# Revisar Solicitudes Dialog Pointer Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evitar que los menus desplegables de acciones dejen el `body` bloqueado con `pointer-events: none` al abrir y cerrar dialogs.

**Architecture:** El arreglo vive en el wrapper compartido de `DropdownMenu`, que pasa a usar `modal={false}` por defecto. Una prueba de regresion con `DropdownMenu` + `Dialog` fija el contrato compartido, y Playwright valida el flujo real en `/solicitudes/revisar`.

**Tech Stack:** Next.js 15 + React 19 + TypeScript strict, Radix UI, shadcn/ui, Vitest + Testing Library, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-10-05-revisar-solicitudes-dialog-pointer-events-design.md`

## Global Constraints

- Rama de trabajo: `Bloqueo-Post-Modal`.
- Idioma espanol para UI, comentarios, commits y documentacion del proyecto.
- No cambiar logica de solicitudes, citas, RBAC, schema de base de datos ni seed.
- No agregar limpieza manual global de `document.body.style.pointerEvents`.
- `.playwright-cli/` queda como artefacto local no versionado.
- Verificacion final obligatoria: `npm test`, `npx tsc --noEmit`, `npm run lint`.

## Review Focus

- Menus existentes: siguen abriendo/cerrando y aceptan clic fuera/Esc despues de `modal={false}`.
- Dialogs abiertos desde menus: al cerrarse no dejan `body.style.pointerEvents = "none"`.
- Escape hatch: `DropdownMenu modal={true}` sigue pasando la prop a Radix.
- Flujo `/solicitudes/revisar`: despues de cerrar "Solicitudes y citas en curso", otro `Gestionar` abre.
- Regresiones visuales: el menu `Gestionar` sigue portaleado y no se recorta dentro de la tabla.

---

### Task 1: Prueba de regresion compartida

**Files:**
- Create: `src/shared/components/ui/dropdown-menu.test.tsx`

**Interfaces:**
- Consumes: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`.
- Consumes: `Dialog`, `DialogContent`, `DialogTitle`.
- Produces: test que falla si un dropdown abierto deja `document.body.style.pointerEvents` en `none`.

- [ ] **Step 1: Escribir la prueba fallida**

Crear `src/shared/components/ui/dropdown-menu.test.tsx` con un fixture que renderiza un `DropdownMenu`
abierto y un `Dialog` controlado. El test debe:

- encontrar la opcion `Otras solicitudes y citas`;
- esperar que `document.body.style.pointerEvents !== "none"`;
- abrir y cerrar el dialog;
- volver a esperar que `document.body.style.pointerEvents !== "none"`;
- comprobar que el trigger `Gestionar` mantiene `pointer-events: auto`.

- [ ] **Step 2: Verificar RED**

Run: `npm test -- src/shared/components/ui/dropdown-menu.test.tsx`

Expected: FAIL con `expected 'none' not to be 'none'`.

### Task 2: Wrapper `DropdownMenu` no modal por defecto

**Files:**
- Modify: `src/shared/components/ui/dropdown-menu.tsx`
- Test: `src/shared/components/ui/dropdown-menu.test.tsx`

**Interfaces:**
- Produces: `DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>)`.
- Default: `modal = false`.
- Override: `modal={true}` se conserva.

- [ ] **Step 1: Implementar wrapper**

Reemplazar el alias:

```tsx
const DropdownMenu = DropdownMenuPrimitive.Root;
```

por:

```tsx
function DropdownMenu({
    modal = false,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
    return <DropdownMenuPrimitive.Root modal={modal} {...props} />;
}
```

- [ ] **Step 2: Verificar GREEN**

Run: `npm test -- src/shared/components/ui/dropdown-menu.test.tsx`

Expected: PASS.

### Task 3: Documentacion SDD

**Files:**
- Create: `docs/superpowers/specs/2026-10-05-revisar-solicitudes-dialog-pointer-events-design.md`
- Create: `docs/superpowers/plans/2026-10-05-revisar-solicitudes-dialog-pointer-events.md`

**Interfaces:**
- Produces: spec y plan versionados para el bug reproducido con Playwright.

- [ ] **Step 1: Escribir spec**

Documentar problema, evidencia Playwright, objetivo, decisiones, diseno, fuera de alcance y criterios de
aceptacion.

- [ ] **Step 2: Escribir plan**

Documentar tareas, interfaces, comandos RED/GREEN, verificacion Playwright y cierre.

### Task 4: Verificacion de integracion

**Files:**
- Modify only files from previous tasks if verification finds issues.

**Interfaces:**
- Produces: evidencia automatizada y manual de que el bloqueo post-modal queda corregido.

- [ ] **Step 1: Ejecutar tests relevantes**

Run: `npm test -- src/shared/components/ui/dropdown-menu.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

Expected: PASS.

- [ ] **Step 2: Ejecutar suite y checks**

Run: `npm test`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: sin errores.

Run: `npm run lint`

Expected: sin errores.

- [ ] **Step 3: Verificar con Playwright**

Con la app levantada:

1. Abrir `/solicitudes/revisar`.
2. Abrir `Gestionar -> Otras solicitudes y citas`.
3. Cerrar el dialog.
4. Evaluar `document.body.style.pointerEvents`.
5. Abrir otro `Gestionar`.

Expected: `pointerEvents` no es `none`, no quedan dialogs abiertos y el menu abre nuevamente.

### Task 5: Commit final

**Files:**
- Add all files modified by Tasks 1-4.

**Interfaces:**
- Produces: commit listo en rama `Bloqueo-Post-Modal`.

- [ ] **Step 1: Revisar estado**

Run: `git status --short`

Expected: solo aparecen los docs SDD, `dropdown-menu.tsx`, `dropdown-menu.test.tsx` y `.playwright-cli/`
como artefacto no versionado.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-10-05-revisar-solicitudes-dialog-pointer-events-design.md docs/superpowers/plans/2026-10-05-revisar-solicitudes-dialog-pointer-events.md src/shared/components/ui/dropdown-menu.tsx src/shared/components/ui/dropdown-menu.test.tsx
git commit -m "fix: desbloquear pagina tras cerrar modal de solicitudes"
```
