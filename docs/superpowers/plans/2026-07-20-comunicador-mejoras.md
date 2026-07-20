# Mejoras del módulo Comunicador — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al comunicador filtros por RUT y sector, historial de llamadas por cita, otras citas próximas del paciente, resaltado de filas gestionadas hoy y edición del paciente; y mostrar en cascada Solicitud → Citas en `/solicitudes/ingresar`.

**Architecture:** Cambios incrementales sobre el módulo `comunicador` (Server Actions + tabla HTML propia + modales caseros) y un componente de cascada en `solicitudes`. Se agrega el componente shadcn `dropdown-menu` (Radix, ya presente en el stack) para el menú kebab por fila. La edición de paciente reutiliza `UsuarioEditModal` y un núcleo de actualización compartido, expuesto vía una action con guard de comunicador.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict, Prisma + MySQL, Zod, Vitest, Tailwind + shadcn/ui, sonner.

## Global Constraints

- Idioma español (UI, comentarios, commits). Indentación: 4 espacios.
- TypeScript strict; tipos explícitos. `interface` para objetos, `type`/`as const` para uniones.
- Alias `@/` → `src/`. Imports categorizados con comentarios (`// lib`, `// components`, ...).
- Server Actions con `'use server'` y sufijo `.action.ts`; validar inputs con Zod; auditar con `AuditLogger`.
- Control de acceso vía sesión: `puedeAccederComunicador` (comunicador), `puedeAccederSolicitudes` (solicitudes).
- Sin `console.log`; feedback con `toast` (sonner); errores con `try/catch`.
- Estados de cita pendientes: `Sin llamadas`, `No contesta (1)`, `No contesta (2)`, `Solo llamada de aviso` (`ESTADOS_PENDIENTES`).
- "Agendamientos próximos" = `fecha_estimada_atencion` entre hoy−15 y hoy+30 (`rangoTemporalidad(TEMPORALIDAD.PROXIMOS, hoy)`).
- **Fuera de alcance:** normalización de `Usuario.sector` a catálogo (trabajo aparte). Aquí el sector se filtra como texto libre.
- **No refactorizar** `/solicitudes/ingresar` ni `/solicitudes/revisar` para usar el nuevo hook (ya funcionan); el hook es solo para el comunicador.

---

## Task 1: Backend — filtros por RUT y sector

**Files:**
- Modify: `src/modules/comunicador/schemas/llamada.schema.ts` (bloque `citasFiltrosSchema`, líneas 21-31)
- Modify: `src/modules/comunicador/actions/getCitasPendientes.action.ts` (bloque WHERE, líneas 49-50)
- Test: `src/modules/comunicador/schemas/llamada.schema.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `citasFiltrosSchema` acepta `rut?: string` y `sector?: string` (trim, opcionales); `getCitasPendientes` filtra por ambos con LIKE.

- [ ] **Step 1: Escribir el test que falla**

En `src/modules/comunicador/schemas/llamada.schema.test.ts`, dentro del `describe("citasFiltrosSchema", ...)`, agregar:

```ts
    it("acepta y recorta rut y sector", () => {
        const r = citasFiltrosSchema.parse({ rut: "  12.345.678-9 ", sector: "  Amarillo " });
        expect(r.rut).toBe("12.345.678-9");
        expect(r.sector).toBe("Amarillo");
    });

    it("rut y sector son opcionales", () => {
        const r = citasFiltrosSchema.parse({});
        expect(r.rut).toBeUndefined();
        expect(r.sector).toBeUndefined();
    });
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test -- src/modules/comunicador/schemas/llamada.schema.test.ts`
Expected: FAIL (los campos `rut`/`sector` no existen en el schema todavía).

- [ ] **Step 3: Agregar los campos al schema**

En `src/modules/comunicador/schemas/llamada.schema.ts`, modificar `citasFiltrosSchema` agregando `rut` y `sector` (antes de `pagina`):

```ts
export const citasFiltrosSchema = z.object({
    temporalidad: z.string().trim().optional(),
    estado: z.string().trim().optional(),
    profesional_id: z.coerce.number().int().positive().optional(),
    prestacion_id: z.coerce.number().int().positive().optional(),
    edadMin: z.coerce.number().int().min(0).max(150).optional(),
    edadMax: z.coerce.number().int().min(0).max(150).optional(),
    fechaDesde: z.string().trim().optional(),
    fechaHasta: z.string().trim().optional(),
    rut: z.string().trim().optional(),
    sector: z.string().trim().optional(),
    pagina: z.coerce.number().int().min(1).default(1)
});
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm test -- src/modules/comunicador/schemas/llamada.schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Agregar las condiciones LIKE en la query**

En `src/modules/comunicador/actions/getCitasPendientes.action.ts`, justo después de las condiciones de `prestacion_id` (línea 50), agregar:

```ts
    if (f.profesional_id) condiciones.push(Prisma.sql`c.profesional_id = ${f.profesional_id}`);
    if (f.prestacion_id) condiciones.push(Prisma.sql`c.prestacion_id = ${f.prestacion_id}`);

    // RUT: coincidencia parcial, ignorando puntos y guion en ambos lados.
    if (f.rut) {
        const fragmentoRut = f.rut.replace(/[.\-\s]/g, "");
        condiciones.push(Prisma.sql`REPLACE(REPLACE(c.rut_usuario, '.', ''), '-', '') LIKE ${`%${fragmentoRut}%`}`);
    }
    // Sector: coincidencia parcial (texto libre).
    if (f.sector) condiciones.push(Prisma.sql`u.sector LIKE ${`%${f.sector}%`}`);
```

- [ ] **Step 6: Verificar compilación y lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/modules/comunicador/schemas/llamada.schema.ts src/modules/comunicador/schemas/llamada.schema.test.ts src/modules/comunicador/actions/getCitasPendientes.action.ts
git commit -m "feat(comunicador): filtro por rut y sector en la cola de citaciones"
```

---

## Task 2: Frontend — filtros por RUT y sector

**Files:**
- Modify: `src/modules/comunicador/components/CitasFiltros.tsx` (interfaz `CitasFiltrosUI` líneas 14-23, `FILTROS_INICIALES` líneas 25-34, y el JSX del formulario)
- Modify: `src/app/(app)/comunicador/page.tsx` (bloque `cargar`, líneas 30-47)

**Interfaces:**
- Consumes: `citasFiltrosSchema` con `rut`/`sector` (Task 1).
- Produces: `CitasFiltrosUI` con `rut: string` y `sector: string`; la página envía ambos a `getCitasPendientes`.

- [ ] **Step 1: Agregar rut y sector a la interfaz y a los valores iniciales**

En `src/modules/comunicador/components/CitasFiltros.tsx`:

```ts
export interface CitasFiltrosUI {
    temporalidad: string;
    estado: string;
    profesional_id: string;
    prestacion_id: string;
    edadMin: string;
    edadMax: string;
    fechaDesde: string;
    fechaHasta: string;
    rut: string;
    sector: string;
}

