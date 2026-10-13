# Selector de centro activo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un administrador (rol activo con `config.roles`) cambie su propio centro desde un selector en el pie del menú lateral, sin cerrar sesión.

**Architecture:** Una regla pura en `privilegios.ts` decide quién puede cambiar su centro. Una Server Action del módulo `configuracion` actualiza `funcionarios.centro_id` del usuario en sesión y lo audita. El layout `(app)` entrega la lista de centros solo a administradores, y `AppShell` muestra el selector en lugar del texto del centro. La sesión toma el nuevo centro con `router.refresh()`, porque el callback `jwt` lo relee desde la BD.

**Tech Stack:** Next.js 15 (App Router, Server Actions), React 19, Prisma 6 / MySQL, Zod, sonner, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-13-selector-centro-activo-design.md`

## Global Constraints

- Administrador = funcionario cuyo rol **activo** incluye `config.roles` (`getPermisosRol` ya devuelve un conjunto vacío para roles inactivos).
- La action toma el RUT **solo de la sesión**; nunca lo recibe del cliente.
- Configuración → Funcionarios no cambia: `validarEdicionFuncionario` y `UsuariosRolesView` mantienen el bloqueo de auto-edición.
- La action devuelve `ResultadoAccion<T>` (`src/shared/types/resultado.ts`). Si no hay sesión devuelve `{ ok: false, error: "No autenticado" }` (no lanza).
- Textos exactos:
  - Error de no administrador: `"Solo un administrador puede cambiar su centro"`
  - Error de centro inexistente: `"El centro seleccionado no existe"`
  - Toast de éxito: `` `Centro cambiado a ${nombre}` ``
  - Toast de excepción: `"No fue posible cambiar el centro"`
  - Placeholder sin centro: `"Sin centro"`
- Convenciones del repo: español, 4 espacios, imports categorizados (`// lib`, `// components`…), alias `@/`.

## Review Focus

1. **Doble cambio rápido:** con el selector deshabilitado mientras guarda no debe quedar un segundo envío en vuelo. Test en la Task 3: el `select` queda `disabled` hasta que la action resuelve.
2. **Rol que perdió `config.roles` con la sesión abierta:** el layout puede haber renderizado el selector, pero la action debe rechazar. Test en la Task 2 ("rechaza a quien no es administrador").
3. **Administrador sin centro asignado (`centro_id = null`):** el selector muestra "Sin centro" y permite elegir uno. Test en la Task 3.
4. **Excepción de red o BD en la action:** el selector vuelve al valor anterior y muestra el toast genérico, sin el detalle técnico. Test en la Task 3.
5. **`centroId` vacío o manipulado desde el cliente:** Zod lo rechaza como centro inexistente y no escribe. Test en la Task 2.

---

### Task 1: Regla `puedeCambiarCentroPropio` y helper `logBloqueo` compartido

**Files:**
- Modify: `src/modules/configuracion/utils/privilegios.ts`: agregar la regla.
- Create: `src/modules/configuracion/utils/auditoria.ts`: mover `logBloqueo` desde `mantenedores.action.ts:85-87` sin cambiar su firma ni su comportamiento.
- Modify: `src/modules/configuracion/actions/mantenedores.action.ts`: importar `logBloqueo` desde `../utils/auditoria`.
- Test: `src/modules/configuracion/utils/privilegios.test.ts`

**Interfaces:**
- Produces:
  - `puedeCambiarCentroPropio(permisos: ReadonlySet<Permiso>): boolean`
  - `logBloqueo(accion: "CREATE" | "UPDATE", user: { rut: string; nombre: string }, resourceId: string, regla: string, error: string): Promise<void>`

- [ ] **Step 1: Escribir el test que falla**

```ts
describe("puedeCambiarCentroPropio", () => {
    it("permite solo a roles con config.roles", () => {
        expect(puedeCambiarCentroPropio(new Set<Permiso>(["config.roles", "config.ver"]))).toBe(true);
        expect(puedeCambiarCentroPropio(new Set<Permiso>(["config.funcionarios", "config.ver"]))).toBe(false);
        expect(puedeCambiarCentroPropio(new Set<Permiso>())).toBe(false);
    });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/modules/configuracion/utils/privilegios.test.ts`
Expected: FAIL. `puedeCambiarCentroPropio` no está exportada.

- [ ] **Step 3: Implementar la regla y mover `logBloqueo`**

`puedeCambiarCentroPropio` es `permisos.has("config.roles")`. `auditoria.ts` exporta `logBloqueo` tal como está hoy y no lleva `"use server"`: es un helper de servidor que importan las actions.

- [ ] **Step 4: Correr los tests del módulo**

