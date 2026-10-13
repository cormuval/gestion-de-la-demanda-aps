# Selector de centro activo para administradores

Fecha: 2026-10-13
Rama: `feat/selector-centro-activo`
Origen: requerimiento del equipo (punto 4 de la tanda del 13/10/2026).

## Problema

Todo el sistema filtra por el centro del funcionario en sesión: bandeja de solicitudes,
Comunicador, Dashboard y Panel SOME. Un administrador que apoya a varios centros no tiene cómo
cambiar de centro por su cuenta. La salvaguarda de auto-edición
(`validarEdicionFuncionario`, `src/modules/configuracion/utils/privilegios.ts`) impide que un
funcionario cambie su propio rol, estado o centro. La pantalla de Configuración → Funcionarios
deshabilita esos campos al editarse a uno mismo.

Hoy un administrador sí puede cambiar el centro de *otro* administrador, porque tienen los mismos
permisos y la regla del último administrador no mira el centro. Por eso hoy hace falta pedirle a
otra persona que lo haga.

## Objetivo

Que un administrador cambie su propio centro desde el menú lateral, sin cerrar sesión, manteniendo
su rol y sus permisos. Para el resto de los roles y para los demás campos se mantienen las
salvaguardas.

## Decisiones

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Quién es administrador | Funcionario cuyo rol activo tiene `config.roles` | Es la definición que ya usa la regla "debe quedar al menos un administrador activo". No depende del nombre del rol (deuda #21). |
| Dónde se cambia | Selector "Centro activo" en el pie del menú lateral | El cambio puede ser frecuente; queda a un clic desde cualquier pantalla. |
| Configuración → Funcionarios | Sin cambios: nadie edita ahí su propio rol, estado ni centro | El selector es la única excepción y está acotado a un campo. |
| Qué se modifica | `funcionarios.centro_id` del funcionario en sesión | Es la fuente que ya lee la sesión. No hace falta un "centro activo" aparte. |
| Rol y estado | No cambian | Fuera de alcance; la excepción es solo el centro. |
| Centros disponibles | Todos los de la tabla `centros` | Un administrador puede apoyar a cualquier centro. |
| Auditoría | `AuditLogger.logDataAccess("UPDATE", …, "funcionario:<rut>")` con centro anterior → nuevo | El mismo registro que deja hoy `guardarFuncionario`. |
| Sesión | Sin cerrar sesión: `router.refresh()` | El callback `jwt` (`src/auth.ts`) relee `centro_id` desde la BD. Se verifica en local al implementar. |

## Diseño

### 1. Regla pura (`src/modules/configuracion/utils/privilegios.ts`)

```ts
export function puedeCambiarCentroPropio(permisos: ReadonlySet<Permiso>): boolean
```

Devuelve `true` si los permisos del rol del actor incluyen `config.roles`. Los permisos vienen de
`getPermisosRol`, que devuelve un conjunto vacío si el rol está inactivo, así que un rol inactivo
nunca califica. La usan la action y el layout.

### 2. Server Action `cambiarCentroActivo(centroId: string)`

Archivo: `src/modules/configuracion/actions/cambiarCentroActivo.action.ts`. Devuelve
`ResultadoAccion<{ centro_id: string; centro_nombre: string | null }>`.

1. `getSessionPermisos()`. Sin sesión devuelve `{ ok: false, error: "No autenticado" }` (las actions no lanzan).
2. Si `!puedeCambiarCentroPropio(permisos)` → `{ ok: false, error: "Solo un administrador puede cambiar su centro" }`.
   El bloqueo se audita con `AuditLogger` (`success: false`), con el mismo formato que `logBloqueo`
   de `mantenedores.action.ts`. Si la action queda en otro archivo, `logBloqueo` se mueve a un
   helper del módulo para reutilizarlo en vez de duplicarlo.
3. Valida `centroId` con Zod (string no vacío). Si el centro no existe en `centros` →
   `{ ok: false, error: "El centro seleccionado no existe" }`.
4. Si `centroId` es el centro actual → `{ ok: true }` sin escribir.
5. `prisma.funcionario.update({ where: { rut: user.rut }, data: { centro_id } })`. El RUT sale
   de la sesión, nunca del cliente, así que la action no sirve para cambiar a otra persona.
6. `AuditLogger.logDataAccess("UPDATE", true, actor, "funcionario:<rut>", { details: "centro_id <anterior> -> <nuevo> (selector centro activo)" })`.

### 3. Layout y menú lateral

- `src/app/(app)/layout.tsx`: si `puedeCambiarCentroPropio(contexto.permisos)`, consulta los
  centros (`id_centro`, `nombre_centro`, ordenados por nombre) y se los pasa a `AppShell` como
  `centros`. Para el resto de los roles no se consulta nada.
- `AppShell` / `AppSidebar`: si `centros` viene definido, muestra `SelectorCentroActivo` en lugar
  del texto con el nombre del centro. Si no, mantiene el texto actual.
- `src/shared/components/layout/selector-centro-activo.tsx`: componente cliente con el `Select`
  de `shared/components/ui` (un `<select>` nativo con estilos, el que ya usan los formularios).
  - **Valor inicial:** `user.centro_id`.
  - **Al cambiar:** llama a la action con el selector deshabilitado. Con `ok: true` muestra un toast
    "Centro cambiado a <nombre>" y llama a `router.refresh()`. Con `ok: false` o una excepción,
    muestra el toast de error y vuelve al valor anterior.
  - **Sin centro asignado:** muestra el placeholder "Sin centro".
  - **Menú colapsado:** se oculta, igual que el bloque actual del pie (`group-data-[collapsible=icon]:hidden`).

El componente vive en `shared/components/layout` porque es parte del layout. La action vive en el
módulo `configuracion` porque modifica un funcionario.

### 4. Documentación

- `docs/rbac-permisos.md`, sección 6 (Auto-edición): agregar la excepción. Un funcionario cuyo rol
  activo incluye `config.roles` puede cambiar su propio centro desde el selector "Centro activo";
  sigue sin poder cambiar su rol ni su estado, y en Configuración → Funcionarios la regla no cambia.
- `AGENTS.md`, sección Permisos (anti-escalada): agregar la misma salvedad en una línea.

## Errores

| Caso | Resultado |
| --- | --- |
| No es administrador (p. ej. el rol perdió `config.roles` con la sesión abierta) | `ok: false`, toast, el selector vuelve atrás, bloqueo en el log |
| Centro inexistente | `ok: false`, toast, el selector vuelve atrás |
| Falla de BD o de red | Excepción → toast genérico "No fue posible cambiar el centro", el selector vuelve atrás |
| Sin sesión | `{ ok: false, error: "No autenticado" }` (las actions no lanzan) |

## Tests (Vitest)

- `privilegios.test.ts`: `puedeCambiarCentroPropio` con y sin `config.roles`, y con un conjunto vacío.
- `cambiarCentroActivo.action.test.ts`:
  - Rechaza a quien no es administrador, sin escribir y con bloqueo en el log.
  - Rechaza un centro inexistente.
  - Actualiza solo el RUT de la sesión.
  - No escribe si el centro es el mismo.
  - Registra la auditoría con el centro anterior y el nuevo.
- `selector-centro-activo.test.tsx`: llama a la action y refresca; ante `ok: false` muestra el
  toast y vuelve al valor anterior.
- `app-shell.test.tsx`: con `centros` muestra el selector; sin `centros`, el texto actual.
- Verificación manual en local: un administrador cambia de centro y la bandeja muestra los datos
  del centro nuevo sin volver a entrar.

## Fuera de alcance

- Cambiar el propio rol o estado.
- Restringir a qué centros puede cambiarse un administrador.
- Un "centro activo" de sesión separado del centro asignado.
