# Gestor Contexto y Edicion de Citas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar al gestor las solicitudes En Curso y citas pendientes del paciente en su centro, y permitir editar priorizacion clinica y fecha estimada de una cita mientras siga sin contacto.

**Architecture:** Implementacion por etapas: primero reglas puras y concurrencia de backend, luego action de consulta/edicion, y finalmente reutilizacion de la cascada e integracion UI con Dialog. La cascada queda como componente reutilizable con slots de acciones para no duplicar la vista de Ingresar y Revisar. La edicion de citas usa `ResultadoAccion<T>` para errores de negocio visibles y `SELECT ... FOR UPDATE` para serializar edicion vs llamada.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript strict, Prisma + MySQL, Zod, Vitest + Testing Library, Tailwind v3 + shadcn/ui, sonner.

## Global Constraints

- Idioma espanol (UI, comentarios, commits). Indentacion: 4 espacios.
- TypeScript strict; tipos explicitos. `interface` para objetos, `type`/`as const` para uniones.
- Alias `@/` -> `src/`. Imports categorizados con comentarios (`// lib`, `// components`, etc.).
- Server Actions con `'use server'`, sufijo `.action.ts`, validacion Zod y guard `requirePermiso` como primera linea ejecutable.
- Reusar permiso `solicitudes.gestionar`; no agregar permisos, migraciones ni seed.
- Alcance de centro: solo el centro del gestor.
- Solicitudes mostradas: todas las `En Curso` del RUT, excepto la actual.
- Citas mostradas: estados pendientes (`ESTADOS_PENDIENTES`).
- Condicion de edicion: `estado_cita = "Sin llamadas"` y 0 filas en `llamadas`.
- Campos editables: `priorizacion_clinica` y `fecha_estimada_atencion`; recalcular `priorizacion`.
- Concurrencia: `SELECT ... FOR UPDATE` en `editarCita` y `registrarLlamada`.
- shadcn: usar `Dialog` instalado por CLI, `flex flex-col gap-*` en vez de `space-y-*`, iconos lucide con `data-icon` en botones.
- Verificacion final obligatoria: `npm test`, `npx tsc --noEmit`, `npm run lint`.

---

## Estrategia de Ejecucion por Etapas

Este plan es lo bastante grande como para ejecutarse por etapas. Cada etapa deja software testeable y revisable:

1. **Etapa A - Backend seguro:** tipos, reglas puras, schema, concurrencia y `editarCita`.
2. **Etapa B - Contexto del paciente:** `getOtrasSolicitudes` devuelve solicitudes y citas editables.
3. **Etapa C - UI reusable:** cascada reusable + datos visibles en `CitaRow`.
4. **Etapa D - Integracion Revisar:** Dialog de contexto, acciones condicionales y dialog de edicion.

---

### Task 1: Tipos Compartidos y Reglas Puras de Citas

**Files:**
- Create: `src/modules/solicitudes/types/pendientes.ts`
- Create: `src/modules/solicitudes/utils/citas.ts`
- Test: `src/modules/solicitudes/utils/citas.test.ts`
- Modify: `src/modules/solicitudes/actions/gestionarSolicitud.action.ts`
- Test: `src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts`

**Interfaces:**
- Produces: `SolicitudCascada`, `CitaCascada`, `CitaCascadaConEdicion`.
- Produces: `esCitaEditable(cita: { estado_cita: string | null; cantidadLlamadas: number }): boolean`.
- Produces: `evaluarFechaEstimada(value: string): { ok: true; fecha: Date } | { ok: false; error: string }`.
- Produces: `calcularPriorizacionCita(priorizacionClinica: PrioridadClinica, priorizacionAdministrativa: number | null | undefined): number`.
- Consumes: `ESTADO_CITA.SIN_LLAMADAS` and `PRIORIZACION_CLINICA_NUMERICA`.

- [ ] **Step 1: Escribir tests de reglas puras**

Crear `src/modules/solicitudes/utils/citas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// utils
import { calcularPriorizacionCita, esCitaEditable, evaluarFechaEstimada } from "./citas";

function dateInputFromOffset(days: number): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function maxDateInput(extraDays = 0): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setFullYear(date.getFullYear() + 2);
    date.setDate(date.getDate() + extraDays);
    return date.toISOString().slice(0, 10);
}

describe("esCitaEditable", () => {
    it("permite solo citas Sin llamadas y sin llamadas registradas", () => {
        expect(esCitaEditable({ estado_cita: "Sin llamadas", cantidadLlamadas: 0 })).toBe(true);
        expect(esCitaEditable({ estado_cita: "Sin llamadas", cantidadLlamadas: 1 })).toBe(false);
        expect(esCitaEditable({ estado_cita: "Solo llamada de aviso", cantidadLlamadas: 0 })).toBe(false);
        expect(esCitaEditable({ estado_cita: "No contesta (1)", cantidadLlamadas: 0 })).toBe(false);
        expect(esCitaEditable({ estado_cita: null, cantidadLlamadas: 0 })).toBe(false);
    });
});

describe("evaluarFechaEstimada", () => {
    it("acepta hoy y hoy mas dos anos", () => {
        expect(evaluarFechaEstimada(dateInputFromOffset(0)).ok).toBe(true);
        expect(evaluarFechaEstimada(maxDateInput(0)).ok).toBe(true);
    });

    it("rechaza fechas fuera de rango o invalidas", () => {
        expect(evaluarFechaEstimada(dateInputFromOffset(-1))).toEqual({ ok: false, error: "La fecha estimada no puede ser anterior a hoy" });
        expect(evaluarFechaEstimada(maxDateInput(1))).toEqual({ ok: false, error: "La fecha estimada no puede superar los 2 años" });
        expect(evaluarFechaEstimada("no-es-fecha")).toEqual({ ok: false, error: "Fecha estimada invalida" });
    });
});

describe("calcularPriorizacionCita", () => {
    it("suma priorizacion clinica y administrativa", () => {
        expect(calcularPriorizacionCita("Alta", 10)).toBe(70);
        expect(calcularPriorizacionCita("Baja", null)).toBe(20);
    });

    it("aplica tope 100", () => {
        expect(calcularPriorizacionCita("Urgente", 45)).toBe(100);
    });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test -- src/modules/solicitudes/utils/citas.test.ts`
Expected: FAIL porque `src/modules/solicitudes/utils/citas.ts` no existe.

- [ ] **Step 3: Crear tipos de cascada**

Crear `src/modules/solicitudes/types/pendientes.ts`:

```ts
export interface SolicitudCascada {
    id_solicitud: string;
    fecha_inicio: Date | string;
    descripcion: string | null;
    estado_solicitud: string;
    accion: string | null;
    tipoSolicitud: { nombre_tipo_solicitud: string } | null;
    motivo: { nombre_motivo: string } | null;
}

export interface CitaCascada {
    id_cita: string;
    solicitud_id: string | null;
    estado_cita: string | null;
    observacion: string | null;
    priorizacion_clinica: string | null;
    fecha_estimada_atencion: Date | string | null;
    profesional: { nombre: string } | null;
    prestacion: { nombre_prestacion: string } | null;
}

export interface CitaCascadaConEdicion extends CitaCascada {
    editable: boolean;
}
```

