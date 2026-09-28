# RBAC Anti-Escalada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que un funcionario pueda obtener, otorgar o degradar privilegios fuera del alcance de su propio rol desde el mantenedor de roles y funcionarios.

**Architecture:** Se agregan reglas puras de privilegios reutilizadas por Server Actions y UI, manteniendo al servidor como autoridad final. Las tres mutaciones sensibles (`guardarFuncionario`, `guardarRol`, `guardarPermisosRol`) pasan a devolver `ResultadoAccion<T>` para errores de negocio visibles, auditan bloqueos con `logSecurity`, y conservan `throw` solo para permisos, Zod y fallos inesperados.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript strict, Prisma + MySQL, Zod, Vitest + Testing Library, Tailwind v3 + shadcn/ui, sonner.

## Global Constraints

- Idioma espanol (UI, comentarios, commits). Indentacion: 4 espacios.
- TypeScript strict; tipos explicitos. `interface` para objetos, `type`/`as const` para uniones.
- Alias `@/` -> `src/`. Imports categorizados con comentarios (`// lib`, `// components`, etc.).
- Server Actions con `'use server'`, validacion Zod y `requirePermiso(...)` como primera linea ejecutable.
- No agregar permisos, migraciones ni cambios de seed.
- Regla base: no otorgar ni editar permisos que el actor no tiene.
- Nombre reservado: `Administrador`, comparado con `trim()` y sin distinguir mayusculas.
- Errores de negocio esperados devuelven `ResultadoAccion<T>`; `requirePermiso`, `ZodError` y fallos de BD siguen lanzando.
- Verificacion final obligatoria: `npm test`, `npx tsc --noEmit`, `npm run lint`.

---

## File Structure

- `src/shared/types/resultado.ts`: tipo compartido `ResultadoAccion<T>`.
- `src/modules/configuracion/utils/privilegios.ts`: reglas puras anti-escalada y mensajes canonicos.
- `src/modules/configuracion/utils/privilegios.test.ts`: matriz TDD de reglas F1-F4, R1-R4, P1-P4.
- `src/modules/configuracion/actions/mantenedores.action.ts`: carga de contexto RBAC, validacion server-side, auditoria de bloqueos y retorno `{ ok }` en las tres mutaciones sensibles.
- `src/modules/configuracion/actions/mantenedores.action.test.ts`: escenarios de escalada y conversion de errores de negocio a `ResultadoAccion`.
- `src/app/(app)/configuracion/usuarios-roles/page.tsx`: entrega `actor` a la vista.
- `src/modules/configuracion/components/UsuariosRolesView.tsx`: UI preventiva, disabled states y manejo de `ResultadoAccion`.
- `src/modules/configuracion/components/UsuariosRolesView.test.tsx`: acciones deshabilitadas y toast en bloqueos.
- `src/modules/configuracion/components/PermisosRolModal.tsx`: permisos no otorgables deshabilitados y contrato `{ ok }`.
- `src/modules/configuracion/components/PermisosRolModal.test.tsx`: checks de permisos actor, rol propio y errores `{ ok: false }`.
- `docs/rbac-permisos.md`: documentacion de anti-escalada y actualizacion de salvaguardas.
- `AGENTS.md`: regla de negocio resumida y referencia al documento RBAC.

---

### Task 1: Tipo Compartido y Reglas Puras de Privilegios

**Files:**
- Create: `src/shared/types/resultado.ts`
- Create: `src/modules/configuracion/utils/privilegios.ts`
- Test: `src/modules/configuracion/utils/privilegios.test.ts`

**Interfaces:**
- Produces: `ResultadoAccion<T> = { ok: true; data: T } | { ok: false; error: string }`.
- Produces: `NOMBRE_ROL_RESERVADO`, `MENSAJES_PRIVILEGIOS`.
- Produces: `esSubconjunto`, `permisosFaltantes`, `esNombreReservado`, `rolTienePermiso`, `quedaAdministrador`.
- Produces: `validarAsignacionRol`, `validarEdicionFuncionario`, `validarEdicionRol`, `validarPermisosRol`.
- Consumes: `Permiso`, `PERMISOS` from `@/config/permisos`.

- [ ] **Step 1: Escribir tests de reglas puras**

Crear `src/modules/configuracion/utils/privilegios.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// config
import { esPermiso, type Permiso } from "@/config/permisos";
// utils
import {
    MENSAJES_PRIVILEGIOS,
    esNombreReservado,
    esSubconjunto,
    permisosFaltantes,
    quedaAdministrador,
    validarAsignacionRol,
    validarEdicionFuncionario,
    validarEdicionRol,
    validarPermisosRol
} from "./privilegios";

function set(permisos: Permiso[]): ReadonlySet<Permiso> {
    return new Set(permisos);
}

const actorBase = set(["config.ver", "config.funcionarios", "config.roles"]);
const rolBase = { id_rol: 2, nombre_rol: "SOME", estado: "Activo", permisos: set(["config.ver", "config.funcionarios"]) };
const rolSuperior = { id_rol: 1, nombre_rol: "Administrador", estado: "Activo", permisos: set(["config.ver", "config.funcionarios", "config.roles", "config.catalogos"]) };

describe("privilegios: helpers", () => {
    it("detecta subconjuntos y permisos faltantes", () => {
        expect(esSubconjunto(["config.ver"], actorBase)).toBe(true);
        expect(esSubconjunto(["config.catalogos"], actorBase)).toBe(false);
        expect(permisosFaltantes(["config.catalogos", "config.roles"], actorBase)).toEqual(["config.catalogos"]);
    });

    it("detecta el nombre reservado con espacios y mayusculas", () => {
        expect(esNombreReservado(" Administrador ")).toBe(true);
        expect(esNombreReservado("ADMINISTRADOR")).toBe(true);
        expect(esNombreReservado("Admin")).toBe(false);
    });
});

describe("privilegios: F1-F4 funcionarios", () => {
    it("F1 permite asignar roles cuyo permiso es subconjunto del actor", () => {
        expect(validarAsignacionRol(actorBase, rolBase)).toBeNull();
    });

    it("F1 bloquea asignar un rol con permisos que el actor no tiene", () => {
        expect(validarAsignacionRol(actorBase, rolSuperior)).toBe("No puedes asignar el rol «Administrador»: incluye permisos que tu rol no tiene");
    });

    it("F2 bloquea editar a un funcionario superior", () => {
        expect(
            validarEdicionFuncionario({
                actorRut: "11.111.111-1",
                actorPermisos: actorBase,
                rolDestino: rolBase,
                funcionarioActual: { rut: "22.222.222-2", rol_id: 1, estado: "Activo", centro_id: "650", rol: rolSuperior },
                data: { rol_id: 2, estado: "Activo", centro_id: "650" },
                quedaAdmin: true
            })
        ).toBe(MENSAJES_PRIVILEGIOS.funcionarioSuperior);
    });

    it("F3 bloquea cambiar rol, estado o centro propio", () => {
        const base = {
            actorRut: "11.111.111-1",
            actorPermisos: actorBase,
            rolDestino: rolBase,
            funcionarioActual: { rut: "11.111.111-1", rol_id: 2, estado: "Activo" as const, centro_id: "650", rol: rolBase },
            quedaAdmin: true
        };

        expect(validarEdicionFuncionario({ ...base, data: { rol_id: 3, estado: "Activo", centro_id: "650" } })).toBe(MENSAJES_PRIVILEGIOS.autoFuncionario);
        expect(validarEdicionFuncionario({ ...base, data: { rol_id: 2, estado: "Inactivo", centro_id: "650" } })).toBe(MENSAJES_PRIVILEGIOS.autoFuncionario);
        expect(validarEdicionFuncionario({ ...base, data: { rol_id: 2, estado: "Activo", centro_id: "700" } })).toBe(MENSAJES_PRIVILEGIOS.autoFuncionario);
    });

    it("F4 bloquea degradar al ultimo administrador activo", () => {
        expect(
            validarEdicionFuncionario({
                actorRut: "99.999.999-9",
                actorPermisos: rolSuperior.permisos,
                rolDestino: rolBase,
                funcionarioActual: { rut: "11.111.111-1", rol_id: 1, estado: "Activo", centro_id: "650", rol: rolSuperior },
                data: { rol_id: 2, estado: "Activo", centro_id: "650" },
                quedaAdmin: false
            })
        ).toBe(MENSAJES_PRIVILEGIOS.ultimoAdministrador);
    });
});

describe("privilegios: R1-R4 roles", () => {
    it("R1 bloquea crear, renombrar a, o renombrar desde el nombre reservado", () => {
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: null, data: { nombre_rol: "Administrador", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.nombreReservado);
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: { ...rolBase, nombre_rol: "Operador" }, data: { nombre_rol: " administrador ", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.nombreReservado);
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: rolSuperior.permisos, rolActual: rolSuperior, data: { nombre_rol: "Admin base", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.nombreReservado);
    });

    it("R2 bloquea renombrar o desactivar el rol propio", () => {
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolBase, data: { nombre_rol: "Nuevo", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.autoRol);
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolBase, data: { nombre_rol: "SOME", estado: "Inactivo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.autoRol);
    });

    it("R3 bloquea editar un rol superior", () => {
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolSuperior, data: { nombre_rol: "Administrador", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.rolSuperior);
    });

    it("R4 bloquea desactivar un rol administrador si no queda otro administrador", () => {
        expect(validarEdicionRol({ actorRolId: 99, actorPermisos: rolSuperior.permisos, rolActual: rolSuperior, data: { nombre_rol: "Administrador", estado: "Inactivo" }, quedaAdmin: false })).toBe(MENSAJES_PRIVILEGIOS.ultimoAdministrador);
    });
});

describe("privilegios: P1-P4 permisos de rol", () => {
    it("P1 bloquea editar permisos de un rol superior", () => {
        expect(validarPermisosRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolSuperior, permisosResultantes: ["config.ver"], quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.rolSuperior);
    });

    it("P2 bloquea otorgar permisos que el actor no tiene con etiquetas", () => {
        expect(validarPermisosRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolBase, permisosResultantes: ["config.ver", "config.catalogos"], quedaAdmin: true })).toBe("No puedes otorgar permisos que tu rol no tiene: Editar catalogos");
    });

    it("P3 bloquea quitar config.roles al rol propio", () => {
        expect(validarPermisosRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolBase, permisosResultantes: ["config.ver"], quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.quitarConfigRolesPropio);
    });

    it("P4 bloquea quitar config.roles al ultimo rol administrador", () => {
        expect(validarPermisosRol({ actorRolId: 99, actorPermisos: rolSuperior.permisos, rolActual: rolSuperior, permisosResultantes: ["config.ver"], quedaAdmin: false })).toBe(MENSAJES_PRIVILEGIOS.ultimoAdministrador);
    });

    it("permite conjuntos iguales: administrador edita administrador sin escalada", () => {
        expect(validarPermisosRol({ actorRolId: 99, actorPermisos: rolSuperior.permisos, rolActual: rolSuperior, permisosResultantes: [...rolSuperior.permisos], quedaAdmin: true })).toBeNull();
    });
});

describe("privilegios: quedaAdministrador", () => {
    it("responde true si queda otro administrador activo fuera del funcionario cambiado", () => {
        expect(quedaAdministrador([{ rut: "1", rol_id: 1 }, { rut: "2", rol_id: 1 }], { tipo: "funcionario", rut: "1" })).toBe(true);
    });

    it("responde false si el cambio afecta al unico administrador activo", () => {
        expect(quedaAdministrador([{ rut: "1", rol_id: 1 }], { tipo: "funcionario", rut: "1" })).toBe(false);
        expect(quedaAdministrador([{ rut: "1", rol_id: 1 }, { rut: "2", rol_id: 1 }], { tipo: "rol", rol_id: 1 })).toBe(false);
    });
});
```

