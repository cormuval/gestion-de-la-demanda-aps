# SOME multi-centro por permiso — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El alcance multi-centro del panel SOME se decide por el permiso `some.todos_centros` (otorgado al rol «Administrador») en vez de comparar `rol.nombre === "Administrador"`, y la reserva del nombre se retira.

**Architecture:** Permiso nuevo en el catálogo de código (`src/config/permisos.ts`), otorgado por migración de datos + seed; `getSomePanel.action.ts` lee `getPermisosRol` (memoizada por request) y conserva `requirePermiso("some.ver")` como guard. Se retira la salvaguarda temporal `NOMBRE_ROL_RESERVADO` en el mismo release.

**Tech Stack:** Next.js 15 (Server Actions), Prisma + MySQL (migración versionada de datos), Vitest + Testing Library, TDD.

**Spec:** `docs/superpowers/specs/2026-11-10-some-todos-centros-permiso-design.md`

## Global Constraints

- Todo el flujo RBAC sigue `docs/rbac-permisos.md` §7 (checklist) y §10 (anti-patrones). La clave nueva es `some.todos_centros` (formato `/^[a-z]+\.[a-z_]+$/`).
- `requirePermiso("some.ver")` sigue siendo la primera línea del guard de `getSomePanel`; el inventario de `src/modules/permisos-por-action.test.ts` NO cambia (sigue siendo `some.ver`).
- La migración es `INSERT IGNORE` idempotente, aplicada por `prisma migrate deploy` en el mismo deploy que trae el código. Instalaciones con `db:push` aplican el SQL a mano (anotarlo en el PR).
- El otorgamiento va **solo al rol cuyo `nombre_rol` = 'Administrador'** (decisión del spec).
- Idioma español, indentación 4 espacios, tipos explícitos; las Server Actions no lanzan errores de negocio (devuelven `ResultadoAccion`).
- Sin `console.log` en producción.

## Review Focus

1. **Admin sin migración aplicada** (locales con `db:push`): después del deploy, un administrador causa panel limitado a su centro, con mensaje normal de negocio, no crash ni error técnico. → Task 2, paso "usuario sin el permiso".
2. **Rol renombrado**: si un rol nuevo se crea y se llama «Administrador», ya NO obtiene alcance multi-centro (el alcance viene del permiso, no del nombre). → Task 2, test del alcance.
3. **Anti-escalada intacta**: nadie puede marcar `some.todos_centros` a su rol si no lo tiene (la regla "no otorgar lo que no tienes" de `validarPermisosRol`/`guardarPermisosRol`). -> Task 3, test que deja esa salvaguarda en verde.
4. **UI del selector de centro**: `SomeView` deshabilita el selector cuando el usuario no abarca todos los centros; tras el renombre de la propiedad la UI debe comportarse igual (disabled sin permiso, habilitado con él). → Task 2, test de `SomeView.test.tsx`.

---

### Task 1: Declarar y otorgar `some.todos_centros` (catálogo + seed + migración)

> Prerrequisito: crear la rama `feat/some-todos-centros-por-permiso` desde `main` actualizado antes del primer commit.

**Files:**
- Modify: `src/config/permisos.ts` (agregar clave junto a `some.ver`)
- Modify: `prisma/seed.ts:15` (array de `Administrador`)
- Test: `src/config/permisos.test.ts`
- Create: `prisma/migrations/20261110170000_permiso_some_todos_centros/migration.sql`

**Interfaces:**
- Produces: `PERMISOS` incluye `"some.todos_centros"` (type `Permiso`), el seed de `Administrador` la contiene, y la migración la inserta. Task 2 consume el hecho de que `permisos.has("some.todos_centros")` es representable.

- [ ] **Step 1: Escribir el test que falla** — en `src/config/permisos.test.ts`, un caso que asegure la existencia y forma del permiso:

```ts
it("declara some.todos_centros con etiqueta y modulo SOME", () => {
    expect(PERMISOS["some.todos_centros"]).toEqual({ modulo: "SOME", etiqueta: "Ver todos los centros en SOME" });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/config/permisos.test.ts`