- [ ] **Step 4: Crear utilidades de citas**

Crear `src/modules/solicitudes/utils/citas.ts`:

```ts
// schemas
import { PRIORIZACION_CLINICA_NUMERICA, type PRIORIDADES_CLINICAS } from "../schemas/revision.schema";
// types
import { ESTADO_CITA } from "@/modules/comunicador/types/comunicador";

export type PrioridadClinica = (typeof PRIORIDADES_CLINICAS)[number];

export function esCitaEditable(cita: { estado_cita: string | null; cantidadLlamadas: number }): boolean {
    return cita.estado_cita === ESTADO_CITA.SIN_LLAMADAS && cita.cantidadLlamadas === 0;
}

export function evaluarFechaEstimada(value: string): { ok: true; fecha: Date } | { ok: false; error: string } {
    const fecha = new Date(`${value}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return { ok: false, error: "Fecha estimada invalida" };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const maxima = new Date(hoy);
    maxima.setFullYear(maxima.getFullYear() + 2);

    if (fecha < hoy) return { ok: false, error: "La fecha estimada no puede ser anterior a hoy" };
    if (fecha > maxima) return { ok: false, error: "La fecha estimada no puede superar los 2 años" };
    return { ok: true, fecha };
}

export function calcularPriorizacionCita(priorizacionClinica: PrioridadClinica, priorizacionAdministrativa: number | null | undefined): number {
    return Math.min(100, PRIORIZACION_CLINICA_NUMERICA[priorizacionClinica] + (priorizacionAdministrativa ?? 0));
}
```

- [ ] **Step 5: Ejecutar tests de utilidades**

Run: `npm test -- src/modules/solicitudes/utils/citas.test.ts`
Expected: PASS.

- [ ] **Step 6: Migrar `gestionarSolicitud` a las utilidades**

En `src/modules/solicitudes/actions/gestionarSolicitud.action.ts`, eliminar `PRIORIZACION_CLINICA_NUMERICA` del import de schema y agregar:

```ts
// utils
import { calcularPriorizacionCita, evaluarFechaEstimada } from "../utils/citas";
```

Eliminar las funciones locales `validarFechaEstimada` y `calcularPriorizacionCita`. Agregar esta funcion local para conservar el comportamiento actual con `throw`:

```ts
function validarFechaEstimada(value: string): Date {
    const resultado = evaluarFechaEstimada(value);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.fecha;
}
```

- [ ] **Step 7: Mover el test de tope 100 a utilidades y dejar gestion verde**

En `src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts`, eliminar el caso `aplica tope 100 a la priorizacion de cita` porque ahora vive en `utils/citas.test.ts`. Mantener el caso `realiza solicitud e inserta citas con prioridad numerica`.

Run: `npm test -- src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts src/modules/solicitudes/utils/citas.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/solicitudes/types/pendientes.ts src/modules/solicitudes/utils/citas.ts src/modules/solicitudes/utils/citas.test.ts src/modules/solicitudes/actions/gestionarSolicitud.action.ts src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts
git commit -m "feat(solicitudes): reglas compartidas para citas pendientes"
```

---

### Task 2: Schema y Action `editarCita`

**Files:**
- Modify: `src/modules/solicitudes/schemas/revision.schema.ts`
- Create: `src/shared/types/resultado.ts` if absent after the RBAC dependency branch is merged
- Create: `src/modules/solicitudes/actions/editarCita.action.ts`
- Test: `src/modules/solicitudes/actions/editarCita.action.test.ts`
- Modify: `src/modules/permisos-por-action.test.ts`

**Interfaces:**
- Consumes: `editarCitaSchema`.
- Produces: `editarCita(input): Promise<ResultadoAccion<CitaEditada>>`.
- Produces: `CitaEditada = { id_cita: string; priorizacion_clinica: PrioridadClinica; priorizacion: number; fecha_estimada_atencion: Date | null }`.

- [ ] **Step 1: Agregar schema y tipos de input**

En `src/modules/solicitudes/schemas/revision.schema.ts`, despues de `gestionarSolicitudSchema`, agregar:

```ts
export const editarCitaSchema = z.object({
    id_cita: z.string().trim().min(1, "Cita requerida"),
    priorizacion_clinica: z.enum(PRIORIDADES_CLINICAS),
    fecha_estimada_atencion: z.string().trim().min(1, "Fecha estimada requerida")
});

export type EditarCitaInput = z.input<typeof editarCitaSchema>;
export type EditarCitaData = z.output<typeof editarCitaSchema>;
```

- [ ] **Step 2: Asegurar tipo `ResultadoAccion`**

Si `src/shared/types/resultado.ts` no existe tras integrar la spec RBAC, crearlo:

```ts
export type ResultadoAccion<T> = { ok: true; data: T } | { ok: false; error: string };
```

- [ ] **Step 3: Escribir tests de `editarCita`**

Crear `src/modules/solicitudes/actions/editarCita.action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
    $queryRaw: vi.fn(),
    cita: { findUnique: vi.fn(), update: vi.fn() }
};

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $transaction: vi.fn(async (callback: any) => callback(tx)),
        funcionario: { findUnique: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { editarCita } from "./editarCita.action";

const fechaValida = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "gestor@demo.local",
        nombre: "Gestor",
        centro_id: "650",
        rol: { id: 2, nombre: "Gestor" }
    });
    tx.$queryRaw.mockResolvedValue([{ id_cita: "CITA-1" }]);
    tx.cita.findUnique.mockResolvedValue({
        id_cita: "CITA-1",
        centro_id: "650",
        estado_cita: "Sin llamadas",
        priorizacion_clinica: "Alta",
        priorizacion: 70,
        fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
        usuario: { priorizacion_administrativa: 10 },
        _count: { llamadas: 0 }
    });
    tx.cita.update.mockResolvedValue({
        id_cita: "CITA-1",
        priorizacion_clinica: "Media",
        priorizacion: 50,
        fecha_estimada_atencion: new Date(`${fechaValida}T00:00:00`)
    });
});

