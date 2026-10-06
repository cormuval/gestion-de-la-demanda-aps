# Panel SOME Consultas Acotadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las dos consultas sin techo del Panel SOME por agregaciones que mantengan el mismo contrato de datos.

**Architecture:** `getSomePanel` conserva su API y el armado de `SomePanelData`, pero demanda clinica y solicitudes pendientes pasan por helpers privados que consumen grupos Prisma y lookups de catalogos. No hay cambios de UI ni de esquema; las pruebas fijan que el backlog no vuelva a cargarse con `findMany`.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript strict, Prisma + MySQL, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-panel-some-consultas-acotadas-design.md`

## Global Constraints

- Idioma espanol. Indentacion: 4 espacios.
- TypeScript strict; mantener tipos explicitos en helpers nuevos.
- No cambiar el contrato publico `SomePanelData`, `SomeDemandaProfesional` ni `SomeSolicitudPendienteTipo`.
- No agregar migraciones, permisos, dependencias ni cambios de UI.
- Mantener `requirePermiso("some.ver")` como control de acceso.
- Mantener fallback de nombres: profesional `"-"`, prestacion `"-"`, tipo `"-"`, motivo `"Sin motivo"` cuando `motivo_id` es nulo.
- Verificacion final: `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`, `npx tsc --noEmit`, `npm run lint`.

## Review Focus

- Filtro `demandaTemporalidad = "Todas"` debe ejecutar y fusionar atrasados, proximos y futuros sin duplicar conteos.
- Filtro temporal concreto debe consultar solo ese rango y devolver totales consistentes.
- `fecha_estimada_atencion = null` debe clasificarse como `Agendamientos próximos`.
- `motivo_id = null` debe mostrarse como `Sin motivo`; ids de catalogo faltantes no deben romper el panel.
- Las consultas de backlog no deben volver a usar `findMany` con filas individuales.

---

## File Structure

- `src/modules/some/actions/getSomePanel.action.ts`: helpers de temporalidad, agrupacion de demanda clinica, agrupacion de solicitudes pendientes, y reemplazo de las dos consultas sin techo.
- `src/modules/some/actions/getSomePanel.action.test.ts`: mocks Prisma ampliados y pruebas TDD de los nuevos `groupBy`, lookups, temporalidad y fallbacks.

---

### Task 1: Solicitudes pendientes agrupadas por tipo y motivo

**Files:**
- Modify: `src/modules/some/actions/getSomePanel.action.ts`
- Test: `src/modules/some/actions/getSomePanel.action.test.ts`

**Interfaces:**
- Produces: helper privado `buildSolicitudesPendientesAgrupadas(grupos, tipos, motivos): SomeSolicitudPendienteTipo[]`.
- Consumes: `prisma.solicitud.groupBy`, `prisma.tipoSolicitud.findMany`, `prisma.motivo.findMany`.

- [ ] **Step 1: Actualizar mock Prisma del test**

En `src/modules/some/actions/getSomePanel.action.test.ts`, extender el mock:

```ts
prisma: {
    centro: { findMany: vi.fn() },
    funcionario: { findMany: vi.fn() },
    solicitud: { findMany: vi.fn(), groupBy: vi.fn() },
    cita: { findMany: vi.fn() },
    llamada: { findMany: vi.fn() },
    tipoSolicitud: { findMany: vi.fn() },
    motivo: { findMany: vi.fn() }
}
```

En `beforeEach`, dejar valores por defecto:

```ts
(prisma.solicitud.groupBy as any).mockResolvedValue([]);
(prisma.tipoSolicitud.findMany as any).mockResolvedValue([]);
(prisma.motivo.findMany as any).mockResolvedValue([]);
```

- [ ] **Step 2: Reescribir test de solicitudes pendientes para `groupBy`**

Actualizar `agrupa solicitudes pendientes por tipo y motivo` para mockear:

```ts
(prisma.solicitud.groupBy as any).mockResolvedValue([
    { tipo_solicitud_id: 1, motivo_id: 10, _count: { _all: 1 } },
    { tipo_solicitud_id: 1, motivo_id: null, _count: { _all: 1 } },
    { tipo_solicitud_id: 2, motivo_id: 20, _count: { _all: 1 } }
]);
(prisma.tipoSolicitud.findMany as any).mockResolvedValue([
    { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Consulta medica" },
    { id_tipo_solicitud: 2, nombre_tipo_solicitud: "Examenes" }
]);
(prisma.motivo.findMany as any).mockResolvedValue([
    { id_motivo: 10, nombre_motivo: "Control" },
    { id_motivo: 20, nombre_motivo: "Laboratorio" }
]);
```

Assert principal:

```ts
expect(prisma.solicitud.groupBy).toHaveBeenCalledWith({
    by: ["tipo_solicitud_id", "motivo_id"],
    where: { centro_id: "605", accion: "En espera de validación" },
    _count: { _all: true }
});
expect(prisma.solicitud.findMany).toHaveBeenCalledTimes(2);
```

Mantener el `expect(result.solicitudesPendientes).toEqual(...)` existente.

- [ ] **Step 3: Agregar test de fallback de catalogos**

Agregar caso:

```ts
it("usa fallback cuando solicitudes pendientes tienen catalogos faltantes", async () => {
    (prisma.solicitud.groupBy as any).mockResolvedValue([
        { tipo_solicitud_id: 99, motivo_id: 88, _count: { _all: 3 } },
        { tipo_solicitud_id: 99, motivo_id: null, _count: { _all: 2 } }
    ]);

    const result = await getSomePanel();

    expect(result.solicitudesPendientes).toEqual([
        {
            tipoSolicitud: "-",
            total: 5,
            motivos: [
                { motivo: "-", total: 3 },
                { motivo: "Sin motivo", total: 2 }
            ]
        }
    ]);
});
```

- [ ] **Step 4: Ejecutar tests y confirmar rojo**

Run: `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`

Expected: FAIL porque `solicitud.groupBy` aun no se usa.

- [ ] **Step 5: Implementar agrupacion de solicitudes pendientes**

En `getSomePanel.action.ts`, reemplazar la sexta promesa por `prisma.solicitud.groupBy` con `by`,
`where` y `_count` definidos en el spec.

Despues del `Promise.all`, obtener ids unicos:

```ts
const tipoSolicitudIds = [...new Set(solicitudesPendientesRaw.map((row) => row.tipo_solicitud_id))];
const motivoIds = [...new Set(solicitudesPendientesRaw.map((row) => row.motivo_id).filter((id): id is number => id !== null))];
```

Consultar catalogos solo si hay ids:

```ts
const [tiposSolicitudPendiente, motivosSolicitudPendiente] = await Promise.all([
    tipoSolicitudIds.length
        ? prisma.tipoSolicitud.findMany({ where: { id_tipo_solicitud: { in: tipoSolicitudIds } }, select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true } })
        : Promise.resolve([]),
    motivoIds.length
        ? prisma.motivo.findMany({ where: { id_motivo: { in: motivoIds } }, select: { id_motivo: true, nombre_motivo: true } })
        : Promise.resolve([])
]);
```

Construir mapas y reemplazar el loop de `solicitudesPendientesRaw` por grupos usando `_count._all`.

- [ ] **Step 6: Ejecutar test especifico**

Run: `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`

Expected: PASS para solicitudes pendientes; pueden quedar fallas de demanda clinica si los mocks aun no se ajustan.

- [ ] **Step 7: Commit**

```bash
git add src/modules/some/actions/getSomePanel.action.ts src/modules/some/actions/getSomePanel.action.test.ts
git commit -m "fix(some): agrupar solicitudes pendientes"
```

---

### Task 2: Demanda clinica agrupada por temporalidad

**Files:**
- Modify: `src/modules/some/actions/getSomePanel.action.ts`
- Test: `src/modules/some/actions/getSomePanel.action.test.ts`

**Interfaces:**
- Produces: helper privado `buildTemporalidadRangos(base?: Date)`.
- Produces: helper privado `buildTemporalidadWhere(temporalidad: string, rangos): Prisma.CitaWhereInput`.
- Produces: helper privado `sumarDemandaAgrupada(...)`.
- Consumes: `prisma.cita.groupBy`, `prisma.profesional.findMany`, `prisma.prestacion.findMany`.

- [ ] **Step 1: Actualizar mock Prisma del test**

Extender el mock:

```ts
cita: { findMany: vi.fn(), groupBy: vi.fn() },
profesional: { findMany: vi.fn() },
prestacion: { findMany: vi.fn() }
```

En `beforeEach`:

```ts
(prisma.cita.groupBy as any).mockResolvedValue([]);
(prisma.profesional.findMany as any).mockResolvedValue([]);
(prisma.prestacion.findMany as any).mockResolvedValue([]);
```

- [ ] **Step 2: Reescribir test de demanda clinica agrupada**

En `demanda clinica ignora filtro de funcionario...`, reemplazar el segundo `cita.findMany` por:

```ts
(prisma.cita.groupBy as any)
    .mockResolvedValueOnce([{ profesional_id: 1, prestacion_id: 10, estado_cita: "Sin llamadas", _count: { _all: 1 } }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ profesional_id: 1, prestacion_id: 20, estado_cita: "No contesta (2)", _count: { _all: 1 } }]);