- [ ] **Step 2: Ejecutar test y confirmar rojo**

Run: `npm test -- src/modules/configuracion/utils/privilegios.test.ts`

Expected: FAIL porque `src/modules/configuracion/utils/privilegios.ts` no existe.

- [ ] **Step 3: Crear tipo compartido `ResultadoAccion`**

Crear `src/shared/types/resultado.ts`:

```ts
export type ResultadoAccion<T> = { ok: true; data: T } | { ok: false; error: string };
```

- [ ] **Step 4: Crear modulo de reglas puras**

Crear `src/modules/configuracion/utils/privilegios.ts`:

```ts
// config
import { PERMISOS, type Permiso } from "@/config/permisos";

export const NOMBRE_ROL_RESERVADO = "Administrador";

export const MENSAJES_PRIVILEGIOS = {
    funcionarioSuperior: "No puedes editar a un funcionario con mas privilegios que tu",
    autoFuncionario: "No puedes cambiar tu propio rol, estado o centro",
    autoRol: "No puedes renombrar ni desactivar tu propio rol",
    rolSuperior: "No puedes editar un rol con mas privilegios que el tuyo",
    nombreReservado: "El nombre «Administrador» esta reservado",
    quitarConfigRolesPropio: "No puedes quitar el permiso de editar roles a tu propio rol",
    ultimoAdministrador: "Debe quedar al menos un administrador activo"
} as const;

export interface RolEvaluado {
    id_rol: number;
    nombre_rol: string;
    estado: string;
    permisos: ReadonlySet<Permiso>;
}

export interface FuncionarioEvaluado {
    rut: string;
    rol_id: number;
    estado: string;
    centro_id: string | null;
    rol: RolEvaluado;
}

export interface AdminEvaluado {
    rut: string;
    rol_id: number;
}

export type CambioAdmin = { tipo: "funcionario"; rut: string } | { tipo: "rol"; rol_id: number };

export interface EdicionFuncionarioCtx {
    actorRut: string;
    actorPermisos: ReadonlySet<Permiso>;
    funcionarioActual: FuncionarioEvaluado | null;
    rolDestino: RolEvaluado;
    data: { rol_id: number; estado: string; centro_id: string | null };
    quedaAdmin: boolean;
}

export interface EdicionRolCtx {
    actorRolId: number;
    actorPermisos: ReadonlySet<Permiso>;
    rolActual: RolEvaluado | null;
    data: { nombre_rol: string; estado: string };
    quedaAdmin: boolean;
}

export interface PermisosRolCtx {
    actorRolId: number;
    actorPermisos: ReadonlySet<Permiso>;
    rolActual: RolEvaluado;
    permisosResultantes: Permiso[];
    quedaAdmin: boolean;
}

export function esSubconjunto(permisos: Iterable<Permiso>, de: ReadonlySet<Permiso>): boolean {
    for (const permiso of permisos) {
        if (!de.has(permiso)) return false;
    }
    return true;
}

export function permisosFaltantes(permisos: Iterable<Permiso>, de: ReadonlySet<Permiso>): Permiso[] {
    return [...permisos].filter((permiso) => !de.has(permiso));
}

export function esNombreReservado(nombre: string): boolean {
    return nombre.trim().toLocaleLowerCase("es-CL") === NOMBRE_ROL_RESERVADO.toLocaleLowerCase("es-CL");
}

export function rolTienePermiso(rol: RolEvaluado | null, permiso: Permiso): boolean {
    return Boolean(rol?.permisos.has(permiso));
}

export function quedaAdministrador(admins: AdminEvaluado[], cambio: CambioAdmin): boolean {
    return admins.some((admin) => {
        if (cambio.tipo === "funcionario") return admin.rut !== cambio.rut;
        return admin.rol_id !== cambio.rol_id;
    });
}

export function validarAsignacionRol(actor: ReadonlySet<Permiso>, rolDestino: RolEvaluado): string | null {
    if (!esSubconjunto(rolDestino.permisos, actor)) {
        return `No puedes asignar el rol «${rolDestino.nombre_rol}»: incluye permisos que tu rol no tiene`;
    }
    return null;
}

export function validarEdicionFuncionario(ctx: EdicionFuncionarioCtx): string | null {
    if (!ctx.funcionarioActual) return null;

    if (!esSubconjunto(ctx.funcionarioActual.rol.permisos, ctx.actorPermisos)) {
        return MENSAJES_PRIVILEGIOS.funcionarioSuperior;
    }

    if (
        ctx.funcionarioActual.rut === ctx.actorRut &&
        (ctx.funcionarioActual.rol_id !== ctx.data.rol_id ||
            ctx.funcionarioActual.estado !== ctx.data.estado ||
            (ctx.funcionarioActual.centro_id ?? "") !== (ctx.data.centro_id ?? ""))
    ) {
        return MENSAJES_PRIVILEGIOS.autoFuncionario;
    }

    const eraAdmin = ctx.funcionarioActual.estado === "Activo" && ctx.funcionarioActual.rol.estado === "Activo" && ctx.funcionarioActual.rol.permisos.has("config.roles");
    const sigueAdmin = ctx.data.estado === "Activo" && ctx.rolDestino.estado === "Activo" && ctx.rolDestino.permisos.has("config.roles");

    if (eraAdmin && !sigueAdmin && !ctx.quedaAdmin) {
        return MENSAJES_PRIVILEGIOS.ultimoAdministrador;
    }

    return null;
}

export function validarEdicionRol(ctx: EdicionRolCtx): string | null {
    const nombreActualReservado = ctx.rolActual ? esNombreReservado(ctx.rolActual.nombre_rol) : false;
    const nombreNuevoReservado = esNombreReservado(ctx.data.nombre_rol);
    const renombra = ctx.rolActual ? ctx.rolActual.nombre_rol.trim() !== ctx.data.nombre_rol.trim() : false;
    if ((!ctx.rolActual && nombreNuevoReservado) || (ctx.rolActual && renombra && (nombreActualReservado || nombreNuevoReservado))) {
        return MENSAJES_PRIVILEGIOS.nombreReservado;
    }

    if (!ctx.rolActual) return null;

    if (ctx.rolActual.id_rol === ctx.actorRolId && (ctx.rolActual.nombre_rol !== ctx.data.nombre_rol || ctx.rolActual.estado !== ctx.data.estado)) {
        return MENSAJES_PRIVILEGIOS.autoRol;
    }

    if (!esSubconjunto(ctx.rolActual.permisos, ctx.actorPermisos)) {
        return MENSAJES_PRIVILEGIOS.rolSuperior;
    }

    if (ctx.rolActual.estado === "Activo" && ctx.rolActual.permisos.has("config.roles") && ctx.data.estado !== "Activo" && !ctx.quedaAdmin) {
        return MENSAJES_PRIVILEGIOS.ultimoAdministrador;
    }

    return null;
}

export function validarPermisosRol(ctx: PermisosRolCtx): string | null {
    if (!esSubconjunto(ctx.rolActual.permisos, ctx.actorPermisos)) {
        return MENSAJES_PRIVILEGIOS.rolSuperior;
    }

    const faltantes = permisosFaltantes(ctx.permisosResultantes, ctx.actorPermisos);
    if (faltantes.length > 0) {
        const etiquetas = faltantes.map((permiso) => PERMISOS[permiso].etiqueta).join(", ");
        return `No puedes otorgar permisos que tu rol no tiene: ${etiquetas}`;
    }

    if (ctx.rolActual.id_rol === ctx.actorRolId && !ctx.permisosResultantes.includes("config.roles")) {
        return MENSAJES_PRIVILEGIOS.quitarConfigRolesPropio;
    }

    if (ctx.rolActual.permisos.has("config.roles") && !ctx.permisosResultantes.includes("config.roles") && !ctx.quedaAdmin) {
        return MENSAJES_PRIVILEGIOS.ultimoAdministrador;
    }

    return null;
}
```

