# Tablas Sin Ancho Minimo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar los anchos minimos fijos de las 11 tablas del issue #23 y mantenerlas legibles a 1366px con sidebar expandido.

**Architecture:** Cada tarea trabaja una superficie independiente y migra sus tablas a los componentes shadcn existentes. La compactacion se hace agrupando datos relacionados dentro de celdas, sin crear una abstraccion global nueva.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind v3, shadcn/ui, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-06-tablas-ancho-minimo-design.md`

## Global Constraints

- No cambiar reglas de negocio, permisos, queries, seeds ni schema Prisma.
- Usar los componentes shadcn existentes en `src/shared/components/ui/table.tsx`, `tooltip.tsx` y `dropdown-menu.tsx`.
- En las 11 tablas del alcance no debe quedar `min-w-[...]`, `table-fixed` ni `w-[...]` en encabezados o celdas.
- Mantener scroll horizontal solo como fallback del `Table` de shadcn en pantallas angostas.
- Mantener idioma de UI en espanol y seguir imports categorizados por comentarios.
- No crear una abstraccion global nueva de tablas.

## Review Focus

- Textos largos de email, tipo, prestacion o rechazo: deben quedar acotados visualmente y disponibles completos por tooltip cuando afecten decision.
- Acciones de fila: editar/activar/visualizar/ver/llamar deben seguir disponibles despues de compactar columnas.
- Estados vacios: `EmptyRow` y mensajes sin registros deben conservar `colSpan` correcto tras cambiar columnas.
- Tablas jerarquicas de SOME: expandir/colapsar no debe mezclar conteos padre e hijo.
- Verificacion visual a 1366px: no basta quitar clases; hay que confirmar que no aparece scroll horizontal en estado normal.

---

### Task 1: Configuracion

**Files:**
- Modify: `src/modules/configuracion/components/UsuariosRolesView.tsx`
- Test: `src/modules/configuracion/components/UsuariosRolesView.test.tsx`

**Interfaces:**
- Consumes: `EstadoBadge`, `RowActions`, `nombreCentro`, `esRolSuperior`, `motivoRolSuperior`.
- Produces: tabla generica sin ancho minimo y tabla Funcionarios compacta de 5 columnas.

- [ ] **Step 1: Write failing tests for fixed-width debt**

Add tests in `UsuariosRolesView.test.tsx` that render the Funcionarios tab and assert:

```tsx
expect(container.querySelector(".min-w-\\[1180px\\]")).toBeNull();
expect(container.querySelector(".table-fixed")).toBeNull();
```

Also assert that a funcionario row shows nombre, RUT, email, rol, centro, programa, estado and both action buttons.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/modules/configuracion/components/UsuariosRolesView.test.tsx`
Expected: FAIL because the current table still has fixed-width classes.

- [ ] **Step 3: Migrate the local generic `Table` helper**

In `UsuariosRolesView.tsx`, import shadcn table primitives and update the local `Table({ headers, children })` helper to render `Table`, `TableHeader`, `TableRow`, `TableHead` and `TableBody` with the existing border wrapper. Do not use `min-w-[780px]`, `table-fixed` or column widths.

- [ ] **Step 4: Compact Funcionarios table**