(prisma.profesional.findMany as any).mockResolvedValue([{ id_profesional: 1, nombre: "Medico" }]);
(prisma.prestacion.findMany as any).mockResolvedValue([
    { id_prestacion: 10, nombre_prestacion: "Control" },
    { id_prestacion: 20, nombre_prestacion: "Morbilidad" }
]);
```

Assert:

```ts
expect(prisma.cita.findMany).toHaveBeenCalledTimes(1);
expect(prisma.cita.groupBy).toHaveBeenCalledTimes(3);
expect(prisma.cita.groupBy).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
        by: ["profesional_id", "prestacion_id", "estado_cita"],
        where: expect.objectContaining({ centro_id: "501", estado_cita: { in: ["Sin llamadas", "No contesta (1)", "No contesta (2)", "Solo llamada de aviso"] } }),
        _count: { _all: true }
    })
);
```

Mantener los asserts sobre `result.demandaClinica`.

- [ ] **Step 3: Reescribir test de filtro temporal**

En `filtra demanda clinica por temporalidad`, mockear un solo `groupBy` con el grupo futuro y assert:

```ts
expect(prisma.cita.groupBy).toHaveBeenCalledTimes(1);
expect(prisma.cita.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({
        where: expect.objectContaining({
            fecha_estimada_atencion: expect.objectContaining({ gte: expect.any(Date) })
        })
    })
);
```

- [ ] **Step 4: Agregar test de proximos con fecha nula**

Agregar caso:

```ts
it("clasifica citas sin fecha estimada como proximos al agrupar demanda clinica", async () => {
    (prisma.cita.groupBy as any).mockResolvedValueOnce([{ profesional_id: null, prestacion_id: null, estado_cita: "Sin llamadas", _count: { _all: 4 } }]);

    const result = await getSomePanel({ demandaTemporalidad: "Agendamientos próximos" });

    expect(prisma.cita.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
            where: expect.objectContaining({
                OR: expect.arrayContaining([{ fecha_estimada_atencion: null }])
            })
        })
    );
    expect(result.demandaClinica).toEqual([
        expect.objectContaining({
            profesional: "-",
            total: 4,
            temporalidades: expect.objectContaining({ "Agendamientos próximos": 4 }),
            prestaciones: [expect.objectContaining({ prestacion: "-", total: 4 })]
        })
    ]);
});
```

- [ ] **Step 5: Ejecutar tests y confirmar rojo**

Run: `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`

Expected: FAIL porque demanda clinica aun usa `cita.findMany`.

- [ ] **Step 6: Implementar helpers de temporalidad**

En `getSomePanel.action.ts`, reemplazar `temporalidadCita` por:

```ts
function buildTemporalidadRangos(base = new Date()) {
    const hoy = new Date(base);
    hoy.setHours(0, 0, 0, 0);
    const atrasadosHasta = new Date(hoy);
    atrasadosHasta.setDate(hoy.getDate() - 15);
    const futurosDesde = new Date(hoy);
    futurosDesde.setDate(hoy.getDate() + 31);
    return { hoy, atrasadosHasta, futurosDesde };
}
```

Agregar helper `buildTemporalidadWhere` con las tres reglas del spec.

- [ ] **Step 7: Reemplazar consulta de demanda clinica**

Antes del `Promise.all`, construir:

```ts
const temporalidadRangos = buildTemporalidadRangos();
const temporalidadesDemanda = demandaTemporalidad === TEMPORALIDAD.TODAS ? [TEMPORALIDAD.ATRASADOS, TEMPORALIDAD.PROXIMOS, TEMPORALIDAD.FUTUROS] : [demandaTemporalidad];
```

Reemplazar la quinta promesa por:

```ts
Promise.all(
    temporalidadesDemanda.map(async (temporalidad) => ({
        temporalidad,
        grupos: await prisma.cita.groupBy({
            by: ["profesional_id", "prestacion_id", "estado_cita"],
            where: {
                centro_id: centroSeleccionado,
                estado_cita: { in: [...ESTADOS_PENDIENTES] },
                ...buildTemporalidadWhere(temporalidad, temporalidadRangos)
            },
            _count: { _all: true }
        })
    }))
)
```

- [ ] **Step 8: Resolver catalogos y fusionar demanda**

Despues del `Promise.all`, obtener ids unicos de `demandaRaw.flatMap((item) => item.grupos)`.
Consultar `profesional` y `prestacion` solo si hay ids.

Reemplazar el loop actual:

```ts
for (const bloque of demandaRaw) {
    for (const grupo of bloque.grupos) {
        const temporalidad = bloque.temporalidad;
        const profesional = grupo.profesional_id ? profesionalesMap.get(grupo.profesional_id) ?? "-" : "-";
        const prestacion = grupo.prestacion_id ? prestacionesMap.get(grupo.prestacion_id) ?? "-" : "-";
        const estado = grupo.estado_cita ?? "-";
        const cantidad = grupo._count._all;
        ...
        sumarDemanda(profesionalRow, temporalidad, estado, cantidad);
        sumarDemanda(prestacionRow, temporalidad, estado, cantidad);
    }
}
```

Actualizar firma:

```ts
function sumarDemanda(target: SomeDemandaConteos, temporalidad: string, estado: string, amount = 1)
```

- [ ] **Step 9: Ejecutar test especifico**

Run: `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/modules/some/actions/getSomePanel.action.ts src/modules/some/actions/getSomePanel.action.test.ts
git commit -m "fix(some): agrupar demanda clinica"
```

---

### Task 3: Verificacion estatica y cierre

**Files:**
- Modify only if verification finds issues: `src/modules/some/actions/getSomePanel.action.ts`, `src/modules/some/actions/getSomePanel.action.test.ts`

**Interfaces:**
- Produces: rama lista para implementar o revisar.

- [ ] **Step 1: Ejecutar test especifico del panel SOME**

Run: `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`

Expected: PASS.

- [ ] **Step 2: Ejecutar busqueda estructural**

Run:

```bash
rg -n "demandaRaw|solicitudesPendientesRaw|cita\.findMany|solicitud\.findMany|groupBy" src/modules/some/actions/getSomePanel.action.ts
```

Expected:

- `cita.findMany` aparece solo para citas creadas de productividad.
- `solicitud.findMany` aparece solo para solicitudes ingresadas y gestiones de productividad.
- `groupBy` aparece para demanda clinica y solicitudes pendientes.

- [ ] **Step 3: Ejecutar TypeScript**

Run: `npx tsc --noEmit`

Expected: PASS sin errores.

- [ ] **Step 4: Ejecutar lint**

Run: `npm run lint`

Expected: PASS sin errores.

- [ ] **Step 5: Preparar EXPLAIN recomendado**

Documentar en el handoff que conviene correr `EXPLAIN` sobre dataset sintetico para comparar:

```sql
EXPLAIN SELECT profesional_id, prestacion_id, estado_cita, COUNT(*)
FROM citas
WHERE centro_id = ? AND estado_cita IN (?, ?, ?, ?) AND fecha_estimada_atencion < ?
GROUP BY profesional_id, prestacion_id, estado_cita;

