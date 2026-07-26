# IDs cortos en el front — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acortar la visualizacion de los IDs de solicitudes, citas y llamadas en el front (prefijo + ultimos 5 caracteres) sin cambiar nada en la BD, manteniendo el ID completo copiable para trazabilidad.

**Architecture:** Dos piezas nuevas — una util pura `acortarId()` (unica fuente de verdad del formato) y un componente cliente `<CodigoId>` que la usa y agrega tooltip + copiar-al-portapapeles. Luego se reemplazan los ~15 call sites: `<CodigoId>` donde el ID es un elemento clickeable (celdas de tabla, filas, lineas de detalle) y `acortarId()` (texto plano) donde el ID va incrustado en una cadena (descripciones de modal, toast). El voucher de creacion conserva el ID completo.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict, Tailwind, shadcn/ui, sonner (toasts), Vitest + Testing Library.

## Global Constraints

- **Formato visible:** prefijo (texto antes del primer `-`) + `-` + ultimos 5 caracteres del ID completo. Ej: `SOL-550e8400-…-446655440000` → `SOL-40000`.
- **Guarda de `acortarId`:** si el ID no contiene `-`, o su longitud es `<= prefijo.length + 6`, se devuelve **tal cual**.
- **`acortarId()` es la unica fuente de verdad del formato.** Ningun call site reimplementa el corte.
- **Trazabilidad = copiar completo**, no buscador. El ID completo se copia al click y aparece en el atributo `title`.
- **El voucher/comprobante de creacion (`IngresarSolicitudView`) conserva el ID completo visible.** No se acorta.
- **No se cambia** la generacion de IDs ni el esquema/datos de BD.
- **Convenciones:** espanol (UI, comentarios, commits); indentacion 4 espacios; TypeScript strict con tipos explicitos; alias `@/` → `src/`; imports categorizados con comentarios (`// lib`, `// components`, ...); componentes PascalCase; funciones/vars camelCase.

---

## File Structure

- `src/shared/lib/acortarId.ts` — util pura `acortarId(id: string): string`. Junto a `permisos.ts`, `access.ts`, `utils.ts`.
- `src/shared/lib/acortarId.test.ts` — tests unitarios de la util.
- `src/shared/components/ui/codigo-id.tsx` — componente cliente `<CodigoId>`.
- `src/shared/components/ui/codigo-id.test.tsx` — test del componente.
- Modificados (rollout): `CitasPendientesTabla.tsx`, `RevisarSolicitudesView.tsx`, `DashboardView.tsx`, `PendientesCascada.tsx`, `OtrasCitasPacienteModal.tsx`, `RegistrarLlamadaModal.tsx`, `IngresarSolicitudView.tsx`.

---

## Task 1: Util pura `acortarId()`

**Files:**
- Create: `src/shared/lib/acortarId.ts`
- Test: `src/shared/lib/acortarId.test.ts`

**Interfaces:**
- Produces: `export function acortarId(id: string): string` — formatea el ID a `prefijo-ultimos5`, o lo devuelve tal cual bajo la guarda.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/shared/lib/acortarId.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { acortarId } from "./acortarId";