Expected: FAIL (la clave no existe en `PERMISOS`)

- [ ] **Step 3: Declarar la clave en `src/config/permisos.ts`** junto a `"some.ver"`:

```ts
"some.todos_centros": { modulo: "SOME", etiqueta: "Ver todos los centros en SOME" },
```

Los tests estructurales del catálogo (formato de clave, agrupación) deben seguir verdes sin cambios extra.

- [ ] **Step 4: Agregar la clave al seed** — en `prisma/seed.ts:15`, al array de `Administrador`, agregar `"some.todos_centros"` (después de `"some.ver"`), porque el seed solo siembra instalaciones nuevas (RBAC §5).

- [ ] **Step 5: Migración de datos versionada** — crear `prisma/migrations/20261110170000_permiso_some_todos_centros/migration.sql`:

```sql
-- Otorga some.todos_centros al rol «Administrador» (issue #21).
-- El nombre sigue siendo único en este punto (aún reservado); el permiso es lo que otorga.
INSERT IGNORE INTO `roles_permisos` (`rol_id`, `permiso`) SELECT `id_rol`, 'some.todos_centros' FROM `roles` WHERE `nombre_rol` = 'Administrador';
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `npx vitest run src/config/permisos.test.ts`
Expected: PASS (y los demás tests del catálogo intactos)

- [ ] **Step 7: Commit**

```bash
git add src/config/permisos.ts src/config/permisos.test.ts prisma/seed.ts prisma/migrations/20261110170000_permiso_some_todos_centros/
git commit -m "feat(permisos): declarar y otorgar some.todos_centros al rol Administrador"
```

---

### Task 2: El panel SOME decide el alcance por el permiso

**Files:**
- Modify: `src/modules/some/actions/getSomePanel.action.ts` (líneas 75, 205-224, 405)
- Modify: `src/modules/some/components/SomeView.tsx` (líneas 34, 164)
- Test: `src/modules/some/actions/getSomePanel.action.test.ts` (mock de `@/shared/lib/permisos`, fixture admin, aserciones `esAdministrador`)
- Test: `src/modules/some/components/SomeView.test.tsx` (fixtures `esAdministrador`)

**Interfaces:**
- Consumes: `getPermisosRol(rolId: number): Promise<Set<Permiso>>` desde `@/shared/lib/permisos` (memoizada con `cache()`; llamarla después de `requirePermiso` no agrega consultas).
- Produces: `SomePanelData.alcanzaTodosLosCentros: boolean` (renombra el campo público `esAdministrador`, que se usaba solo en `SomeView.tsx:164` para deshabilitar el selector de centro).

- [ ] **Step 1: Escribir los tests que fallan** en `getSomePanel.action.test.ts`:

1. Ampliar el mock de permisos (línea 16):

```ts
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn(), getPermisosRol: vi.fn() }));
```

y en el `beforeEach` (línea 47 aprox.), default SIN el permiso:

```ts
(getPermisosRol as any).mockResolvedValue(new Set());
```

2. Asegurar el alcance (`alcanzaTodosLosCentros`) y el centro:

- Test nuevo «el alcance multi-centro viene del permiso, no del nombre»: con `requirePermiso` devolviendo `funcionarioAdmin` (rol aún llamado «Administrador») pero `getPermisosRol` devolviendo un `Set()` vacío, la consulta de centros va con `where: { id_centro: "501" }` y `result.alcanzaTodosLosCentros` es `false`. Este caso fija los review-focus 1 y 2.
- Test nuevo «usuario con some.todos_centros lista todos los centros»: `getPermisosRol` → `new Set(["some.todos_centros"])`, con `prisma.centro.findMany` devolviendo 2 centros: `result.alcanzaTodosLosCentros` es `true` y el `findMany` de centros se llamó sin `where`.

3. Renombrar en los tests existentes: en «para administrador permite filtrar por centro_id» (líneas 106-134), `esAdministrador` → `alcanzaTodosLosCentros` y agregar el override `(getPermisosRol as any).mockResolvedValueOnce(new Set(["some.todos_centros"]))` (el test de rol SOME de la línea 98 queda sin override: rol limitado por definición).

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/modules/some/actions/getSomePanel.action.test.ts`
Expected: FAIL por comportamiento: no existe `alcanzaTodosLosCentros` (la acción aún calcula el alcance con el nombre del rol y devuelve `esAdministrador`).