- [ ] **Step 5: Ejecutar tests de reglas**

Run: `npm test -- src/modules/configuracion/utils/privilegios.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types/resultado.ts src/modules/configuracion/utils/privilegios.ts src/modules/configuracion/utils/privilegios.test.ts
git commit -m "feat(configuracion): reglas puras anti escalada rbac"
```

---

### Task 2: Backend `guardarRol` y `guardarPermisosRol` Seguro

**Files:**
- Modify: `src/modules/configuracion/actions/mantenedores.action.ts`
- Test: `src/modules/configuracion/actions/mantenedores.action.test.ts`

**Interfaces:**
- Consumes: `ResultadoAccion<T>`, `validarEdicionRol`, `validarPermisosRol`, `quedaAdministrador`.
- Produces: `guardarRol(input): Promise<ResultadoAccion<Role>>`.
- Produces: `guardarPermisosRol(input): Promise<ResultadoAccion<{ id_rol: number; permisos: Permiso[] }>>`.
- Business errors return `{ ok: false, error }`; `requirePermiso` and Zod still throw.

- [ ] **Step 1: Agregar mocks e imports de pruebas**

En `src/modules/configuracion/actions/mantenedores.action.test.ts`, actualizar los mocks existentes:

```ts
vi.mock("@/shared/lib/permisos", () => ({
    requirePermiso: vi.fn(),
    getPermisosRol: vi.fn()
}));

vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: {
        logDataAccess: vi.fn(),
        logSecurity: vi.fn()
    }
}));
```

Agregar imports:

```ts
import { getPermisosRol, requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
```

En `beforeEach`, configurar el actor administrador por defecto:

```ts
(requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue({
    rut: "11.111.111-1",
    email: "admin@demo.local",
    nombre: "Admin",
    centro_id: "650",
    rol: { id: 1, nombre: "Administrador" }
});
(getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.funcionarios", "config.roles", "config.catalogos"]));
```

- [ ] **Step 2: Escribir tests rojos para roles y permisos**

Agregar casos en `mantenedores.action.test.ts`:

```ts
describe("anti escalada en roles", () => {
    it("bloquea crear o renombrar un rol a Administrador", async () => {
        prisma.role.findFirst.mockResolvedValue(null);
        const result = await guardarRol({ nombre_rol: " administrador ", estado: "Activo" });

        expect(result).toEqual({ ok: false, error: "El nombre «Administrador» esta reservado" });
        expect(prisma.role.create).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).toHaveBeenCalledWith("CREATE", false, { rut: "11.111.111-1", name: "Admin" }, expect.objectContaining({
            resourceId: "rol:nuevo",
            error: "El nombre «Administrador» esta reservado"
        }));
    });

    it("bloquea editar un rol con permisos superiores al actor", async () => {
        (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.roles"]));
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.ver" }, { permiso: "config.roles" }, { permiso: "config.funcionarios" }]
        });
        prisma.role.findFirst.mockResolvedValue(null);

        const result = await guardarRol({ id_rol: 1, nombre_rol: "Administrador", estado: "Activo" });

        expect(result).toEqual({ ok: false, error: "No puedes editar un rol con mas privilegios que el tuyo" });
        expect(prisma.role.update).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).toHaveBeenCalled();
    });

    it("bloquea desactivar el ultimo rol administrador", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }]
        });
        prisma.role.findFirst.mockResolvedValue(null);
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11.111.111-1", rol_id: 1 }]);

        const result = await guardarRol({ id_rol: 1, nombre_rol: "Administrador", estado: "Inactivo" });

        expect(result).toEqual({ ok: false, error: "Debe quedar al menos un administrador activo" });
        expect(prisma.role.update).not.toHaveBeenCalled();
    });
});

describe("anti escalada en permisos de rol", () => {
    it("bloquea otorgar permisos que el actor no tiene", async () => {
        (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.roles"]));
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 3,
            nombre_rol: "SOME",
            estado: "Activo",
            permisos: [{ permiso: "config.ver" }]
        });

        const result = await guardarPermisosRol({ rol_id: 3, permisos: ["config.ver", "config.funcionarios"] });

        expect(result).toEqual({ ok: false, error: "No puedes otorgar permisos que tu rol no tiene: Editar funcionarios" });
        expect(prisma.rolPermiso.deleteMany).not.toHaveBeenCalled();
        expect(prisma.rolPermiso.createMany).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).toHaveBeenCalledWith("UPDATE", false, { rut: "11.111.111-1", name: "Admin" }, expect.objectContaining({
            resourceId: "rol:3",
            error: "No puedes otorgar permisos que tu rol no tiene: Editar funcionarios"
        }));
    });

    it("bloquea quitar config.roles al ultimo administrador", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }]
        });
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11.111.111-1", rol_id: 1 }]);

        const result = await guardarPermisosRol({ rol_id: 1, permisos: ["config.ver"] });

        expect(result).toEqual({ ok: false, error: "Debe quedar al menos un administrador activo" });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("mantiene ZodError para permisos inventados", async () => {
        await expect(guardarPermisosRol({ rol_id: 3, permisos: ["inventado"] })).rejects.toThrow();
    });
});
```

