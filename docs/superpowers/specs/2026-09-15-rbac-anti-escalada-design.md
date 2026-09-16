# RBAC: evitar la escalada de privilegios en el mantenedor de roles y funcionarios

Fecha: 2026-09-15
Rama: `feat/mejoras-minuta-2026-09-14`
Origen: minuta del 14-09-2026, punto 6 ("Restricciones de permisos"). Prioridad: critica.
Relacionados: `docs/superpowers/specs/2026-07-23-rbac-permisos-design.md`, `docs/rbac-permisos.md`, issue #21.

## Problema

El RBAC por permisos (spec 2026-07-23) resolvio **quien puede entrar** a cada accion, pero no **que
puede otorgar** quien tiene acceso al mantenedor. Hoy las tres actions de mutacion de
`src/modules/configuracion/actions/mantenedores.action.ts` validan solo el permiso de entrada y la
existencia de los datos:

| Action | Guard | Que no valida |
| --- | --- | --- |
| `guardarFuncionario` (:201) | `config.funcionarios` | Acepta cualquier `rol_id` (incluido Administrador) y permite editarse a si mismo (rol, estado, centro) |
| `guardarRol` (:143) | `config.roles` | Permite renombrar o desactivar cualquier rol, incluidos Administrador y el propio |
| `guardarPermisosRol` (:232) | `config.roles` | Acepta cualquier permiso del catalogo para cualquier rol, incluido el propio |

Escenarios de escalada verificados en el codigo:

1. **Un SOME se hace Administrador.** El rol SOME tiene `config.funcionarios` (`prisma/seed.ts:18`).
   Edita su propio registro con `rol_id` del Administrador. El cambio es inmediato: `jwt` relee el
   rol desde BD en cada `auth()` (`src/auth.ts:28-51`).
2. **Un SOME asigna Administrador a un complice.** Mismo camino, sobre otro funcionario.
3. **Con `config.roles`, alguien se otorga todo.** `guardarPermisosRol` sobre su propio rol con las
   12 claves, o crea un rol nuevo con todas.
4. **Renombrar para ganar alcance.** `getSomePanel.action.ts:183` da acceso a todos los centros si
   `user.rol.nombre === "Administrador"`. Renombrar un rol a "Administrador" (con el nombre libre)
   amplia el alcance de quien lo tenga.
5. **Sabotaje.** Quitar permisos al rol Administrador, desactivarlo o desactivar a sus funcionarios.

Salvaguarda existente: `guardarPermisosRol` impide quitar `config.roles` al rol propio
(`mantenedores.action.ts:238-240`). No protege al ultimo administrador (reconocido en
`docs/rbac-permisos.md` §6).

Problema adicional: todas estas actions **lanzan** `Error` para errores de negocio. En produccion
Next.js omite el mensaje de los errores lanzados en Server Actions y el cliente muestra el texto
generico "An error occurred in the Server Components render...". Un bloqueo de seguridad con
`throw` se veria como una falla del sistema.

## Objetivo

Que ningun funcionario pueda, desde el mantenedor, obtener u otorgar mas privilegios de los que su
propio rol ya tiene, ni dejar el sistema sin administradores, con mensajes claros para el usuario.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Regla base | "No otorgas lo que no tienes": subconjunto de permisos | Generica para cualquier rol; no depende del nombre "Administrador" ni de un flag nuevo |
| Auto-edicion | Bloqueada para rol, estado y centro propios | Cambiar el centro propio tambien amplia el alcance de datos |
| Superiores | No se edita un funcionario o rol con permisos que el actor no tiene | Evita sabotaje hacia arriba |
| Ultimo administrador | Siempre debe quedar al menos uno | Evita el bloqueo total del mantenedor |
| Alcance por nombre de rol (`getSomePanel`) | Mitigacion: nombre "Administrador" reservado. Solucion definitiva en #21 | Cierra el vector sin crear un permiso ni migrar datos en S1 |
| Ubicacion de la logica | Modulo de reglas puras, reutilizado por actions y UI | Testeable sin Prisma; la UI anticipa los bloqueos |
| Errores de negocio | Tipo compartido `ResultadoAccion<T>` en vez de `throw` | Mensajes visibles en produccion; S2 reutiliza el tipo |