describe("acortarId", () => {
    it("acorta un id SOL con UUID a prefijo + ultimos 5", () => {
        expect(acortarId("SOL-550e8400-e29b-41d4-a716-446655440000")).toBe("SOL-40000");
    });

    it("acorta un id CITA", () => {
        expect(acortarId("CITA-550e8400-e29b-41d4-a716-446655440000")).toBe("CITA-40000");
    });

    it("acorta un id LLAM", () => {
        expect(acortarId("LLAM-550e8400-e29b-41d4-a716-446655440000")).toBe("LLAM-40000");
    });

    it("acorta el id demo (por encima del umbral)", () => {
        expect(acortarId("SOL-DEMO-001")).toBe("SOL-O-001");
    });

    it("es idempotente sobre un id ya corto", () => {
        expect(acortarId("SOL-40000")).toBe("SOL-40000");
    });

    it("devuelve tal cual un id sin guion", () => {
        expect(acortarId("12345")).toBe("12345");
    });

    it("devuelve tal cual un id por debajo del umbral", () => {
        expect(acortarId("SOL-01")).toBe("SOL-01");
    });

    it("devuelve tal cual un id vacio", () => {
        expect(acortarId("")).toBe("");
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- src/shared/lib/acortarId.test.ts`
Expected: FAIL — no existe el modulo `./acortarId` (error de importacion).

- [ ] **Step 3: Implementar la util minima**

Crear `src/shared/lib/acortarId.ts`:

```ts
/**
 * Acorta un ID largo (prefijo + UUID) a "prefijo-ultimos5" para mostrar en el
 * front. El ID completo NO cambia en la BD; esta es solo la representacion
 * visible. Es la unica fuente de verdad del formato corto.
 *
 * Ej: "SOL-550e8400-e29b-41d4-a716-446655440000" -> "SOL-40000".
 * Si el id no tiene prefijo, o ya es corto, se devuelve tal cual.
 */
export function acortarId(id: string): string {
    const guion = id.indexOf("-");
    if (guion === -1) return id; // sin prefijo -> tal cual
    const prefijo = id.slice(0, guion);
    if (id.length <= prefijo.length + 6) return id; // ya es corto -> nada que acortar
    return `${prefijo}-${id.slice(-5)}`;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- src/shared/lib/acortarId.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/acortarId.ts src/shared/lib/acortarId.test.ts
git commit -m "feat(shared): util acortarId para IDs cortos en el front"
```

---

## Task 2: Componente `<CodigoId>`

**Files:**
- Create: `src/shared/components/ui/codigo-id.tsx`
- Test: `src/shared/components/ui/codigo-id.test.tsx`

**Interfaces:**
- Consumes: `acortarId(id)` de `@/shared/lib/acortarId` (Task 1); `cn` de `@/shared/lib/utils`; `toast` de `sonner`.
- Produces: `export function CodigoId({ id, className }: { id: string; className?: string })` — boton inline que muestra `acortarId(id)`, con `title={id}` y click-para-copiar el id completo.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/shared/components/ui/codigo-id.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() }
}));

import { CodigoId } from "./codigo-id";
import { toast } from "sonner";

const ID = "SOL-550e8400-e29b-41d4-a716-446655440000";

const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

beforeEach(() => {
    vi.clearAllMocks();
});

describe("CodigoId", () => {
    it("muestra el codigo acortado", () => {
        render(<CodigoId id={ID} />);
        expect(screen.getByRole("button")).toHaveTextContent("SOL-40000");
    });

    it("expone el id completo en el title", () => {
        render(<CodigoId id={ID} />);
        expect(screen.getByRole("button")).toHaveAttribute("title", ID);
    });

    it("al hacer click copia el id completo y avisa con un toast", async () => {
        render(<CodigoId id={ID} />);
        fireEvent.click(screen.getByRole("button"));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(ID));
        expect(toast.success).toHaveBeenCalledWith("Codigo copiado");
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- src/shared/components/ui/codigo-id.test.tsx`
Expected: FAIL — no existe el modulo `./codigo-id`.

- [ ] **Step 3: Implementar el componente minimo**

Crear `src/shared/components/ui/codigo-id.tsx`:

```tsx
"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
// lib
import { cn } from "@/shared/lib/utils";
import { acortarId } from "@/shared/lib/acortarId";

/**
 * Muestra un ID acortado (prefijo + ultimos 5) y permite copiar el ID completo
 * con un click. El id completo tambien queda en el atributo title (tooltip).
 * Usar donde el ID es un elemento clickeable independiente (celdas, filas,
 * lineas de detalle). Para IDs incrustados en texto usar acortarId() directo.
 */
export function CodigoId({ id, className }: { id: string; className?: string }) {
    async function copiar() {
        try {
            await navigator.clipboard.writeText(id);
            toast.success("Codigo copiado");
        } catch {
            toast.error("No se pudo copiar el codigo");
        }
    }

    return (
        <button
            type="button"
            onClick={copiar}
            title={id}
            aria-label="Copiar codigo completo"
            className={cn(
                "group inline-flex items-center gap-1 font-medium hover:text-primary",
                className
            )}
        >
            {acortarId(id)}
            <Copy size={12} className="opacity-0 transition-opacity group-hover:opacity-70" />
        </button>
    );
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- src/shared/components/ui/codigo-id.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/ui/codigo-id.tsx src/shared/components/ui/codigo-id.test.tsx
git commit -m "feat(ui): componente CodigoId con copiar ID completo"
```

---

## Task 3: Rollout de `<CodigoId>` en tablas, filas y detalles

Reemplazar los IDs renderizados como elementos independientes por `<CodigoId>`. Estas son ediciones mecanicas de JSX; **no** se agregan tests nuevos (la logica ya esta cubierta por Task 1/2). La verificacion es `npm run lint` + `npm run build` (tsc) + `npm test` (suite completa verde).

**Files:**
- Modify: `src/modules/comunicador/components/CitasPendientesTabla.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Modify: `src/modules/dashboard/components/DashboardView.tsx`
- Modify: `src/modules/solicitudes/components/PendientesCascada.tsx`

**Interfaces:**
- Consumes: `<CodigoId>` de `@/shared/components/ui/codigo-id` (Task 2).

- [ ] **Step 1: `CitasPendientesTabla.tsx` — reemplazar el helper `abreviar` por `<CodigoId>`**

Agregar el import (seccion `// components`, junto a los otros imports de `@/shared/components/ui/...`):

```tsx
import { CodigoId } from "@/shared/components/ui/codigo-id";
```

Eliminar la funcion `abreviar` completa (actualmente lineas 11-13):

```tsx
function abreviar(codigo: string): string {
    return codigo.length > 14 ? `${codigo.slice(0, 12)}…` : codigo;
}
```

Reemplazar la celda (actual linea 52):

```tsx
<td className="px-3 py-3 font-medium" title={c.id_cita}>{abreviar(c.id_cita)}</td>
```

por:

```tsx
<td className="px-3 py-3 font-medium"><CodigoId id={c.id_cita} /></td>
```

- [ ] **Step 2: `RevisarSolicitudesView.tsx` — celdas de tabla y lineas de detalle**

Agregar el import (seccion `// components`):

```tsx
import { CodigoId } from "@/shared/components/ui/codigo-id";
```

Reemplazar la celda de la primera tabla (actual lineas 411-413):

```tsx
<td className="truncate px-3 py-3 font-medium" title={s.id_solicitud}>
    {s.id_solicitud}
</td>
```

por:

```tsx
<td className="px-3 py-3 font-medium">
    <CodigoId id={s.id_solicitud} />
</td>
```

Reemplazar la linea de detalle del modal Rechazar (actual linea 561):

```tsx
<p className="mt-1 text-sm text-muted-foreground">{solicitud.id_solicitud}</p>
```

por:

```tsx
<p className="mt-1 text-sm text-muted-foreground"><CodigoId id={solicitud.id_solicitud} /></p>
```

Reemplazar la celda de la segunda tabla (actual lineas 645-647):

```tsx
<td className="truncate px-3 py-3 font-medium" title={solicitud.id_solicitud}>
    {solicitud.id_solicitud}
</td>
```

por:

```tsx
<td className="px-3 py-3 font-medium">
    <CodigoId id={solicitud.id_solicitud} />
</td>
```

Reemplazar la linea de detalle del modal Realizar (actual linea 710):

```tsx
<p className="mt-1 text-sm text-muted-foreground">{solicitud.id_solicitud}</p>
```

por:

```tsx
<p className="mt-1 text-sm text-muted-foreground"><CodigoId id={solicitud.id_solicitud} /></p>
```

- [ ] **Step 3: `DashboardView.tsx` — celdas de tabla (solo celdas)**

Agregar el import (seccion `// components`):

```tsx
import { CodigoId } from "@/shared/components/ui/codigo-id";
```

Reemplazar estas 5 celdas de tabla (actuales lineas 280, 320, 372, 374, 443):

```tsx
<td className="px-3 py-3 font-medium">{solicitud.id_solicitud}</td>
```
→
```tsx
<td className="px-3 py-3 font-medium"><CodigoId id={solicitud.id_solicitud} /></td>
```

```tsx
<td className="px-3 py-3 font-medium">{gestion.id_solicitud}</td>
```
→
```tsx
<td className="px-3 py-3 font-medium"><CodigoId id={gestion.id_solicitud} /></td>
```

```tsx
<td className="px-3 py-3 font-medium">{llamada.id_llamada}</td>
```
→
```tsx
<td className="px-3 py-3 font-medium"><CodigoId id={llamada.id_llamada} /></td>
```

```tsx
<td className="px-3 py-3">{llamada.cita_id}</td>
```
→
```tsx
<td className="px-3 py-3"><CodigoId id={llamada.cita_id} /></td>
```

```tsx
<td className="px-3 py-3 font-medium">{cita.id_cita}</td>
```
→
```tsx
<td className="px-3 py-3 font-medium"><CodigoId id={cita.id_cita} /></td>
```

> No tocar en este task las descripciones de modal (lineas 426, 462) ni el `DetailItem` de la linea 466 — esas van en Task 4 con `acortarId()`.

- [ ] **Step 4: `PendientesCascada.tsx` — filas de cita y de solicitud**

Agregar el import (seccion `// components`):

```tsx
import { CodigoId } from "@/shared/components/ui/codigo-id";
```

Reemplazar el ID de la fila de cita (actual linea 23):

```tsx
<p className="text-sm font-medium">{cita.id_cita}</p>
```

por:

```tsx
<p className="text-sm font-medium"><CodigoId id={cita.id_cita} /></p>
```

Reemplazar el ID de la fila de solicitud (actual linea 79):

```tsx
<p className="text-sm font-medium">{solicitud.id_solicitud}</p>
```

por:

```tsx
<p className="text-sm font-medium"><CodigoId id={solicitud.id_solicitud} /></p>
```

- [ ] **Step 5: Verificar lint, tipos y build**

Run: `npm run lint`
Expected: sin errores.

Run: `npm run build`
Expected: compila sin errores de TypeScript.

- [ ] **Step 6: Correr la suite completa**

Run: `npm test`
Expected: PASS (toda la suite verde, incluidos los tests de Task 1 y 2).

- [ ] **Step 7: Commit**

```bash
git add src/modules/comunicador/components/CitasPendientesTabla.tsx \
        src/modules/solicitudes/components/RevisarSolicitudesView.tsx \
        src/modules/dashboard/components/DashboardView.tsx \
        src/modules/solicitudes/components/PendientesCascada.tsx
git commit -m "feat(front): usar CodigoId para IDs en tablas, filas y detalles"
```

---

## Task 4: Rollout de `acortarId()` en textos incrustados + voucher completo

Reemplazar los IDs incrustados en cadenas de texto (descripciones de modal, `DetailItem`, toast) por `acortarId()`. Verificar que el voucher conserva el ID completo. Ediciones mecanicas; verificacion por `npm run lint` + `npm run build` + `npm test`.

**Files:**
- Modify: `src/modules/dashboard/components/DashboardView.tsx`
- Modify: `src/modules/comunicador/components/OtrasCitasPacienteModal.tsx`
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx`

**Interfaces:**
- Consumes: `acortarId` de `@/shared/lib/acortarId` (Task 1).

> Nota: `DashboardView.tsx` ya fue tocado en Task 3 (celdas + import de `CodigoId`). Aqui solo se agrega el import de `acortarId` y se editan las lineas de texto (descripciones y `DetailItem`), que Task 3 no toco.

- [ ] **Step 1: `DashboardView.tsx` — descripciones de modal y DetailItem**

Agregar el import (seccion `// lib`):

```tsx
import { acortarId } from "@/shared/lib/acortarId";
```

Reemplazar la descripcion del modal de citas gestionadas (actual linea 426):

```tsx
<ModalShell title="Citas gestionadas" description={`Solicitud ${gestion.id_solicitud} · ${gestion.rut_usuario}`} onClose={onClose}>
```

por:

```tsx
<ModalShell title="Citas gestionadas" description={`Solicitud ${acortarId(gestion.id_solicitud)} · ${gestion.rut_usuario}`} onClose={onClose}>
```

Reemplazar la descripcion del modal de detalle de llamada (actual linea 462):

```tsx
<ModalShell title="Detalle llamada" description={`Llamada ${llamada.id_llamada}`} onClose={onClose}>
```

por:

```tsx
<ModalShell title="Detalle llamada" description={`Llamada ${acortarId(llamada.id_llamada)}`} onClose={onClose}>
```

Reemplazar el `DetailItem` de la cita (actual linea 466):

```tsx
<DetailItem label="Cita" value={llamada.cita_id} />
```

por:

```tsx
<DetailItem label="Cita" value={acortarId(llamada.cita_id)} />
```

- [ ] **Step 2: `OtrasCitasPacienteModal.tsx` — texto "Cita {id}"**

Agregar el import (seccion `// lib`; si no existe la seccion, agregarla sobre los imports de componentes):

```tsx
import { acortarId } from "@/shared/lib/acortarId";
```

Reemplazar (actual linea 57):

```tsx
Fecha estimada: {formatFecha(c.fecha_estimada_atencion)} · Cita {c.id_cita}
```

por:

```tsx
Fecha estimada: {formatFecha(c.fecha_estimada_atencion)} · Cita {acortarId(c.id_cita)}
```

- [ ] **Step 3: `RegistrarLlamadaModal.tsx` — texto "Cita {id} · Nombre"**

Agregar el import (seccion `// lib` o junto a los otros imports de `@/shared/...`):

```tsx
import { acortarId } from "@/shared/lib/acortarId";
```

Reemplazar (actual linea 54):

```tsx
<p className="text-sm text-muted-foreground">Cita {cita.id_cita} · {cita.nombre_usuario}</p>
```

por:

```tsx
<p className="text-sm text-muted-foreground">Cita {acortarId(cita.id_cita)} · {cita.nombre_usuario}</p>
```

- [ ] **Step 4: `IngresarSolicitudView.tsx` — acortar el toast, dejar el voucher completo**

Agregar el import (seccion `// lib`):

```tsx
import { acortarId } from "@/shared/lib/acortarId";
```

Reemplazar el toast de creacion (actual linea 258):

```tsx
toast.success(`Solicitud creada: ${solicitud.id_solicitud}`);
```

por:

```tsx
toast.success(`Solicitud creada: ${acortarId(solicitud.id_solicitud)}`);
```

**NO** modificar la linea del voucher (actual linea 464); debe permanecer con el ID completo:

```tsx
<VoucherLine label="Solicitud" value={voucher.id_solicitud} />
```

- [ ] **Step 5: Verificar que el voucher sigue mostrando el ID completo**

Run: `grep -n "VoucherLine label=\"Solicitud\"" src/modules/solicitudes/components/IngresarSolicitudView.tsx`
Expected: la linea muestra `value={voucher.id_solicitud}` (sin `acortarId`).

- [ ] **Step 6: Verificar lint, tipos y build**

Run: `npm run lint`
Expected: sin errores.

Run: `npm run build`
Expected: compila sin errores de TypeScript.

- [ ] **Step 7: Correr la suite completa**

Run: `npm test`
Expected: PASS (toda la suite verde).

- [ ] **Step 8: Commit**

```bash
git add src/modules/dashboard/components/DashboardView.tsx \
        src/modules/comunicador/components/OtrasCitasPacienteModal.tsx \
        src/modules/comunicador/components/RegistrarLlamadaModal.tsx \
        src/modules/solicitudes/components/IngresarSolicitudView.tsx
git commit -m "feat(front): acortar IDs en textos de modales y toast (voucher intacto)"
```

---

## Notas de verificacion final (para la revision de rama completa)

- Todos los IDs renderizados en el front usan `<CodigoId>` (elementos) o `acortarId()` (texto), salvo el voucher.
- El helper local `abreviar` de `CitasPendientesTabla.tsx` fue eliminado (no queda formato de ID duplicado fuera de `acortarId`).
- Ningun cambio toca `crearSolicitud.action.ts`, `gestionarSolicitud.action.ts` ni `registrarLlamada.action.ts` (la generacion de IDs no cambia).
- El esquema de Prisma y el seed no se tocan.