Run: `npx vitest run src/modules/configuracion`
Expected: PASS. Los tests existentes de `mantenedores.action` siguen en verde.

- [ ] **Step 5: Commit**

```bash
git add src/modules/configuracion/utils src/modules/configuracion/actions/mantenedores.action.ts
git commit -m "feat(configuracion): regla puedeCambiarCentroPropio y logBloqueo compartido"
```

### Task 2: Server Action `cambiarCentroActivo`

**Files:**
- Create: `src/modules/configuracion/actions/cambiarCentroActivo.action.ts`
- Test: `src/modules/configuracion/actions/cambiarCentroActivo.action.test.ts`

**Interfaces:**
- Consumes: `puedeCambiarCentroPropio`, `logBloqueo` (Task 1); `getSessionPermisos()` de `@/shared/lib/permisos`.
- Produces: `cambiarCentroActivo(centroId: string): Promise<ResultadoAccion<{ centro_id: string; centro_nombre: string | null }>>`

- [ ] **Step 1: Escribir los tests que fallan**

Mockear `@/shared/lib/prisma` (`centro.findUnique`, `funcionario.update`), `@/shared/lib/permisos` (`getSessionPermisos`), `@/shared/lib/logger` (`AuditLogger.logDataAccess`, `AuditLogger.logSecurity`). Sesión base: `user = { rut: "11-1", nombre: "Admin", centro_id: "501", … }`, `permisos = new Set(["config.roles"])`.

- `"rechaza a quien no es administrador sin escribir y audita el bloqueo"`: con permisos `new Set(["config.ver"])` devuelve `{ ok: false, error: "Solo un administrador puede cambiar su centro" }`. `funcionario.update` no se llama y `logSecurity` se llama con `success: false`.
- `"rechaza un centro inexistente o vacio"`: con `centro.findUnique → null` y `"999"`, devuelve `{ ok: false, error: "El centro seleccionado no existe" }`. Con `""` devuelve el mismo error. En ambos casos `update` no se llama.
- `"no escribe si el centro es el actual"`: con `"501"` devuelve `{ ok: true, data: { centro_id: "501", centro_nombre: <nombre> } }` y `update` no se llama.
- `"actualiza solo al funcionario en sesion y audita el cambio"`: con `"655"` (`findUnique → { id_centro: "655", nombre_centro: "CESFAM Reina Isabel II" }`), `update` se llama con `{ where: { rut: "11-1" }, data: { centro_id: "655" } }`. `logDataAccess` recibe `"UPDATE"`, `true`, `"funcionario:11-1"` y un `details` que contiene `"501 -> 655"`. El resultado es `{ ok: true, data: { centro_id: "655", centro_nombre: "CESFAM Reina Isabel II" } }`.
- `"sin sesion devuelve error"`: con `getSessionPermisos → null`, resuelve `{ ok: false, error: "No autenticado" }` (no lanza).

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/modules/configuracion/actions/cambiarCentroActivo.action.test.ts`
Expected: FAIL. El módulo no existe.

- [ ] **Step 3: Implementar la action**

Archivo con `"use server"`. Orden de las validaciones:

1. sesión;
2. regla, con `logBloqueo("UPDATE", user, "funcionario:<rut>", "regla=cambiarCentroActivo", <error>)`;
3. Zod `z.string().trim().min(1)` (si falla, error de centro inexistente);
4. `centro.findUnique`;
5. si el centro es el actual, devolver sin escribir;
6. `update`;
7. `logDataAccess` con `details: "centro_id <anterior|null> -> <nuevo> (selector centro activo)"`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/modules/configuracion`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/configuracion/actions/cambiarCentroActivo.action.ts src/modules/configuracion/actions/cambiarCentroActivo.action.test.ts
git commit -m "feat(configuracion): action cambiarCentroActivo para administradores"
```

### Task 3: `SelectorCentroActivo`, `AppShell` y layout

**Files:**
- Create: `src/shared/components/layout/selector-centro-activo.tsx`
- Test: `src/shared/components/layout/selector-centro-activo.test.tsx`
- Modify: `src/shared/components/layout/app-shell.tsx`: prop opcional `centros` en `AppShellProps` y `AppSidebarProps`; en el pie (`:125`) muestra el selector si viene `centros` y el texto actual si no.
- Modify: `src/shared/components/layout/app-shell.test.tsx`
- Modify: `src/app/(app)/layout.tsx`: si `puedeCambiarCentroPropio(contexto.permisos)`, hace `prisma.centro.findMany({ select: { id_centro: true, nombre_centro: true }, orderBy: { nombre_centro: "asc" } })` y lo pasa como `centros`.

**Interfaces:**
- Consumes: `cambiarCentroActivo` (Task 2); `puedeCambiarCentroPropio` (Task 1).
- Produces:
  - `interface CentroOpcion { id_centro: string; nombre_centro: string | null }`, exportada desde `selector-centro-activo.tsx`.
  - `SelectorCentroActivo({ centroId, centros }: { centroId: string | null; centros: CentroOpcion[] })`
  - `AppShellProps.centros?: CentroOpcion[]`

- [ ] **Step 1: Escribir los tests que fallan**

En `selector-centro-activo.test.tsx`, mockear `next/navigation` (`useRouter → { refresh }`), `sonner` y la action. El `select` se ubica por su label `"Centro activo"`.

- `"cambia el centro, avisa y refresca"`: al elegir `"655"` se llama `cambiarCentroActivo("655")`. Mientras está pendiente, el `select` está `disabled`. Al resolver `{ ok: true, data: { centro_id: "655", centro_nombre: "CESFAM Reina Isabel II" } }` se llama `toast.success("Centro cambiado a CESFAM Reina Isabel II")` y `refresh`.
- `"vuelve al centro anterior ante un error de negocio"`: con `{ ok: false, error: "Solo un administrador puede cambiar su centro" }` se llama `toast.error` con ese texto, el valor vuelve a `"501"` y no se refresca.
- `"vuelve al centro anterior ante una excepcion sin exponer el detalle"`: si la action rechaza con `Error("detalle sensible")`, se llama `toast.error("No fue posible cambiar el centro")` y el valor vuelve a `"501"`.
- `"sin centro asignado muestra el placeholder"`: con `centroId={null}` el `select` tiene valor `""` y la opción `"Sin centro"`.

En `app-shell.test.tsx`:

- `"con centros muestra el selector de centro activo"`: `renderShell` con `centros` hace aparecer el combobox `"Centro activo"` y no el texto suelto `"CESFAM Placeres"` como párrafo.
- `"sin centros mantiene el texto del centro"`: aparece el texto `"CESFAM Placeres"` y no hay combobox `"Centro activo"`.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/shared/components/layout`
Expected: FAIL. El componente no existe y `AppShell` no acepta `centros`.