## Diseno

### 1. Definiciones

- **P(rol):** conjunto de permisos del rol segun `roles_permisos`, filtrado con `esPermiso`. Un rol
  **inactivo se evalua igual por sus permisos** (puede reactivarse).
- **Actor:** funcionario en sesion. P(actor) = `getPermisosRol(user.rol.id)` (ya cacheado por request;
  si el rol del actor esta inactivo es vacio, pero entonces tampoco pasa `requirePermiso`).
- **Administrador (para la regla del ultimo admin):** funcionario con `estado` activo, cuyo rol esta
  activo (`esEstadoActivo`) e incluye `config.roles`.
- **Nombre reservado:** `"Administrador"`, comparado tras `trim()` y sin distinguir mayusculas.
- **Identidad del actor:** `data.rut` (ya normalizado por `funcionarioConfigSchema`) igual a
  `user.rut`; para roles, `id_rol === user.rol.id`.

### 2. Reglas

#### `guardarFuncionario`

| # | Regla | Mensaje |
| --- | --- | --- |
| F1 | P(rol destino) ⊆ P(actor) | `No puedes asignar el rol «{nombre}»: incluye permisos que tu rol no tiene` |
| F2 | Si el funcionario existe: P(su rol actual) ⊆ P(actor) | `No puedes editar a un funcionario con mas privilegios que tu` |
| F3 | Si es el propio actor: `rol_id`, `estado` y `centro_id` no cambian. Nombre, email y programa si | `No puedes cambiar tu propio rol, estado o centro` |
| F4 | Si el funcionario es administrador y tras el cambio deja de serlo, debe existir otro administrador | `Debe quedar al menos un administrador activo` |

#### `guardarRol`

| # | Regla | Mensaje |
| --- | --- | --- |
| R1 | No se crea un rol con nombre reservado; no se renombra un rol a nombre reservado; el rol cuyo nombre actual es reservado no se renombra | `El nombre «Administrador» esta reservado` |
| R2 | Si es el rol propio: `nombre_rol` y `estado` no cambian | `No puedes renombrar ni desactivar tu propio rol` |
| R3 | Si el rol existe: P(rol) ⊆ P(actor) | `No puedes editar un rol con mas privilegios que el tuyo` |
| R4 | Desactivar un rol con `config.roles` requiere que quede algun administrador fuera de ese rol | `Debe quedar al menos un administrador activo` |

Crear un rol nuevo (sin permisos) solo esta sujeto a R1.

#### `guardarPermisosRol`

| # | Regla | Mensaje |
| --- | --- | --- |
| P1 | P(rol antes del cambio) ⊆ P(actor) | `No puedes editar un rol con mas privilegios que el tuyo` |
| P2 | Permisos resultantes ⊆ P(actor) | `No puedes otorgar permisos que tu rol no tiene: {etiquetas}` |
| P3 | (existente) El rol propio conserva `config.roles` | `No puedes quitar el permiso de editar roles a tu propio rol` |
| P4 | Quitar `config.roles` a un rol requiere que quede algun administrador fuera de ese rol | `Debe quedar al menos un administrador activo` |

Orden de evaluacion: el de las tablas; se devuelve el **primer** bloqueo.

#### Cobertura de los escenarios

| Escenario | Bloqueado por |
| --- | --- |
| 1. SOME se asigna Administrador | F3 (y F1) |
| 2. SOME asigna Administrador a otro | F1 |
| 3. Otorgarse todo / crear rol con todo | P2 |
| 4. Renombrar un rol a "Administrador" | R1 |
| 5. Sabotaje al rol Administrador o sus funcionarios | F2, R3, P1, F4/R4/P4 |

