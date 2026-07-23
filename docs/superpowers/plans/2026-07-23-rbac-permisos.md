# RBAC por permisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la autorizacion basada en la tabla `menu` y en listas de roles hardcodeadas por un RBAC de permisos: catalogo tipado en codigo, asignacion configurable en BD, y enforcement server-side en cada pagina y cada Server Action.

**Architecture:** Un catalogo `PERMISOS` (`as const`) define las claves validas y da el tipo `Permiso`. Una tabla pivote `roles_permisos` guarda que rol tiene que permiso. `src/shared/lib/permisos.ts` lee esos permisos por request (React `cache`) y expone `requirePermiso` (actions, lanza) y `requirePermisoPagina` (paginas, redirige). El nav se declara en `src/config/navegacion.ts` y se filtra por permisos. La tabla `menu` desaparece.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Prisma + MySQL 8.4, NextAuth v5, Zod, Vitest + Testing Library, Tailwind + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-07-23-rbac-permisos-design.md`

**Rama:** `feat/rbac-permisos` (ya creada).

## Global Constraints

- Idioma espanol en UI, comentarios y mensajes de commit. Sin tildes en identificadores de codigo.
- Indentacion: **4 espacios**. TypeScript strict, tipos explicitos.
- `interface` para objetos, `type` / `as const` para uniones.
- Alias `@/` apunta a `src/`. Imports categorizados con comentarios (`// lib`, `// components`, `// actions`, `// schemas`, `// types`).
- Componentes en PascalCase; funciones y variables en camelCase; Server Actions con sufijo `.action.ts` y `'use server'` al tope del archivo.
- Sin `console.log` en codigo de aplicacion. Permitido solo en `prisma/seed.ts` y `prisma/scripts/*`.
- Errores de UI con `toast` de sonner; operaciones de datos auditadas con `AuditLogger` (`src/shared/lib/logger.ts`).
- Antes de crear un componente nuevo, revisar `src/shared/components/ui`.
- Comandos: `npm test` (vitest run), `npm run lint`, `npm run build`, `npm run db:push`, `npm run db:generate`, `npm run db:seed`.
- MySQL local por Docker en puerto **3308** (`npm run services:up`).

## Orden de ejecucion y seguridad en produccion

Las tareas estan ordenadas para que el sistema siga funcionando en cada commit:

1. Tareas 1–2 agregan estructura sin quitar nada.
2. Tarea 4 **puebla** `roles_permisos` derivandolo de la tabla `menu` actual. Debe correrse antes de que las actions exijan permisos (tareas 5–7).
3. Tareas 5–11 migran el enforcement. `menu` sigue en BD, sin uso desde la tarea 10.
4. Tarea 13 elimina `menu`, en commit separado, cuando ya nada la lee.

---

### Task 1: Catalogo de permisos

**Files:**
- Create: `src/config/permisos.ts`
- Test: `src/config/permisos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `PERMISOS` — objeto `as const`, claves = permisos, valor `{ modulo: string; etiqueta: string }`.
  - `type Permiso = keyof typeof PERMISOS`
  - `CLAVES_PERMISOS: readonly Permiso[]`
  - `esPermiso(valor: string): valor is Permiso`
  - `interface PermisoDescrito { clave: Permiso; etiqueta: string }`
  - `interface GrupoPermisos { modulo: string; permisos: PermisoDescrito[] }`
  - `agruparPermisos(): GrupoPermisos[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/config/permisos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PERMISOS, CLAVES_PERMISOS, esPermiso, agruparPermisos } from "./permisos";

describe("catalogo de permisos", () => {
    it("expone una clave por permiso declarado", () => {
        expect(CLAVES_PERMISOS).toHaveLength(Object.keys(PERMISOS).length);
        expect(new Set(CLAVES_PERMISOS).size).toBe(CLAVES_PERMISOS.length);
    });

    it("usa el formato modulo.accion en todas las claves", () => {
        for (const clave of CLAVES_PERMISOS) {
            expect(clave).toMatch(/^[a-z]+\.[a-z_]+$/);
        }
    });

    it("incluye los permisos definidos en el diseno", () => {
        expect(CLAVES_PERMISOS).toContain("solicitudes.gestionar");
        expect(CLAVES_PERMISOS).toContain("comunicador.paciente");
        expect(CLAVES_PERMISOS).toContain("config.roles");
    });

    it("esPermiso reconoce claves validas y rechaza el resto", () => {
        expect(esPermiso("solicitudes.ver")).toBe(true);
        expect(esPermiso("solicitudes.inventado")).toBe(false);
        expect(esPermiso("")).toBe(false);
    });

    it("agruparPermisos agrupa por modulo sin perder permisos", () => {
        const grupos = agruparPermisos();
        const total = grupos.reduce((acc, grupo) => acc + grupo.permisos.length, 0);
        expect(total).toBe(CLAVES_PERMISOS.length);
        expect(grupos.map((grupo) => grupo.modulo)).toContain("Solicitudes");
        const solicitudes = grupos.find((grupo) => grupo.modulo === "Solicitudes");
        expect(solicitudes?.permisos.map((permiso) => permiso.clave)).toContain("solicitudes.crear");
    });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/config/permisos.test.ts`
Expected: FAIL — `Failed to resolve import "./permisos"`.

- [ ] **Step 3: Implementar el catalogo**

Crear `src/config/permisos.ts`:

```ts
// Catalogo unico de permisos del sistema.
// La fuente de verdad de que permisos existen es este archivo; la BD solo guarda
// que rol tiene cada clave (tabla roles_permisos).
export const PERMISOS = {
    "solicitudes.ver": { modulo: "Solicitudes", etiqueta: "Ver solicitudes" },
    "solicitudes.crear": { modulo: "Solicitudes", etiqueta: "Ingresar solicitud" },
    "solicitudes.gestionar": { modulo: "Solicitudes", etiqueta: "Revisar y gestionar" },
    "comunicador.ver": { modulo: "Comunicador", etiqueta: "Ver citas y llamados" },
    "comunicador.llamar": { modulo: "Comunicador", etiqueta: "Registrar llamada" },
    "comunicador.paciente": { modulo: "Comunicador", etiqueta: "Editar datos del paciente" },
    "dashboard.ver": { modulo: "Dashboard", etiqueta: "Ver indicadores" },
    "config.ver": { modulo: "Configuracion", etiqueta: "Ver configuracion" },
    "config.funcionarios": { modulo: "Configuracion", etiqueta: "Editar funcionarios" },
    "config.roles": { modulo: "Configuracion", etiqueta: "Editar roles y permisos" },
    "config.catalogos": { modulo: "Configuracion", etiqueta: "Editar catalogos" }
} as const;

export type Permiso = keyof typeof PERMISOS;

export const CLAVES_PERMISOS = Object.keys(PERMISOS) as Permiso[];

export interface PermisoDescrito {
    clave: Permiso;
    etiqueta: string;
}

export interface GrupoPermisos {
    modulo: string;
    permisos: PermisoDescrito[];
}

export function esPermiso(valor: string): valor is Permiso {
    return Object.prototype.hasOwnProperty.call(PERMISOS, valor);
}

// Agrupa el catalogo por modulo para pintar la matriz del mantenedor.
export function agruparPermisos(): GrupoPermisos[] {
    const grupos: GrupoPermisos[] = [];
    for (const clave of CLAVES_PERMISOS) {
        const { modulo, etiqueta } = PERMISOS[clave];
        const existente = grupos.find((grupo) => grupo.modulo === modulo);
        if (existente) {
            existente.permisos.push({ clave, etiqueta });
        } else {
            grupos.push({ modulo, permisos: [{ clave, etiqueta }] });
        }
    }
    return grupos;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/config/permisos.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/config/permisos.ts src/config/permisos.test.ts
git commit -m "feat(rbac): catalogo tipado de permisos"
```

---

### Task 2: Modelo RolPermiso en Prisma

**Files:**
- Modify: `prisma/schema.prisma:10-31`

**Interfaces:**
- Consumes: nada.
- Produces: `prisma.rolPermiso` (delegate) con campos `rol_id: number`, `permiso: string`; y `prisma.role.findUnique({ select: { permisos: { select: { permiso: true } } } })`.

`model Menu` **se conserva** en esta tarea: la tarea 4 lo necesita para derivar los permisos. Se elimina en la tarea 13.

- [ ] **Step 1: Agregar el modelo y la relacion**

En `prisma/schema.prisma`, reemplazar el bloque `model Role` (lineas 10-18) por:

```prisma
model Role {
  id_rol     Int           @id @default(autoincrement())
  nombre_rol String        @db.VarChar(50)
  estado     String        @default("Activo") @db.VarChar(50)
  menus      Menu[]
  permisos   RolPermiso[]
  funcionarios Funcionario[]

  @@map("roles")
}
```

Y agregar, inmediatamente despues del bloque `model Menu` (linea 31):

```prisma
model RolPermiso {
  rol_id  Int
  permiso String @db.VarChar(60)
  role    Role   @relation(fields: [rol_id], references: [id_rol], onDelete: Cascade)

  @@id([rol_id, permiso])
  @@map("roles_permisos")
}
```

- [ ] **Step 2: Generar el cliente y aplicar el esquema**

Run:

```bash
npm run services:up
npm run db:push
npm run db:generate
```

Expected: `db:push` reporta que crea la tabla `roles_permisos`; `db:generate` termina con "Generated Prisma Client".

- [ ] **Step 3: Verificar que el delegate existe**

Run: `npx tsx -e "import { PrismaClient } from '@prisma/client'; console.log(typeof new PrismaClient().rolPermiso.findMany)"`
Expected: `function`

- [ ] **Step 4: Verificar que nada se rompio**

Run: `npm test`
Expected: PASS — la suite existente sigue verde.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(rbac): tabla roles_permisos en el esquema"
```

---

### Task 3: Capa de autorizacion

**Files:**
- Create: `src/shared/lib/permisos.ts`
- Create: `src/shared/lib/permisos.test.ts`
- Create: `src/app/(app)/sin-acceso/page.tsx`

**Interfaces:**
- Consumes: `Permiso`, `esPermiso` (Task 1); `getSessionUser` de `@/shared/lib/auth`; `esEstadoActivo` de `@/shared/lib/access`; `prisma.role.findUnique` (Task 2).
- Produces:
  - `getPermisosRol(rolId: number): Promise<Set<Permiso>>`
  - `getSessionPermisos(): Promise<{ user: SessionUser; permisos: Set<Permiso> } | null>`
  - `requirePermiso(...requeridos: Permiso[]): Promise<SessionUser>` — **semantica OR**: basta uno de los permisos. Lanza `Error("No autenticado")` o `Error("No tienes permiso para esta operacion")`.
  - `requirePermisoPagina(...requeridos: Permiso[]): Promise<SessionUser>` — misma semantica OR, pero redirige a `/auth/login` o `/sin-acceso`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/shared/lib/permisos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { cacheSpy } = vi.hoisted(() => ({ cacheSpy: vi.fn((fn: unknown) => fn) }));

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return { ...actual, cache: (fn: unknown) => cacheSpy(fn) };
});
vi.mock("@/shared/lib/prisma", () => ({ prisma: { role: { findUnique: vi.fn() } } }));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: vi.fn() }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn((destino: string) => {
        throw new Error(`REDIRECT:${destino}`);
    })
}));