describe("editarCita", () => {
    it("rechaza permiso faltante", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(editarCita({} as never)).rejects.toThrow("No tienes permiso");
    });

    it("actualiza cita editable recalculando priorizacion", async () => {
        const result = await editarCita({ id_cita: "CITA-1", priorizacion_clinica: "Media", fecha_estimada_atencion: fechaValida });

        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(tx.cita.findUnique).toHaveBeenCalledTimes(1);
        expect(tx.cita.update).toHaveBeenCalledWith({
            where: { id_cita: "CITA-1" },
            data: {
                priorizacion_clinica: "Media",
                fecha_estimada_atencion: expect.any(Date),
                priorizacion: 50
            },
            select: {
                id_cita: true,
                priorizacion_clinica: true,
                priorizacion: true,
                fecha_estimada_atencion: true
            }
        });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("UPDATE", true, { id: "gestor@demo.local", name: "Gestor", rut: "22.222.222-2" }, "CITA-1", {
            details: expect.stringContaining("Cita editada")
        });
        expect(result).toEqual({
            ok: true,
            data: {
                id_cita: "CITA-1",
                priorizacion_clinica: "Media",
                priorizacion: 50,
                fecha_estimada_atencion: expect.any(Date)
            }
        });
    });

    it("bloquea cita inexistente u otro centro sin escribir", async () => {
        tx.cita.findUnique.mockResolvedValueOnce(null);
        await expect(editarCita({ id_cita: "CITA-X", priorizacion_clinica: "Media", fecha_estimada_atencion: fechaValida })).resolves.toEqual({
            ok: false,
            error: "La cita no existe o no pertenece a tu centro"
        });
        expect(tx.cita.update).not.toHaveBeenCalled();
    });

    it("bloquea cita con llamadas registradas", async () => {
        tx.cita.findUnique.mockResolvedValueOnce({
            id_cita: "CITA-1",
            centro_id: "650",
            estado_cita: "Sin llamadas",
            priorizacion_clinica: "Alta",
            priorizacion: 70,
            fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
            usuario: { priorizacion_administrativa: 10 },
            _count: { llamadas: 1 }
        });
        await expect(editarCita({ id_cita: "CITA-1", priorizacion_clinica: "Baja", fecha_estimada_atencion: fechaValida })).resolves.toEqual({
            ok: false,
            error: "La cita ya tiene llamadas registradas y no se puede modificar"
        });
        expect(tx.cita.update).not.toHaveBeenCalled();
    });

    it("bloquea estado distinto de Sin llamadas", async () => {
        tx.cita.findUnique.mockResolvedValueOnce({
            id_cita: "CITA-1",
            centro_id: "650",
            estado_cita: "Solo llamada de aviso",
            priorizacion_clinica: "Alta",
            priorizacion: 70,
            fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
            usuario: { priorizacion_administrativa: 10 },
            _count: { llamadas: 0 }
        });
        const result = await editarCita({ id_cita: "CITA-1", priorizacion_clinica: "Baja", fecha_estimada_atencion: fechaValida });
        expect(result).toEqual({ ok: false, error: "La cita ya tiene llamadas registradas y no se puede modificar" });
        expect(tx.cita.update).not.toHaveBeenCalled();
    });

    it("bloquea fecha anterior a hoy antes de abrir transaccion", async () => {
        const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const result = await editarCita({ id_cita: "CITA-1", priorizacion_clinica: "Media", fecha_estimada_atencion: ayer });
        expect(result).toEqual({ ok: false, error: "La fecha estimada no puede ser anterior a hoy" });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 4: Ejecutar test y verificar que falla**

Run: `npm test -- src/modules/solicitudes/actions/editarCita.action.test.ts`
Expected: FAIL porque la action no existe.

- [ ] **Step 5: Implementar `editarCita.action.ts`**

Crear `src/modules/solicitudes/actions/editarCita.action.ts`:

```ts
"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { editarCitaSchema, type EditarCitaInput } from "../schemas/revision.schema";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
import type { PrioridadClinica } from "../utils/citas";
// utils
import { calcularPriorizacionCita, esCitaEditable, evaluarFechaEstimada } from "../utils/citas";

export interface CitaEditada {
    id_cita: string;
    priorizacion_clinica: PrioridadClinica;
    priorizacion: number;
    fecha_estimada_atencion: Date | null;
}

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string | null> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    return funcionario?.centro_id ?? null;
}

export async function editarCita(input: EditarCitaInput): Promise<ResultadoAccion<CitaEditada>> {
    const user = await requirePermiso("solicitudes.gestionar");
    const data = editarCitaSchema.parse(input);
    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    if (!centroId) return { ok: false, error: "El funcionario activo no tiene centro asignado" };

    const fecha = evaluarFechaEstimada(data.fecha_estimada_atencion);
    if (!fecha.ok) return { ok: false, error: fecha.error };

    const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id_cita FROM citas WHERE id_cita = ${data.id_cita} FOR UPDATE`;
        const cita = await tx.cita.findUnique({
            where: { id_cita: data.id_cita },
            select: {
                id_cita: true,
                centro_id: true,
                estado_cita: true,
                priorizacion_clinica: true,
                priorizacion: true,
                fecha_estimada_atencion: true,
                usuario: { select: { priorizacion_administrativa: true } },
                _count: { select: { llamadas: true } }
            }
        });

        if (!cita || cita.centro_id !== centroId) return { ok: false as const, error: "La cita no existe o no pertenece a tu centro" };
        if (!esCitaEditable({ estado_cita: cita.estado_cita, cantidadLlamadas: cita._count.llamadas })) {
            return { ok: false as const, error: "La cita ya tiene llamadas registradas y no se puede modificar" };
        }

        const priorizacion = calcularPriorizacionCita(data.priorizacion_clinica, cita.usuario?.priorizacion_administrativa);
        const citaEditada = await tx.cita.update({
            where: { id_cita: cita.id_cita },
            data: {
                priorizacion_clinica: data.priorizacion_clinica,
                fecha_estimada_atencion: fecha.fecha,
                priorizacion
            },
            select: {
                id_cita: true,
                priorizacion_clinica: true,
                priorizacion: true,
                fecha_estimada_atencion: true
            }
        });

        return { ok: true as const, data: citaEditada as CitaEditada, anterior: cita };
    });

    if (!result.ok) return result;

    await AuditLogger.logDataAccess("UPDATE", true, { id: user.email, name: user.nombre, rut: user.rut }, result.data.id_cita, {
        details: `Cita editada: priorizacion_clinica ${result.anterior.priorizacion_clinica ?? "-"}->${result.data.priorizacion_clinica}, priorizacion ${result.anterior.priorizacion ?? "-"}->${result.data.priorizacion}, fecha_estimada ${result.anterior.fecha_estimada_atencion?.toISOString().slice(0, 10) ?? "-"}->${result.data.fecha_estimada_atencion?.toISOString().slice(0, 10) ?? "-"}`
    });

    return { ok: true, data: result.data };
}
```

- [ ] **Step 6: Agregar action al inventario de permisos**

En `src/modules/permisos-por-action.test.ts`, importar:

```ts
import { editarCita } from "./solicitudes/actions/editarCita.action";
```

Agregar fila en la seccion `// solicitudes`, junto a `gestionarSolicitud`:

```ts
    {
        nombre: "editarCita",
        invocar: () => editarCita({} as never),
        permisos: ["solicitudes.gestionar"]
    },
```

Actualizar el comentario y assertion:

```ts
// ... Hoy sistema tiene 30 Server Actions ...
expect(tabla.length).toBe(30);
```

- [ ] **Step 7: Ejecutar tests**

Run: `npm test -- src/modules/solicitudes/actions/editarCita.action.test.ts src/modules/permisos-por-action.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/types/resultado.ts src/modules/solicitudes/schemas/revision.schema.ts src/modules/solicitudes/actions/editarCita.action.ts src/modules/solicitudes/actions/editarCita.action.test.ts src/modules/permisos-por-action.test.ts
git commit -m "feat(solicitudes): editar citas sin contacto"
```