EXPLAIN SELECT tipo_solicitud_id, motivo_id, COUNT(*)
FROM solicitudes
WHERE centro_id = ? AND accion = 'En espera de validación'
GROUP BY tipo_solicitud_id, motivo_id;
```

- [ ] **Step 6: Commit de ajustes si existieron**

Si la verificacion requirio cambios:

```bash
git add src/modules/some/actions/getSomePanel.action.ts src/modules/some/actions/getSomePanel.action.test.ts
git commit -m "fix(some): ajustar agregaciones panel some"
```

Si no hubo cambios, no crear commit vacio.

---

## Acceptance Checklist

- [ ] Demanda clinica deja de traer citas individuales pendientes.
- [ ] Solicitudes pendientes deja de traer solicitudes individuales en espera.
- [ ] El contrato `SomePanelData` no cambia.
- [ ] Los resultados procesados en Node quedan acotados por combinaciones de catalogo.
- [ ] Centro, temporalidad, fallbacks y ordenamiento conservan el comportamiento actual.
- [ ] `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`, `npx tsc --noEmit` y `npm run lint` pasan.

## Execution Handoff

Plan completo y listo para ejecucion con `subagent-driven-development` si se quiere mantener el flujo multiagente. Recomiendo subagent-driven porque hay dos tareas independientes y revisables: solicitudes pendientes y demanda clinica; un error en cualquiera afecta el panel operativo de SOME.