import { getPermisosRol, requirePermiso, requirePermisoPagina } from "./permisos";
import { prisma } from "@/shared/lib/prisma";
import { getSessionUser } from "@/shared/lib/auth";

const usuario = {
    rut: "1-9",
    email: "o@x.cl",
    nombre: "Orientador",
    centro_id: "501",
    centro_nombre: "CESFAM",
    rol: { id: 2, nombre: "Orientador" }
};

beforeEach(() => {
    vi.clearAllMocks();
    (getSessionUser as any).mockResolvedValue(usuario);
    (prisma.role.findUnique as any).mockResolvedValue({
        estado: "Activo",
        permisos: [{ permiso: "solicitudes.ver" }, { permiso: "solicitudes.crear" }]
    });
});

describe("getPermisosRol", () => {
    it("devuelve las claves del rol", async () => {
        const permisos = await getPermisosRol(2);
        expect(permisos.has("solicitudes.ver")).toBe(true);
        expect(permisos.has("solicitudes.gestionar")).toBe(false);
    });

    it("descarta claves que ya no existen en el catalogo", async () => {
        (prisma.role.findUnique as any).mockResolvedValue({
            estado: "Activo",
            permisos: [{ permiso: "solicitudes.ver" }, { permiso: "modulo.borrado" }]
        });
        const permisos = await getPermisosRol(2);
        expect(permisos.size).toBe(1);
        expect(permisos.has("solicitudes.ver")).toBe(true);
    });

    it("trata un rol inactivo como sin permisos", async () => {
        (prisma.role.findUnique as any).mockResolvedValue({
            estado: "Inactivo",
            permisos: [{ permiso: "solicitudes.ver" }]
        });
        const permisos = await getPermisosRol(2);
        expect(permisos.size).toBe(0);
    });

    it("trata un rol inexistente como sin permisos", async () => {
        (prisma.role.findUnique as any).mockResolvedValue(null);
        const permisos = await getPermisosRol(99);
        expect(permisos.size).toBe(0);
    });

    it("envuelve la lectura con cache() de React", () => {
        expect(cacheSpy).toHaveBeenCalledTimes(1);
    });
});

describe("requirePermiso", () => {
    it("devuelve el usuario cuando tiene el permiso", async () => {
        const user = await requirePermiso("solicitudes.ver");
        expect(user.rut).toBe("1-9");
    });

    it("acepta cuando tiene al menos uno de los permisos pedidos", async () => {
        const user = await requirePermiso("solicitudes.gestionar", "solicitudes.crear");
        expect(user.rut).toBe("1-9");
    });

    it("lanza cuando no tiene ninguno de los permisos", async () => {
        await expect(requirePermiso("config.roles")).rejects.toThrow("No tienes permiso para esta operacion");
    });

    it("lanza cuando no hay sesion", async () => {
        (getSessionUser as any).mockResolvedValue(null);
        await expect(requirePermiso("solicitudes.ver")).rejects.toThrow("No autenticado");
    });
});