### 3. Modulo de reglas: `src/modules/configuracion/utils/privilegios.ts`

Funciones **puras**: sin Prisma ni sesion. Reciben `ReadonlySet<Permiso>` y datos planos, y devuelven
`string | null` (mensaje del bloqueo o `null` si esta permitido). Contrato orientativo:

```ts
export const NOMBRE_ROL_RESERVADO = "Administrador";

export function esSubconjunto(permisos: Iterable<Permiso>, de: ReadonlySet<Permiso>): boolean;
export function esNombreReservado(nombre: string): boolean;

export function validarAsignacionRol(actor: ReadonlySet<Permiso>, rolDestino: RolEvaluado): string | null;   // F1
export function validarEdicionFuncionario(ctx: EdicionFuncionarioCtx): string | null;                        // F2, F3
export function validarEdicionRol(ctx: EdicionRolCtx): string | null;                                        // R1, R2, R3
export function validarPermisosRol(ctx: PermisosRolCtx): string | null;                                      // P1, P2, P3
export function quedaAdministrador(admins: AdminEvaluado[], cambio: CambioAdmin): boolean;                   // F4, R4, P4
```

Tipos (`RolEvaluado`, `AdminEvaluado`, contextos) en el mismo archivo o en
`src/modules/configuracion/types/`. Las firmas exactas quedan a criterio del plan; lo obligatorio es que
sean puras y que la UI y las actions usen **las mismas** funciones.

`quedaAdministrador` recibe la lista de administradores actuales (`{ rut, rol_id }`) y el cambio
propuesto (funcionario que deja de ser admin, o rol que deja de otorgar admin) y responde si queda al
menos uno.

### 4. Tipo compartido: `src/shared/types/resultado.ts`

```ts
export type ResultadoAccion<T> = { ok: true; data: T } | { ok: false; error: string };
```

- `{ ok: false, error }` para **errores de negocio esperados** de las tres actions: las reglas de la
  seccion 2 y las validaciones que ya existen (rol o centro inexistente, email duplicado, nombre de rol
  duplicado).
- Sigue siendo `throw`: `requirePermiso` (sin sesion/permiso), `ZodError` (input manipulado; la UI ya
  valida) y fallos de BD.
- Sin helpers adicionales. S2 reutiliza este tipo en solicitudes.

### 5. Flujo de las actions

1. `requirePermiso(...)` — sin cambios, primera linea.
2. `schema.parse(input)`.
3. Carga en paralelo lo necesario: P(actor); estado actual del destino (funcionario con su rol y
   permisos, o rol con permisos); rol destino con permisos; y **solo si el cambio puede quitar un
   administrador**, la lista de administradores activos.
4. Evaluar reglas en orden. Ante el primer bloqueo: `AuditLogger.logSecurity(...)` y
   `return { ok: false, error }`, **sin escribir** en BD.
5. Escritura igual que hoy (`guardarPermisosRol` mantiene su `$transaction`).
6. Auditoria del exito y `return { ok: true, data }`.

Firmas resultantes:

```ts
guardarFuncionario(input): Promise<ResultadoAccion<Funcionario>>
guardarRol(input): Promise<ResultadoAccion<Role>>
guardarPermisosRol(input): Promise<ResultadoAccion<{ id_rol: number; permisos: Permiso[] }>>
```

### 6. Auditoria

- **Intento bloqueado:**
  `AuditLogger.logSecurity(accion, false, { rut, name }, { resourceId, details, error })`, con
  `accion` = `"CREATE"` o `"UPDATE"`, `resourceId` = `funcionario:{rut}` / `rol:{id}`,
  `details` = regla y datos relevantes (ej. `regla=F1 rol_destino=1`) y `error` = mensaje mostrado.
  `logSecurity` existe en `src/shared/lib/logger.ts:46` y hoy no se usa.