- [ ] **Step 3: Ejecutar tests y confirmar rojo**

Run: `npm test -- src/modules/configuracion/actions/mantenedores.action.test.ts`

Expected: FAIL porque las actions aun lanzan o escriben sin reglas anti-escalada.

- [ ] **Step 4: Agregar imports y helpers RBAC en la action**

En `src/modules/configuracion/actions/mantenedores.action.ts`, agregar:

```ts
import type { Role } from "@prisma/client";
// lib
import { getPermisosRol, requirePermiso } from "@/shared/lib/permisos";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
import type { Permiso } from "@/config/permisos";
// utils
import {
    quedaAdministrador,
    validarEdicionRol,
    validarPermisosRol,
    type AdminEvaluado,
    type RolEvaluado
} from "../utils/privilegios";
```

Mantener un solo import de `requirePermiso`; no duplicarlo.

Agregar helpers bajo `searchContains`:

```ts
function permisosValidos(filas: { permiso: string }[]): Set<Permiso> {
    return new Set(filas.map((fila) => fila.permiso).filter(esPermiso));
}

function rolEvaluado(rol: { id_rol: number; nombre_rol: string; estado: string; permisos: { permiso: string }[] }): RolEvaluado {
    return {
        id_rol: rol.id_rol,
        nombre_rol: rol.nombre_rol,
        estado: rol.estado,
        permisos: permisosValidos(rol.permisos)
    };
}

async function adminsActivos(): Promise<AdminEvaluado[]> {
    const funcionarios = await prisma.funcionario.findMany({
        where: {
            estado: "Activo",
            role: { estado: "Activo", permisos: { some: { permiso: "config.roles" } } }
        },
        select: { rut: true, rol_id: true }
    });
    return funcionarios;
}

async function logBloqueo(accion: "CREATE" | "UPDATE", user: { rut: string; nombre: string }, resourceId: string, regla: string, error: string) {
    await AuditLogger.logSecurity(accion, false, { rut: user.rut, name: user.nombre }, { resourceId, details: regla, error });
}
```

Tambien agregar `esPermiso` al import de permisos:

```ts
import { CLAVES_PERMISOS, esPermiso, type Permiso } from "@/config/permisos";
```

- [ ] **Step 5: Convertir `guardarRol`**

Reemplazar `guardarRol` por:

```ts
export async function guardarRol(input: RolConfigInput): Promise<ResultadoAccion<Role>> {
    const user = await requirePermiso("config.roles");
    const data = rolConfigSchema.parse(input);
    const accion = data.id_rol ? "UPDATE" : "CREATE";
    const actorPermisos = await getPermisosRol(user.rol.id);

    const [duplicated, rolActual] = await Promise.all([
        prisma.role.findFirst({
            where: { nombre_rol: data.nombre_rol, ...(data.id_rol ? { NOT: { id_rol: data.id_rol } } : {}) },
            select: { id_rol: true }
        }),
        data.id_rol
            ? prisma.role.findUnique({
                  where: { id_rol: data.id_rol },
                  include: { permisos: { select: { permiso: true } } }
              })
            : Promise.resolve(null)
    ]);

    if (duplicated) return { ok: false, error: "Ya existe un rol con ese nombre" };
    if (data.id_rol && !rolActual) return { ok: false, error: "Rol no existe" };

    const requiereAdmins = Boolean(rolActual && rolActual.estado === "Activo" && data.estado !== "Activo" && permisosValidos(rolActual.permisos).has("config.roles"));
    const admins = requiereAdmins ? await adminsActivos() : [];
    const error = validarEdicionRol({
        actorRolId: user.rol.id,
        actorPermisos,
        rolActual: rolActual ? rolEvaluado(rolActual) : null,
        data: { nombre_rol: data.nombre_rol, estado: data.estado },
        quedaAdmin: !requiereAdmins || quedaAdministrador(admins, { tipo: "rol", rol_id: data.id_rol ?? 0 })
    });

    if (error) {
        await logBloqueo(accion, user, data.id_rol ? `rol:${data.id_rol}` : "rol:nuevo", `regla=guardarRol rol=${data.id_rol ?? "nuevo"}`, error);
        return { ok: false, error };
    }

    const saved = data.id_rol
        ? await prisma.role.update({ where: { id_rol: data.id_rol }, data: { nombre_rol: data.nombre_rol, estado: data.estado } })
        : await prisma.role.create({ data: { nombre_rol: data.nombre_rol, estado: data.estado } });

    const details = rolActual
        ? `Rol guardado: nombre_rol ${rolActual.nombre_rol}->${saved.nombre_rol} estado ${rolActual.estado}->${saved.estado}`
        : `Rol creado: nombre_rol ${saved.nombre_rol} estado ${saved.estado}`;
    await AuditLogger.logDataAccess(accion, true, { rut: user.rut, name: user.nombre }, `rol:${saved.id_rol}`, { details });
    return { ok: true, data: saved };
}
```

- [ ] **Step 6: Convertir `guardarPermisosRol`**

Reemplazar `guardarPermisosRol` por:

```ts
export async function guardarPermisosRol(input: PermisosRolInput): Promise<ResultadoAccion<{ id_rol: number; permisos: Permiso[] }>> {
    const user = await requirePermiso("config.roles");
    const data = permisosRolSchema.parse(input);
    const permisos = CLAVES_PERMISOS.filter((clave) => data.permisos.includes(clave));
    const actorPermisos = await getPermisosRol(user.rol.id);

    const rolActual = await prisma.role.findUnique({
        where: { id_rol: data.rol_id },
        include: { permisos: { select: { permiso: true } } }
    });
    if (!rolActual) return { ok: false, error: "Rol no existe" };

    const rol = rolEvaluado(rolActual);
    const requiereAdmins = rol.permisos.has("config.roles") && !permisos.includes("config.roles");
    const admins = requiereAdmins ? await adminsActivos() : [];
    const error = validarPermisosRol({
        actorRolId: user.rol.id,
        actorPermisos,
        rolActual: rol,
        permisosResultantes: permisos,
        quedaAdmin: !requiereAdmins || quedaAdministrador(admins, { tipo: "rol", rol_id: data.rol_id })
    });

    if (error) {
        await logBloqueo("UPDATE", user, `rol:${data.rol_id}`, `regla=guardarPermisosRol rol=${data.rol_id}`, error);
        return { ok: false, error };
    }

    const previos = rol.permisos;
    await prisma.$transaction([
        prisma.rolPermiso.deleteMany({ where: { rol_id: data.rol_id } }),
        prisma.rolPermiso.createMany({ data: permisos.map((permiso) => ({ rol_id: data.rol_id, permiso })) })
    ]);

    await AuditLogger.logDataAccess("UPDATE", true, { rut: user.rut, name: user.nombre }, `rol:${data.rol_id}`, {
        details: `Permisos de rol actualizados: antes=[${[...previos].join(",")}] despues=[${permisos.join(",")}]`
    });

    return { ok: true, data: { id_rol: data.rol_id, permisos } };
}
```

- [ ] **Step 7: Ejecutar tests de actions**

Run: `npm test -- src/modules/configuracion/actions/mantenedores.action.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/configuracion/actions/mantenedores.action.ts src/modules/configuracion/actions/mantenedores.action.test.ts
git commit -m "feat(configuracion): proteger roles y permisos contra escalada"
```

---

### Task 3: Backend `guardarFuncionario` Seguro

**Files:**
- Modify: `src/modules/configuracion/actions/mantenedores.action.ts`
- Test: `src/modules/configuracion/actions/mantenedores.action.test.ts`

**Interfaces:**
- Consumes: `validarAsignacionRol`, `validarEdicionFuncionario`, `quedaAdministrador`.
- Produces: `guardarFuncionario(input): Promise<ResultadoAccion<Funcionario>>`.
- Business errors for rol inexistente, centro inexistente and email duplicado return `{ ok: false, error }`.

- [ ] **Step 1: Escribir tests rojos de escalada por funcionario**

Agregar casos en `mantenedores.action.test.ts`:

```ts
describe("anti escalada en funcionarios", () => {
    it("bloquea que un SOME se asigne Administrador a si mismo", async () => {
        (requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue({
            rut: "22.222.222-2",
            email: "some@demo.local",
            nombre: "Some",
            centro_id: "650",
            rol: { id: 2, nombre: "SOME" }
        });
        (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.funcionarios"]));
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "650" });
        prisma.funcionario.findUnique.mockResolvedValue({
            rut: "22.222.222-2",
            rol_id: 2,
            estado: "Activo",
            centro_id: "650",
            role: {
                id_rol: 2,
                nombre_rol: "SOME",
                estado: "Activo",
                permisos: [{ permiso: "config.funcionarios" }]
            }
        });
        prisma.funcionario.findFirst.mockResolvedValue(null);

        const result = await guardarFuncionario({
            rut: "22.222.222-2",
            email: "some@demo.local",
            nombre: "Some",
            rol_id: 1,
            centro_id: "650",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "No puedes asignar el rol «Administrador»: incluye permisos que tu rol no tiene" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).toHaveBeenCalled();
    });

    it("bloquea editar a un funcionario con mas privilegios", async () => {
        (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.funcionarios"]));
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 2,
            nombre_rol: "SOME",
            estado: "Activo",
            permisos: [{ permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "650" });
        prisma.funcionario.findUnique.mockResolvedValue({
            rut: "33.333.333-3",
            rol_id: 1,
            estado: "Activo",
            centro_id: "650",
            role: {
                id_rol: 1,
                nombre_rol: "Administrador",
                estado: "Activo",
                permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
            }
        });
        prisma.funcionario.findFirst.mockResolvedValue(null);

        const result = await guardarFuncionario({
            rut: "33.333.333-3",
            email: "admin@demo.local",
            nombre: "Admin",
            rol_id: 2,
            centro_id: "650",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "No puedes editar a un funcionario con mas privilegios que tu" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });

    it("bloquea cambiar estado o centro propio", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "700" });
        prisma.funcionario.findUnique.mockResolvedValue({
            rut: "11.111.111-1",
            rol_id: 1,
            estado: "Activo",
            centro_id: "650",
            role: {
                id_rol: 1,
                nombre_rol: "Administrador",
                estado: "Activo",
                permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
            }
        });
        prisma.funcionario.findFirst.mockResolvedValue(null);

        const result = await guardarFuncionario({
            rut: "11.111.111-1",
            email: "admin@demo.local",
            nombre: "Admin",
            rol_id: 1,
            centro_id: "700",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "No puedes cambiar tu propio rol, estado o centro" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });

    it("bloquea dejar el sistema sin administradores activos", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 2,
            nombre_rol: "SOME",
            estado: "Activo",
            permisos: [{ permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "650" });
        prisma.funcionario.findUnique.mockResolvedValue({
            rut: "11.111.111-1",
            rol_id: 1,
            estado: "Activo",
            centro_id: "650",
            role: {
                id_rol: 1,
                nombre_rol: "Administrador",
                estado: "Activo",
                permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
            }
        });
        prisma.funcionario.findFirst.mockResolvedValue(null);
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11.111.111-1", rol_id: 1 }]);

        const result = await guardarFuncionario({
            rut: "11.111.111-1",
            email: "admin@demo.local",
            nombre: "Admin",
            rol_id: 2,
            centro_id: "650",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "Debe quedar al menos un administrador activo" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });
});
```

Actualizar tests existentes de errores de negocio:

```ts
await expect(guardarFuncionario(input)).resolves.toEqual({ ok: false, error: "Rol no existe" });
await expect(guardarFuncionario(input)).resolves.toEqual({ ok: false, error: "Centro no existe" });
await expect(guardarFuncionario(input)).resolves.toEqual({ ok: false, error: "Ya existe un funcionario con ese email" });
```

Mantener `rejects.toThrow` para RUT invalido y fallos de conexion.

- [ ] **Step 2: Ejecutar tests y confirmar rojo**

Run: `npm test -- src/modules/configuracion/actions/mantenedores.action.test.ts`

Expected: FAIL porque `guardarFuncionario` aun escribe sin reglas y devuelve entidad directa.

- [ ] **Step 3: Agregar imports faltantes**

En `mantenedores.action.ts`, agregar:

```ts
import type { Funcionario, Role } from "@prisma/client";
```

Y extender imports de utilidades:

```ts
import {
    quedaAdministrador,
    validarAsignacionRol,
    validarEdicionFuncionario,
    validarEdicionRol,
    validarPermisosRol,
    type AdminEvaluado,
    type RolEvaluado
} from "../utils/privilegios";
```

- [ ] **Step 4: Convertir `guardarFuncionario`**

Reemplazar `guardarFuncionario` por:

```ts
export async function guardarFuncionario(input: FuncionarioConfigInput): Promise<ResultadoAccion<Funcionario>> {
    const user = await requirePermiso("config.funcionarios");
    const data = funcionarioConfigSchema.parse(input);
    const actorPermisos = await getPermisosRol(user.rol.id);
    const [rolDestino, centro, funcionarioActual, emailDuplicado] = await Promise.all([
        prisma.role.findUnique({
            where: { id_rol: data.rol_id },
            include: { permisos: { select: { permiso: true } } }
        }),
        prisma.centro.findUnique({ where: { id_centro: data.centro_id }, select: { id_centro: true } }),
        prisma.funcionario.findUnique({
            where: { rut: data.rut },
            select: {
                rut: true,
                rol_id: true,
                estado: true,
                centro_id: true,
                role: {
                    select: {
                        id_rol: true,
                        nombre_rol: true,
                        estado: true,
                        permisos: { select: { permiso: true } }
                    }
                }
            }
        }),
        prisma.funcionario.findFirst({ where: { email: data.email, NOT: { rut: data.rut } }, select: { rut: true } })
    ]);

    if (!rolDestino) return { ok: false, error: "Rol no existe" };
    if (!centro) return { ok: false, error: "Centro no existe" };
    if (emailDuplicado) return { ok: false, error: "Ya existe un funcionario con ese email" };

    const rolDestinoEvaluado = rolEvaluado(rolDestino);
    const errorAsignacion = validarAsignacionRol(actorPermisos, rolDestinoEvaluado);
    if (errorAsignacion) {
        await logBloqueo(funcionarioActual ? "UPDATE" : "CREATE", user, `funcionario:${data.rut}`, `regla=F1 rol_destino=${data.rol_id}`, errorAsignacion);
        return { ok: false, error: errorAsignacion };
    }

    const requiereAdmins = Boolean(
        funcionarioActual &&
            funcionarioActual.estado === "Activo" &&
            funcionarioActual.role.estado === "Activo" &&
            permisosValidos(funcionarioActual.role.permisos).has("config.roles") &&
            (data.estado !== "Activo" || data.rol_id !== funcionarioActual.rol_id)
    );
    const admins = requiereAdmins ? await adminsActivos() : [];
    const errorEdicion = validarEdicionFuncionario({
        actorRut: user.rut,
        actorPermisos,
        rolDestino: rolDestinoEvaluado,
        funcionarioActual: funcionarioActual
            ? {
                  rut: funcionarioActual.rut,
                  rol_id: funcionarioActual.rol_id,
                  estado: funcionarioActual.estado,
                  centro_id: funcionarioActual.centro_id,
                  rol: rolEvaluado(funcionarioActual.role)
              }
            : null,
        data: { rol_id: data.rol_id, estado: data.estado, centro_id: data.centro_id },
        quedaAdmin: !requiereAdmins || quedaAdministrador(admins, { tipo: "funcionario", rut: data.rut })
    });

    if (errorEdicion) {
        await logBloqueo(funcionarioActual ? "UPDATE" : "CREATE", user, `funcionario:${data.rut}`, `regla=guardarFuncionario rut=${data.rut}`, errorEdicion);
        return { ok: false, error: errorEdicion };
    }

    const payload = {
        email: data.email,
        nombre: data.nombre,
        rol_id: data.rol_id,
        centro_id: data.centro_id,
        programa_asociado: data.programa_asociado,
        estado: data.estado
    };

    const saved = funcionarioActual
        ? await prisma.funcionario.update({ where: { rut: data.rut }, data: payload })
        : await prisma.funcionario.create({ data: { rut: data.rut, ...payload } });

    const details = funcionarioActual
        ? `Funcionario guardado: rol_id ${funcionarioActual.rol_id}->${saved.rol_id} estado ${funcionarioActual.estado}->${saved.estado} centro ${funcionarioActual.centro_id ?? "-"}->${saved.centro_id ?? "-"}`
        : `Funcionario creado: rol_id ${saved.rol_id} estado ${saved.estado} centro ${saved.centro_id ?? "-"}`;
    await AuditLogger.logDataAccess(funcionarioActual ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `funcionario:${saved.rut}`, { details });
    return { ok: true, data: saved };
}
```