---

### Task 3: Bloqueo Concurrente en `registrarLlamada`

**Files:**
- Modify: `src/modules/comunicador/actions/registrarLlamada.action.ts`
- Test: `src/modules/comunicador/actions/registrarLlamada.action.test.ts`

**Interfaces:**
- Consumes: `tx.$queryRaw`.
- Produces: llamada a `SELECT id_cita FROM citas WHERE id_cita = ${data.cita_id} FOR UPDATE` antes del `findUnique`.

- [ ] **Step 1: Extender mock y test de orden**

En `src/modules/comunicador/actions/registrarLlamada.action.test.ts`, agregar `$queryRaw` al `tx`:

```ts
const tx = {
    $queryRaw: vi.fn(),
    cita: { findUnique: vi.fn(), update: vi.fn() },
    llamada: { count: vi.fn(), create: vi.fn() },
    solicitud: { update: vi.fn() }
};
```

En `beforeEach`, agregar:

```ts
    tx.$queryRaw.mockResolvedValue([{ id_cita: "CITA-1" }]);
```

Agregar test:

```ts
    it("bloquea la cita FOR UPDATE antes de leerla", async () => {
        await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any);

        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.cita.findUnique.mock.invocationCallOrder[0]);
    });
```

- [ ] **Step 2: Ejecutar test y verificar que falla**

Run: `npm test -- src/modules/comunicador/actions/registrarLlamada.action.test.ts`
Expected: FAIL porque `tx.$queryRaw` no se llama.

- [ ] **Step 3: Agregar bloqueo en la action**

En `src/modules/comunicador/actions/registrarLlamada.action.ts`, dentro de la transaccion y antes de `tx.cita.findUnique`, agregar:

```ts
        await tx.$queryRaw`SELECT id_cita FROM citas WHERE id_cita = ${data.cita_id} FOR UPDATE`;
```

- [ ] **Step 4: Ejecutar test**

Run: `npm test -- src/modules/comunicador/actions/registrarLlamada.action.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/actions/registrarLlamada.action.ts src/modules/comunicador/actions/registrarLlamada.action.test.ts
git commit -m "fix(comunicador): serializar llamadas y edicion de citas"
```

---

### Task 4: `getOtrasSolicitudes` Devuelve Solicitudes y Citas Pendientes

**Files:**
- Modify: `src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts`
- Test: `src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts`

**Interfaces:**
- Consumes: `normalizarRut`, `ESTADOS_PENDIENTES`, `esCitaEditable`.
- Produces: `getOtrasSolicitudes(rutUsuario, solicitudActualId)` devuelve `{ solicitudes, citas }`.
- Produces: cada cita contiene `editable: boolean`; `_count` no sale en el resultado.

- [ ] **Step 1: Escribir tests de consulta**

Crear `src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        funcionario: { findUnique: vi.fn() },
        solicitud: { findMany: vi.fn() },
        cita: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { getOtrasSolicitudes } from "./getOtrasSolicitudes.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "gestor@demo.local",
        nombre: "Gestor",
        centro_id: "650",
        rol: { id: 2, nombre: "Gestor" }
    });
    (prisma.solicitud.findMany as any).mockResolvedValue([{ id_solicitud: "SOL-2", accion: "Realizar solicitud" }]);
    (prisma.cita.findMany as any).mockResolvedValue([
        { id_cita: "CITA-1", estado_cita: "Sin llamadas", _count: { llamadas: 0 } },
        { id_cita: "CITA-2", estado_cita: "Sin llamadas", _count: { llamadas: 1 } }
    ]);
});

describe("getOtrasSolicitudes", () => {
    it("consulta solicitudes En Curso del centro sin filtrar por accion y trae citas pendientes", async () => {
        const result = await getOtrasSolicitudes("12.345.678-5", "SOL-1");

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    rut_usuario: "12345678-5",
                    id_solicitud: { not: "SOL-1" },
                    estado_solicitud: "En Curso",
                    centro_id: "650"
                }
            })
        );
        expect(prisma.cita.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    rut_usuario: "12345678-5",
                    centro_id: "650",
                    estado_cita: { in: ["Sin llamadas", "No contesta (1)", "No contesta (2)", "Solo llamada de aviso"] }
                },
                include: { profesional: true, prestacion: true, _count: { select: { llamadas: true } } }
            })
        );
        expect(result.solicitudes).toEqual([{ id_solicitud: "SOL-2", accion: "Realizar solicitud" }]);
        expect(result.citas).toEqual([
            { id_cita: "CITA-1", estado_cita: "Sin llamadas", editable: true },
            { id_cita: "CITA-2", estado_cita: "Sin llamadas", editable: false }
        ]);
    });

    it("resuelve centro desde funcionario si la sesion no trae centro", async () => {
        (requirePermiso as any).mockResolvedValueOnce({
            rut: "22.222.222-2",
            email: "gestor@demo.local",
            nombre: "Gestor",
            centro_id: null,
            rol: { id: 2, nombre: "Gestor" }
        });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce({ centro_id: "501" });

        await getOtrasSolicitudes("12345678-5", "SOL-1");

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ centro_id: "501" }) }));
    });
});
```

- [ ] **Step 2: Ejecutar test y verificar que falla**

Run: `npm test -- src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts`
Expected: FAIL porque la action aun filtra `accion` y no devuelve citas.

- [ ] **Step 3: Modificar action**

En `src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts`, reemplazar el contenido por:

```ts
"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
// types
import { ESTADOS_PENDIENTES } from "@/modules/comunicador/types/comunicador";
// utils
import { esCitaEditable } from "../utils/citas";
import { normalizarRut } from "../utils/rut";

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    if (!funcionario?.centro_id) throw new Error("El funcionario activo no tiene centro asignado");
    return funcionario.centro_id;
}

export async function getOtrasSolicitudes(rutUsuario: string, solicitudActualId: string) {
    const user = await requirePermiso("solicitudes.gestionar");

    const rut = normalizarRut(rutUsuario);
    if (!rut) throw new Error("rutUsuario es requerido");

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    const [solicitudes, citasRaw] = await Promise.all([
        prisma.solicitud.findMany({
            where: {
                rut_usuario: rut,
                id_solicitud: { not: solicitudActualId },
                estado_solicitud: "En Curso",
                centro_id: centroId
            },
            include: { usuario: true, tipoSolicitud: true, motivo: true, orientador: true, gestor: true },
            orderBy: [{ priorizacion_admin: "desc" }, { fecha_inicio: "asc" }]
        }),
        prisma.cita.findMany({
            where: { rut_usuario: rut, centro_id: centroId, estado_cita: { in: [...ESTADOS_PENDIENTES] } },
            include: { profesional: true, prestacion: true, _count: { select: { llamadas: true } } },
            orderBy: [{ fecha_estimada_atencion: "asc" }, { fecha_creacion: "asc" }]
        })
    ]);

    const citas = citasRaw.map(({ _count, ...cita }) => ({
        ...cita,
        editable: esCitaEditable({ estado_cita: cita.estado_cita, cantidadLlamadas: _count.llamadas })
    }));

    return { solicitudes, citas };
}
```