- [ ] **Step 3: Implementar en `getSomePanel.action.ts`** — reemplazar la línea 207 y el uso (líneas 75, 214, 220, 405):

```ts
const user = await requirePermiso("some.ver");
const permisos = await getPermisosRol(user.rol.id);
const alcanzaTodosLosCentros = permisos.has("some.todos_centros");
```

- type `SomePanelData` (`:75`): `esAdministrador: boolean` → `alcanzaTodosLosCentros: boolean`
- retornos (`:405`): `esAdministrador,` → `alcanzaTodosLosCentros,`
- las ramas 214-224 usan `alcanzaTodosLosCentros` en vez de `esAdministrador` (misma lógica).

Importar `getPermisosRol` desde `@/shared/lib/permisos` (ya exportado).

- [ ] **Step 4: Alinear `SomeView`** — `SomeView.tsx:34` (default de panelData) y `SomeView.tsx:164` (`disabled={!panelData.alcanzaTodosLosCentros}`), más los fixtures `esAdministrador: true` de `SomeView.test.tsx:18` y `:93` → `alcanzaTodosLosCentros: true`. El compilador guía el renombre (`npx tsc --noEmit` sin errores en el módulo some).

- [ ] **Step 5: Correr los tests del módulo some y verificar que pasan**

Run: `npx vitest run src/modules/some`
Expected: PASS (incluye «exige permiso some.ver» y «rechaza filtros con una forma invalida»: sin cambios)

- [ ] **Step 6: Inventario de actions sin cambios** — `npx vitest run src/modules/permisos-por-action.test.ts` debe pasar igual (la action sigue siendo `some.ver`).

- [ ] **Step 7: Commit**

```bash
git add src/modules/some
git commit -m "feat(some): alcance multi-centro por permiso some.todos_centros"
```

---

### Task 3: Retirar la reserva del nombre «Administrador»

**Files:**
- Modify: `src/modules/configuracion/utils/privilegios.ts` (líneas 4, 11, 74-76, 123-128)
- Modify: `src/modules/configuracion/components/UsuariosRolesView.tsx` (líneas 31, 146, 714)
- Modify: `docs/rbac-permisos.md` (§6 «Nombre reservado», §10 primer anti-patrón)
- Test: `src/modules/configuracion/utils/privilegios.test.ts` (importes y líneas 33-36, 91-94)
- Test: `src/modules/configuracion/actions/mantenedores.action.test.ts` (líneas 634-660)
- Test: `src/modules/configuracion/components/UsuariosRolesView.test.tsx` (líneas 245-253)

**Interfaces:**
- Consumes: nada de Task 2.
- Produces: `validarEdicionRol` valida solo por auto-edición/subconjunto/último admin; `MENSAJES_PRIVILEGIOS` sin `nombreReservado`. Ningún código exporta ya `NOMBRE_ROL_RESERVADO`/`esNombreReservado`.

- [ ] **Step 1: Escribir el test que cambia el comportamiento** en `privilegios.test.ts`:

1. Eliminar el importe `esNombreReservado` (línea 7) y los tests que prueban la reserva: «detecta el nombre reservado con espacios y mayusculas» (líneas 33-36) y «R1 bloquea crear, renombrar a, o renombrar desde el nombre reservado» (líneas 91-94).
2. Test nuevo documentando la decisión:

```ts
it("el nombre «Administrador» ya no esta reservado (el alcance viene del permiso)", () => {
    expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: null, data: { nombre_rol: "Administrador", estado: "Activo" }, quedaAdmin: true })).toBeNull();
});
```