describe("requirePermisoPagina", () => {
    it("redirige a /sin-acceso cuando falta el permiso", async () => {
        await expect(requirePermisoPagina("config.roles")).rejects.toThrow("REDIRECT:/sin-acceso");
    });

    it("redirige al login cuando no hay sesion", async () => {
        (getSessionUser as any).mockResolvedValue(null);
        await expect(requirePermisoPagina("solicitudes.ver")).rejects.toThrow("REDIRECT:/auth/login");
    });

    it("devuelve el usuario cuando tiene el permiso", async () => {
        const user = await requirePermisoPagina("solicitudes.ver");
        expect(user.nombre).toBe("Orientador");
    });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/shared/lib/permisos.test.ts`
Expected: FAIL — `Failed to resolve import "./permisos"`.

- [ ] **Step 3: Implementar la capa**

Crear `src/shared/lib/permisos.ts`:

```ts
import { cache } from "react";
import { redirect } from "next/navigation";
// lib
import { prisma } from "@/shared/lib/prisma";
import { getSessionUser } from "@/shared/lib/auth";
import { esEstadoActivo } from "@/shared/lib/access";
// config
import { esPermiso, type Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

export interface ContextoPermisos {
    user: SessionUser;
    permisos: Set<Permiso>;
}

// Lee los permisos del rol una sola vez por request.
// Un rol inactivo o inexistente se resuelve como conjunto vacio.
export const getPermisosRol = cache(async (rolId: number): Promise<Set<Permiso>> => {
    const rol = await prisma.role.findUnique({
        where: { id_rol: rolId },
        select: { estado: true, permisos: { select: { permiso: true } } }
    });
    if (!rol || !esEstadoActivo(rol.estado)) return new Set<Permiso>();
    return new Set(rol.permisos.map((fila) => fila.permiso).filter(esPermiso));
});

export async function getSessionPermisos(): Promise<ContextoPermisos | null> {
    const user = await getSessionUser();
    if (!user) return null;
    return { user, permisos: await getPermisosRol(user.rol.id) };
}

function cumple(permisos: Set<Permiso>, requeridos: Permiso[]): boolean {
    return requeridos.some((permiso) => permisos.has(permiso));
}

// Para Server Actions: lanza si falta el permiso. Semantica OR entre los requeridos.
export async function requirePermiso(...requeridos: Permiso[]): Promise<SessionUser> {
    const contexto = await getSessionPermisos();
    if (!contexto) throw new Error("No autenticado");
    if (!cumple(contexto.permisos, requeridos)) throw new Error("No tienes permiso para esta operacion");
    return contexto.user;
}

// Para paginas server: redirige en vez de lanzar. Semantica OR entre los requeridos.
export async function requirePermisoPagina(...requeridos: Permiso[]): Promise<SessionUser> {
    const contexto = await getSessionPermisos();
    if (!contexto) redirect("/auth/login");
    if (!cumple(contexto.permisos, requeridos)) redirect("/sin-acceso");
    return contexto.user;
}
```

- [ ] **Step 4: Crear la pagina de acceso denegado**

Crear `src/app/(app)/sin-acceso/page.tsx`:

```tsx
// Pagina de destino cuando requirePermisoPagina rechaza el acceso.
// No lleva guard: es accesible para cualquier sesion valida (ver paginas-protegidas.test.ts).
export default function SinAccesoPage() {
    return (
        <div className="mx-auto max-w-lg rounded-lg border bg-card p-8 text-center">
            <h1 className="text-lg font-semibold">Sin acceso</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                Tu rol no tiene permisos para ver esta seccion. Si crees que es un error, contacta al administrador del sistema.
            </p>
        </div>
    );
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/shared/lib/permisos.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/permisos.ts src/shared/lib/permisos.test.ts "src/app/(app)/sin-acceso/page.tsx"
git commit -m "feat(rbac): capa de autorizacion por permisos"
```

---

### Task 4: Script de derivacion de permisos

**Files:**
- Create: `prisma/scripts/derivar-permisos.ts`
- Create: `prisma/scripts/derivar-permisos.test.ts`
- Modify: `package.json` (bloque `scripts`, tras la linea `"db:seed:ref": ...`)

**Interfaces:**
- Consumes: `Permiso`, `CLAVES_PERMISOS` (Task 1); `prisma.rolPermiso.createMany` (Task 2); tabla `menu`.
- Produces: `derivarPermisos(nombreRol: string, rutasMenu: string[]): Permiso[]` (funcion pura, exportada para test).

Las listas de roles hardcodeadas se copian **congeladas** dentro del script antes de borrarlas del codigo (Task 12): son el estado actual a preservar. La derivacion es la **union** de lo que dice `menu` y lo que dicen las constantes; asi ningun rol pierde acceso que hoy tenga por cualquiera de las dos vias.

- [ ] **Step 1: Escribir el test que falla**

Crear `prisma/scripts/derivar-permisos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { derivarPermisos } from "./derivar-permisos";

describe("derivarPermisos", () => {
    it("deriva solicitudes desde el menu", () => {
        const permisos = derivarPermisos("Comunicador", ["/solicitudes/ingresar"]);
        expect(permisos).toContain("solicitudes.ver");
        expect(permisos).toContain("solicitudes.crear");
        expect(permisos).not.toContain("solicitudes.gestionar");
    });

    it("agrega gestionar a los roles de la lista legada de solicitudes", () => {
        const permisos = derivarPermisos("Orientador", ["/solicitudes/ingresar"]);
        expect(permisos).toContain("solicitudes.gestionar");
    });

    it("deriva comunicador completo desde el menu", () => {
        const permisos = derivarPermisos("Comunicador", ["/comunicador"]);
        expect(permisos).toEqual(expect.arrayContaining(["comunicador.ver", "comunicador.llamar", "comunicador.paciente"]));
    });

    it("otorga comunicador a un rol de la lista legada aunque no tenga menu", () => {
        const permisos = derivarPermisos("Gestor y Comunicador", []);
        expect(permisos).toContain("comunicador.ver");
    });

    it("deriva dashboard y configuracion desde el menu", () => {
        const permisos = derivarPermisos("Comunicador", ["/dashboard", "/configuracion/usuarios-roles"]);
        expect(permisos).toContain("dashboard.ver");
        expect(permisos).toContain("config.ver");
        expect(permisos).not.toContain("config.roles");
    });

    it("da configuracion completa a los roles de la lista legada aunque no tengan menu (caso Full)", () => {
        const permisos = derivarPermisos("Full", []);
        expect(permisos).toEqual(expect.arrayContaining(["config.ver", "config.funcionarios", "config.roles", "config.catalogos"]));
    });

    it("devuelve vacio para un rol sin menu ni listas legadas", () => {
        expect(derivarPermisos("Rol Nuevo", [])).toEqual([]);
    });

    it("no repite claves cuando menu y listas legadas coinciden", () => {
        const permisos = derivarPermisos("Administrador", ["/solicitudes/ingresar", "/comunicador", "/dashboard", "/configuracion/usuarios-roles"]);
        expect(new Set(permisos).size).toBe(permisos.length);
    });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run prisma/scripts/derivar-permisos.test.ts`
Expected: FAIL — `Failed to resolve import "./derivar-permisos"`.

- [ ] **Step 3: Implementar el script**

Crear `prisma/scripts/derivar-permisos.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { CLAVES_PERMISOS, type Permiso } from "../../src/config/permisos";

const prisma = new PrismaClient();

// Copias congeladas de las listas hardcodeadas que existian antes del RBAC.
// Se conservan aqui porque representan el estado de acceso a preservar.
const ROLES_SOLICITUDES_LEGADO = ["Administrador", "Orientador", "SOME", "Orientador y Comunicador", "Full"];
const ROLES_COMUNICADOR_LEGADO = ["Administrador", "Comunicador", "SOME", "Orientador y Comunicador", "Gestor y Comunicador", "Full"];
const ROLES_CONFIGURACION_LEGADO = ["Administrador", "SOME", "Full"];

// Union de lo que otorga el menu y lo que otorgaban las listas hardcodeadas.
export function derivarPermisos(nombreRol: string, rutasMenu: string[]): Permiso[] {
    const permisos = new Set<Permiso>();
    const tieneRuta = (prefijo: string) => rutasMenu.some((ruta) => ruta.startsWith(prefijo));

    if (tieneRuta("/solicitudes")) {
        permisos.add("solicitudes.ver");
        permisos.add("solicitudes.crear");
    }
    if (ROLES_SOLICITUDES_LEGADO.includes(nombreRol)) {
        permisos.add("solicitudes.ver");
        permisos.add("solicitudes.crear");
        permisos.add("solicitudes.gestionar");
    }
    if (tieneRuta("/comunicador") || ROLES_COMUNICADOR_LEGADO.includes(nombreRol)) {
        permisos.add("comunicador.ver");
        permisos.add("comunicador.llamar");
        permisos.add("comunicador.paciente");
    }
    if (tieneRuta("/dashboard")) {
        permisos.add("dashboard.ver");
    }
    if (tieneRuta("/configuracion")) {
        permisos.add("config.ver");
    }
    if (ROLES_CONFIGURACION_LEGADO.includes(nombreRol)) {
        permisos.add("config.ver");
        permisos.add("config.funcionarios");
        permisos.add("config.roles");
        permisos.add("config.catalogos");
    }

    return CLAVES_PERMISOS.filter((clave) => permisos.has(clave));
}

async function main() {
    const roles = await prisma.role.findMany({
        select: {
            id_rol: true,
            nombre_rol: true,
            menus: { select: { ruta: true } },
            _count: { select: { funcionarios: true } }
        },
        orderBy: { id_rol: "asc" }
    });

    console.log(`Derivando permisos para ${roles.length} roles...`);
    let insertados = 0;

    for (const rol of roles) {
        const permisos = derivarPermisos(
            rol.nombre_rol,
            rol.menus.map((menu) => menu.ruta)
        );

        if (permisos.length === 0) {
            console.warn(`WARN  Rol "${rol.nombre_rol}" (id ${rol.id_rol}) queda sin permisos. Funcionarios afectados: ${rol._count.funcionarios}`);
            continue;
        }

        const resultado = await prisma.rolPermiso.createMany({
            data: permisos.map((permiso) => ({ rol_id: rol.id_rol, permiso })),
            skipDuplicates: true
        });
        insertados += resultado.count;
        console.log(`OK    ${rol.nombre_rol.padEnd(26)} ${permisos.length} permisos (${resultado.count} nuevos) · ${rol._count.funcionarios} funcionarios`);
        console.log(`      ${permisos.join(", ")}`);
    }

    console.log(`\nListo. Filas nuevas en roles_permisos: ${insertados}.`);
    console.log("Revisa las lineas WARN antes de desplegar el codigo nuevo.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run prisma/scripts/derivar-permisos.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Registrar el comando npm**

En `package.json`, dentro de `"scripts"`, agregar tras la linea `"db:seed:ref"`:

```json
        "db:rbac:migrar": "tsx prisma/scripts/derivar-permisos.ts",
```

- [ ] **Step 6: Ejecutar la derivacion en la BD local**

Run: `npm run db:rbac:migrar`
Expected: una linea `OK` por cada rol con permisos, y el resumen final. En la BD de desarrollo sembrada con `npm run db:seed` no debe aparecer ningun `WARN`.

- [ ] **Step 7: Verificar idempotencia**

Run: `npm run db:rbac:migrar`
Expected: mismas lineas `OK`, pero `0 nuevos` en todas y `Filas nuevas en roles_permisos: 0.`

- [ ] **Step 8: Commit**

```bash
git add prisma/scripts/derivar-permisos.ts prisma/scripts/derivar-permisos.test.ts package.json
git commit -m "feat(rbac): script de derivacion de permisos desde menu y listas legadas"
```

---

### Task 5: Migrar actions de solicitudes y catalogos

**Files:**
- Modify: `src/modules/solicitudes/actions/getSolicitudes.action.ts:5-6,76-77`
- Modify: `src/modules/solicitudes/actions/getPendientes.action.ts:4-5,13-14`
- Modify: `src/modules/solicitudes/actions/getUsuarioPorRut.action.ts:5-6,12-13`
- Modify: `src/modules/solicitudes/actions/getCentros.action.ts:5,13`
- Modify: `src/modules/solicitudes/actions/crearSolicitud.action.ts:6-7,47-48`
- Modify: `src/modules/solicitudes/actions/guardarUsuario.action.ts:5-6,13-17`
- Modify: `src/modules/solicitudes/actions/gestionarSolicitud.action.ts:6-7,70-71`
- Modify: `src/modules/solicitudes/actions/getRevisionCatalogos.action.ts:5-6,37-38`
- Modify: `src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts:5-6,25-26`
- Modify: `src/modules/catalogos/actions/getCatalogos.action.ts:4,29`
- Test: `src/modules/solicitudes/actions/getPendientes.action.test.ts`, `getSolicitudes.action.test.ts`, `crearSolicitud.action.test.ts`, `gestionarSolicitud.action.test.ts`, `guardarUsuario.action.test.ts`, `getCentros.action.test.ts`, `src/modules/catalogos/actions/getCatalogos.action.test.ts`

**Interfaces:**
- Consumes: `requirePermiso` (Task 3).
- Produces: sin cambios de firma publica. Las actions siguen exportando lo mismo; solo cambia el guard interno.

Mapa a aplicar:

| Permiso | Actions |
| --- | --- |
| `solicitudes.ver` | `getSolicitudes`, `getPendientes`, `getUsuarioPorRut`, `getCentros`, `getCatalogos` |
| `solicitudes.crear` | `crearSolicitud`, `crearUsuario`, `actualizarUsuario` |
| `solicitudes.gestionar` | `gestionarSolicitud`, `getRevisionCatalogos`, `getOtrasSolicitudes` |

- [ ] **Step 1: Actualizar los tests existentes al nuevo mock**

Los `.action.test.ts` de solicitudes mockean `@/shared/lib/auth`. Ahora deben mockear `@/shared/lib/permisos`. En **cada** archivo de test listado arriba:

Reemplazar la linea de mock de auth:

```ts
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
```

por:

```ts
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
```

Reemplazar el import:

```ts
import { requireSessionUser } from "@/shared/lib/auth";
```

por:

```ts
import { requirePermiso } from "@/shared/lib/permisos";
```

Y en el `beforeEach`, reemplazar:

```ts
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
```

por:

```ts
    (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", centro_nombre: "CESFAM", rol: { id: 2, nombre: "Orientador" } });
```

(Si algun archivo usa otros valores en el objeto, conservar los suyos y solo quitar `menu: []`.)

- [ ] **Step 2: Agregar un test de denegacion a getPendientes**

En `src/modules/solicitudes/actions/getPendientes.action.test.ts`, agregar dentro del `describe("getPendientes", ...)`:

```ts
    it("propaga el rechazo cuando falta el permiso", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(getPendientes("12.345.678-9")).rejects.toThrow("No tienes permiso para esta operacion");
        expect(prisma.cita.findMany).not.toHaveBeenCalled();
    });
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx vitest run src/modules/solicitudes src/modules/catalogos`
Expected: FAIL — los mocks de `@/shared/lib/permisos` no coinciden con lo que importan las actions (siguen usando `requireSessionUser`).

- [ ] **Step 4: Migrar los guards de las actions**

En `getSolicitudes.action.ts`, `getPendientes.action.ts`, `getUsuarioPorRut.action.ts`, reemplazar el par de imports:

```ts
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
```

por:

```ts
import { requirePermiso } from "@/shared/lib/permisos";
```

y el par de lineas del guard:

```ts
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");
```

por:

```ts
    const user = await requirePermiso("solicitudes.ver");
```

En `crearSolicitud.action.ts`, el mismo reemplazo de imports, y el guard pasa a:

```ts
    const user = await requirePermiso("solicitudes.crear");
```

En `gestionarSolicitud.action.ts`, `getRevisionCatalogos.action.ts` y `getOtrasSolicitudes.action.ts`, el mismo reemplazo de imports, y el guard pasa a:

```ts
    const user = await requirePermiso("solicitudes.gestionar");
```

En `guardarUsuario.action.ts`, reemplazar los imports igual y sustituir el helper completo (lineas 13-17):

```ts
async function requireSolicitudesUser() {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");
    return user;
}
```

por:

```ts
async function requireSolicitudesUser() {
    return requirePermiso("solicitudes.crear");
}
```

En `getCentros.action.ts`, reemplazar el import:

```ts
import { requireSessionUser } from "@/shared/lib/auth";
```

por:

```ts
import { requirePermiso } from "@/shared/lib/permisos";
```

y la linea 13:

```ts
    await requireSessionUser();
```

por:

```ts
    await requirePermiso("solicitudes.ver");
```

En `src/modules/catalogos/actions/getCatalogos.action.ts`, reemplazar el import:

```ts
import { requireSessionUser } from "@/shared/lib/auth";
```

por:

```ts
import { requirePermiso } from "@/shared/lib/permisos";
```

y la linea 29:

```ts
    const user = await requireSessionUser();
```

por:

```ts
    const user = await requirePermiso("solicitudes.ver");
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run src/modules/solicitudes src/modules/catalogos`
Expected: PASS.

- [ ] **Step 6: Verificar que no queda ninguna referencia**

Run: `grep -rn "puedeAccederSolicitudes" src/modules`
Expected: sin resultados.

- [ ] **Step 7: Commit**

```bash
git add src/modules/solicitudes src/modules/catalogos
git commit -m "feat(rbac): actions de solicitudes y catalogos exigen permisos"
```

---

### Task 6: Migrar actions de comunicador

**Files:**
- Modify: `src/modules/comunicador/actions/getCitasPendientes.action.ts:6-7,34-35`
- Modify: `src/modules/comunicador/actions/getCitasPendientesPaciente.action.ts:4-5,23-24`
- Modify: `src/modules/comunicador/actions/getFiltrosComunicador.action.ts:4-5,16-17`
- Modify: `src/modules/comunicador/actions/getHistorialLlamadas.action.ts:5-6,18-19`
- Modify: `src/modules/comunicador/actions/getContactoPaciente.action.ts:4-5,11-12`
- Modify: `src/modules/comunicador/actions/registrarLlamada.action.ts:6-7,17-18`
- Modify: `src/modules/comunicador/actions/getUsuarioParaEdicion.action.ts:5-6,31-32`
- Modify: `src/modules/comunicador/actions/actualizarUsuarioComunicador.action.ts:4-5,12-13`
- Test: `src/modules/comunicador/actions/*.action.test.ts` (5 archivos)

**Interfaces:**
- Consumes: `requirePermiso` (Task 3).
- Produces: sin cambios de firma publica.

Mapa a aplicar:

| Permiso | Actions |
| --- | --- |
| `comunicador.ver` | `getCitasPendientes`, `getCitasPendientesPaciente`, `getFiltrosComunicador`, `getHistorialLlamadas`, `getContactoPaciente` |
| `comunicador.llamar` | `registrarLlamada` |
| `comunicador.paciente` | `getUsuarioParaEdicion`, `actualizarUsuarioComunicador` |

- [ ] **Step 1: Actualizar los mocks de los tests existentes**

En cada `.action.test.ts` de `src/modules/comunicador/actions/`, reemplazar:

```ts
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
```

por:

```ts
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
```

el import:

```ts
import { requireSessionUser } from "@/shared/lib/auth";
```

por:

```ts
import { requirePermiso } from "@/shared/lib/permisos";
```

y en el `beforeEach` cambiar `(requireSessionUser as any).mockResolvedValue({...})` por `(requirePermiso as any).mockResolvedValue({...})`, quitando la propiedad `menu` del objeto y conservando el resto de sus valores.

- [ ] **Step 2: Agregar un test de denegacion a registrarLlamada**

En `src/modules/comunicador/actions/registrarLlamada.action.test.ts`, agregar dentro del `describe` principal:

```ts
    it("propaga el rechazo cuando falta el permiso de llamar", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(registrarLlamada({} as any)).rejects.toThrow("No tienes permiso para esta operacion");
    });
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx vitest run src/modules/comunicador`
Expected: FAIL — las actions siguen importando `requireSessionUser`.

- [ ] **Step 4: Migrar los guards**

En `getCitasPendientes.action.ts`, `getCitasPendientesPaciente.action.ts`, `getFiltrosComunicador.action.ts`, `getHistorialLlamadas.action.ts` y `getContactoPaciente.action.ts`, reemplazar el par de imports:

```ts
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
```

por:

```ts
import { requirePermiso } from "@/shared/lib/permisos";
```

y el par de lineas del guard:

```ts
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");
```

por:

```ts
    const user = await requirePermiso("comunicador.ver");
```

En `registrarLlamada.action.ts`, el mismo reemplazo de imports, y el guard pasa a:

```ts
    const user = await requirePermiso("comunicador.llamar");
```

En `getUsuarioParaEdicion.action.ts` y `actualizarUsuarioComunicador.action.ts`, el mismo reemplazo de imports, y el guard pasa a:

```ts
    const user = await requirePermiso("comunicador.paciente");
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run src/modules/comunicador`
Expected: PASS.

- [ ] **Step 6: Verificar que no queda ninguna referencia**

Run: `grep -rn "puedeAccederComunicador" src/modules`
Expected: sin resultados.

- [ ] **Step 7: Commit**

```bash
git add src/modules/comunicador
git commit -m "feat(rbac): actions del comunicador exigen permisos"
```

---

### Task 7: Migrar configuracion y agregar guardarPermisosRol

**Files:**
- Modify: `src/modules/configuracion/actions/mantenedores.action.ts:19-33` (imports y helper) y todas las llamadas a `requireConfigUser()`
- Modify: `src/modules/configuracion/schemas/mantenedores.schema.ts` (agregar `permisosRolSchema` y su tipo)
- Test: `src/modules/configuracion/actions/mantenedores.action.test.ts`

**Interfaces:**
- Consumes: `requirePermiso` (Task 3), `esPermiso`, `type Permiso` (Task 1).
- Produces:
  - `guardarPermisosRol(input: PermisosRolInput): Promise<{ id_rol: number; permisos: Permiso[] }>`
  - `permisosRolSchema` y `type PermisosRolInput = { rol_id: number; permisos: string[] }`
  - `getMantenedoresConfig` ahora devuelve cada rol con `permisos: { permiso: string }[]`.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/modules/configuracion/actions/mantenedores.action.test.ts`, ajustar los mocks del encabezado. Reemplazar:

```ts
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
```

por:

```ts
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
```

el import correspondiente por:

```ts
import { requirePermiso } from "@/shared/lib/permisos";
```

y en el `beforeEach` cambiar `(requireSessionUser as any).mockResolvedValue(...)` por:

```ts
    (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "a@x.cl", nombre: "Admin", centro_id: null, centro_nombre: null, rol: { id: 1, nombre: "Administrador" } });
```

Ampliar el mock de `prisma` del encabezado para que incluya:

```ts
    rolPermiso: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (operaciones: unknown[]) => operaciones)
```

Agregar al final del archivo:

```ts
import { guardarPermisosRol } from "./mantenedores.action";

describe("guardarPermisosRol", () => {
    beforeEach(() => {
        (prisma.rolPermiso.findMany as any).mockResolvedValue([{ permiso: "solicitudes.ver" }]);
        (prisma.rolPermiso.deleteMany as any).mockResolvedValue({ count: 1 });
        (prisma.rolPermiso.createMany as any).mockResolvedValue({ count: 2 });
    });

    it("reemplaza los permisos del rol", async () => {
        const resultado = await guardarPermisosRol({ rol_id: 3, permisos: ["solicitudes.ver", "comunicador.ver"] });
        expect(resultado.permisos).toEqual(["solicitudes.ver", "comunicador.ver"]);
        expect(prisma.rolPermiso.deleteMany).toHaveBeenCalledWith({ where: { rol_id: 3 } });
        const argsCreate = (prisma.rolPermiso.createMany as any).mock.calls[0][0];
        expect(argsCreate.data).toEqual([
            { rol_id: 3, permiso: "solicitudes.ver" },
            { rol_id: 3, permiso: "comunicador.ver" }
        ]);
    });

    it("rechaza claves que no existen en el catalogo", async () => {
        await expect(guardarPermisosRol({ rol_id: 3, permisos: ["modulo.inventado"] })).rejects.toThrow();
        expect(prisma.rolPermiso.deleteMany).not.toHaveBeenCalled();
    });

    it("impide que el usuario se quite config.roles a si mismo", async () => {
        await expect(guardarPermisosRol({ rol_id: 1, permisos: ["config.ver"] })).rejects.toThrow(
            "No puedes quitar el permiso de editar roles a tu propio rol"
        );
        expect(prisma.rolPermiso.deleteMany).not.toHaveBeenCalled();
    });

    it("permite editar el propio rol si conserva config.roles", async () => {
        const resultado = await guardarPermisosRol({ rol_id: 1, permisos: ["config.ver", "config.roles"] });
        expect(resultado.permisos).toContain("config.roles");
    });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/modules/configuracion`
Expected: FAIL — `guardarPermisosRol` no existe.

- [ ] **Step 3: Agregar el schema Zod**

En `src/modules/configuracion/schemas/mantenedores.schema.ts`, agregar tras el bloque `rolConfigSchema` (linea 41):

```ts
export const permisosRolSchema = z.object({
    rol_id: z.coerce.number().int().positive(),
    permisos: z.array(z.string().refine(esPermiso, "Permiso desconocido"))
});
```

y en la seccion de tipos del final del archivo:

```ts
export type PermisosRolInput = z.input<typeof permisosRolSchema>;
```

Agregar al bloque de imports del archivo (junto a los demas):

```ts
// config
import { esPermiso } from "@/config/permisos";
```

- [ ] **Step 4: Migrar el guard y agregar la action**

En `src/modules/configuracion/actions/mantenedores.action.ts`, reemplazar el bloque de lineas 19-33:

```ts
// lib
import { requireSessionUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";

const ROLES_CONFIGURACION = ["Administrador", "SOME", "Full"] as const;

function puedeConfigurar(rol: string): boolean {
    return (ROLES_CONFIGURACION as readonly string[]).includes(rol);
}

async function requireConfigUser() {
    const user = await requireSessionUser();
    if (!puedeConfigurar(user.rol.nombre)) throw new Error("No tienes permiso para configuracion");
    return user;
}
```

por:

```ts
// lib
import { requirePermiso } from "@/shared/lib/permisos";
import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";
// config
import { CLAVES_PERMISOS, type Permiso } from "@/config/permisos";
```

Agregar `permisosRolSchema` y `type PermisosRolInput` al bloque de imports de schemas del tope del archivo.

Luego reemplazar cada llamada `await requireConfigUser()` segun la action que la contiene:

| Action | Reemplazo |
| --- | --- |
| `getMantenedoresConfig` | `await requirePermiso("config.ver");` |
| `guardarTipoSolicitud` | `const user = await requirePermiso("config.catalogos");` |
| `guardarMotivo` | `const user = await requirePermiso("config.catalogos");` |
| `guardarProfesional` | `const user = await requirePermiso("config.catalogos");` |
| `guardarPrestacion` | `const user = await requirePermiso("config.catalogos");` |
| `guardarRol` | `const user = await requirePermiso("config.roles");` |
| `guardarFuncionario` | `const user = await requirePermiso("config.funcionarios");` |

(las que hoy escriben `const user = await requireConfigUser();` mantienen el `const user =`; `getMantenedoresConfig` hoy escribe `await requireConfigUser();` sin variable y la mantiene sin variable).

En la consulta `prisma.role.findMany` dentro de `getMantenedoresConfig`, agregar el `select` de permisos:

```ts
        prisma.role.findMany({
            where: search ? { nombre_rol: search } : undefined,
            include: { permisos: { select: { permiso: true } } },
            orderBy: { nombre_rol: "asc" },
            take: 300
        }),
```

Y agregar al final del archivo:

```ts
export async function guardarPermisosRol(input: PermisosRolInput) {
    const user = await requirePermiso("config.roles");
    const data = permisosRolSchema.parse(input);
    const permisos = CLAVES_PERMISOS.filter((clave) => data.permisos.includes(clave));

    // Evita que un administrador se deje sin acceso al mantenedor de roles.
    if (data.rol_id === user.rol.id && !permisos.includes("config.roles")) {
        throw new Error("No puedes quitar el permiso de editar roles a tu propio rol");
    }

    const previos = await prisma.rolPermiso.findMany({ where: { rol_id: data.rol_id }, select: { permiso: true } });

    await prisma.$transaction([
        prisma.rolPermiso.deleteMany({ where: { rol_id: data.rol_id } }),
        prisma.rolPermiso.createMany({ data: permisos.map((permiso) => ({ rol_id: data.rol_id, permiso })) })
    ]);

    await AuditLogger.logDataAccess(
        "UPDATE",
        true,
        { rut: user.rut, name: user.nombre },
        `rol:${data.rol_id} permisos antes=[${previos.map((fila) => fila.permiso).join(",")}] despues=[${permisos.join(",")}]`
    );

    return { id_rol: data.rol_id, permisos: permisos as Permiso[] };
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run src/modules/configuracion`
Expected: PASS.

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/modules/configuracion`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/configuracion
git commit -m "feat(rbac): configuracion por permisos y action guardarPermisosRol"
```

---

### Task 8: Declaracion de navegacion

**Files:**
- Create: `src/config/navegacion.ts`
- Test: `src/config/navegacion.test.ts`

**Interfaces:**
- Consumes: `type Permiso` (Task 1).
- Produces:
  - `interface NavItem { label: string; href: string; icon: LucideIcon; permiso: Permiso }`
  - `NAV: readonly NavItem[]`
  - `navVisible(permisos: readonly Permiso[]): NavItem[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/config/navegacion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NAV, navVisible } from "./navegacion";
import { CLAVES_PERMISOS, type Permiso } from "./permisos";

describe("navegacion", () => {
    it("usa solo permisos del catalogo", () => {
        for (const item of NAV) {
            expect(CLAVES_PERMISOS).toContain(item.permiso);
        }
    });

    it("apunta a rutas que existen como pagina", () => {
        for (const item of NAV) {
            const ruta = join(process.cwd(), "src/app/(app)", item.href, "page.tsx");
            expect(existsSync(ruta), `Falta la pagina para ${item.href}`).toBe(true);
        }
    });

    it("no repite rutas", () => {
        const hrefs = NAV.map((item) => item.href);
        expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it("navVisible filtra por los permisos entregados", () => {
        const visibles = navVisible(["comunicador.ver"] as Permiso[]);
        expect(visibles.map((item) => item.href)).toEqual(["/comunicador"]);
    });

    it("navVisible devuelve vacio sin permisos", () => {
        expect(navVisible([])).toEqual([]);
    });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/config/navegacion.test.ts`
Expected: FAIL — `Failed to resolve import "./navegacion"`.

- [ ] **Step 3: Implementar la navegacion**

Crear `src/config/navegacion.ts`:

```ts
import { BarChart3, ClipboardList, ClipboardCheck, Megaphone, Settings, type LucideIcon } from "lucide-react";
// config
import type { Permiso } from "@/config/permisos";

export interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    permiso: Permiso;
}

// Orden del menu lateral. Reemplaza a la tabla `menu`: la visibilidad la da el permiso.
export const NAV: readonly NavItem[] = [
    { label: "Solicitudes", href: "/solicitudes/ingresar", icon: ClipboardList, permiso: "solicitudes.ver" },
    { label: "Revisar solicitudes", href: "/solicitudes/revisar", icon: ClipboardCheck, permiso: "solicitudes.gestionar" },
    { label: "Llamadas", href: "/comunicador", icon: Megaphone, permiso: "comunicador.ver" },
    { label: "Dashboard", href: "/dashboard", icon: BarChart3, permiso: "dashboard.ver" },
    { label: "Configuracion", href: "/configuracion/usuarios-roles", icon: Settings, permiso: "config.ver" }
];

export function navVisible(permisos: readonly Permiso[]): NavItem[] {
    return NAV.filter((item) => permisos.includes(item.permiso));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/config/navegacion.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/config/navegacion.ts src/config/navegacion.test.ts
git commit -m "feat(rbac): navegacion declarativa por permisos"
```

---

### Task 9: Guards en paginas

**Files:**
- Create: `src/modules/solicitudes/components/IngresarSolicitudView.tsx` (movido desde `src/app/(app)/solicitudes/ingresar/page.tsx`)
- Create: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx` (movido desde `src/app/(app)/solicitudes/revisar/page.tsx`)
- Create: `src/modules/comunicador/components/ComunicadorView.tsx` (movido desde `src/app/(app)/comunicador/page.tsx`)
- Create: `src/modules/configuracion/components/UsuariosRolesView.tsx` (movido desde `src/app/(app)/configuracion/usuarios-roles/page.tsx`)
- Modify: `src/app/(app)/solicitudes/ingresar/page.tsx`, `src/app/(app)/solicitudes/revisar/page.tsx`, `src/app/(app)/comunicador/page.tsx`, `src/app/(app)/configuracion/usuarios-roles/page.tsx`, `src/app/(app)/dashboard/page.tsx`
- Test: `src/app/paginas-protegidas.test.ts`

**Interfaces:**
- Consumes: `requirePermisoPagina` (Task 3).
- Produces: componentes cliente `IngresarSolicitudView`, `RevisarSolicitudesView`, `ComunicadorView`, `UsuariosRolesView` — todos sin props, export nombrado.

Guards por ruta:

| Ruta | Permiso |
| --- | --- |
| `/solicitudes/ingresar` | `solicitudes.ver` |
| `/solicitudes/revisar` | `solicitudes.gestionar` |
| `/comunicador` | `comunicador.ver` |
| `/dashboard` | `dashboard.ver` |
| `/configuracion/usuarios-roles` | `config.ver` |
| `/sin-acceso` | sin guard (allowlist) |

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/paginas-protegidas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(process.cwd(), "src/app/(app)");

// Paginas que legitimamente no llevan guard de permiso.
const SIN_GUARD = ["sin-acceso"];

function buscarPaginas(directorio: string): string[] {
    const encontrados: string[] = [];
    for (const entrada of readdirSync(directorio)) {
        const ruta = join(directorio, entrada);
        if (statSync(ruta).isDirectory()) {
            encontrados.push(...buscarPaginas(ruta));
        } else if (entrada === "page.tsx") {
            encontrados.push(ruta);
        }
    }
    return encontrados;
}

describe("paginas protegidas", () => {
    const paginas = buscarPaginas(RAIZ);

    it("encuentra las paginas del grupo (app)", () => {
        expect(paginas.length).toBeGreaterThan(0);
    });

    it("toda pagina llama a requirePermisoPagina", () => {
        const sinGuard = paginas.filter((ruta) => {
            const relativa = ruta.slice(RAIZ.length + 1);
            if (SIN_GUARD.some((permitida) => relativa.startsWith(permitida))) return false;
            return !readFileSync(ruta, "utf8").includes("requirePermisoPagina");
        });
        expect(sinGuard, `Paginas sin guard de permiso: ${sinGuard.join(", ")}`).toEqual([]);
    });

    it("ninguna pagina del grupo (app) es componente cliente", () => {
        const clientes = paginas.filter((ruta) => readFileSync(ruta, "utf8").trimStart().startsWith('"use client"'));
        expect(clientes, `Paginas cliente sin guard server: ${clientes.join(", ")}`).toEqual([]);
    });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/app/paginas-protegidas.test.ts`
Expected: FAIL — 4 paginas cliente y 5 sin `requirePermisoPagina`.

- [ ] **Step 3: Mover las paginas cliente a componentes de modulo**

```bash
git mv "src/app/(app)/solicitudes/ingresar/page.tsx" src/modules/solicitudes/components/IngresarSolicitudView.tsx
git mv "src/app/(app)/solicitudes/revisar/page.tsx" src/modules/solicitudes/components/RevisarSolicitudesView.tsx
git mv "src/app/(app)/comunicador/page.tsx" src/modules/comunicador/components/ComunicadorView.tsx
git mv "src/app/(app)/configuracion/usuarios-roles/page.tsx" src/modules/configuracion/components/UsuariosRolesView.tsx
```

En cada archivo movido, cambiar la declaracion del componente principal de `export default function` a export nombrado:

- `IngresarSolicitudView.tsx`: `export default function IngresarSolicitudesPage()` pasa a `export function IngresarSolicitudView()`
- `RevisarSolicitudesView.tsx`: `export default function ...` pasa a `export function RevisarSolicitudesView()`
- `ComunicadorView.tsx`: `export default function ...` pasa a `export function ComunicadorView()`
- `UsuariosRolesView.tsx`: `export default function UsuariosRolesPage()` pasa a `export function UsuariosRolesView()`

El resto del contenido de cada archivo (incluida la directiva `"use client"` de la primera linea) queda intacto.

- [ ] **Step 4: Crear las paginas server con guard**

Crear `src/app/(app)/solicitudes/ingresar/page.tsx`:

```tsx
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { IngresarSolicitudView } from "@/modules/solicitudes/components/IngresarSolicitudView";

export default async function IngresarSolicitudPage() {
    await requirePermisoPagina("solicitudes.ver");
    return <IngresarSolicitudView />;
}
```

Crear `src/app/(app)/solicitudes/revisar/page.tsx`:

```tsx
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { RevisarSolicitudesView } from "@/modules/solicitudes/components/RevisarSolicitudesView";

export default async function RevisarSolicitudesPage() {
    await requirePermisoPagina("solicitudes.gestionar");
    return <RevisarSolicitudesView />;
}
```

Crear `src/app/(app)/comunicador/page.tsx`:

```tsx
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { ComunicadorView } from "@/modules/comunicador/components/ComunicadorView";

export default async function ComunicadorPage() {
    await requirePermisoPagina("comunicador.ver");
    return <ComunicadorView />;
}
```

Crear `src/app/(app)/configuracion/usuarios-roles/page.tsx`:

```tsx
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { UsuariosRolesView } from "@/modules/configuracion/components/UsuariosRolesView";

export default async function UsuariosRolesPage() {
    await requirePermisoPagina("config.ver");
    return <UsuariosRolesView />;
}
```

Reemplazar el contenido de `src/app/(app)/dashboard/page.tsx` por:

```tsx
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { StagePlaceholder } from "@/shared/components/layout/stage-placeholder";

export default async function DashboardPage() {
    await requirePermisoPagina("dashboard.ver");
    return <StagePlaceholder title="Dashboard" description="Modulo reservado para indicadores de solicitudes, citas y llamados." />;
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/app/paginas-protegidas.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 7: Commit**

```bash
git add -A src/app src/modules
git commit -m "feat(rbac): guard de permisos en todas las paginas del grupo (app)"
```

---

### Task 10: Sesion sin menu y AppShell por permisos

**Files:**
- Modify: `src/shared/types/session.ts`
- Modify: `src/shared/types/next-auth.d.ts`
- Modify: `src/auth.ts` (callbacks `signIn`, `jwt`, `session`)
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/shared/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: `getSessionPermisos` (Task 3), `NAV`, `navVisible` (Task 8).
- Produces:
  - `SessionUser` sin la propiedad `menu`; `MenuItem` deja de existir.
  - `AppShell` pasa a recibir props: `{ user: SessionUser; permisos: Permiso[]; children: React.ReactNode }`.

- [ ] **Step 1: Quitar MenuItem de los tipos**

Reemplazar el contenido completo de `src/shared/types/session.ts` por:

```ts
export interface SessionUser {
    rut: string;
    email: string;
    nombre: string;
    centro_id: string | null;
    centro_nombre: string | null;
    rol: { id: number; nombre: string };
}
```

Reemplazar el contenido completo de `src/shared/types/next-auth.d.ts` por:

```ts
declare module "next-auth" {
    interface Session {
        user: {
            name?: string | null;
            email?: string | null;
            image?: string | null;
            rut: string;
            nombre: string;
            centro_id: string | null;
            centro_nombre: string | null;
            rol: { id: number; nombre: string };
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        rut?: string;
        nombre?: string;
        centro_id?: string | null;
        centro_nombre?: string | null;
        rol?: { id: number; nombre: string };
    }
}
```

- [ ] **Step 2: Sacar el menu del JWT y validar el estado del rol**

En `src/auth.ts`:

Eliminar la linea de import de tipos:

```ts
import { MenuItem } from "@/shared/types/session";
```

En el callback `signIn`, reemplazar la consulta:

```ts
            const funcionario = await prisma.funcionario.findUnique({
                where: { email: user.email },
                select: { rut: true, nombre: true, estado: true }
            });
            if (!funcionario || !esEstadoActivo(funcionario.estado)) {
```

por:

```ts
            const funcionario = await prisma.funcionario.findUnique({
                where: { email: user.email },
                select: { rut: true, nombre: true, estado: true, role: { select: { estado: true } } }
            });
            if (!funcionario || !esEstadoActivo(funcionario.estado) || !esEstadoActivo(funcionario.role.estado)) {
```

y el mensaje de error de esa auditoria:

```ts
                await AuditLogger.logAuth("LOGIN", false, { name: user.name ?? "Desconocido" }, { error: "Funcionario no encontrado o inactivo", details: `Email: ${user.email}` });
```

por:

```ts
                await AuditLogger.logAuth("LOGIN", false, { name: user.name ?? "Desconocido" }, { error: "Funcionario o rol no encontrado o inactivo", details: `Email: ${user.email}` });
```

En el callback `jwt`, reemplazar el `select` del rol:

```ts
                        role: {
                            select: {
                                id_rol: true,
                                nombre_rol: true,
                                menus: {
                                    select: {
                                        id_menu: true,
                                        nombre: true,
                                        descripcion: true,
                                        ruta: true,
                                        imagen: true
                                    },
                                    orderBy: { id_menu: "asc" }
                                }
                            }
                        }
```

por:

```ts
                        role: { select: { id_rol: true, nombre_rol: true } }
```

y eliminar la asignacion del menu:

```ts
                    token.menu = funcionario.role.menus.map(
                        (m): MenuItem => ({ id: m.id_menu, nombre: m.nombre, descripcion: m.descripcion, ruta: m.ruta, imagen: m.imagen })
                    );
```

En el callback `session`, eliminar la linea:

```ts
                session.user.menu = (token.menu ?? []) as MenuItem[];
```

- [ ] **Step 3: Quitar menu de getSessionUser**

En `src/shared/lib/auth.ts`, reemplazar el `return` de `getSessionUser`:

```ts
    return { rut: u.rut, email: u.email ?? "", nombre: u.nombre, centro_id: u.centro_id, centro_nombre: u.centro_nombre, rol: u.rol, menu: u.menu };
```

por:

```ts
    return { rut: u.rut, email: u.email ?? "", nombre: u.nombre, centro_id: u.centro_id, centro_nombre: u.centro_nombre, rol: u.rol };
```

- [ ] **Step 4: Pasar usuario y permisos desde el layout**

Reemplazar el contenido completo de `src/app/(app)/layout.tsx` por:

```tsx
import { redirect } from "next/navigation";
// lib
import { getSessionPermisos } from "@/shared/lib/permisos";
// components
import { AppShell } from "@/shared/components/layout/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const contexto = await getSessionPermisos();
    if (!contexto) redirect("/auth/login");
    return (
        <AppShell user={contexto.user} permisos={[...contexto.permisos]}>
            {children}
        </AppShell>
    );
}
```

- [ ] **Step 5: Reescribir el nav del AppShell**

En `src/shared/components/layout/app-shell.tsx`, reemplazar todo el bloque que va desde el primer import hasta la linea `const isActive = (href: string) => ...` (es decir: imports, `iconByName`, `protectedPrefixes`, `NavLink`, `buildNavLinks`, `canAccess`, y la cabecera de `AppShell` con su `useEffect` y su early return) por:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
// lib
import { cn } from "@/shared/lib/utils";
// config
import { navVisible } from "@/config/navegacion";
import type { Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

interface AppShellProps {
    user: SessionUser;
    permisos: Permiso[];
    children: React.ReactNode;
}

export function AppShell({ user, permisos, children }: AppShellProps) {
    const pathname = usePathname();
    const navLinks = navVisible(permisos);
    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
```

En el JSX del nav lateral, reemplazar:

```tsx
                    {navLinks.map(({ key, href, label, Icon }) => {
                        const active = isActive(href);
```

por:

```tsx
                    {navLinks.map(({ href, label, icon: Icon }) => {
                        const active = isActive(href);
```

y en el `<Link>` de ese bloque cambiar `key={key}` por `key={href}`.

En el nav movil, reemplazar:

```tsx
                        {navLinks.map(({ key, href, label }) => (
                            <Link
                                key={key}
```

por:

```tsx
                        {navLinks.map(({ href, label }) => (
                            <Link
                                key={href}
```

El resto del JSX (logos, datos del usuario, boton Salir, `<main>`) queda igual.

- [ ] **Step 6: Verificar tipos y tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores de tipos; suite completa en verde.

- [ ] **Step 7: Verificar que nada referencia el menu de sesion**

Run: `grep -rn "MenuItem\|user.menu\|token.menu" src`
Expected: sin resultados.

- [ ] **Step 8: Probar en el navegador**

Run: `npm run dev`

Verificar manualmente con `orientador@demo.local`: el nav muestra Solicitudes, Revisar solicitudes y Llamadas; navegar a `/configuracion/usuarios-roles` por URL redirige a `/sin-acceso`.

- [ ] **Step 9: Commit**

```bash
git add src/auth.ts src/shared src/app
git commit -m "feat(rbac): sesion sin menu y navegacion filtrada por permisos"
```

---

### Task 11: Matriz de permisos en el mantenedor

**Files:**
- Create: `src/modules/configuracion/components/PermisosRolModal.tsx`
- Modify: `src/modules/configuracion/components/UsuariosRolesView.tsx` (imports, estado, tabla de roles, render de modales)

**Interfaces:**
- Consumes: `agruparPermisos`, `type Permiso` (Task 1); `guardarPermisosRol` (Task 7); `getMantenedoresConfig` ahora devuelve `roles[].permisos`.
- Produces: `PermisosRolModal` con props `{ rol: RolConPermisos; onClose: () => void; onSaved: () => void }` y `interface RolConPermisos { id_rol: number; nombre_rol: string; permisos: { permiso: string }[] }`.

- [ ] **Step 1: Crear el modal**

Crear `src/modules/configuracion/components/PermisosRolModal.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
// actions
import { guardarPermisosRol } from "@/modules/configuracion/actions/mantenedores.action";
// config
import { agruparPermisos, esPermiso, type Permiso } from "@/config/permisos";
// components
import { Button } from "@/shared/components/ui/button";

export interface RolConPermisos {
    id_rol: number;
    nombre_rol: string;
    permisos: { permiso: string }[];
}

const GRUPOS = agruparPermisos();

export function PermisosRolModal({ rol, onClose, onSaved }: { rol: RolConPermisos; onClose: () => void; onSaved: () => void }) {
    const [seleccion, setSeleccion] = useState<Permiso[]>(() => rol.permisos.map((fila) => fila.permiso).filter(esPermiso));
    const [saving, setSaving] = useState(false);

    const alternar = (permiso: Permiso, activo: boolean) => {
        setSeleccion((actual) => (activo ? [...actual, permiso] : actual.filter((clave) => clave !== permiso)));
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        try {
            await guardarPermisosRol({ rol_id: rol.id_rol, permisos: seleccion });
            toast.success("Permisos actualizados");
            onSaved();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error al guardar permisos");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border bg-background shadow-lg">
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold">Permisos de {rol.nombre_rol}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Marca las acciones que este rol puede realizar.</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <form className="grid gap-5 p-5" onSubmit={submit}>
                    {GRUPOS.map((grupo) => (
                        <div key={grupo.modulo} className="space-y-2">
                            <p className="text-sm font-semibold">{grupo.modulo}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {grupo.permisos.map((permiso) => (
                                    <label key={permiso.clave} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={seleccion.includes(permiso.clave)}
                                            onChange={(event) => alternar(permiso.clave, event.target.checked)}
                                            className="h-4 w-4 rounded border-input"
                                        />
                                        <span>{permiso.etiqueta}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Conectar el modal en la vista**

En `src/modules/configuracion/components/UsuariosRolesView.tsx`:

Agregar al bloque de imports de components:

```tsx
import { PermisosRolModal, type RolConPermisos } from "@/modules/configuracion/components/PermisosRolModal";
```

Agregar el estado junto a `const [modal, setModal] = useState<TabKey | null>(null);`:

```tsx
    const [rolPermisos, setRolPermisos] = useState<RolConPermisos | null>(null);
```

Reemplazar la celda de acciones de la tabla de roles:

```tsx
                                    <td className="px-3 py-3">
                                        <RowActions
                                            active={rol.estado === "Activo"}
                                            onEdit={() => {
                                                setRolForm({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Activo" : "Inactivo" });
                                                setModal("roles");
                                            }}
                                            onToggle={() => guardarRol({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Inactivo" : "Activo" }).then(() => loadData()).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cambiar estado"))}
                                        />
                                    </td>
```

por:

```tsx
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <Button type="button" variant="outline" size="sm" onClick={() => setRolPermisos({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, permisos: rol.permisos })}>
                                                Permisos
                                            </Button>
                                            <RowActions
                                                active={rol.estado === "Activo"}
                                                onEdit={() => {
                                                    setRolForm({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Activo" : "Inactivo" });
                                                    setModal("roles");
                                                }}
                                                onToggle={() => guardarRol({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Inactivo" : "Activo" }).then(() => loadData()).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cambiar estado"))}
                                            />
                                        </div>
                                    </td>
```

Y agregar, junto al render de los demas `ConfigModal` (antes del cierre del componente):

```tsx
            {rolPermisos && (
                <PermisosRolModal
                    rol={rolPermisos}
                    onClose={() => setRolPermisos(null)}
                    onSaved={() => {
                        setRolPermisos(null);
                        loadData();
                    }}
                />
            )}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Probar en el navegador**

Run: `npm run dev`

Con `admin@demo.local`: en Configuracion → Roles, boton "Permisos" abre la matriz con los permisos actuales marcados. Desmarcar "Ver indicadores" en el rol Administrador y guardar; recargar y comprobar que Dashboard desaparece del nav. Volver a marcarlo. Intentar desmarcar "Editar roles y permisos" del propio rol muestra el toast de error y no guarda.

- [ ] **Step 5: Commit**

```bash
git add src/modules/configuracion
git commit -m "feat(rbac): matriz de permisos por rol en el mantenedor"
```

---

### Task 12: Seed declarativo y limpieza de access.ts

**Files:**
- Modify: `prisma/seed.ts:12-42` (tipo `MenuTuple` y `roleMenus`), y el bloque de siembra de menus
- Modify: `src/shared/lib/access.ts`
- Modify: `src/shared/lib/access.test.ts`

**Interfaces:**
- Consumes: `type Permiso` (Task 1).
- Produces: `access.ts` exporta unicamente `ESTADOS_ACTIVOS` y `esEstadoActivo`.

El seed sigue creando la tabla `menu` mientras el modelo exista (se elimina en la Task 13). Aqui solo **agrega** la siembra de `roles_permisos`.

- [ ] **Step 1: Reducir access.ts**

Reemplazar el contenido completo de `src/shared/lib/access.ts` por:

```ts
export const ESTADOS_ACTIVOS = ["Activo", "1"] as const;

export function esEstadoActivo(estado: string | null | undefined): boolean {
    if (!estado) return false;
    return (ESTADOS_ACTIVOS as readonly string[]).includes(estado.trim());
}
```

Reemplazar el contenido completo de `src/shared/lib/access.test.ts` por:

```ts
import { describe, it, expect } from "vitest";
import { esEstadoActivo } from "./access";

describe("esEstadoActivo", () => {
    it("acepta los estados activos conocidos", () => {
        expect(esEstadoActivo("Activo")).toBe(true);
        expect(esEstadoActivo(" 1 ")).toBe(true);
    });

    it("rechaza estados inactivos, vacios o nulos", () => {
        expect(esEstadoActivo("Inactivo")).toBe(false);
        expect(esEstadoActivo("")).toBe(false);
        expect(esEstadoActivo(null)).toBe(false);
        expect(esEstadoActivo(undefined)).toBe(false);
    });
});
```

- [ ] **Step 2: Correr los tests y verificar que la suite sigue verde**

Run: `npm test`
Expected: PASS. Las tareas 5–7 ya eliminaron todos los usos de `puedeAcceder*`, asi que reducir `access.ts` no debe romper nada. Si algun archivo aun lo importa, el fallo lo delata: corregirlo aqui antes de continuar.

- [ ] **Step 3: Sembrar permisos por rol**

En `prisma/seed.ts`, agregar tras la declaracion de `roleMenus` (linea 42):

```ts
const rolePermisos: Record<string, Permiso[]> = {
    Administrador: ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente", "dashboard.ver", "config.ver", "config.funcionarios", "config.roles", "config.catalogos"],
    Orientador: ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente"],
    Comunicador: ["comunicador.ver", "comunicador.llamar", "comunicador.paciente"],
    SOME: ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente", "dashboard.ver", "config.ver", "config.funcionarios", "config.roles", "config.catalogos"],
    "Orientador y Comunicador": ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente"],
    "Gestor y Comunicador": ["comunicador.ver", "comunicador.llamar", "comunicador.paciente"],
    Full: ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente", "dashboard.ver", "config.ver", "config.funcionarios", "config.roles", "config.catalogos"]
};
```

(El import del catalogo se agrega en el Step siguiente, junto al reporte de claves huerfanas.)

Y en `main()`, inmediatamente despues del bucle que crea los menus (tras el cierre del `for` que contiene `prisma.menu.create`), agregar:

```ts
    await prisma.rolPermiso.deleteMany();
    for (const [roleName, permisos] of Object.entries(rolePermisos)) {
        const role = roleByName.get(roleName);
        if (!role) continue;
        await prisma.rolPermiso.createMany({
            data: permisos.map((permiso) => ({ rol_id: role.id_rol, permiso })),
            skipDuplicates: true
        });
    }
    console.log(`Seed: permisos sembrados para ${Object.keys(rolePermisos).length} roles`);

    const huerfanos = await prisma.rolPermiso.findMany({
        where: { permiso: { notIn: CLAVES_PERMISOS } },
        select: { rol_id: true, permiso: true }
    });
    for (const fila of huerfanos) {
        console.warn(`WARN  Permiso desconocido en BD: rol ${fila.rol_id} -> "${fila.permiso}" (se ignora al leer)`);
    }
```

Agregar `CLAVES_PERMISOS` al import del catalogo en el tope del archivo:

```ts
import { CLAVES_PERMISOS, type Permiso } from "../src/config/permisos";
```

- [ ] **Step 4: Resembrar y verificar**

Run:

```bash
npm run db:seed
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.rolPermiso.groupBy({ by: ['rol_id'], _count: true }).then(r => { console.log(r); return p.\$disconnect(); })"
```

Expected: 7 grupos, con conteos 11 (Administrador), 6 (Orientador), 3 (Comunicador), 11 (SOME), 6 (Orientador y Comunicador), 3 (Gestor y Comunicador), 11 (Full).

- [ ] **Step 5: Correr la suite completa**

Run: `npm test && npm run lint`
Expected: PASS, sin warnings de lint nuevos.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts src/shared/lib/access.ts src/shared/lib/access.test.ts
git commit -m "feat(rbac): seed declarativo de permisos y limpieza de access"
```

---

### Task 13: Eliminar el modelo Menu

**Files:**
- Modify: `prisma/schema.prisma` (eliminar `model Menu` y la relacion `menus` de `Role`)
- Modify: `prisma/seed.ts` (eliminar `MenuTuple`, `roleMenus` y la siembra de menus)
- Modify: `prisma/scripts/derivar-permisos.ts` (dejar de leer `menus`)
- Modify: `AGENTS.md` (seccion "Datos y reglas de negocio" y "Auth")

Esta tarea va **al final y en commit separado**: es el paso destructivo. Solo ejecutarla cuando la Task 4 ya corrio en produccion y el codigo de las tareas 5–12 esta desplegado y verificado.

**Interfaces:**
- Consumes: nada nuevo.
- Produces: esquema sin `Menu`; el script de derivacion queda como registro historico pero sin dependencia de la tabla.

- [ ] **Step 1: Congelar el script de derivacion**

En `prisma/scripts/derivar-permisos.ts`, reemplazar el cuerpo de `main()` por:

```ts
async function main() {
    console.log("Este script ya fue aplicado: la tabla `menu` fue eliminada del esquema.");
    console.log("Se conserva por trazabilidad de la migracion a RBAC (ver docs/superpowers/specs/2026-07-23-rbac-permisos-design.md).");
    console.log("La derivacion sigue testeada en derivar-permisos.test.ts.");
}
```

y eliminar la constante `const prisma = new PrismaClient();`, el import de `PrismaClient`, y el `.finally(() => prisma.$disconnect())` de la invocacion final, que pasa a ser:

```ts
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

La funcion `derivarPermisos` y sus constantes legadas quedan intactas.

- [ ] **Step 2: Verificar que el test de derivacion sigue verde**

Run: `npx vitest run prisma/scripts/derivar-permisos.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 3: Quitar los menus del seed**

En `prisma/seed.ts`, eliminar:

- el tipo `type MenuTuple = [nombre: string, ruta: string, descripcion: string];`
- la constante `const roleMenus: Record<string, MenuTuple[]> = { ... };` completa
- el bloque `await prisma.menu.deleteMany();` y el `for` que lo sigue con `prisma.menu.create`

Ajustar el mensaje inicial:

```ts
    console.log(`Seed: modo ${SEED_DEMO ? "completo (roles + permisos + funcionarios reales + demo)" : "produccion (roles + permisos + funcionarios reales)"}`);
```

- [ ] **Step 4: Eliminar el modelo del esquema**

En `prisma/schema.prisma`, eliminar el bloque `model Menu { ... }` completo y la linea `menus      Menu[]` de `model Role`.

- [ ] **Step 5: Aplicar y verificar**

Run:

```bash
npm run db:push
npm run db:generate
npm run db:seed
npm test
npm run build
```

Expected: `db:push` reporta que elimina la tabla `menu`; seed, tests y build en verde.

- [ ] **Step 6: Actualizar AGENTS.md**

En la seccion **Auth**, reemplazar:

```
- La sesion expone `rut`, `nombre`, `rol`, `menu`; el acceso por rol se deriva del menu cargado.
```

por:

```
- La sesion expone `rut`, `nombre`, `rol` y `centro`; los permisos se leen por request desde `roles_permisos` (`src/shared/lib/permisos.ts`).
```

En la seccion **Datos y reglas de negocio**, reemplazar:

```
- Modelos clave: `Funcionario`/`Role`/`Menu`, `Usuario`, `Solicitud`, `Llamada`, `TipoSolicitud`/`Motivo`.
```

por:

```
- Modelos clave: `Funcionario`/`Role`/`RolPermiso`, `Usuario`, `Solicitud`, `Llamada`, `TipoSolicitud`/`Motivo`.
```

y reemplazar:

```
- Acceso a solicitudes: `Administrador`, `Orientador`, `SOME`, `Orientador y Comunicador`, `Full`.
```

por:

```
- Autorizacion: catalogo de permisos en `src/config/permisos.ts`; asignacion por rol en la tabla `roles_permisos`, editable desde Configuracion → Roles → Permisos.
- Paginas protegidas con `requirePermisoPagina`; Server Actions con `requirePermiso`. El middleware solo valida autenticacion.
```

En la seccion **Backend (Server Actions)**, reemplazar:

```
- Validar inputs con Zod. Control de acceso via sesion (`requireSessionUser`, `puedeAccederSolicitudes`).
```

por:

```
- Validar inputs con Zod. Control de acceso con `requirePermiso('modulo.accion')` de `src/shared/lib/permisos.ts`.
```

- [ ] **Step 7: Commit**

```bash
git add prisma AGENTS.md
git commit -m "refactor(rbac): eliminar la tabla menu del esquema y el seed"
```

---

## Verificacion final

- [ ] `npm test` — toda la suite en verde
- [ ] `npm run lint` — sin errores
- [ ] `npm run build` — build exitoso
- [ ] `grep -rn "puedeAcceder\|MenuItem\|user.menu\|prisma.menu" src prisma` — sin resultados
- [ ] Prueba manual con cada funcionario demo (`admin@`, `orientador@`, `comunicador@`, `some@`, `full@`): el nav muestra exactamente lo permitido, y escribir por URL una ruta no permitida redirige a `/sin-acceso`

## Despliegue en produccion

Orden obligatorio (el paso destructivo va al final):

1. Desplegar hasta el commit de la Task 12 (crea `roles_permisos`, no toca `menu`).
2. Ejecutar `npm run db:rbac:migrar` en el servidor. **Leer todas las lineas `WARN`**: cada una es un rol que quedaria sin acceso.
3. Revisar el resumen contra la realidad operativa; corregir desde Configuracion → Roles → Permisos lo que falte, en especial el rol `Full` (gana `config.*` completo por union con la lista legada).
4. Verificar con un usuario de cada rol antes de continuar.
5. Solo entonces desplegar el commit de la Task 13, que elimina la tabla `menu`.

Si algo falla entre los pasos 2 y 4, la tabla `menu` sigue intacta y el rollback es volver al commit anterior.