export const FILTROS_INICIALES: CitasFiltrosUI = {
    temporalidad: "Todas",
    estado: "",
    profesional_id: "",
    prestacion_id: "",
    edadMin: "",
    edadMax: "",
    fechaDesde: "",
    fechaHasta: "",
    rut: "",
    sector: ""
};
```

- [ ] **Step 2: Agregar los dos campos al formulario**

En el mismo archivo, dentro del `<form>`, después del campo "Fecha hasta" (línea 111) y antes del `<div className="md:col-span-4">`, agregar:

```tsx
            <Field label="RUT paciente">
                <Input value={valor.rut} onChange={(e) => set("rut", e.target.value)} placeholder="Ej: 12345678" />
            </Field>
            <Field label="Sector">
                <Input value={valor.sector} onChange={(e) => set("sector", e.target.value)} placeholder="Ej: Amarillo, 1, 2" />
            </Field>
```

- [ ] **Step 3: Enviar rut y sector desde la página**

En `src/app/(app)/comunicador/page.tsx`, dentro de `cargar` (llamada a `getCitasPendientes`), agregar los dos campos:

```ts
            const r = await getCitasPendientes({
                temporalidad: aplicados.temporalidad,
                estado: aplicados.estado,
                profesional_id: aplicados.profesional_id || undefined,
                prestacion_id: aplicados.prestacion_id || undefined,
                edadMin: aplicados.edadMin || undefined,
                edadMax: aplicados.edadMax || undefined,
                fechaDesde: aplicados.fechaDesde || undefined,
                fechaHasta: aplicados.fechaHasta || undefined,
                rut: aplicados.rut || undefined,
                sector: aplicados.sector || undefined,
                pagina
            });
```

- [ ] **Step 4: Verificar compilación y lint**

Run: `npm run lint && npm run build`
Expected: build exitoso, sin errores de tipos.

- [ ] **Step 5: Verificación manual**

Levantar `npm run dev`, ir a `/comunicador`, escribir un RUT parcial y un sector, "Aplicar filtros", confirmar que la cola se filtra.

- [ ] **Step 6: Commit**

```bash
git add src/modules/comunicador/components/CitasFiltros.tsx src/app/(app)/comunicador/page.tsx
git commit -m "feat(comunicador): UI de filtros por rut y sector"
```

---

## Task 3: Backend — flag `tiene_llamada_hoy`

**Files:**
- Modify: `src/modules/comunicador/actions/getCitasPendientes.action.ts` (interfaz `CitaFila` líneas 19-30, SELECT líneas 75-95, normalización línea 111)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `CitaFila` gana `tiene_llamada_hoy: boolean` (true si la cita tiene alguna `Llamada` con `fecha_llamada` en el día actual).

- [ ] **Step 1: Agregar el campo a la interfaz `CitaFila`**

En `src/modules/comunicador/actions/getCitasPendientes.action.ts`:

```ts
export interface CitaFila {
    id_cita: string;
    priorizacion: number | null;
    disponibilidad: string | null;
    rut_usuario: string;
    nombre_usuario: string | null;
    profesion: string | null;
    prestacion: string | null;
    fecha_estimada_atencion: Date | null;
    estado_cita: string | null;
    intentos: number;
    tiene_llamada_hoy: boolean;
}
```

- [ ] **Step 2: Agregar la subconsulta al SELECT**

En la query principal (`prisma.$queryRaw<CitaFila[]>`), agregar la columna después de `intentos` (línea 86):

```sql
            (SELECT COUNT(*) FROM llamadas ll WHERE ll.cita_id = c.id_cita AND ll.respuesta_usuario = ${RESPUESTA_LLAMADA.NO_CONTESTA}) AS intentos,
            EXISTS(SELECT 1 FROM llamadas lh WHERE lh.cita_id = c.id_cita AND DATE(lh.fecha_llamada) = CURDATE()) AS tiene_llamada_hoy
```

- [ ] **Step 3: Normalizar el flag a boolean**

En el `map` de normalización (línea 111), incluir la conversión (MySQL devuelve 0/1):

```ts
    const filasNorm = filas.map((r) => ({
        ...r,
        intentos: Number(r.intentos as unknown as bigint),
        tiene_llamada_hoy: Number(r.tiene_llamada_hoy as unknown as number) === 1
    }));
```

- [ ] **Step 4: Verificar compilación**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Verificación manual (opcional con BD)**

Con `npm run dev` y datos de prueba: registrar una llamada hoy sobre una cita y confirmar (via consola de red o el resaltado del Task 4) que `tiene_llamada_hoy` llega en true.

- [ ] **Step 6: Commit**

```bash
git add src/modules/comunicador/actions/getCitasPendientes.action.ts
git commit -m "feat(comunicador): flag tiene_llamada_hoy en la cola"
```

---

## Task 4: Frontend — resaltar filas con llamada de hoy

**Files:**
- Modify: `src/modules/comunicador/components/CitasPendientesTabla.tsx` (import + `<tr>` línea 48)

**Interfaces:**
- Consumes: `CitaFila.tiene_llamada_hoy` (Task 3).
- Produces: fila con fondo `bg-primary/5` cuando `tiene_llamada_hoy`.

- [ ] **Step 1: Importar el helper `cn`**

En `src/modules/comunicador/components/CitasPendientesTabla.tsx`, agregar a los imports:

```ts
// lib
import { cn } from "@/shared/lib/utils";
```

- [ ] **Step 2: Aplicar el fondo condicional a la fila**

Reemplazar la apertura del `<tr>` (línea 48):

```tsx
                                <tr key={c.id_cita} className={cn("border-t", c.tiene_llamada_hoy && "bg-primary/5")}>
```

- [ ] **Step 3: Verificar compilación y lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

En `/comunicador`, una cita con llamada registrada hoy debe mostrar un fondo sutil en su fila.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/components/CitasPendientesTabla.tsx
git commit -m "feat(comunicador): resaltar filas con llamada registrada hoy"
```

---

## Task 5: UI — componente `dropdown-menu` (shadcn/Radix)

**Files:**
- Create: `src/shared/components/ui/dropdown-menu.tsx`
- Modify: `package.json` (nueva dependencia, vía npm)

**Interfaces:**
- Produces: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` reutilizables.

- [ ] **Step 1: Instalar la dependencia de Radix**

Run: `npm install @radix-ui/react-dropdown-menu`
Expected: se agrega a `dependencies` en `package.json`.

- [ ] **Step 2: Crear el componente**

Crear `src/shared/components/ui/dropdown-menu.tsx`:

```tsx
"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
// lib
import { cn } from "@/shared/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
                "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
                className
            )}
            {...props}
        />
    </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
        ref={ref}
        className={cn(
            "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            className
        )}
        {...props}
    />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
```

- [ ] **Step 3: Verificar compilación**

Run: `npm run build`
Expected: build exitoso (el componente compila aunque aún no se use).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/shared/components/ui/dropdown-menu.tsx
git commit -m "feat(ui): componente dropdown-menu (shadcn/radix)"
```

---

## Task 6: Backend — `getHistorialLlamadas`

**Files:**
- Create: `src/modules/comunicador/actions/getHistorialLlamadas.action.ts`
- Test: `src/modules/comunicador/actions/getHistorialLlamadas.action.test.ts`