- [ ] **Step 4: Ejecutar tests**

Run: `npm test -- src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts src/modules/permisos-por-action.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts
git commit -m "feat(solicitudes): contexto de citas en otras solicitudes"
```

---

### Task 5: Reutilizar Cascada con Slots de Acciones

**Files:**
- Modify: `src/modules/solicitudes/components/PendientesCascada.tsx`
- Test: `src/modules/solicitudes/components/PendientesCascada.test.tsx`

**Interfaces:**
- Produces: `ListaPendientes<S extends SolicitudCascada, C extends CitaCascada>`.
- Produces: `accionesSolicitud?: (solicitud: S) => ReactNode`, `accionesCita?: (cita: C) => ReactNode`.
- `PendientesCascada` conserva prop `{ pendientes }` y comportamiento visible de Ingresar.

- [ ] **Step 1: Escribir tests de render y slots**

Crear `src/modules/solicitudes/components/PendientesCascada.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// components
import { ListaPendientes, PendientesCascada } from "./PendientesCascada";

const solicitud = {
    id_solicitud: "SOL-1",
    fecha_inicio: new Date("2026-09-01T00:00:00"),
    descripcion: "Control pendiente",
    estado_solicitud: "En Curso",
    accion: "En espera de validación",
    tipoSolicitud: { nombre_tipo_solicitud: "Atencion" },
    motivo: { nombre_motivo: "Control" }
};

const cita = {
    id_cita: "CITA-1",
    solicitud_id: "SOL-1",
    estado_cita: "Sin llamadas",
    observacion: "Traer examenes",
    priorizacion_clinica: "Alta",
    fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
    profesional: { nombre: "Medico" },
    prestacion: { nombre_prestacion: "Consulta" }
};

describe("ListaPendientes", () => {
    it("anida citas y muestra priorizacion y fecha estimada", () => {
        render(<ListaPendientes solicitudes={[solicitud]} citas={[cita]} />);

        expect(screen.getByText("SOL-1")).toBeInTheDocument();
        expect(screen.getByText("CITA-1")).toBeInTheDocument();
        expect(screen.getByText("Alta")).toBeInTheDocument();
        expect(screen.getByText(/Fecha estimada:/)).toHaveTextContent("01-10-2026");
    });

    it("renderiza acciones por solicitud y cita", () => {
        render(
            <ListaPendientes
                solicitudes={[solicitud]}
                citas={[{ ...cita, editable: true }]}
                accionesSolicitud={(item) => <button>Solicitud {item.id_solicitud}</button>}
                accionesCita={(item) => <button>Cita {item.id_cita}</button>}
            />
        );

        expect(screen.getByRole("button", { name: "Solicitud SOL-1" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cita CITA-1" })).toBeInTheDocument();
    });
});

describe("PendientesCascada", () => {
    it("mantiene el wrapper Card para Ingresar", () => {
        render(<PendientesCascada pendientes={{ solicitudesPendientes: [solicitud], citasPendientes: [cita] }} />);
        expect(screen.getByText("Pendientes del paciente")).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Ejecutar test y verificar que falla**

Run: `npm test -- src/modules/solicitudes/components/PendientesCascada.test.tsx`
Expected: FAIL porque `ListaPendientes` no existe y `CitaRow` no muestra priorizacion/fecha.

- [ ] **Step 3: Refactorizar componente**

En `src/modules/solicitudes/components/PendientesCascada.tsx`, agregar `ReactNode` y tipos compartidos:

```tsx
"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
// actions
import type { getPendientes } from "../actions/getPendientes.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CodigoId } from "@/shared/components/ui/codigo-id";
// types
import type { CitaCascada, SolicitudCascada } from "../types/pendientes";
```

Reemplazar `CitaRow` por:

```tsx
function CitaRow<C extends CitaCascada>({ cita, accionesCita }: { cita: C; accionesCita?: (cita: C) => ReactNode }) {
    return (
        <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium"><CodigoId id={cita.id_cita} /></p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {[cita.profesional?.nombre, cita.prestacion?.nombre_prestacion].filter(Boolean).join(" · ") || "Sin detalle"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {cita.priorizacion_clinica && <Badge variant="secondary">{cita.priorizacion_clinica}</Badge>}
                        {cita.fecha_estimada_atencion && <Badge variant="outline">Fecha estimada: {formatFecha(cita.fecha_estimada_atencion)}</Badge>}
                    </div>
                    {cita.observacion && <p className="mt-2 text-sm text-muted-foreground">{cita.observacion}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant="warning">
                        <AlertTriangle data-icon="inline-start" />
                        {cita.estado_cita ?? "Sin estado"}
                    </Badge>
                    {accionesCita?.(cita)}
                </div>
            </div>
        </div>
    );
}
```

Exportar `ListaPendientes`:

```tsx
export interface ListaPendientesProps<S extends SolicitudCascada, C extends CitaCascada> {
    solicitudes: S[];
    citas: C[];
    accionesSolicitud?: (solicitud: S) => ReactNode;
    accionesCita?: (cita: C) => ReactNode;
}

export function ListaPendientes<S extends SolicitudCascada, C extends CitaCascada>({
    solicitudes,
    citas,
    accionesSolicitud,
    accionesCita
}: ListaPendientesProps<S, C>) {
    const idsSolicitudes = new Set(solicitudes.map((s) => s.id_solicitud));
    const citasPorSolicitud = new Map<string, C[]>();
    const huerfanas: C[] = [];

    for (const cita of citas) {
        if (cita.solicitud_id && idsSolicitudes.has(cita.solicitud_id)) {
            const lista = citasPorSolicitud.get(cita.solicitud_id) ?? [];
            lista.push(cita);
            citasPorSolicitud.set(cita.solicitud_id, lista);
        } else {
            huerfanas.push(cita);
        }
    }

    if (solicitudes.length === 0 && citas.length === 0) {
        return <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">No hay solicitudes ni citas en curso.</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            {solicitudes.map((solicitud) => {
                const citasSolicitud = citasPorSolicitud.get(solicitud.id_solicitud) ?? [];
                return (
                    <div key={solicitud.id_solicitud} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium"><CodigoId id={solicitud.id_solicitud} /></p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {[
                                        `Inicio: ${formatFecha(solicitud.fecha_inicio)}`,
                                        `Tipo: ${solicitud.tipoSolicitud?.nombre_tipo_solicitud || "-"}`,
                                        `Motivo: ${solicitud.motivo?.nombre_motivo || "-"}`
                                    ].join(" · ")}
                                </p>
                                {solicitud.descripcion && <p className="mt-1 text-sm text-muted-foreground">{solicitud.descripcion}</p>}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                                <Badge variant="warning">
                                    <AlertTriangle data-icon="inline-start" />
                                    {solicitud.estado_solicitud}
                                </Badge>
                                {accionesSolicitud?.(solicitud)}
                            </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-l-2 border-muted pl-3">
                            {citasSolicitud.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin citas pendientes en esta solicitud.</p>
                            ) : (
                                citasSolicitud.map((item) => <CitaRow key={item.id_cita} cita={item} accionesCita={accionesCita} />)
                            )}
                        </div>
                    </div>
                );
            })}

            {huerfanas.length > 0 && (
                <div className="rounded-md border border-dashed p-3">
                    <p className="text-sm font-medium">Otras citas</p>
                    <p className="mt-1 text-sm text-muted-foreground">Citas pendientes sin una solicitud En Curso asociada.</p>
                    <div className="mt-3 flex flex-col gap-2">
                        {huerfanas.map((item) => <CitaRow key={item.id_cita} cita={item} accionesCita={accionesCita} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
```

Modificar `PendientesCascada` para usar `ListaPendientes` y cambiar `CardContent className="space-y-4"` por `CardContent`:

```tsx
export function PendientesCascada({ pendientes }: { pendientes: Pendientes }) {
    const { solicitudesPendientes, citasPendientes } = pendientes;

    if (solicitudesPendientes.length === 0 && citasPendientes.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Pendientes del paciente</CardTitle>
                    <CardDescription>No hay solicitudes En Curso ni citas pendientes para este RUT.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Pendientes del paciente</CardTitle>
                <CardDescription>Solicitudes En Curso con sus citas pendientes anidadas.</CardDescription>
            </CardHeader>
            <CardContent>
                <ListaPendientes solicitudes={solicitudesPendientes} citas={citasPendientes} />
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 4: Ejecutar tests**

Run: `npm test -- src/modules/solicitudes/components/PendientesCascada.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/solicitudes/components/PendientesCascada.tsx src/modules/solicitudes/components/PendientesCascada.test.tsx
git commit -m "feat(solicitudes): cascada reusable con acciones"
```

---

### Task 6: Agregar Dialog de shadcn

**Files:**
- Create: `src/shared/components/ui/dialog.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`.

- [ ] **Step 1: Revisar docs e instalar**

Run: `npx shadcn@latest docs dialog`
Expected: imprime URLs de documentacion del componente `dialog`.

Run: `npx shadcn@latest add dialog`
Expected: crea `src/shared/components/ui/dialog.tsx` y agrega `@radix-ui/react-dialog` si falta.

- [ ] **Step 2: Revisar archivo agregado**

Run: `Get-Content -Path src\shared\components\ui\dialog.tsx`
Expected: el archivo exporta `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`; los imports usan `@/shared/lib/utils`.

- [ ] **Step 3: Verificar compilacion**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/shared/components/ui/dialog.tsx
git commit -m "feat(ui): agregar dialog de shadcn"
```

---

### Task 7: UI de Edicion de Cita

**Files:**
- Create: `src/modules/solicitudes/components/EditarCitaDialog.tsx`
- Test: `src/modules/solicitudes/components/EditarCitaDialog.test.tsx`

**Interfaces:**
- Consumes: cita con `id_cita`, `priorizacion_clinica`, `fecha_estimada_atencion`, `profesional`, `prestacion`.
- Consumes: `editarCita`.
- Produces: `EditarCitaDialog({ cita, open, saving? no, onOpenChange, onActualizada })`.
- `onActualizada` se ejecuta tanto en `ok` como en `!ok` despues de toast/error, porque el estado pudo cambiar por concurrencia.

- [ ] **Step 1: Escribir test del dialog**

Crear `src/modules/solicitudes/components/EditarCitaDialog.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions/editarCita.action", () => ({ editarCita: vi.fn() }));

import { toast } from "sonner";
import { editarCita } from "../actions/editarCita.action";
import { EditarCitaDialog } from "./EditarCitaDialog";

const cita = {
    id_cita: "CITA-1",
    solicitud_id: "SOL-1",
    estado_cita: "Sin llamadas",
    observacion: null,
    priorizacion_clinica: "Alta",
    fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
    profesional: { nombre: "Medico" },
    prestacion: { nombre_prestacion: "Consulta" },
    editable: true
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("EditarCitaDialog", () => {
    it("precarga campos y envia cambios", async () => {
        (editarCita as any).mockResolvedValue({ ok: true, data: { id_cita: "CITA-1", priorizacion_clinica: "Media", priorizacion: 50, fecha_estimada_atencion: new Date("2026-10-10T00:00:00") } });
        const onActualizada = vi.fn();
        const onOpenChange = vi.fn();

        render(<EditarCitaDialog cita={cita} open onOpenChange={onOpenChange} onActualizada={onActualizada} />);

        fireEvent.change(screen.getByLabelText("Priorizacion clinica"), { target: { value: "Media" } });
        fireEvent.change(screen.getByLabelText("Fecha estimada"), { target: { value: "2026-10-10" } });
        fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

        await waitFor(() => expect(editarCita).toHaveBeenCalledWith({ id_cita: "CITA-1", priorizacion_clinica: "Media", fecha_estimada_atencion: "2026-10-10" }));
        expect(toast.success).toHaveBeenCalledWith("Cita actualizada");
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onActualizada).toHaveBeenCalledTimes(1);
    });

    it("muestra error y recarga contexto si el servidor bloquea", async () => {
        (editarCita as any).mockResolvedValue({ ok: false, error: "La cita ya tiene llamadas registradas y no se puede modificar" });
        const onActualizada = vi.fn();

        render(<EditarCitaDialog cita={cita} open onOpenChange={vi.fn()} onActualizada={onActualizada} />);
        fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita ya tiene llamadas registradas y no se puede modificar"));
        expect(onActualizada).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Ejecutar test y verificar que falla**

Run: `npm test -- src/modules/solicitudes/components/EditarCitaDialog.test.tsx`
Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Crear componente**

Crear `src/modules/solicitudes/components/EditarCitaDialog.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
// actions
import { editarCita } from "../actions/editarCita.action";
// schemas
import { PRIORIDADES_CLINICAS } from "../schemas/revision.schema";
// components
import { Button } from "@/shared/components/ui/button";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
// types
import type { CitaCascadaConEdicion } from "../types/pendientes";

function toDateInput(value: Date | string | null): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function addYearsInput(years: number): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString().slice(0, 10);
}

export function EditarCitaDialog({
    cita,
    open,
    onOpenChange,
    onActualizada
}: {
    cita: CitaCascadaConEdicion;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onActualizada: () => Promise<void> | void;
}) {
    const [priorizacionClinica, setPriorizacionClinica] = useState(cita.priorizacion_clinica ?? "");
    const [fechaEstimada, setFechaEstimada] = useState(toDateInput(cita.fecha_estimada_atencion));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setPriorizacionClinica(cita.priorizacion_clinica ?? "");
        setFechaEstimada(toDateInput(cita.fecha_estimada_atencion));
    }, [cita]);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            const result = await editarCita({
                id_cita: cita.id_cita,
                priorizacion_clinica: priorizacionClinica as (typeof PRIORIDADES_CLINICAS)[number],
                fecha_estimada_atencion: fechaEstimada
            });
            if (!result.ok) {
                toast.error(result.error);
                await onActualizada();
                return;
            }
            toast.success("Cita actualizada");
            onOpenChange(false);
            await onActualizada();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al editar cita");
        } finally {
            setSaving(false);
        }
    }

    const detalle = [cita.profesional?.nombre, cita.prestacion?.nombre_prestacion].filter(Boolean).join(" · ") || "Sin detalle";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar cita <CodigoId id={cita.id_cita} /></DialogTitle>
                    <DialogDescription>{detalle}</DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="editar-cita-priorizacion">Priorizacion clinica</Label>
                        <Select id="editar-cita-priorizacion" aria-label="Priorizacion clinica" value={priorizacionClinica} onChange={(event) => setPriorizacionClinica(event.target.value)} required>
                            <option value="">Seleccionar</option>
                            {PRIORIDADES_CLINICAS.map((prioridad) => (
                                <option key={prioridad} value={prioridad}>
                                    {prioridad}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="editar-cita-fecha">Fecha estimada</Label>
                        <Input
                            id="editar-cita-fecha"
                            aria-label="Fecha estimada"
                            type="date"
                            min={addYearsInput(0)}
                            max={addYearsInput(2)}
                            value={fechaEstimada}
                            onChange={(event) => setFechaEstimada(event.target.value)}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>
                            <Save data-icon="inline-start" />
                            {saving ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 4: Ejecutar test**

Run: `npm test -- src/modules/solicitudes/components/EditarCitaDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/solicitudes/components/EditarCitaDialog.tsx src/modules/solicitudes/components/EditarCitaDialog.test.tsx
git commit -m "feat(solicitudes): dialog para editar cita sin contacto"
```

---

### Task 8: Integrar Contexto en Revisar Solicitudes

**Files:**
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Test: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx` if present; otherwise create it

**Interfaces:**
- Consumes: `getOtrasSolicitudes` returning `{ solicitudes, citas }`.
- Consumes: `ListaPendientes`, `EditarCitaDialog`.
- Produces: menu "Otras solicitudes y citas".
- Produces: modal `Dialog` "Solicitudes y citas en curso".
- Solicitudes con `accion === ACCION_ESPERA_VALIDACION` muestran Realizar/Rechazar/Usuario; las demas muestran Badge "Validada" + Usuario.
- Citas con `editable` muestran boton Editar.

- [ ] **Step 1: Ajustar imports y estado**

En `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`, agregar imports:

```tsx
import { Pencil } from "lucide-react";
// components
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { EditarCitaDialog } from "@/modules/solicitudes/components/EditarCitaDialog";
import { ListaPendientes } from "@/modules/solicitudes/components/PendientesCascada";
// schemas
import { ACCION_ESPERA_VALIDACION } from "@/modules/solicitudes/schemas/revision.schema";
// types
import type { CitaCascadaConEdicion } from "@/modules/solicitudes/types/pendientes";
```

Cambiar estado:

```tsx
    const [otrasContexto, setOtrasContexto] = useState<OtrasSolicitudesResponse>({ solicitudes: [], citas: [] });
    const [citaEditando, setCitaEditando] = useState<CitaCascadaConEdicion | null>(null);
```

Eliminar `otrasSolicitudes` y `setOtrasSolicitudes`.

- [ ] **Step 2: Extraer carga reusable**

Reemplazar `openOtrasSolicitudes` por:

```tsx
    async function cargarContexto(solicitud: SolicitudRow) {
        setLoadingOtras(true);
        try {
            const result = await getOtrasSolicitudes(solicitud.rut_usuario, solicitud.id_solicitud);
            setOtrasContexto(result);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al consultar solicitudes y citas");
        } finally {
            setLoadingOtras(false);
        }
    }

    async function openOtrasSolicitudes(solicitud: SolicitudRow) {
        setActionsOpen(null);
        setOtrasSolicitudBase(solicitud);
        await cargarContexto(solicitud);
    }
```

En `onGuardarUsuario`, `confirmarRechazo` y `confirmarRealizar`, reemplazar `await openOtrasSolicitudes(otrasSolicitudBase)` por:

```tsx
            if (otrasSolicitudBase) await cargarContexto(otrasSolicitudBase);
```

- [ ] **Step 3: Cambiar copy del menu**

En el menu de la tabla, cambiar:

```tsx
Otras solicitudes
```

por:

```tsx
Otras solicitudes y citas
```

- [ ] **Step 4: Reemplazar props del modal**

En el render del modal, cambiar:

```tsx
                <OtrasSolicitudesModal
                    solicitudBase={otrasSolicitudBase}
                    contexto={otrasContexto}
                    loading={loadingOtras}
                    onClose={() => {
                        setOtrasSolicitudBase(null);
                        setOtrasContexto({ solicitudes: [], citas: [] });
                    }}
                    onRealizar={openRealizar}
                    onRechazar={openRechazo}
                    onEditarUsuario={openEditarUsuario}
                    onEditarCita={setCitaEditando}
                />
```

Renderizar `EditarCitaDialog` junto a los modales:

```tsx
            {citaEditando && otrasSolicitudBase && (
                <EditarCitaDialog
                    cita={citaEditando}
                    open
                    onOpenChange={(open) => {
                        if (!open) setCitaEditando(null);
                    }}
                    onActualizada={async () => {
                        await cargarContexto(otrasSolicitudBase);
                    }}
                />
            )}
```

- [ ] **Step 5: Reemplazar `OtrasSolicitudesModal`**

Reemplazar la funcion `OtrasSolicitudesModal` por:

```tsx
function OtrasSolicitudesModal({
    solicitudBase,
    contexto,
    loading,
    onClose,
    onRealizar,
    onRechazar,
    onEditarUsuario,
    onEditarCita
}: {
    solicitudBase: SolicitudRow;
    contexto: OtrasSolicitudesResponse;
    loading: boolean;
    onClose: () => void;
    onRealizar: (solicitud: SolicitudRow) => void;
    onRechazar: (solicitud: SolicitudRow) => void;
    onEditarUsuario: (solicitud: SolicitudRow) => void;
    onEditarCita: (cita: CitaCascadaConEdicion) => void;
}) {
    const estaVacio = contexto.solicitudes.length === 0 && contexto.citas.length === 0;

    return (
        <Dialog open onOpenChange={(open) => {
            if (!open) onClose();
        }}>
            <DialogContent className="max-h-[86vh] max-w-5xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Solicitudes y citas en curso</DialogTitle>
                    <DialogDescription>RUT {solicitudBase.rut_usuario} · solo tu centro</DialogDescription>
                </DialogHeader>

                {loading ? (
                    <p className="text-sm text-muted-foreground">Consultando solicitudes y citas...</p>
                ) : estaVacio ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                        No hay otras solicitudes ni citas en curso para este RUT en tu centro.
                    </div>
                ) : (
                    <ListaPendientes
                        solicitudes={contexto.solicitudes}
                        citas={contexto.citas}
                        accionesSolicitud={(solicitud) => {
                            const enEspera = solicitud.accion === ACCION_ESPERA_VALIDACION;
                            return (
                                <div className="flex flex-wrap justify-end gap-2">
                                    {enEspera ? (
                                        <>
                                            <Button type="button" variant="outline" onClick={() => onRealizar(solicitud)}>
                                                <Check data-icon="inline-start" />
                                                Realizar
                                            </Button>
                                            <Button type="button" variant="outline" onClick={() => onRechazar(solicitud)}>
                                                <X data-icon="inline-start" />
                                                Rechazar
                                            </Button>
                                        </>
                                    ) : (
                                        <Badge variant="secondary">Validada</Badge>
                                    )}
                                    <Button type="button" variant="outline" onClick={() => onEditarUsuario(solicitud)}>
                                        <Edit data-icon="inline-start" />
                                        Usuario
                                    </Button>
                                </div>
                            );
                        }}
                        accionesCita={(cita) =>
                            cita.editable ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => onEditarCita(cita)}>
                                    <Pencil data-icon="inline-start" />
                                    Editar
                                </Button>
                            ) : null
                        }
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 6: Crear tests UI minimos**

Si `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx` no existe, crear un test enfocado:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/modules/solicitudes/actions/getRevisionCatalogos.action", () => ({ getRevisionCatalogos: vi.fn().mockResolvedValue({ tiposSolicitud: [], motivos: [], profesionales: [], prestaciones: [], centros: [] }) }));
vi.mock("@/modules/solicitudes/actions/getSolicitudes.action", () => ({ getSolicitudes: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/gestionarSolicitud.action", () => ({ gestionarSolicitud: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/guardarUsuario.action", () => ({ actualizarUsuario: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getOtrasSolicitudes.action", () => ({ getOtrasSolicitudes: vi.fn() }));

import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
import { getOtrasSolicitudes } from "@/modules/solicitudes/actions/getOtrasSolicitudes.action";
import { RevisarSolicitudesView } from "./RevisarSolicitudesView";

const solicitudBase = {
    id_solicitud: "SOL-1",
    fecha_inicio: new Date("2026-09-01T00:00:00"),
    rut_usuario: "12345678-5",
    descripcion: "Base",
    estado_solicitud: "En Curso",
    accion: "En espera de validación",
    priorizacion_admin: 10,
    usuario: { rut: "12345678-5", nombre: "Juan", apellido: "Perez", genero: "Masculino", gestante: "No aplica", discapacidad: "No", centro_id: "650" },
    tipoSolicitud: { nombre_tipo_solicitud: "Atencion" },
    motivo: { nombre_motivo: "Control" }
};

beforeEach(() => {
    vi.clearAllMocks();
    (getSolicitudes as any).mockResolvedValue({ solicitudes: [solicitudBase], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    (getOtrasSolicitudes as any).mockResolvedValue({
        solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-2", accion: "Realizar solicitud" }],
        citas: [
            {
                id_cita: "CITA-1",
                solicitud_id: "SOL-2",
                estado_cita: "Sin llamadas",
                observacion: null,
                priorizacion_clinica: "Alta",
                fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
                profesional: { nombre: "Medico" },
                prestacion: { nombre_prestacion: "Consulta" },
                editable: true
            }
        ]
    });
});

describe("RevisarSolicitudesView contexto de citas", () => {
    it("abre otras solicitudes y citas con acciones condicionales", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
        fireEvent.click(screen.getByRole("button", { name: /Otras solicitudes y citas/i }));

        await waitFor(() => expect(getOtrasSolicitudes).toHaveBeenCalledWith("12345678-5", "SOL-1"));
        expect(screen.getByText("Solicitudes y citas en curso")).toBeInTheDocument();
        expect(screen.getByText("CITA-1")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Editar/i })).toBeInTheDocument();
        expect(screen.getByText("Validada")).toBeInTheDocument();
    });
});
```

- [ ] **Step 7: Ejecutar tests**

Run: `npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/solicitudes/components/EditarCitaDialog.test.tsx src/modules/solicitudes/components/PendientesCascada.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/solicitudes/components/RevisarSolicitudesView.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
git commit -m "feat(solicitudes): contexto integrado de solicitudes y citas"
```

---

### Task 9: Verificacion Visual y Ajustes de Integracion

**Files:**
- Modify only files from previous tasks if verification finds issues.

**Interfaces:**
- Produces: validacion manual de flujos Ingresar y Revisar.

- [ ] **Step 1: Ejecutar verificacion de etapa**

Run: `npm test -- src/modules/solicitudes src/modules/comunicador/actions/registrarLlamada.action.test.ts src/modules/permisos-por-action.test.ts`
Expected: todos los tests PASS.

- [ ] **Step 2: Ejecutar TypeScript y lint**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificacion manual en navegador**

Run: `npm run dev`
Expected: servidor local en `http://localhost:3000`.

Verificar `/solicitudes/ingresar`:
- Buscar un RUT con pendientes.
- Confirmar que la cascada sigue mostrando solicitudes y citas.
- Confirmar que cada cita muestra estado, priorizacion clinica y fecha estimada si existen.

Verificar `/solicitudes/revisar`:
- Abrir `Gestionar -> Otras solicitudes y citas`.
- Confirmar que el Dialog muestra solicitudes En Curso validadas y no validadas del mismo centro.
- Confirmar que Realizar/Rechazar solo aparece en solicitudes `En espera de validación`.
- Confirmar que Usuario aparece para todas las solicitudes.
- Confirmar que Editar aparece solo en citas `editable`.
- Editar una cita sin llamadas y confirmar toast `Cita actualizada`, cierre del dialog de edicion y recarga del contexto.
- Registrar o simular una llamada sobre una cita y confirmar que ya no aparece como editable tras recargar.

- [ ] **Step 4: Commit de ajustes si existieron**

Si Step 1-3 requirieron correcciones:

```bash
git add src/modules/solicitudes src/modules/comunicador
git commit -m "fix(solicitudes): ajustes de integracion de contexto de citas"
```

Si no hubo correcciones, no crear commit vacio.

---

## Cierre

- [ ] **Verificacion global final**

Run: `npm test`
Expected: todos los tests PASS.

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Checklist de aceptacion**

Confirmar:

1. "Otras solicitudes y citas" muestra todas las solicitudes En Curso del paciente en el centro del gestor, validadas o no, con sus citas pendientes anidadas y citas huerfanas aparte.
2. Cada cita muestra estamento/profesional, prestacion, estado, priorizacion clinica y fecha estimada.
3. Realizar/Rechazar solo aparecen en solicitudes en espera de validacion.
4. Editar solo aparece en citas sin llamadas; guardar actualiza priorizacion clinica, fecha y `priorizacion` recalculada, con auditoria.
5. El servidor rechaza editar una cita con llamadas, de otro centro o con fecha fuera de rango, sin escribir.
6. Una llamada y una edicion concurrentes sobre la misma cita se serializan por `FOR UPDATE`.
7. La cascada de Ingresar solicitud sigue funcionando y muestra priorizacion y fecha estimada.
8. `npm test`, `npx tsc --noEmit` y `npm run lint` quedan en verde.

- [ ] **Handoff de ejecucion recomendado**

Ejecutar este plan con `subagent-driven-development`, una tarea por subagente y revision entre tareas. Si se ejecuta inline, usar `executing-plans` y cerrar cada etapa A-D con los tests de esa etapa antes de avanzar.