3. La salvaguarda anti-escalada no se toca: dejar en verde el test existente que cubre `validarPermisosRol` con permisos faltantes («no puedes otorgar permisos que tu rol no tiene»). No se modifica su lógica.

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/modules/configuracion/utils/privilegios.test.ts`
Expected: FAIL — `validarEdicionRol` sigue devolviendo `nombreReservado`.

- [ ] **Step 3: Retirar la reserva en `privilegios.ts`**:

1. Borrar `NOMBRE_ROL_RESERVADO` (línea 4), `nombreReservado` de `MENSAJES_PRIVILEGIOS` (línea 11) y la función `esNombreReservado` (líneas 74-76).
2. En `validarEdicionRol` (líneas 123-128) borrar el bloque `nombreActualReservado`/`nombreNuevoReservado` con su `return MENSAJES_PRIVILEGIOS.nombreReservado`.

- [ ] **Step 4: Retirar la UI** — en `UsuariosRolesView.tsx`:
1. Quitar `esNombreReservado` del importe (línea 31).
2. Borrar `editandoRolReservado` (línea 146) y el `disabled={editandoRolReservado}` (línea 714: el input de nombre queda siempre editable; las salvaguardas de server siguen siendo el enforcement).

- [ ] **Step 5: Alinear los tests restantes al nuevo comportamiento**

1. `mantenedores.action.test.ts:634-660`: los dos casos que esperaban `El nombre «Administrador» esta reservado` se reescriben en un positivo: crear un rol nuevo con ese nombre devuelve `ok: true` con los mismos mocks de guard (ya sin mensaje de reserva); el caso de «renombrar el propio rol» cae en la regla de auto-edición (`autoRol`) que corresponda según el fixture de `rolActual`/`actorRolId` ya presente en el archivo.
2. `UsuariosRolesView.test.tsx:245-253`: el test simula un rechazo de `guardarRol`; reemplazar el mensaje por uno genérico (p. ej. `No tienes permiso para esta operacion`) manteniendo la verificación de que el toast muestra el error.

- [ ] **Step 6: Actualizar `docs/rbac-permisos.md`**:

1. §6 «Nombre reservado»: reemplazar el párrafo por la nota histórica «La reserva se retiro cuando el alcance multi-centro de SOME paso al permiso `some.todos_centros` (#21); hoy ninguna ruta decide autorización por nombre de rol.»
2. §10 anti-patrones «Chequear por nombre de rol»: quitar la referencia a la mitigación vigente y a #21; la regla queda como patrón prohibido con el ejemplo del propio problema.

- [ ] **Step 7: Correr los tests completos y verificar que pasan**

Run: `npm test`
Expected: PASS completo (con los tests nuevos de los steps 1-5)

- [ ] **Step 8: Commit**

```bash
git add src/modules/configuracion docs/rbac-permisos.md
git commit -m "refactor(rbac): retiro la reserva del nombre Administrador tras el permiso some.todos_centros"
```

---

### Task 4: Verificación final y PR

**Files:**
- sin archivos nuevos; rama y PR.

**Interfaces:**
- Consumes: Tasks 1-3 completos.

- [ ] **Step 1: Suite completa en verde**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS (los tres, sin warnings nuevos)

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Verificación del criterio de aceptación del issue** — grep de salvaguarda:

Run: `grep -rn 'rol\.nombre === \|rol\.nombre===' src --include='*.ts' --include='*.tsx' | grep -v test`
Expected: sin resultados que decidan autorización (el `rol.nombre` restante es presentación/auditoría: `app-shell.tsx:134`, `getDashboardFuncionario.action.ts:238`)

- [ ] **Step 4: Commit del estado de rama, push y PR** — rama `feat/some-todos-centros-por-permiso` creada desde `main` actualizado al **iniciar** el plan (todos los commits de Tasks 1-3 van en ella). PR hacia `main` con cuerpo: cambios por archivo, instrucción de despliegue (migración versionada + SQL manual para entornos con `db:push`), verificación corrida y `Closes #21`.

```bash
git push -u origin feat/some-todos-centros-por-permiso
gh pr create --repo cormuval/gestion-de-la-demanda-aps --base main --head feat/some-todos-centros-por-permiso ...
```

El PR menciona explícitamente: los admin de producción conservan el alcance porque la migración corre en el mismo deploy (criterio de aceptación #2 del issue).