- [ ] **Step 3: Implementar el componente, `AppShell` y el layout**

Componente cliente:

- Usa `Select` de `@/shared/components/ui/select` con `aria-label="Centro activo"`.
- Guarda el valor en estado local y el valor anterior para revertir.
- La opción `"Sin centro"` (`value=""`) se muestra solo si `centroId` es null.
- Va dentro del bloque del pie que ya oculta `group-data-[collapsible=icon]:hidden`.

El layout solo consulta los centros cuando la regla lo permite.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/shared/components/layout && npx tsc --noEmit`
Expected: PASS, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/layout src/app/(app)/layout.tsx
git commit -m "feat: selector de centro activo en el menu lateral para administradores"
```

### Task 4: Documentación y verificación de punta a punta

**Files:**
- Modify: `docs/rbac-permisos.md`, sección 6 (párrafo **Auto-edicion**).
- Modify: `AGENTS.md`, sección Permisos (RBAC), viñeta Anti-escalada.

- [ ] **Step 1: Actualizar la documentación**

`docs/rbac-permisos.md`, al final del párrafo Auto-edicion:

> Excepcion: un funcionario cuyo rol activo incluye `config.roles` puede cambiar su propio centro
> desde el selector "Centro activo" del menu lateral (`cambiarCentroActivo`, auditado). Sigue sin
> poder cambiar su rol ni su estado, y en Configuracion -> Funcionarios la regla no cambia.

`AGENTS.md`, en la viñeta Anti-escalada, después de "cambiar su propio rol/estado/centro": agregar " (salvo el centro de un administrador, desde el selector 'Centro activo')".

- [ ] **Step 2: Correr la suite, los tipos y el lint**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: todo en verde.

- [ ] **Step 3: Verificación manual en local**

Con `npm run dev`, entrar como administrador. Elegir otro centro en "Centro activo" y verificar:

- aparece el toast;
- el pie muestra el centro nuevo;
- Revisar solicitudes muestra datos del centro nuevo sin cerrar sesión.

Entrar como un rol sin `config.roles` y verificar que el pie muestra solo el texto del centro.

Si la sesión no toma el centro nuevo sin volver a entrar, detenerse y avisar: invalida la decisión "Sesión" de la spec.

- [ ] **Step 4: Commit**

```bash
git add docs/rbac-permisos.md AGENTS.md
git commit -m "docs: excepcion de centro propio para administradores en RBAC"
```