- [ ] **Step 5: Ejecutar tests de actions**

Run: `npm test -- src/modules/configuracion/actions/mantenedores.action.test.ts`

Expected: PASS.

- [ ] **Step 6: Ejecutar inventario estructural**

Run: `npm test -- src/modules/permisos-por-action.test.ts`

Expected: PASS, sin cambios de permisos ni actions nuevas.

- [ ] **Step 7: Commit**

```bash
git add src/modules/configuracion/actions/mantenedores.action.ts src/modules/configuracion/actions/mantenedores.action.test.ts
git commit -m "feat(configuracion): proteger funcionarios contra escalada"
```

---

### Task 4: UI Preventiva en Usuarios y Roles

**Files:**
- Modify: `src/app/(app)/configuracion/usuarios-roles/page.tsx`
- Modify: `src/modules/configuracion/components/UsuariosRolesView.tsx`
- Modify: `src/modules/configuracion/components/PermisosRolModal.tsx`
- Test: `src/modules/configuracion/components/UsuariosRolesView.test.tsx`
- Test: `src/modules/configuracion/components/PermisosRolModal.test.tsx`

**Interfaces:**
- Consumes: rules from `privilegios.ts`.
- Produces: `UsuariosRolesView({ permisos, actor })`.
- Produces: `PermisosRolModal({ rol, permisosActor, esRolPropio, onClose, onSaved })`.
- `actor = { rut: string; rolId: number }`.

- [ ] **Step 1: Escribir tests rojos del modal de permisos**

En `PermisosRolModal.test.tsx`, actualizar `renderModal`:

```tsx
function renderModal(props: Partial<React.ComponentProps<typeof PermisosRolModal>> = {}) {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(
        <PermisosRolModal
            rol={rol}
            permisosActor={["solicitudes.ver", "comunicador.ver", "config.roles"]}
            esRolPropio={false}
            onClose={onClose}
            onSaved={onSaved}
            {...props}
        />
    );
    return { onClose, onSaved };
}
```

Cambiar mocks de exito a:

```ts
(guardarPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: { id_rol: 3, permisos: ["comunicador.ver"] } });
```

Agregar tests:

```tsx
it("deshabilita permisos que el actor no tiene", () => {
    renderModal({ permisosActor: ["solicitudes.ver", "comunicador.ver"] });

    const editarRoles = screen.getByLabelText("Editar roles y permisos") as HTMLInputElement;
    expect(editarRoles).toBeDisabled();
    expect(editarRoles).toHaveAttribute("title", "Tu rol no tiene este permiso");
});

it("deshabilita config.roles en el rol propio", () => {
    renderModal({ esRolPropio: true });

    const editarRoles = screen.getByLabelText("Editar roles y permisos") as HTMLInputElement;
    expect(editarRoles).toBeDisabled();
    expect(editarRoles).toHaveAttribute("title", "No puedes quitar el permiso de editar roles a tu propio rol");
});

it("muestra toast de negocio cuando la action retorna ok false", async () => {
    (guardarPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "No puedes otorgar permisos que tu rol no tiene: Editar funcionarios" });
    const { onSaved } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No puedes otorgar permisos que tu rol no tiene: Editar funcionarios"));
    expect(onSaved).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Escribir tests rojos de `UsuariosRolesView`**

En `UsuariosRolesView.test.tsx`, renderizar siempre con actor:

```tsx
render(<UsuariosRolesView permisos={["config.ver", "config.roles", "config.funcionarios"]} actor={{ rut: "11.111.111-1", rolId: 2 }} />);
```

Agregar datos base con roles que incluyan permisos:

```ts
const rolSome = { id_rol: 2, nombre_rol: "SOME", estado: "Activo", permisos: [{ permiso: "config.ver" }, { permiso: "config.funcionarios" }] };
const rolAdmin = { id_rol: 1, nombre_rol: "Administrador", estado: "Activo", permisos: [{ permiso: "config.ver" }, { permiso: "config.funcionarios" }, { permiso: "config.roles" }] };
```

Agregar tests:

```tsx
it("deshabilita editar y activar/desactivar funcionarios superiores", async () => {
    render(<UsuariosRolesView permisos={["config.ver", "config.funcionarios"]} actor={{ rut: "22.222.222-2", rolId: 2 }} />);

    await screen.findByText("Administrador");
    const filaAdmin = screen.getByText("admin@demo.local").closest("tr") as HTMLElement;

    expect(within(filaAdmin).getByRole("button", { name: "Editar" })).toBeDisabled();
    expect(within(filaAdmin).getByRole("button", { name: "Desactivar" })).toBeDisabled();
});

it("en edicion propia deshabilita rol, centro y estado con aviso", async () => {
    render(<UsuariosRolesView permisos={["config.ver", "config.funcionarios"]} actor={{ rut: "22.222.222-2", rolId: 2 }} />);

    await screen.findByText("some@demo.local");
    const filaPropia = screen.getByText("some@demo.local").closest("tr") as HTMLElement;
    fireEvent.click(within(filaPropia).getByRole("button", { name: "Editar" }));

    expect(screen.getByText("No puedes cambiar tu propio rol, estado o centro")).toBeInTheDocument();
    expect(screen.getByLabelText("Rol")).toBeDisabled();
    expect(screen.getByLabelText("Centro")).toBeDisabled();
    expect(screen.getByLabelText("Estado")).toBeDisabled();
});