**Interfaces:**
- Consumes: `puedeAccederComunicador`, `requireSessionUser`, `AuditLogger`.
- Produces: `getHistorialLlamadas(citaId: string): Promise<HistorialLlamada[]>` con `HistorialLlamada = { id_llamada: number; fecha_llamada: Date | null; respuesta_usuario: string | null; observacion: string | null; comunicador: string | null }`, ordenado por `fecha_llamada` desc.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/modules/comunicador/actions/getHistorialLlamadas.action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        llamada: { findMany: vi.fn() },
        funcionario: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getHistorialLlamadas } from "./getHistorialLlamadas.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
});

describe("getHistorialLlamadas", () => {
    it("rechaza rol sin acceso al comunicador", async () => {
        (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
        await expect(getHistorialLlamadas("CITA-1")).rejects.toThrow("No tienes permiso");
    });

    it("mapea las llamadas y resuelve el nombre del comunicador", async () => {
        (prisma.llamada.findMany as any).mockResolvedValue([
            { id_llamada: 2, fecha_llamada: new Date("2026-07-19T10:00:00"), respuesta_usuario: "No contesta", observacion: "no atiende", rut_comunicador: "5-5" }
        ]);
        (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "5-5", nombre: "Ana" }]);
        const r = await getHistorialLlamadas("CITA-1");
        expect(r).toEqual([
            { id_llamada: 2, fecha_llamada: new Date("2026-07-19T10:00:00"), respuesta_usuario: "No contesta", observacion: "no atiende", comunicador: "Ana" }
        ]);
    });

    it("devuelve lista vacía cuando no hay llamadas", async () => {
        (prisma.llamada.findMany as any).mockResolvedValue([]);
        (prisma.funcionario.findMany as any).mockResolvedValue([]);
        const r = await getHistorialLlamadas("CITA-1");
        expect(r).toEqual([]);
    });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test -- src/modules/comunicador/actions/getHistorialLlamadas.action.test.ts`
Expected: FAIL (el módulo no existe).

- [ ] **Step 3: Implementar la action**

Crear `src/modules/comunicador/actions/getHistorialLlamadas.action.ts`:

```ts
"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";

export interface HistorialLlamada {
    id_llamada: number;
    fecha_llamada: Date | null;
    respuesta_usuario: string | null;
    observacion: string | null;
    comunicador: string | null;
}

export async function getHistorialLlamadas(citaId: string): Promise<HistorialLlamada[]> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");

    const llamadas = await prisma.llamada.findMany({
        where: { cita_id: citaId },
        orderBy: { fecha_llamada: "desc" },
        select: { id_llamada: true, fecha_llamada: true, respuesta_usuario: true, observacion: true, rut_comunicador: true }
    });

    const ruts = [...new Set(llamadas.map((l) => l.rut_comunicador).filter((r): r is string => Boolean(r)))];
    const funcionarios = ruts.length
        ? await prisma.funcionario.findMany({ where: { rut: { in: ruts } }, select: { rut: true, nombre: true } })
        : [];
    const nombrePorRut = new Map(funcionarios.map((f) => [f.rut, f.nombre]));

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `HISTORIAL_${citaId}`, {
        details: `Historial de llamadas de la cita ${citaId}`
    });

    return llamadas.map((l) => ({
        id_llamada: l.id_llamada,
        fecha_llamada: l.fecha_llamada,
        respuesta_usuario: l.respuesta_usuario,
        observacion: l.observacion,
        comunicador: l.rut_comunicador ? nombrePorRut.get(l.rut_comunicador) ?? l.rut_comunicador : null
    }));
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm test -- src/modules/comunicador/actions/getHistorialLlamadas.action.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/actions/getHistorialLlamadas.action.ts src/modules/comunicador/actions/getHistorialLlamadas.action.test.ts
git commit -m "feat(comunicador): action getHistorialLlamadas"
```

---

## Task 7: Frontend — modal de historial + kebab en la fila

**Files:**
- Create: `src/modules/comunicador/components/HistorialLlamadasModal.tsx`
- Create: `src/modules/comunicador/components/CitaAccionesMenu.tsx`
- Modify: `src/modules/comunicador/components/CitasPendientesTabla.tsx` (agregar slot `renderAcciones`)
- Modify: `src/app/(app)/comunicador/page.tsx` (estado + render del modal + `renderAcciones`)

**Interfaces:**
- Consumes: `getHistorialLlamadas` (Task 6), `HistorialLlamada`, componentes `DropdownMenu*` (Task 5), `CitaFila`.
- Produces: `CitaAccionesMenu` (kebab, con item "Ver historial de llamadas"); `CitasPendientesTabla` gana prop `renderAcciones?: (cita: CitaFila) => React.ReactNode`; la página muestra `HistorialLlamadasModal`.

- [ ] **Step 1: Agregar el slot `renderAcciones` a la tabla**

En `src/modules/comunicador/components/CitasPendientesTabla.tsx`, extender las props y renderizar el slot junto al botón "Llamar". Cambiar la firma:

```tsx
export function CitasPendientesTabla({ filas, total, pagina, porPagina, onPagina, onGestionar, renderAcciones }: {
    filas: CitaFila[];
    total: number;
    pagina: number;
    porPagina: number;
    onPagina: (p: number) => void;
    onGestionar: (cita: CitaFila) => void;
    renderAcciones?: (cita: CitaFila) => React.ReactNode;
}) {
```

Y reemplazar la celda de acciones (líneas 62-66) por:

```tsx
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" onClick={() => onGestionar(c)}>
                                                Llamar
                                            </Button>
                                            {renderAcciones?.(c)}
                                        </div>
                                    </td>
```

- [ ] **Step 2: Crear el menú kebab**

Crear `src/modules/comunicador/components/CitaAccionesMenu.tsx`:

```tsx
"use client";

import { History, MoreVertical } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import type { CitaFila } from "../actions/getCitasPendientes.action";

export function CitaAccionesMenu({ cita, onVerHistorial }: {
    cita: CitaFila;
    onVerHistorial: (cita: CitaFila) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                    <MoreVertical size={16} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onVerHistorial(cita)}>
                    <History size={14} />
                    Ver historial de llamadas
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

- [ ] **Step 3: Crear el modal de historial**

Crear `src/modules/comunicador/components/HistorialLlamadasModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
// actions
import { getHistorialLlamadas, type HistorialLlamada } from "../actions/getHistorialLlamadas.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

function formatFechaHora(value: Date | null): string {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function HistorialLlamadasModal({ citaId, onCerrar }: { citaId: string; onCerrar: () => void }) {
    const [llamadas, setLlamadas] = useState<HistorialLlamada[]>([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        getHistorialLlamadas(citaId)
            .then(setLlamadas)
            .catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar el historial"))
            .finally(() => setCargando(false));
    }, [citaId]);

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">Historial de llamadas</h2>
                        <p className="text-sm text-muted-foreground">Cita {citaId}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <div className="mt-4 space-y-3">
                    {cargando ? (
                        <p className="text-sm text-muted-foreground">Cargando historial...</p>
                    ) : llamadas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin llamadas registradas.</p>
                    ) : (
                        llamadas.map((l) => (
                            <div key={l.id_llamada} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{formatFechaHora(l.fecha_llamada)}</span>
                                    <Badge variant="muted">{l.respuesta_usuario ?? "Sin respuesta"}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">Comunicador: {l.comunicador ?? "—"}</p>
                                {l.observacion && <p className="mt-1 text-muted-foreground">Obs: {l.observacion}</p>}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Wire en la página**

En `src/app/(app)/comunicador/page.tsx`:

Agregar imports:

```ts
import { CitaAccionesMenu } from "@/modules/comunicador/components/CitaAccionesMenu";
import { HistorialLlamadasModal } from "@/modules/comunicador/components/HistorialLlamadasModal";
```

Agregar estado (junto a los otros `useState`):

```ts
    const [citaHistorial, setCitaHistorial] = useState<CitaFila | null>(null);
```

Pasar `renderAcciones` a `<CitasPendientesTabla>` (dentro de la Card "Citaciones pendientes"):

```tsx
                    <CitasPendientesTabla
                        filas={data.filas}
                        total={data.total}
                        pagina={data.pagina}
                        porPagina={data.porPagina}
                        onPagina={setPagina}
                        onGestionar={abrirGestion}
                        renderAcciones={(cita) => (
                            <CitaAccionesMenu cita={cita} onVerHistorial={setCitaHistorial} />
                        )}
                    />
```

Renderizar el modal antes del cierre del `</div>` raíz (junto al `RegistrarLlamadaModal`):

```tsx
            {citaHistorial && (
                <HistorialLlamadasModal citaId={citaHistorial.id_cita} onCerrar={() => setCitaHistorial(null)} />
            )}
```

- [ ] **Step 5: Verificar compilación y lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 6: Verificación manual**

En `/comunicador`, abrir el kebab (⋮) de una fila → "Ver historial de llamadas" → el modal muestra los intentos previos (o "Sin llamadas registradas").

- [ ] **Step 7: Commit**

```bash
git add src/modules/comunicador/components/HistorialLlamadasModal.tsx src/modules/comunicador/components/CitaAccionesMenu.tsx src/modules/comunicador/components/CitasPendientesTabla.tsx "src/app/(app)/comunicador/page.tsx"
git commit -m "feat(comunicador): kebab por fila y modal de historial de llamadas"
```

---

## Task 8: Backend — otras citas del paciente solo "Agendamientos próximos"

**Files:**
- Modify: `src/modules/comunicador/actions/getCitasPendientesPaciente.action.ts`
- Test: `src/modules/comunicador/actions/getCitasPendientesPaciente.action.test.ts` (crear)

**Interfaces:**
- Consumes: `rangoTemporalidad`, `TEMPORALIDAD`.
- Produces: `getCitasPendientesPaciente` filtra además por `fecha_estimada_atencion` en el rango "Agendamientos próximos" (hoy−15..hoy+30).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/modules/comunicador/actions/getCitasPendientesPaciente.action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: { cita: { findMany: vi.fn() }, llamada: { count: vi.fn() } }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/modules/solicitudes/utils/rut", () => ({ normalizarRut: (r: string) => r }));

import { getCitasPendientesPaciente } from "./getCitasPendientesPaciente.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
    (prisma.cita.findMany as any).mockResolvedValue([]);
    (prisma.llamada.count as any).mockResolvedValue(0);
});

describe("getCitasPendientesPaciente", () => {
    it("filtra por el rango de 'Agendamientos próximos' (hoy-15..hoy+30)", async () => {
        await getCitasPendientesPaciente("1-9", "CITA-ACTUAL");
        const where = (prisma.cita.findMany as any).mock.calls[0][0].where;
        expect(where.fecha_estimada_atencion).toBeDefined();
        expect(where.fecha_estimada_atencion.gte).toBeInstanceOf(Date);
        expect(where.fecha_estimada_atencion.lte).toBeInstanceOf(Date);
        const dias = (where.fecha_estimada_atencion.lte.getTime() - where.fecha_estimada_atencion.gte.getTime()) / (1000 * 60 * 60 * 24);
        expect(Math.round(dias)).toBe(45);
    });

    it("excluye la cita actual", async () => {
        await getCitasPendientesPaciente("1-9", "CITA-ACTUAL");
        const where = (prisma.cita.findMany as any).mock.calls[0][0].where;
        expect(where.id_cita).toEqual({ not: "CITA-ACTUAL" });
    });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test -- src/modules/comunicador/actions/getCitasPendientesPaciente.action.test.ts`
Expected: FAIL (aún no hay filtro `fecha_estimada_atencion`).

- [ ] **Step 3: Agregar el filtro de temporalidad**

En `src/modules/comunicador/actions/getCitasPendientesPaciente.action.ts`, agregar imports y el rango:

```ts
// utils
import { normalizarRut } from "@/modules/solicitudes/utils/rut";
import { rangoTemporalidad } from "../utils/temporalidad";
// types
import { ESTADOS_PENDIENTES, TEMPORALIDAD } from "../types/comunicador";
```

Y dentro de la función, antes del `findMany`, calcular el rango y agregarlo al `where`:

```ts
    const rango = rangoTemporalidad(TEMPORALIDAD.PROXIMOS, new Date());

    const citas = await prisma.cita.findMany({
        where: {
            rut_usuario: normalizarRut(rutUsuario),
            centro_id: user.centro_id,
            id_cita: { not: citaActualId },
            estado_cita: { in: [...ESTADOS_PENDIENTES] },
            fecha_estimada_atencion: { gte: rango?.gte, lte: rango?.lte }
        },
        include: { profesional: true, prestacion: true },
        orderBy: { priorizacion: "desc" }
    });
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm test -- src/modules/comunicador/actions/getCitasPendientesPaciente.action.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/actions/getCitasPendientesPaciente.action.ts src/modules/comunicador/actions/getCitasPendientesPaciente.action.test.ts
git commit -m "feat(comunicador): otras citas del paciente limitadas a agendamientos proximos"
```

---

## Task 9: Frontend — modal de otras citas + item en kebab

**Files:**
- Create: `src/modules/comunicador/components/OtrasCitasPacienteModal.tsx`
- Modify: `src/modules/comunicador/components/CitaAccionesMenu.tsx` (nuevo item)
- Modify: `src/app/(app)/comunicador/page.tsx` (estado + render del modal + handler)

**Interfaces:**
- Consumes: `getCitasPendientesPaciente` (Task 8), `CitaPacienteFila`, `CitaFila`.
- Produces: `CitaAccionesMenu` gana prop `onVerOtrasCitas: (cita: CitaFila) => void` y su item; la página muestra `OtrasCitasPacienteModal`.

- [ ] **Step 1: Crear el modal de otras citas**

Crear `src/modules/comunicador/components/OtrasCitasPacienteModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
// actions
import { getCitasPendientesPaciente, type CitaPacienteFila } from "../actions/getCitasPendientesPaciente.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

function formatFecha(value: Date | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("es-CL");
}

export function OtrasCitasPacienteModal({ rutUsuario, citaActualId, onCerrar }: {
    rutUsuario: string;
    citaActualId: string;
    onCerrar: () => void;
}) {
    const [citas, setCitas] = useState<CitaPacienteFila[]>([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        getCitasPendientesPaciente(rutUsuario, citaActualId)
            .then(setCitas)
            .catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar otras citas"))
            .finally(() => setCargando(false));
    }, [rutUsuario, citaActualId]);

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">Otras citas del paciente</h2>
                        <p className="text-sm text-muted-foreground">Agendamientos próximos · RUT {rutUsuario}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <div className="mt-4 space-y-3">
                    {cargando ? (
                        <p className="text-sm text-muted-foreground">Cargando otras citas...</p>
                    ) : citas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin otras citas próximas.</p>
                    ) : (
                        citas.map((c) => (
                            <div key={c.id_cita} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{c.profesion || "—"} · {c.prestacion || "—"}</span>
                                    <Badge variant="warning">{c.estado_cita ?? "Sin estado"}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">
                                    Fecha estimada: {formatFecha(c.fecha_estimada_atencion)} · Cita {c.id_cita}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Agregar el item al kebab**

En `src/modules/comunicador/components/CitaAccionesMenu.tsx`, extender props e item (agregar `CalendarClock` al import de lucide):

```tsx
import { CalendarClock, History, MoreVertical } from "lucide-react";
```

```tsx
export function CitaAccionesMenu({ cita, onVerHistorial, onVerOtrasCitas }: {
    cita: CitaFila;
    onVerHistorial: (cita: CitaFila) => void;
    onVerOtrasCitas: (cita: CitaFila) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                    <MoreVertical size={16} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onVerHistorial(cita)}>
                    <History size={14} />
                    Ver historial de llamadas
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onVerOtrasCitas(cita)}>
                    <CalendarClock size={14} />
                    Otras citas del paciente
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

- [ ] **Step 3: Wire en la página**

En `src/app/(app)/comunicador/page.tsx`:

Import:

```ts
import { OtrasCitasPacienteModal } from "@/modules/comunicador/components/OtrasCitasPacienteModal";
```

Estado:

```ts
    const [citaOtras, setCitaOtras] = useState<CitaFila | null>(null);
```

Pasar el handler al kebab:

```tsx
                        renderAcciones={(cita) => (
                            <CitaAccionesMenu cita={cita} onVerHistorial={setCitaHistorial} onVerOtrasCitas={setCitaOtras} />
                        )}
```

Render del modal:

```tsx
            {citaOtras && (
                <OtrasCitasPacienteModal rutUsuario={citaOtras.rut_usuario} citaActualId={citaOtras.id_cita} onCerrar={() => setCitaOtras(null)} />
            )}
```

- [ ] **Step 4: Verificar compilación y lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Kebab → "Otras citas del paciente" → modal lista solo citas próximas del paciente (excluyendo la actual).

- [ ] **Step 6: Commit**

```bash
git add src/modules/comunicador/components/OtrasCitasPacienteModal.tsx src/modules/comunicador/components/CitaAccionesMenu.tsx "src/app/(app)/comunicador/page.tsx"
git commit -m "feat(comunicador): modal de otras citas proximas del paciente"
```

---

## Task 10: Backend — edición de paciente desde comunicador

**Files:**
- Create: `src/modules/solicitudes/actions/usuarioUpdate.ts` (módulo compartido, sin `'use server'`)
- Modify: `src/modules/solicitudes/actions/guardarUsuario.action.ts` (reutilizar el núcleo)
- Create: `src/modules/comunicador/actions/actualizarUsuarioComunicador.action.ts`
- Create: `src/modules/comunicador/actions/getUsuarioParaEdicion.action.ts`
- Test: `src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts`

**Interfaces:**
- Consumes: `usuarioSolicitudSchema`, `UsuarioSolicitudInput`, `calcularPriorizacionAdministrativa`, `puedeAccederComunicador`.
- Produces:
  - `usuarioUpdate.ts`: `validarCentro(centroId: string)`, `toUsuarioData(data)`, `persistirActualizacionUsuario(actor, input, origen): Promise<{ usuario }>` con `actor: { email: string; nombre: string; rut: string }`.
  - `actualizarUsuarioComunicador(input: UsuarioSolicitudInput): Promise<{ usuario }>`.
  - `getUsuarioParaEdicion(rut: string): Promise<{ usuario: UsuarioEditable | null }>` con `UsuarioEditable` = los 14 campos del `select` (rut, nombre, apellido, nombre_social, correo_contacto, sector, genero, fecha_nacimiento, telefono, telefono_alternativo, gestante, discapacidad, centro_id, priorizacion_administrativa).

- [ ] **Step 1: Crear el módulo compartido de actualización**

Crear `src/modules/solicitudes/actions/usuarioUpdate.ts`:

```ts
// lib
import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { usuarioSolicitudSchema, type UsuarioSolicitudInput, type UsuarioSolicitudData } from "../schemas/usuario.schema";
// utils
import { calcularPriorizacionAdministrativa } from "../utils/priorizacion";

export interface ActorAuditoria {
    email: string;
    nombre: string;
    rut: string;
}

const USUARIO_SELECT = {
    rut: true,
    nombre: true,
    apellido: true,
    nombre_social: true,
    correo_contacto: true,
    sector: true,
    genero: true,
    fecha_nacimiento: true,
    telefono: true,
    telefono_alternativo: true,
    gestante: true,
    discapacidad: true,
    centro_id: true,
    priorizacion_administrativa: true
} as const;

export async function validarCentro(centroId: string): Promise<void> {
    const rows = await prisma.$queryRaw<{ id_centro: string }[]>`
        SELECT id_centro
        FROM centros
        WHERE id_centro = ${centroId}
        LIMIT 1
    `;
    if (rows.length === 0) throw new Error("Centro no encontrado");
}

export function toUsuarioData(data: UsuarioSolicitudData) {
    return {
        nombre: data.nombre,
        apellido: data.apellido,
        nombre_social: data.nombre_social || null,
        correo_contacto: data.correo_contacto || null,
        sector: data.sector || null,
        genero: data.genero,
        fecha_nacimiento: new Date(`${data.fecha_nacimiento}T00:00:00`),
        telefono: data.telefono,
        telefono_alternativo: data.telefono_alternativo,
        gestante: data.gestante,
        discapacidad: data.discapacidad,
        centro_id: data.centro_id,
        priorizacion_administrativa: calcularPriorizacionAdministrativa({
            discapacidad: data.discapacidad,
            fechaNacimiento: data.fecha_nacimiento,
            gestante: data.gestante
        })
    };
}

export async function persistirActualizacionUsuario(actor: ActorAuditoria, input: UsuarioSolicitudInput, origen: string) {
    const data = usuarioSolicitudSchema.parse(input);
    await validarCentro(data.centro_id);

    const usuario = await prisma.usuario.update({
        where: { rut: data.rut },
        data: toUsuarioData(data),
        select: USUARIO_SELECT
    });

    await AuditLogger.logDataAccess("UPDATE", true, { id: actor.email, name: actor.nombre, rut: actor.rut }, `USUARIO_${usuario.rut}`, {
        details: `Usuario actualizado desde ${origen}`
    });

    return { usuario };
}
```

- [ ] **Step 2: Refactorizar `guardarUsuario.action.ts` para reutilizar el núcleo**

En `src/modules/solicitudes/actions/guardarUsuario.action.ts`, reemplazar las funciones locales `validarCentro` y `toUsuarioData` por imports del módulo compartido, y usar `persistirActualizacionUsuario` en `actualizarUsuario`. El archivo queda:

```ts
"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { usuarioSolicitudSchema, UsuarioSolicitudInput } from "../schemas/usuario.schema";
// actions (núcleo compartido)
import { validarCentro, toUsuarioData, persistirActualizacionUsuario } from "./usuarioUpdate";

async function requireSolicitudesUser() {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");
    return user;
}

export async function crearUsuario(input: UsuarioSolicitudInput) {
    const user = await requireSolicitudesUser();
    const data = usuarioSolicitudSchema.parse(input);
    await validarCentro(data.centro_id);

    const existing = await prisma.usuario.findUnique({ where: { rut: data.rut }, select: { rut: true } });
    if (existing) throw new Error("El usuario ya existe");

    const usuario = await prisma.usuario.create({
        data: { rut: data.rut, ...toUsuarioData(data) },
        select: {
            rut: true,
            nombre: true,
            apellido: true,
            nombre_social: true,
            correo_contacto: true,
            sector: true,
            genero: true,
            fecha_nacimiento: true,
            telefono: true,
            telefono_alternativo: true,
            gestante: true,
            discapacidad: true,
            centro_id: true,
            priorizacion_administrativa: true
        }
    });

    await AuditLogger.logDataAccess("CREATE", true, { id: user.email, name: user.nombre, rut: user.rut }, `USUARIO_${usuario.rut}`, {
        details: `Usuario creado desde ingreso de solicitudes`
    });

    return { usuario };
}

export async function actualizarUsuario(input: UsuarioSolicitudInput) {
    const user = await requireSolicitudesUser();
    return persistirActualizacionUsuario({ email: user.email, nombre: user.nombre, rut: user.rut }, input, "ingreso de solicitudes");
}
```

- [ ] **Step 3: Verificar que los tests existentes de solicitudes siguen pasando**

Run: `npm test -- src/modules/solicitudes`
Expected: PASS (si existen tests de guardarUsuario, no deben romperse). Si no hay, `npm run build` debe compilar.

- [ ] **Step 4: Crear la action `getUsuarioParaEdicion` (comunicador)**

Crear `src/modules/comunicador/actions/getUsuarioParaEdicion.action.ts`:

```ts
"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// utils
import { esRutChilenoValido, normalizarRut } from "@/modules/solicitudes/utils/rut";

export interface UsuarioEditable {
    rut: string;
    nombre: string;
    apellido: string;
    nombre_social: string | null;
    correo_contacto: string | null;
    sector: string | null;
    genero: string | null;
    fecha_nacimiento: Date | null;
    telefono: string | null;
    telefono_alternativo: string | null;
    gestante: string | null;
    discapacidad: string | null;
    centro_id: string | null;
    priorizacion_administrativa: number | null;
}

export async function getUsuarioParaEdicion(rutUsuario: string): Promise<{ usuario: UsuarioEditable | null }> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");

    const rut = normalizarRut(rutUsuario);
    if (!rut) throw new Error("RUT usuario es requerido");
    if (!esRutChilenoValido(rut)) throw new Error("RUT invalido");

    const usuario = await prisma.usuario.findUnique({
        where: { rut },
        select: {
            rut: true,
            nombre: true,
            apellido: true,
            nombre_social: true,
            correo_contacto: true,
            sector: true,
            genero: true,
            fecha_nacimiento: true,
            telefono: true,
            telefono_alternativo: true,
            gestante: true,
            discapacidad: true,
            centro_id: true,
            priorizacion_administrativa: true
        }
    });

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `USUARIO_${rut}`, {
        details: `Consulta de usuario (edición desde comunicador) para RUT ${rut}`
    });

    return { usuario };
}
```

- [ ] **Step 5: Escribir el test que falla para la action de actualización**

Crear `src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        usuario: { update: vi.fn() }
    }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { actualizarUsuarioComunicador } from "./actualizarUsuarioComunicador.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

const inputValido = {
    rut: "1-9",
    nombre: "Juan",
    apellido: "Pérez",
    genero: "Masculino",
    fecha_nacimiento: "1990-05-10",
    telefono: "999",
    telefono_alternativo: "888",
    gestante: "No aplica",
    discapacidad: "El usuario poseé una credencial de discapacidad.",
    centro_id: "501"
};

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
    (prisma.$queryRaw as any).mockResolvedValue([{ id_centro: "501" }]);
    (prisma.usuario.update as any).mockResolvedValue({ rut: "1-9", nombre: "Juan" });
});

describe("actualizarUsuarioComunicador", () => {
    it("rechaza rol sin acceso al comunicador", async () => {
        (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
        await expect(actualizarUsuarioComunicador(inputValido as any)).rejects.toThrow("No tienes permiso");
    });

    it("actualiza el usuario para un rol de comunicador", async () => {
        const r = await actualizarUsuarioComunicador(inputValido as any);
        expect(r.usuario.rut).toBe("1-9");
        expect(prisma.usuario.update).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 6: Ejecutar el test y verificar que falla**

Run: `npm test -- src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts`
Expected: FAIL (el módulo no existe).

- [ ] **Step 7: Crear la action `actualizarUsuarioComunicador`**

Crear `src/modules/comunicador/actions/actualizarUsuarioComunicador.action.ts`:

```ts
"use server";

// lib
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
// actions (núcleo compartido)
import { persistirActualizacionUsuario } from "@/modules/solicitudes/actions/usuarioUpdate";
// schemas
import type { UsuarioSolicitudInput } from "@/modules/solicitudes/schemas/usuario.schema";

export async function actualizarUsuarioComunicador(input: UsuarioSolicitudInput) {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");
    return persistirActualizacionUsuario({ email: user.email, nombre: user.nombre, rut: user.rut }, input, "comunicador");
}
```

- [ ] **Step 8: Ejecutar los tests y verificar que pasan**

Run: `npm test -- src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts`
Expected: PASS.

- [ ] **Step 9: Verificar build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 10: Commit**

```bash
git add src/modules/solicitudes/actions/usuarioUpdate.ts src/modules/solicitudes/actions/guardarUsuario.action.ts src/modules/comunicador/actions/getUsuarioParaEdicion.action.ts src/modules/comunicador/actions/actualizarUsuarioComunicador.action.ts src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts
git commit -m "feat(comunicador): backend para editar paciente (nucleo compartido + guard de comunicador)"
```

---

## Task 11: Frontend — editar paciente desde el comunicador

**Files:**
- Create: `src/modules/comunicador/hooks/useUsuarioEdit.ts`
- Modify: `src/modules/comunicador/components/CitaAccionesMenu.tsx` (item "Editar paciente")
- Modify: `src/app/(app)/comunicador/page.tsx` (cargar centros, hook, modal)

**Interfaces:**
- Consumes: `getUsuarioParaEdicion`, `UsuarioEditable`, `actualizarUsuarioComunicador` (Task 10); `UsuarioEditModal`, `UsuarioEditFormState`, `CentroUsuarioOption` (solicitudes); `getCentros` (solicitudes); enums de `usuario.schema`.
- Produces: `useUsuarioEdit(onActualizado?)` → `{ form, open, saving, abrir(rut), cerrar, onChange, onSubmit }`; `CitaAccionesMenu` gana prop `onEditarPaciente: (cita: CitaFila) => void` y su item.

- [ ] **Step 1: Crear el hook `useUsuarioEdit`**

Crear `src/modules/comunicador/hooks/useUsuarioEdit.ts`:

```ts
"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
// actions
import { actualizarUsuarioComunicador } from "../actions/actualizarUsuarioComunicador.action";
import { getUsuarioParaEdicion, type UsuarioEditable } from "../actions/getUsuarioParaEdicion.action";
// components
import type { UsuarioEditFormState } from "@/modules/solicitudes/components/UsuarioEditModal";
// schemas
import { DISCAPACIDAD_USUARIO, GENEROS_USUARIO, GESTANTE_USUARIO } from "@/modules/solicitudes/schemas/usuario.schema";

const emptyForm: UsuarioEditFormState = {
    rut: "",
    nombre: "",
    apellido: "",
    nombre_social: "",
    correo_contacto: "",
    sector: "",
    genero: "",
    fecha_nacimiento: "",
    telefono: "",
    telefono_alternativo: "",
    gestante: "",
    discapacidad: "",
    centro_id: ""
};

function toDateInput(value: Date | string | null): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function toForm(usuario: UsuarioEditable): UsuarioEditFormState {
    return {
        rut: usuario.rut,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        nombre_social: usuario.nombre_social ?? "",
        correo_contacto: usuario.correo_contacto ?? "",
        sector: usuario.sector ?? "",
        genero: (usuario.genero as UsuarioEditFormState["genero"]) ?? "",
        fecha_nacimiento: toDateInput(usuario.fecha_nacimiento),
        telefono: usuario.telefono ?? "",
        telefono_alternativo: usuario.telefono_alternativo ?? "",
        gestante: usuario.genero === "Femenino" ? ((usuario.gestante as UsuarioEditFormState["gestante"]) ?? "") : "No aplica",
        discapacidad: (usuario.discapacidad as UsuarioEditFormState["discapacidad"]) ?? "",
        centro_id: usuario.centro_id ?? ""
    };
}

function isGenero(v: string): v is (typeof GENEROS_USUARIO)[number] {
    return (GENEROS_USUARIO as readonly string[]).includes(v);
}
function isGestante(v: string): v is (typeof GESTANTE_USUARIO)[number] {
    return (GESTANTE_USUARIO as readonly string[]).includes(v);
}
function isDiscapacidad(v: string): v is (typeof DISCAPACIDAD_USUARIO)[number] {
    return (DISCAPACIDAD_USUARIO as readonly string[]).includes(v);
}

export function useUsuarioEdit(onActualizado?: () => void) {
    const [form, setForm] = useState<UsuarioEditFormState>(emptyForm);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    async function abrir(rut: string) {
        try {
            const { usuario } = await getUsuarioParaEdicion(rut);
            if (!usuario) {
                toast.error("No se encontró el paciente");
                return;
            }
            setForm(toForm(usuario));
            setOpen(true);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al cargar el paciente");
        }
    }

    function cerrar() {
        setOpen(false);
    }

    function onChange(field: keyof UsuarioEditFormState, value: string) {
        setForm((current) => ({
            ...current,
            [field]: value,
            ...(field === "genero" && value !== "Femenino" ? { gestante: "No aplica" } : {})
        }));
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            if (!isGenero(form.genero) || !isGestante(form.gestante) || !isDiscapacidad(form.discapacidad)) {
                toast.error("Selecciona genero, gestante y discapacidad");
                return;
            }
            await actualizarUsuarioComunicador({
                ...form,
                genero: form.genero,
                gestante: form.genero === "Femenino" ? form.gestante : "No aplica",
                discapacidad: form.discapacidad
            });
            toast.success("Paciente actualizado");
            setOpen(false);
            onActualizado?.();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al guardar el paciente");
        } finally {
            setSaving(false);
        }
    }

    return { form, open, saving, abrir, cerrar, onChange, onSubmit };
}
```

- [ ] **Step 2: Agregar el item "Editar paciente" al kebab**

En `src/modules/comunicador/components/CitaAccionesMenu.tsx`, agregar `Pencil` al import de lucide y el nuevo item/prop:

```tsx
import { CalendarClock, History, MoreVertical, Pencil } from "lucide-react";
```

```tsx
export function CitaAccionesMenu({ cita, onVerHistorial, onVerOtrasCitas, onEditarPaciente }: {
    cita: CitaFila;
    onVerHistorial: (cita: CitaFila) => void;
    onVerOtrasCitas: (cita: CitaFila) => void;
    onEditarPaciente: (cita: CitaFila) => void;
}) {
```

Agregar al final del `<DropdownMenuContent>`:

```tsx
                <DropdownMenuItem onSelect={() => onEditarPaciente(cita)}>
                    <Pencil size={14} />
                    Editar paciente
                </DropdownMenuItem>
```

- [ ] **Step 3: Wire en la página (cargar centros + hook + modal)**

En `src/app/(app)/comunicador/page.tsx`:

Imports:

```ts
import { getCentros, type CentroOption } from "@/modules/solicitudes/actions/getCentros.action";
import { UsuarioEditModal } from "@/modules/solicitudes/components/UsuarioEditModal";
import { useUsuarioEdit } from "@/modules/comunicador/hooks/useUsuarioEdit";
```

Estado + carga de centros (agregar junto a los otros `useState`/`useEffect`):

```ts
    const [centros, setCentros] = useState<CentroOption[]>([]);
    const editarPaciente = useUsuarioEdit(cargar);

    useEffect(() => {
        getCentros().then(setCentros).catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar centros"));
    }, []);
```

> Nota: `editarPaciente = useUsuarioEdit(cargar)` debe declararse **después** de la definición de `cargar` (el `useCallback` de la línea 30). Colocar esta línea junto al `useEffect` de carga de centros, más abajo que `cargar`.

Pasar el handler al kebab:

```tsx
                        renderAcciones={(cita) => (
                            <CitaAccionesMenu
                                cita={cita}
                                onVerHistorial={setCitaHistorial}
                                onVerOtrasCitas={setCitaOtras}
                                onEditarPaciente={(c) => editarPaciente.abrir(c.rut_usuario)}
                            />
                        )}
```

Render del modal (junto a los demás modales):

```tsx
            {editarPaciente.open && (
                <UsuarioEditModal
                    form={editarPaciente.form}
                    centros={centros.map((c) => ({ id_centro: c.id_centro, nombre_centro: c.nombre_centro }))}
                    saving={editarPaciente.saving}
                    onChange={editarPaciente.onChange}
                    onClose={editarPaciente.cerrar}
                    onSubmit={editarPaciente.onSubmit}
                />
            )}
```

- [ ] **Step 4: Verificar compilación y lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

En `/comunicador` con un rol de comunicador: kebab → "Editar paciente" → el modal carga los datos, se editan y se guardan; la cola se recarga. Probar también que un cambio de género distinto de "Femenino" fuerza gestante a "No aplica".

- [ ] **Step 6: Commit**

```bash
git add src/modules/comunicador/hooks/useUsuarioEdit.ts src/modules/comunicador/components/CitaAccionesMenu.tsx "src/app/(app)/comunicador/page.tsx"
git commit -m "feat(comunicador): editar paciente desde el kebab de la cola"
```

---

## Task 12: Frontend — cascada Solicitud → Citas en /solicitudes/ingresar

**Files:**
- Create: `src/modules/solicitudes/components/PendientesCascada.tsx`
- Modify: `src/app/(app)/solicitudes/ingresar/page.tsx` (reemplazar el grid de dos Cards, líneas 297-341)

**Interfaces:**
- Consumes: el resultado de `getPendientes` (`{ solicitudesPendientes, citasPendientes }`).
- Produces: `PendientesCascada` que anida citas bajo su solicitud y agrupa las citas huérfanas en "Otras citas".

- [ ] **Step 1: Crear el componente de cascada**

Crear `src/modules/solicitudes/components/PendientesCascada.tsx`:

```tsx
"use client";

import { AlertTriangle } from "lucide-react";
// actions
import type { getPendientes } from "../actions/getPendientes.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

type Pendientes = Awaited<ReturnType<typeof getPendientes>>;
type SolicitudPendiente = Pendientes["solicitudesPendientes"][number];
type CitaPendiente = Pendientes["citasPendientes"][number];

function formatFecha(value: Date | string): string {
    return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function CitaRow({ cita }: { cita: CitaPendiente }) {
    return (
        <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">{cita.id_cita}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {[cita.profesional?.nombre, cita.prestacion?.nombre_prestacion].filter(Boolean).join(" · ") || "Sin detalle"}
                    </p>
                    {cita.observacion && <p className="mt-1 text-sm text-muted-foreground">{cita.observacion}</p>}
                </div>
                <Badge variant="warning">
                    <AlertTriangle size={12} />
                    {cita.estado_cita ?? "Sin estado"}
                </Badge>
            </div>
        </div>
    );
}

export function PendientesCascada({ pendientes }: { pendientes: Pendientes }) {
    const { solicitudesPendientes, citasPendientes } = pendientes;

    const idsSolicitudes = new Set(solicitudesPendientes.map((s) => s.id_solicitud));
    const citasPorSolicitud = new Map<string, CitaPendiente[]>();
    const huerfanas: CitaPendiente[] = [];

    for (const cita of citasPendientes) {
        if (cita.solicitud_id && idsSolicitudes.has(cita.solicitud_id)) {
            const lista = citasPorSolicitud.get(cita.solicitud_id) ?? [];
            lista.push(cita);
            citasPorSolicitud.set(cita.solicitud_id, lista);
        } else {
            huerfanas.push(cita);
        }
    }

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
            <CardContent className="space-y-4">
                {solicitudesPendientes.map((solicitud: SolicitudPendiente) => {
                    const citas = citasPorSolicitud.get(solicitud.id_solicitud) ?? [];
                    return (
                        <div key={solicitud.id_solicitud} className="rounded-md border p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium">{solicitud.id_solicitud}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {[
                                            `Inicio: ${formatFecha(solicitud.fecha_inicio)}`,
                                            `Tipo: ${solicitud.tipoSolicitud?.nombre_tipo_solicitud || "-"}`,
                                            `Motivo: ${solicitud.motivo?.nombre_motivo || "-"}`
                                        ].join(" · ")}
                                    </p>
                                    {solicitud.descripcion && <p className="mt-1 text-sm text-muted-foreground">{solicitud.descripcion}</p>}
                                </div>
                                <Badge variant="warning">
                                    <AlertTriangle size={12} />
                                    {solicitud.estado_solicitud}
                                </Badge>
                            </div>
                            <div className="mt-3 space-y-2 border-l-2 border-muted pl-3">
                                {citas.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin citas pendientes en esta solicitud.</p>
                                ) : (
                                    citas.map((cita) => <CitaRow key={cita.id_cita} cita={cita} />)
                                )}
                            </div>
                        </div>
                    );
                })}

                {huerfanas.length > 0 && (
                    <div className="rounded-md border border-dashed p-3">
                        <p className="text-sm font-medium">Otras citas</p>
                        <p className="mt-1 text-sm text-muted-foreground">Citas pendientes sin una solicitud En Curso asociada.</p>
                        <div className="mt-3 space-y-2">
                            {huerfanas.map((cita) => <CitaRow key={cita.id_cita} cita={cita} />)}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 2: Reemplazar el grid de dos Cards en /ingresar**

En `src/app/(app)/solicitudes/ingresar/page.tsx`, agregar el import:

```ts
import { PendientesCascada } from "@/modules/solicitudes/components/PendientesCascada";
```

Reemplazar todo el bloque `{pendientes && ( <div className="grid gap-4 lg:grid-cols-2"> ... </div> )}` (líneas 297-341) por:

```tsx
            {pendientes && <PendientesCascada pendientes={pendientes} />}
```

- [ ] **Step 3: Eliminar `EmptyState` si queda sin uso**

Verificar si `EmptyState` (líneas 705-712) sigue usándose en el archivo. Si ya no se referencia tras el reemplazo, eliminar la función `EmptyState` para evitar un warning de lint por variable sin uso. Si `PendingRow` tampoco se usa en otra parte, eliminarla también.

Run: `npm run lint`
Expected: sin warnings de "unused". Ajustar (eliminar helpers muertos) según lo que reporte.

- [ ] **Step 4: Verificar compilación y build**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

En `/solicitudes/ingresar`, buscar un RUT con solicitudes y citas: las citas aparecen anidadas bajo su solicitud; citas sin solicitud En Curso aparecen en "Otras citas".

- [ ] **Step 6: Commit**

```bash
git add src/modules/solicitudes/components/PendientesCascada.tsx "src/app/(app)/solicitudes/ingresar/page.tsx"
git commit -m "feat(solicitudes): vista en cascada de solicitudes y citas en ingresar"
```

---

## Cierre

- [ ] **Verificación global final**

Run: `npm run lint && npm test && npm run build`
Expected: lint limpio, todos los tests PASS, build exitoso.

- [ ] **Revisión de cobertura vs. spec**

Confirmar los 6 cambios de la spec:
1. Filtros rut/sector (Tasks 1-2) ✓
2. Historial de llamadas (Tasks 6-7) ✓
3. Otras citas próximas (Tasks 8-9) ✓
4. Resaltar filas de hoy (Tasks 3-4) ✓
5. Editar paciente desde comunicador (Tasks 10-11) ✓
6. Cascada Solicitud → Citas (Task 12) ✓