- **Exito:** agregar antes/despues en `details`, como ya hace `guardarPermisosRol`:
  - funcionario: `rol_id`, `estado`, `centro_id` (ej. `rol_id 3->3 estado Activo->Inactivo centro 501->501`).
  - rol: `nombre_rol`, `estado`.

### 7. UI del mantenedor

La UI **anticipa**; la autoridad es el servidor.

**Datos del actor.** `src/app/(app)/configuracion/usuarios-roles/page.tsx` ya pasa `permisos`; agregar
`actor={{ rut, rolId }}` desde `contexto.user`. `UsuariosRolesView` deriva lo permitido con las
funciones de `privilegios.ts` sobre `data.roles` (que ya incluye `permisos`) y `data.funcionarios`
(incluye `rol_id`).

**`RowActions`** acepta `editDisabled`, `toggleDisabled` y un `title` opcional con el motivo.

**Pestana Funcionarios**

- Fila de un funcionario superior (F2): Editar y Activar/Desactivar deshabilitados, con
  `title="Tiene privilegios que tu rol no posee"`.
- Fila propia (F3): Activar/Desactivar deshabilitado. En el modal de edicion, los selects Rol, Centro y
  Estado deshabilitados con el aviso "No puedes cambiar tu propio rol, estado o centro".
- Select Rol del modal (F1): opciones no asignables con `disabled` y sufijo "(requiere mas permisos)".

**Pestana Roles**

- Rol superior (R3/P1): Permisos, Editar y Activar/Desactivar deshabilitados.
- Rol propio (R2): Editar y Activar/Desactivar deshabilitados; Permisos habilitado (puede quitarse
  permisos, salvo `config.roles`).
- Rol con nombre reservado (R1): en el modal de edicion, el input nombre deshabilitado.

**`PermisosRolModal`** — props nuevas `permisosActor: Permiso[]` y `esRolPropio: boolean`:

- Checkbox de un permiso que el actor no tiene: `disabled`, `title="Tu rol no tiene este permiso"` (P2).
- En el rol propio, checkbox `config.roles` deshabilitado (P3).

**Manejo del resultado — los 5 puntos de llamada:** `submitFuncionario`, `submitRol`, toggle de
funcionario (`UsuariosRolesView.tsx:469`), toggle de rol (`:374`) y `PermisosRolModal.submit`. Pasan a:

```ts
const res = await guardarX(...);
if (!res.ok) {
    toast.error(res.error);
    return;
}
```

manteniendo el `catch` para errores inesperados. **Ojo con los toggles:** hoy hacen
`.then(() => loadData())`; con el nuevo tipo, sin este cambio un bloqueo pasaria en silencio.

La regla del ultimo administrador (F4/R4/P4) no se anticipa en la UI (no tiene el conteo global);
llega como toast.

### 8. Tests

TDD en cada tarea.

- **`src/modules/configuracion/utils/privilegios.test.ts` (nuevo).** Tabla por regla (F1-F4, R1-R4,
  P1-P4) con al menos un caso permitido y uno bloqueado. Bordes: conjuntos iguales (Admin asigna Admin
  = permitido), rol sin permisos, nombre reservado con mayusculas/espacios, rol inactivo evaluado por
  sus permisos, ultimo administrador con y sin otro admin.
- **`mantenedores.action.test.ts`.**
  - Escenarios 1 a 5 de punta a punta con Prisma mockeado.
  - Cada bloqueo: `{ ok: false, error }`, **ninguna** llamada a `create`/`update`/`deleteMany`/`createMany`,
    y `AuditLogger.logSecurity` llamado.
  - Tests existentes de errores de negocio de estas tres actions pasan de `rejects.toThrow` a
    `{ ok: false }` ("Ya existe un funcionario con ese email", "Rol no existe", "Centro no existe",
    anti-lockout de `config.roles`). Siguen con `rejects.toThrow`: RUT invalido (Zod), clave de permiso
    inventada (Zod) y fallo de conexion.
  - Mock de `@/shared/lib/permisos` agrega `getPermisosRol`; mock de logger agrega `logSecurity`.