it("muestra toast y no recarga cuando guardarRol retorna ok false", async () => {
    (guardarRol as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "El nombre «Administrador» esta reservado" });
    render(<UsuariosRolesView permisos={["config.ver", "config.roles"]} actor={{ rut: "11.111.111-1", rolId: 2 }} />);

    await screen.findByText("Roles");
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.change(screen.getByLabelText("Nombre rol"), { target: { value: "Administrador" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El nombre «Administrador» esta reservado"));
});
```

- [ ] **Step 3: Ejecutar tests UI y confirmar rojo**

Run: `npm test -- src/modules/configuracion/components/PermisosRolModal.test.tsx src/modules/configuracion/components/UsuariosRolesView.test.tsx`

Expected: FAIL por props faltantes, disabled states inexistentes y contrato anterior.

- [ ] **Step 4: Pasar actor desde pagina server**

Modificar `src/app/(app)/configuracion/usuarios-roles/page.tsx`:

```tsx
export default async function UsuariosRolesPage() {
    await requirePermisoPagina("config.ver");
    const contexto = await getSessionPermisos();
    return (
        <UsuariosRolesView
            permisos={contexto ? [...contexto.permisos] : []}
            actor={contexto ? { rut: contexto.user.rut, rolId: contexto.user.rol.id } : null}
        />
    );
}
```

- [ ] **Step 5: Actualizar props y helpers de `UsuariosRolesView`**

En `UsuariosRolesView.tsx`, agregar imports:

```tsx
// utils
import { esNombreReservado, esSubconjunto } from "@/modules/configuracion/utils/privilegios";
```

Cambiar firma:

```tsx
export interface ActorConfig {
    rut: string;
    rolId: number;
}

export function UsuariosRolesView({ permisos, actor }: { permisos: Permiso[]; actor: ActorConfig | null }) {
```

Agregar helpers dentro del componente:

```tsx
const permisosActor = useMemo(() => new Set(permisos), [permisos]);

function rolPorId(rolId: number) {
    return data.roles.find((rol) => rol.id_rol === rolId);
}

function permisosRol(rolId: number): Permiso[] {
    return rolPorId(rolId)?.permisos.map((fila) => fila.permiso).filter(esPermiso) ?? [];
}

function esRolSuperior(rolId: number): boolean {
    return !esSubconjunto(permisosRol(rolId), permisosActor);
}

function motivoRolSuperior(rolId: number): string | undefined {
    return esRolSuperior(rolId) ? "Tiene privilegios que tu rol no posee" : undefined;
}
```

- [ ] **Step 6: Actualizar `RowActions`**

Reemplazar `RowActions`:

```tsx
function RowActions({
    active,
    onEdit,
    onToggle,
    editDisabled = false,
    toggleDisabled = false,
    title
}: {
    active: boolean;
    onEdit: () => void;
    onToggle: () => void;
    editDisabled?: boolean;
    toggleDisabled?: boolean;
    title?: string;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={editDisabled} title={editDisabled ? title : undefined}>
                <Edit size={14} />
                Editar
            </Button>
            <Button type="button" variant={active ? "secondary" : "default"} size="sm" onClick={onToggle} disabled={toggleDisabled} title={toggleDisabled ? title : undefined}>
                {active ? "Desactivar" : "Activar"}
            </Button>
        </div>
    );
}
```

- [ ] **Step 7: Aplicar disabled states a roles y funcionarios**

En filas de roles:

```tsx
const superior = esRolSuperior(rol.id_rol);
const propio = actor?.rolId === rol.id_rol;
const motivo = superior ? "Tiene privilegios que tu rol no posee" : propio ? "No puedes renombrar ni desactivar tu propio rol" : undefined;
```

Usar:

```tsx
<Button type="button" variant="outline" size="sm" onClick={() => setRolPermisos({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, permisos: rol.permisos })} disabled={superior} title={superior ? motivo : undefined}>
    Permisos
</Button>
<RowActions
    active={rol.estado === "Activo"}
    editDisabled={superior || propio}
    toggleDisabled={superior || propio}
    title={motivo}
    onEdit={() => {
        setRolForm({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Activo" : "Inactivo" });
        setModal("roles");
    }}
    onToggle={async () => {
        try {
            const result = await guardarRol({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Inactivo" : "Activo" });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            await loadData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error al cambiar estado");
        }
    }}
/>
```

En filas de funcionarios:

```tsx
const superior = esRolSuperior(funcionario.rol_id);
const propio = actor?.rut === funcionario.rut;
const motivo = superior ? "Tiene privilegios que tu rol no posee" : propio ? "No puedes cambiar tu propio rol, estado o centro" : undefined;
```

Usar:

```tsx
<RowActions
    active={funcionario.estado === "Activo"}
    editDisabled={superior}
    toggleDisabled={superior || propio}
    title={motivo}
    onEdit={() => {
        setFuncionarioForm({
            rut: funcionario.rut,
            email: funcionario.email,
            nombre: funcionario.nombre,
            rol_id: String(funcionario.rol_id),
            centro_id: funcionario.centro_id ?? "",
            programa_asociado: asProgramaFuncionario(funcionario.programa_asociado),
            estado: funcionario.estado === "Activo" ? "Activo" : "Inactivo"
        });
        setEditingFuncionarioRut(funcionario.rut);
        setModal("funcionarios");
    }}
    onToggle={async () => {
        try {
            const result = await guardarFuncionario({
                rut: funcionario.rut,
                email: funcionario.email,
                nombre: funcionario.nombre,
                rol_id: funcionario.rol_id,
                centro_id: funcionario.centro_id ?? "",
                programa_asociado: asProgramaFuncionario(funcionario.programa_asociado),
                estado: funcionario.estado === "Activo" ? "Inactivo" : "Activo"
            });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            await loadData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error al cambiar estado");
        }
    }}
/>
```

- [ ] **Step 8: Bloquear campos propios y nombre reservado en modales**

En modal de rol, calcular:

```tsx
const editandoRolReservado = Boolean(rolForm.id_rol && esNombreReservado(rolPorId(rolForm.id_rol)?.nombre_rol ?? ""));
```

Usar input:

```tsx
<Input aria-label="Nombre rol" value={rolForm.nombre_rol} onChange={(event) => setRolForm((current) => ({ ...current, nombre_rol: event.target.value }))} required maxLength={50} disabled={editandoRolReservado} />
```

En modal de funcionario:

```tsx
const editandoFuncionarioPropio = Boolean(editingFuncionarioRut && actor?.rut === editingFuncionarioRut);
```

Agregar aviso antes de los campos protegidos:

```tsx
{editandoFuncionarioPropio && (
    <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground sm:col-span-2">
        No puedes cambiar tu propio rol, estado o centro
    </p>
)}
```

Deshabilitar:

```tsx
<Select aria-label="Rol" value={funcionarioForm.rol_id} onChange={(event) => setFuncionarioForm((current) => ({ ...current, rol_id: event.target.value }))} required disabled={editandoFuncionarioPropio}>
<Select aria-label="Centro" value={funcionarioForm.centro_id} onChange={(event) => setFuncionarioForm((current) => ({ ...current, centro_id: event.target.value }))} required disabled={editandoFuncionarioPropio}>
<EstadoActivoSelect ariaLabel="Estado" value={funcionarioForm.estado} onChange={(estado) => setFuncionarioForm((current) => ({ ...current, estado }))} disabled={editandoFuncionarioPropio} />
```

Modificar `EstadoActivoSelect`:

```tsx
function EstadoActivoSelect({ value, onChange, disabled = false, ariaLabel }: { value: "Activo" | "Inactivo"; onChange: (value: "Activo" | "Inactivo") => void; disabled?: boolean; ariaLabel?: string }) {
    return (
        <Select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value as "Activo" | "Inactivo")} required disabled={disabled}>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
        </Select>
    );
}
```

- [ ] **Step 9: Actualizar `PermisosRolModal`**

Cambiar firma:

```tsx
export function PermisosRolModal({
    rol,
    permisosActor,
    esRolPropio,
    onClose,
    onSaved
}: {
    rol: RolConPermisos;
    permisosActor: Permiso[];
    esRolPropio: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
```

Agregar:

```tsx
const permisosActorSet = new Set(permisosActor);

function checkboxDisabled(permiso: Permiso): boolean {
    return !permisosActorSet.has(permiso) || (esRolPropio && permiso === "config.roles");
}

function checkboxTitle(permiso: Permiso): string | undefined {
    if (esRolPropio && permiso === "config.roles") return "No puedes quitar el permiso de editar roles a tu propio rol";
    if (!permisosActorSet.has(permiso)) return "Tu rol no tiene este permiso";
    return undefined;
}
```

En `submit`, manejar resultado:

```tsx
const result = await guardarPermisosRol({ rol_id: rol.id_rol, permisos: seleccion });
if (!result.ok) {
    toast.error(result.error);
    return;
}
toast.success("Permisos actualizados");
onSaved();
```

En checkbox:

```tsx
disabled={checkboxDisabled(permiso.clave)}
title={checkboxTitle(permiso.clave)}
```

En `UsuariosRolesView`, pasar:

```tsx
<PermisosRolModal
    rol={rolPermisos}
    permisosActor={permisos}
    esRolPropio={actor?.rolId === rolPermisos.id_rol}
    onClose={() => setRolPermisos(null)}
    onSaved={() => {
        setRolPermisos(null);
        loadData();
    }}
/>
```

- [ ] **Step 10: Manejar `ResultadoAccion` en submit y toggles**

En `submitRol`:

```tsx
const result = await guardarRol(rolForm);
if (!result.ok) {
    toast.error(result.error);
    return;
}
toast.success("Rol guardado");
```

En `submitFuncionario`:

```tsx
const result = await guardarFuncionario({
    ...funcionarioForm,
    rol_id: Number(funcionarioForm.rol_id),
    programa_asociado: funcionarioForm.programa_asociado
});
if (!result.ok) {
    toast.error(result.error);
    return;
}
toast.success("Funcionario guardado");
```

Reemplazar toggle de rol por async inline:

```tsx
onToggle={async () => {
    try {
        const result = await guardarRol({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Inactivo" : "Activo" });
        if (!result.ok) {
            toast.error(result.error);
            return;
        }
        await loadData();
    } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al cambiar estado");
    }
}}
```

Reemplazar toggle de funcionario por async inline con el mismo patron:

```tsx
const result = await guardarFuncionario({
    rut: funcionario.rut,
    email: funcionario.email,
    nombre: funcionario.nombre,
    rol_id: funcionario.rol_id,
    centro_id: funcionario.centro_id ?? "",
    programa_asociado: asProgramaFuncionario(funcionario.programa_asociado),
    estado: funcionario.estado === "Activo" ? "Inactivo" : "Activo"
});
if (!result.ok) {
    toast.error(result.error);
    return;
}
await loadData();
```

No cambiar los handlers de catalogos, profesionales ni prestaciones porque siguen devolviendo entidad directa o lanzando.

- [ ] **Step 11: Ejecutar tests UI**

Run: `npm test -- src/modules/configuracion/components/PermisosRolModal.test.tsx src/modules/configuracion/components/UsuariosRolesView.test.tsx`

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/app/(app)/configuracion/usuarios-roles/page.tsx src/modules/configuracion/components/UsuariosRolesView.tsx src/modules/configuracion/components/UsuariosRolesView.test.tsx src/modules/configuracion/components/PermisosRolModal.tsx src/modules/configuracion/components/PermisosRolModal.test.tsx
git commit -m "feat(configuracion): anticipar bloqueos rbac en ui"
```

---

### Task 5: Documentacion RBAC Anti-Escalada

**Files:**
- Modify: `docs/rbac-permisos.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: reglas F1-F4, R1-R4, P1-P4 ya implementadas.
- Produces: documentacion operativa para futuros cambios RBAC.

- [ ] **Step 1: Actualizar catalogo documentado**

En `docs/rbac-permisos.md`, seccion "Catalogo (codigo)", agregar `some.ver` entre `dashboard.ver` y `config.ver`:

```ts
"dashboard.ver":        { modulo: "Dashboard",     etiqueta: "Ver indicadores" },
"some.ver":             { modulo: "SOME",          etiqueta: "Ver panel SOME" },
"config.ver":           { modulo: "Configuracion", etiqueta: "Ver configuracion" },
```

- [ ] **Step 2: Reemplazar seccion de salvaguardas**

En `docs/rbac-permisos.md`, reemplazar el parrafo de limitacion conocida de la seccion 6 por:

```md
**Anti-escalada.** El mantenedor de roles y funcionarios aplica la regla "no otorgar lo que no
tienes". Un actor no puede asignar un rol, editar un rol/funcionario superior, ni marcar permisos
que su propio rol no posee. Estas reglas viven en `src/modules/configuracion/utils/privilegios.ts`
y se usan tanto en las Server Actions como en la UI preventiva.

**Auto-edicion.** Un funcionario puede actualizar datos no sensibles de su propio registro, pero no
puede cambiar su rol, estado ni centro. Tampoco puede renombrar ni desactivar su propio rol.

**Ultimo administrador.** Las actions impiden desactivar o degradar al ultimo funcionario activo
cuyo rol activo incluye `config.roles`. La regla cubre cambios de funcionario, estado de rol y
matriz de permisos del rol.

**Nombre reservado.** `Administrador` es un nombre reservado para cerrar el vector legacy donde
algunas rutas aun comparan `user.rol.nombre === "Administrador"`. La deuda definitiva es reemplazar
esa comparacion por un permiso explicito, registrada en #21.
```

- [ ] **Step 3: Agregar anti-patron**

En seccion 10, actualizar el anti-patron de nombre de rol:

```md
- **Chequear por nombre de rol.** `if (user.rol.nombre === "Administrador")` es deuda legacy. Hoy el
  mantenedor reserva ese nombre para evitar escalada, pero el patron correcto sigue siendo autorizar
  por permisos. Ver #21 para eliminar la comparacion restante.
```

- [ ] **Step 4: Actualizar `AGENTS.md`**

En la seccion "Datos y reglas de negocio", agregar:

```md
- Anti-escalada RBAC: desde Configuracion nadie puede otorgar permisos que su propio rol no tiene,
  editar roles/funcionarios superiores, cambiar su propio rol/estado/centro, ni dejar el sistema sin
  administradores activos. Ver `docs/rbac-permisos.md`.
```

- [ ] **Step 5: Verificar docs con busqueda**

Run: `rg -n "some.ver|Anti-escalada|Ultimo administrador|Administrador.*reservado|no otorgar" docs/rbac-permisos.md AGENTS.md`

Expected: muestra las entradas agregadas.

- [ ] **Step 6: Commit**

```bash
git add docs/rbac-permisos.md AGENTS.md
git commit -m "docs(rbac): documentar salvaguardas anti escalada"
```

---

### Task 6: Verificacion Final y Handoff

**Files:**
- Modify only files from earlier tasks if verification finds issues.

**Interfaces:**
- Produces: branch verificable con tests, TypeScript y lint en verde.

- [ ] **Step 1: Ejecutar tests especificos de configuracion**

Run:

```bash
npm test -- src/modules/configuracion src/shared/lib/permisos.test.ts src/config/permisos.test.ts src/modules/permisos-por-action.test.ts
```

Expected: PASS.

- [ ] **Step 2: Ejecutar suite global**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Ejecutar TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS sin errores.

- [ ] **Step 4: Ejecutar lint**

Run:

```bash
npm run lint
```

Expected: PASS sin errores.

- [ ] **Step 5: Validacion manual local**

Run:

```bash
npm run dev
```

Expected: servidor local en `http://localhost:3000`.

Verificar en `/configuracion/usuarios-roles`:

1. Un usuario con `config.funcionarios` pero sin `config.roles` no puede asignar rol Administrador a si mismo ni a otro funcionario.
2. Un usuario no puede cambiar su propio rol, estado ni centro; los campos aparecen deshabilitados y el servidor bloquea el intento.
3. Un rol superior muestra Permisos, Editar y Activar/Desactivar deshabilitados.
4. En el modal de permisos, los permisos ausentes del actor aparecen deshabilitados.
5. Al intentar dejar sin administradores activos, aparece toast `Debe quedar al menos un administrador activo`.
6. Un Administrador puede seguir editando roles y funcionarios de igual o menor privilegio.

- [ ] **Step 6: Queries post-deploy**

Preparar estas consultas para la revision manual con Dani despues del deploy:

```sql
SELECT f.rut, f.nombre, f.email, r.nombre_rol, r.estado AS estado_rol
FROM funcionarios f
JOIN roles r ON r.id_rol = f.rol_id
WHERE f.estado = 'Activo'
  AND (LOWER(TRIM(r.nombre_rol)) = 'administrador'
       OR EXISTS (SELECT 1 FROM roles_permisos rp
                  WHERE rp.rol_id = r.id_rol AND rp.permiso IN ('config.roles', 'config.funcionarios')))
ORDER BY r.nombre_rol, f.nombre;

SELECT r.id_rol, r.nombre_rol, r.estado, GROUP_CONCAT(rp.permiso ORDER BY rp.permiso) AS permisos
FROM roles r
JOIN roles_permisos rp ON rp.rol_id = r.id_rol
GROUP BY r.id_rol, r.nombre_rol, r.estado
HAVING SUM(rp.permiso IN ('config.roles', 'config.funcionarios')) > 0;
```

- [ ] **Step 7: Commit de ajustes si existieron**

Si las verificaciones requirieron cambios:

```bash
git add src/modules/configuracion src/app/(app)/configuracion docs/rbac-permisos.md AGENTS.md
git commit -m "fix(configuracion): ajustes anti escalada rbac"
```

Si no hubo cambios, no crear commit vacio.

---

## Acceptance Checklist

- [ ] Los escenarios 1 a 5 del spec quedan bloqueados en servidor, sin escritura en BD y con registro `SECURITY`.
- [ ] Un Administrador conserva capacidades sobre roles y funcionarios de igual o menor privilegio.
- [ ] Los bloqueos de negocio devuelven `{ ok: false, error }` y se muestran con toast en produccion.
- [ ] La UI deshabilita acciones no permitidas para funcionarios superiores, roles superiores, rol propio, funcionario propio y permisos ausentes del actor.
- [ ] No es posible dejar el sistema sin administradores activos desde el mantenedor.
- [ ] No hay permisos, paginas, Server Actions, migraciones ni seeds nuevos.
- [ ] `npm test`, `npx tsc --noEmit` y `npm run lint` quedan en verde.

## Execution Handoff

Ejecutar con `subagent-driven-development` recomendado: un subagente por tarea y revision entre tareas. Si se ejecuta inline, usar `executing-plans` y cerrar cada tarea con sus tests antes de avanzar.