Replace the Funcionarios raw table with shadcn primitives and the 5 columns from the spec: Funcionario, Rol / Centro, Programa, Estado, Acciones. Keep `RowActions` props and the existing anti-escalation logic unchanged.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npm test -- src/modules/configuracion/components/UsuariosRolesView.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/configuracion/components/UsuariosRolesView.tsx src/modules/configuracion/components/UsuariosRolesView.test.tsx
git commit -m "fix: compactar tablas de configuracion"
```

### Task 2: Dashboard

**Files:**
- Modify: `src/modules/dashboard/components/DashboardView.tsx`
- Test: create `src/modules/dashboard/components/DashboardView.test.tsx` if no component test exists, otherwise extend the existing dashboard component test.

**Interfaces:**
- Consumes: `DashboardFuncionarioData`, `CodigoId`, `Badge`, `Button`, `formatFecha`, `formatFechaHora`, modal state callbacks.
- Produces: four dashboard tables migrated to shadcn primitives with compact columns.

- [ ] **Step 1: Write failing tests for dashboard tables**

Create or extend component tests with sample `DashboardFuncionarioData` covering solicitudes, gestiones, llamadas and modal citas. Assert the rendered dashboard has no table element with class text containing `min-w-[`, `table-fixed` or `w-[`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/modules/dashboard/components/DashboardView.test.tsx`
Expected: FAIL because `DashboardView.tsx` still uses fixed-width tables.

- [ ] **Step 3: Add imports for shadcn table and tooltip primitives**

Import `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, plus tooltip primitives if needed for rejection text.

- [ ] **Step 4: Compact `DetalleSolicitudes`**

Render the 4 columns from the spec: Solicitud, Paciente, Tipo, Estado. Keep empty row behavior with `colSpan={4}`.

- [ ] **Step 5: Compact `DetalleGestiones`**

Render Solicitud, Paciente / Accion, Citas, Rechazo. Keep the "Visualizar" button behavior and modal callback. Clamp long rejection text and expose full text through tooltip.

- [ ] **Step 6: Compact `DetalleLlamadas`**

Render Llamada, Paciente / Cita, Prestacion, Respuesta, Detalle. Keep the "Ver" button behavior and modal callback.

- [ ] **Step 7: Compact `CitasGestionadasModal`**

Render Cita, Prestacion, Estamento / Prioridad, Estado. Keep `Badge` for state and empty row `colSpan={4}`.

- [ ] **Step 8: Run the focused test and verify it passes**

Run: `npm test -- src/modules/dashboard/components/DashboardView.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/dashboard/components/DashboardView.tsx src/modules/dashboard/components/DashboardView.test.tsx
git commit -m "fix: compactar tablas del dashboard"
```

### Task 3: SOME

**Files:**
- Modify: `src/modules/some/components/SomeView.tsx`
- Test: create or extend `src/modules/some/components/SomeView.test.tsx`

**Interfaces:**
- Consumes: `SomePanelData`, `ESTADOS_PENDIENTES`, `TEMPORALIDAD`, `NumberCell`, expand/collapse state.
- Produces: three SOME tables without fixed widths; Demanda Clinica grouped by temporalidad and estados.

- [ ] **Step 1: Write failing tests for SOME tables**

Use sample `SomePanelData` with one funcionario, one demanda clinica parent with one child, and one solicitudes pendientes group. Assert no table has `min-w-[`, `table-fixed` or `w-[` in class names. Assert Demanda Clinica shows Atrasados, Proximos, Futuros and each `ESTADOS_PENDIENTES` label with its count.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/modules/some/components/SomeView.test.tsx`
Expected: FAIL because fixed-width table classes remain.

- [ ] **Step 3: Add imports for shadcn table primitives**

Import `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/shared/components/ui/table`.

- [ ] **Step 4: Migrate Productividad table**

Keep the current metric columns. Remove fixed-width classes and render through shadcn primitives with the existing `NumberCell`.

- [ ] **Step 5: Compact Demanda Clinica**

Render columns Profesional / Prestacion, Total, Temporalidad, Estados. In Temporalidad, show Atrasados, Proximos and Futuros as a vertical list. In Estados, map `ESTADOS_PENDIENTES` to a vertical list of label and count. Preserve expand/collapse behavior.

- [ ] **Step 6: Migrate Solicitudes Pendientes**

Render the existing 2 columns through shadcn primitives, without fixed-width classes. Keep expand/collapse behavior and `EmptyRow colSpan={2}`.

- [ ] **Step 7: Run the focused test and verify it passes**

Run: `npm test -- src/modules/some/components/SomeView.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/some/components/SomeView.tsx src/modules/some/components/SomeView.test.tsx
git commit -m "fix: compactar tablas de some"
```

### Task 4: Comunicador

**Files:**
- Modify: `src/modules/comunicador/components/CitasPendientesTabla.tsx`
- Test: create or extend `src/modules/comunicador/components/CitasPendientesTabla.test.tsx`

**Interfaces:**
- Consumes: `CitaFila`, `CodigoId`, `Badge`, pagination props, `onGestionar`, optional `renderAcciones`.
- Produces: Citas pendientes compacta de 6 columnas.

- [ ] **Step 1: Write failing tests for CitasPendientesTabla**

Render a row with prioritizacion, disponibilidad, profesion, prestacion, fecha, estado and `renderAcciones`. Assert no table class contains `min-w-[`. Assert "Llamar" calls `onGestionar` and custom actions still render.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/modules/comunicador/components/CitasPendientesTabla.test.tsx`
Expected: FAIL because `min-w-[900px]` remains.

- [ ] **Step 3: Add imports for shadcn table primitives**

Import table primitives and replace the raw table structure.

- [ ] **Step 4: Compact columns**

Render Cita, Paciente, Prestacion, Priorizacion / Disponibilidad, Estado, Acciones. Preserve row highlight for `tiene_llamada_hoy`, pagination controls and empty state with `colSpan={6}`.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npm test -- src/modules/comunicador/components/CitasPendientesTabla.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/comunicador/components/CitasPendientesTabla.tsx src/modules/comunicador/components/CitasPendientesTabla.test.tsx
git commit -m "fix: compactar tabla de citas pendientes"
```

### Task 5: Solicitudes Modal Secundario

**Files:**
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Test: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `resumen.citas`, `formatFechaResumen`, existing dialog behavior.
- Produces: modal resumen con tabla secundaria sin ancho minimo.

- [ ] **Step 1: Write failing test for resumen modal table**

Extend `RevisarSolicitudesView.test.tsx` to open the saved gestion summary path that renders citas. Assert the modal table has no class containing `min-w-[640px]` and that profesional, prestacion and fecha estimada are visible.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`
Expected: FAIL because the modal still has `min-w-[640px]`.

- [ ] **Step 3: Add shadcn table imports if missing**

Use the existing table primitives if already imported for the main view; otherwise import them from `@/shared/components/ui/table`.

- [ ] **Step 4: Compact modal citas table**

Render Cita and Prestacion columns through shadcn table primitives. In Cita, show profesional and fecha estimada as secondary text. Remove fixed widths.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/solicitudes/components/RevisarSolicitudesView.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
git commit -m "fix: compactar tabla de resumen de citas"
```

### Task 6: Whole-Branch Verification

**Files:**
- Inspect: all files modified by Tasks 1-5

**Interfaces:**
- Consumes: completed tasks.
- Produces: verified branch ready for review.

- [ ] **Step 1: Static search for fixed table debt in scoped files**

Run:

```bash
rg -n "min-w-\\[|table-fixed|w-\\[" src/modules/configuracion/components/UsuariosRolesView.tsx src/modules/dashboard/components/DashboardView.tsx src/modules/some/components/SomeView.tsx src/modules/comunicador/components/CitasPendientesTabla.tsx src/modules/solicitudes/components/RevisarSolicitudesView.tsx
```

Expected: no matches related to the 11 tables in scope. If matches remain for unrelated layout elements, document why they are not table-width debt.

- [ ] **Step 2: Run automated checks**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: all pass.

- [ ] **Step 3: Run visual check at 1366px**

Start the app, open the scoped pages, and inspect at 1366px with sidebar expanded. Confirm no scoped table shows horizontal scroll in normal state.

- [ ] **Step 4: Run mobile fallback check**

Inspect at 390px. Confirm content remains usable and any horizontal scroll is only fallback behavior, not a clipped action menu.

- [ ] **Step 5: Commit verification notes if needed**

If visual verification requires documentation for an intentional remaining scroll case, add the note to the spec or issue handoff and commit it.

```bash
git add docs/superpowers/specs/2026-10-06-tablas-ancho-minimo-design.md docs/superpowers/plans/2026-10-06-tablas-ancho-minimo.md
git commit -m "docs: planificar tablas sin ancho minimo"
```