- **`PermisosRolModal.test.tsx` / `UsuariosRolesView.test.tsx`.** Controles deshabilitados segun el
  actor y toast con `res.error` cuando `ok: false`.
- **Estructurales** (`permisos-por-action.test.ts`, `paginas-protegidas.test.ts`, `navegacion.test.ts`):
  sin cambios; no hay actions, paginas ni permisos nuevos.
- Verificacion final: `npm test`, `npx tsc --noEmit`, `npm run lint`.

### 9. Documentacion

- `docs/rbac-permisos.md`:
  - Nueva seccion "Escalada de privilegios" con las reglas de la seccion 2 y el modulo `privilegios.ts`.
  - §6 Salvaguardas: reemplazar la "limitacion conocida" del ultimo administrador por la regla F4/R4/P4.
  - §2 catalogo: agregar `some.ver` (hoy desactualizado).
  - §10 Anti-patrones: referencia a #21 como deuda conocida.
- `AGENTS.md`, seccion "Datos y reglas de negocio": una linea sobre "no otorgar lo que no tienes" con
  referencia a `docs/rbac-permisos.md`.

### 10. Despliegue

- Sin cambios de esquema ni migraciones. El seed no cambia: corre como script y no pasa por las actions.
- **Revision post-deploy en produccion**, a validar manualmente con Dani. Detectar estados ya escalados:

```sql
-- Funcionarios activos con privilegio de administracion o rol llamado Administrador
SELECT f.rut, f.nombre, f.email, r.nombre_rol, r.estado AS estado_rol
FROM funcionarios f
JOIN roles r ON r.id_rol = f.rol_id
WHERE f.estado = 'Activo'
  AND (LOWER(TRIM(r.nombre_rol)) = 'administrador'
       OR EXISTS (SELECT 1 FROM roles_permisos rp
                  WHERE rp.rol_id = r.id_rol AND rp.permiso IN ('config.roles', 'config.funcionarios')))
ORDER BY r.nombre_rol, f.nombre;

-- Roles con permisos de configuracion sensibles
SELECT r.id_rol, r.nombre_rol, r.estado, GROUP_CONCAT(rp.permiso ORDER BY rp.permiso) AS permisos
FROM roles r
JOIN roles_permisos rp ON rp.rol_id = r.id_rol
GROUP BY r.id_rol, r.nombre_rol, r.estado
HAVING SUM(rp.permiso IN ('config.roles', 'config.funcionarios')) > 0;
```

## Fuera de alcance

- Permiso `some.todos_centros` y eliminar la comparacion por nombre de rol (#21).
- Aplicar `ResultadoAccion` en solicitudes y otros modulos (S2). Incluye los `ZodError` provocados por
  input real del usuario (ej. RUT invalido en el formulario de funcionario), que en S1 siguen lanzando.
- Proteccion ante degradacion concurrente entre administradores (dos admins que se degradan al mismo
  tiempo podrian saltarse F4/R4/P4). Riesgo aceptado por improbable.
- Borrado de roles o funcionarios (no existe hoy).
- Corregir automaticamente estados ya escalados en BD (se revisan con las consultas de la seccion 10).

## Criterios de aceptacion

- [ ] Los escenarios 1 a 5 quedan bloqueados en el servidor, sin escritura en BD y con registro `SECURITY`.
- [ ] Un Administrador conserva todas sus capacidades actuales sobre roles y funcionarios de igual o
      menor privilegio.
- [ ] Los mensajes de bloqueo se ven en produccion (no el error generico de Next.js).
- [ ] La UI deshabilita las acciones no permitidas descritas en la seccion 7.
- [ ] No es posible dejar el sistema sin administradores activos desde el mantenedor.
- [ ] `npm test`, `npx tsc --noEmit` y `npm run lint` en verde.
