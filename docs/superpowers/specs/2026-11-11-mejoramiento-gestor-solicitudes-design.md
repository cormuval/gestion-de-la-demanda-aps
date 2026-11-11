# Mejoramiento del gestor de solicitudes

Fecha: 2026-11-11

Rama: `mejoramiento_gestor_solicitudes`

## Contexto

El flujo principal de la aplicacion permite ingresar una solicitud, gestionarla y contactar al
paciente para coordinar la prestacion. La vista **Revisar solicitudes** ya incorpora el contexto
integral del paciente mediante **Otras solicitudes y citas**, pero una gestora que detecta que una
cita pendiente ya no es necesaria debe salir de ese flujo y resolverla desde Comunicador.

Ademas, el rechazo de una solicitud limita la observacion a 200 caracteres en la validacion del
servidor, aunque el requerimiento funcional es admitir 350. Los modales de gestion tampoco muestran
el nombre del orientador que ingreso la solicitud, dato necesario para que la gestora identifique su
origen.

## Objetivo

Mejorar la gestion integral del paciente desde **Revisar solicitudes** para que una gestora pueda:

1. registrar, sobre una cita pendiente de otra solicitud en curso del mismo paciente, una llamada
   restringida a la respuesta **Cita Rechazada (No Necesaria)**;
2. ingresar hasta 350 caracteres en la observacion de rechazo de una solicitud; y
3. identificar al orientador que ingreso la solicitud antes de realizarla o rechazarla.

## Alcance

### Incluido

- Accion **Registrar llamada** en las citas elegibles de **Otras solicitudes y citas**.
- Reutilizacion del flujo transaccional actual de `registrarLlamada`.
- Modal de llamada en modo restringido, con respuesta fija y solo un campo editable.
- Persistencia de la observacion exclusivamente en `llamadas.observacion`.
- Actualizacion de los estados de cita y solicitud con las reglas actuales.
- Limite de 350 caracteres para `observacion_rechazo` al rechazar solicitudes.
- Nombre del orientador en los modales **Realizar solicitud** y **Rechazar solicitud**.
- Pruebas unitarias y de componentes para los tres cambios.

### Fuera de alcance

- Nuevas respuestas o estados de llamada.
- Registro de llamadas sobre citas cerradas, sobre la solicitud actualmente revisada o sobre citas
  huerfanas de una solicitud en curso visible.
- Cambios al catalogo de permisos o a las asignaciones de roles.
- Escritura en `citas.razon_rechazo` desde este flujo. La columna conserva su definicion actual
  `VARCHAR(350)`, pero **no se modifica** al registrar la llamada desde Gestion.
- Migraciones de base de datos: `llamadas.observacion` y `citas.razon_rechazo` ya admiten 350
  caracteres, y `solicitudes.observacion_rechazo` admite mas de 350.
- Cambios al formulario general de Comunicador, que mantiene todas sus respuestas actuales.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Implementacion de la llamada | Reutilizar `registrarLlamada` y `RegistrarLlamadaModal` con un modo restringido | Evita duplicar concurrencia, auditoria y reglas de cierre |
| Respuesta desde Gestion | Solo `Cita Rechazada (No Necesaria)` | Es el unico caso solicitado |
| Campo editable | Solo `llamadas.observacion`, opcional y con maximo 350 caracteres | Conserva la regla actual y no introduce datos adicionales |
| `citas.razon_rechazo` | No escribir | Decision final del requerimiento: la observacion se guarda solamente en la llamada |
| Citas elegibles | Estado incluido en `ESTADOS_PENDIENTES`, asociadas a otra solicitud `En Curso` visible en el centro | Impide actuar sobre citas cerradas o fuera del contexto mostrado |
| Permisos | Mantener `solicitudes.gestionar` para la vista y exigir `comunicador.llamar` al registrar | Conserva el control vigente del registro de llamadas |
| Centro | Centro activo de la gestora y centro de la cita | Mantiene el aislamiento actual |
| Cierre de solicitud | Regla actual: `Realizado` solo cuando no quedan citas pendientes | Mantiene el comportamiento del Comunicador |
| Observacion de rechazo de solicitud | 350 caracteres en UI y Zod | Alinea cliente y servidor con el limite requerido |
| Orientador ausente | Mostrar `Orientador: Sin registro` | Evita ocultar el dato o dejar un espacio ambiguo |

## Diseno

### 1. Contexto de otras solicitudes y citas

`src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts` mantendra el permiso
`solicitudes.gestionar`, el filtro por RUT normalizado y el centro activo. La consulta de citas se
ajustara para que una cita sea accionable solo si:

- pertenece al mismo paciente y centro;
- su `estado_cita` esta incluido en `ESTADOS_PENDIENTES`;
- tiene una `solicitud` con `estado_solicitud = "En Curso"`;
- la solicitud asociada no es la solicitud base que se esta revisando; y
- la solicitud asociada forma parte de las solicitudes devueltas por el contexto.

El contrato de cada cita agregara una propiedad explicita, por ejemplo `puedeRegistrarRechazo`,
calculada en el servidor. `editable`, usada para corregir una cita sin llamadas, conserva su regla
actual y es independiente de esta nueva accion.

No se habilitara **Registrar llamada** en la seccion de citas huerfanas ni en citas que por una carrera
de concurrencia hayan dejado de estar pendientes. La action de registro volvera a validar el estado.

### 2. Modo restringido del modal de llamada

`src/modules/comunicador/components/RegistrarLlamadaModal.tsx` aceptara una configuracion explicita
de origen o modo, sin duplicar el componente. El modo normal conservara exactamente el comportamiento
actual de Comunicador. El modo de Gestion tendra estas reglas:

- titulo **Registrar llamada** y datos informativos actuales del paciente y la cita;
- respuesta fija visible: **Cita Rechazada (No Necesaria)**, sin `Select`;
- unico control editable: **Observacion**;
- observacion opcional, recortada con `trim`, con `maxLength={350}` y contador `N/350`;
- sin campo de hora agendada ni otros campos de respuesta;
- botones **Cancelar** y **Registrar**.

La composicion respetara shadcn/ui: `Dialog` con `DialogTitle`, `FieldGroup`/`Field` para el
formulario, `Textarea` para la observacion, `Button` para acciones, espaciado mediante `gap-*` y
`data-icon` si se incorporan iconos. Se reutilizaran los componentes ya instalados antes de agregar
otros.

Al registrar con exito, el modal se cerrara, mostrara el mismo feedback del flujo actual y recargara
**Otras solicitudes y citas**. Si la cita se cerro concurrentemente, se mostrara
`ERROR_CITA_CERRADA`, se cerrara el modal de llamada y se recargara el contexto.

### 3. Validacion y registro de la llamada

Se ampliara el contrato de `registrarLlamada` con un origen discriminado, por ejemplo:

```ts
type OrigenLlamada = "comunicador" | "gestion_solicitudes";
```

Para preservar compatibilidad, las llamadas existentes sin origen se interpretaran como
`comunicador`. Cuando `origen === "gestion_solicitudes"`, el schema y la action exigiran:

- `respuesta === RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA`;
- `observacion` opcional y de 350 caracteres como maximo luego de `trim`;
- `hora_agendada` vacia; y
- permiso `comunicador.llamar`, igual que el flujo general.

La interfaz restringida no sera la unica proteccion: una invocacion directa que intente otra
respuesta desde ese origen sera rechazada antes de escribir datos.

Dentro de la transaccion existente se conservaran:

1. bloqueo `SELECT ... FOR UPDATE` de la cita;
2. validacion de existencia, centro y estado no terminal;
3. creacion de `llamadas` con la observacion ingresada;
4. calculo del estado mediante `computeEstadoCita`, cuyo resultado sera
   `Cita Rechazada (No Necesaria)`;
5. actualizacion de `citas.estado_cita`; y
6. conteo de citas pendientes de la solicitud y cambio de `solicitudes.estado_solicitud` a
   `Realizado` solo si el conteo es cero.

La actualizacion de la cita **no incluira** `razon_rechazo`. Tampoco se agregara una segunda escritura
de la observacion en otra tabla. La auditoria existente mantendra actor, cita, respuesta y estado
resultante.

### 4. Integracion en Revisar solicitudes

En `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`, `OtrasSolicitudesModal` agregara
la accion **Registrar llamada** junto a cada cita con `puedeRegistrarRechazo = true`. La accion abrira
`RegistrarLlamadaModal` en modo Gestion con los datos de la cita y el contacto del paciente ya
disponible o consultado mediante el flujo existente.

Una cita puede mostrar **Editar** y **Registrar llamada** de acuerdo con reglas independientes. Una
cita sin llamadas puede admitir ambas acciones; al abrir un modal se mantendra el contexto padre y
se evitara superponer interacciones. Al completar cualquiera de ellas se recargara el contexto.

La action `registrarLlamada` seguira exigiendo `comunicador.llamar`. Si un usuario con acceso a
Gestion no tiene ese permiso, el servidor no escribira y la interfaz mostrara el mensaje de acceso
devuelto por el control existente. No se agrega un permiso alternativo ni se relaja el actual.

### 5. Limite de observacion al rechazar una solicitud

En `src/modules/solicitudes/schemas/revision.schema.ts`, el campo `observacion_rechazo` cambiara de
`max(200)` a `max(350)` con el mensaje correspondiente. Este schema es la validacion autoritativa del
servidor.

En `RechazoModal`:

- `Textarea` tendra `maxLength={350}`;
- se mostrara contador `N/350`;
- el campo continuara siendo opcional, porque el motivo estructurado `razon_rechazo` sigue siendo
  obligatorio; y
- no se cambiara `solicitudes.razon_rechazo`, que permanece como el valor del catalogo
  `RAZONES_RECHAZO`.

El limite se aplica despues de `trim`, de forma consistente entre frontend y backend.

### 6. Visualizacion del orientador

Las consultas `getSolicitudes` y `getOtrasSolicitudes` ya incluyen la relacion `orientador`, por lo
que no se requiere una consulta adicional. El tipo usado por `RevisarSolicitudesView` mantendra el
nombre del orientador disponible para solicitudes de la tabla y del modal contextual.

En `RealizarModal` y `RechazoModal`, debajo de la descripcion de la solicitud se mostrara:

```text
Orientador: Nombre del funcionario
```

Si la relacion no existe, se mostrara `Orientador: Sin registro`. El dato es informativo, no editable,
y no altera el envio de los formularios.

## Flujo de datos

1. La gestora abre **Otras solicitudes y citas** desde una solicitud base.
2. El servidor devuelve las otras solicitudes en curso y sus citas pendientes del mismo paciente y
   centro, marcando las citas elegibles.
3. La gestora selecciona **Registrar llamada** en una cita.
4. El modal muestra la respuesta fija y solicita solo la observacion.
5. La action valida `comunicador.llamar`, origen, respuesta, observacion, centro y estado bajo bloqueo.
6. Se crea una fila en `llamadas` y se actualiza `citas.estado_cita`; `citas.razon_rechazo` queda sin
   cambios.
7. Si no quedan citas pendientes, se actualiza la solicitud asociada a `Realizado`.
8. La interfaz informa el resultado y recarga el contexto integral del paciente.

## Manejo de errores y concurrencia

- Falta `solicitudes.gestionar`: no se puede abrir la pagina ni consultar el contexto.
- Falta `comunicador.llamar`: no se crea la llamada y se muestra el error de permisos existente.
- Observacion mayor a 350: validacion antes de abrir la transaccion; no hay escrituras.
- Respuesta distinta desde origen Gestion: rechazo de schema; no hay escrituras.
- Cita inexistente, de otro centro o ya cerrada: resultado de negocio sin escritura.
- Cierre concurrente: el `FOR UPDATE` serializa acciones; la segunda operacion observa el estado
  terminal y falla de forma controlada.
- Fallo inesperado: `toast.error` y modal disponible para reintentar, sin mostrar detalles internos.

## Pruebas

El desarrollo seguira TDD.

### Schema de llamadas

- modo Comunicador conserva todas las respuestas actuales;
- modo Gestion acepta exactamente `Cita Rechazada (No Necesaria)`;
- modo Gestion acepta observacion de 350 caracteres;
- acepta observacion vacia y rechaza una de 351 caracteres;
- rechaza otra respuesta y una hora agendada.

### `registrarLlamada.action.test.ts`

- exige `comunicador.llamar` para el origen Gestion;
- crea una llamada con la observacion escrita por la gestora;
- actualiza solo `estado_cita` en la cita y no envia `razon_rechazo` al `update`;
- no escribe en ninguna otra columna o tabla la observacion;
- mantiene `FOR UPDATE` antes de leer la cita;
- rechaza cita cerrada o de otro centro;
- cierra la solicitud cuando no quedan citas pendientes;
- conserva la solicitud `En Curso` cuando queda al menos una cita pendiente;
- mantiene verdes los casos actuales del Comunicador.

### Contexto y UI de Gestion

- `getOtrasSolicitudes` solo marca citas pendientes de otras solicitudes `En Curso` visibles;
- no habilita la accion para citas de la solicitud base, cerradas o huerfanas;
- **Registrar llamada** abre el modal en modo restringido;
- no existe selector de respuesta ni campo de hora;
- solo la observacion es editable y muestra el limite `350`;
- exito y cierre concurrente recargan el contexto;
- los errores de permiso se presentan sin cerrar silenciosamente el flujo.

### Rechazo de solicitudes

- schema acepta `observacion_rechazo` de 350 caracteres y rechaza 351;
- modal aplica `maxLength={350}` y muestra contador;
- rechazo exitoso persiste el texto completo.

### Orientador

- los modales Realizar y Rechazar muestran el nombre bajo la descripcion;
- solicitudes sin relacion muestran `Sin registro`;
- solicitudes abiertas desde **Otras solicitudes y citas** muestran su propio orientador, no el de la
  solicitud base.

### Verificacion final

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

## Criterios de aceptacion

- [ ] Desde **Otras solicitudes y citas** se puede registrar una llamada solo sobre una cita pendiente
  perteneciente a otra solicitud `En Curso` del mismo paciente y centro.
- [ ] El modal restringido fija la respuesta **Cita Rechazada (No Necesaria)** y permite editar
  unicamente una observacion opcional de hasta 350 caracteres.
- [ ] El registro exige `comunicador.llamar` y conserva las validaciones de centro y concurrencia.
- [ ] La observacion se guarda exclusivamente en `llamadas.observacion`; `citas.razon_rechazo` no se
  modifica.
- [ ] La cita pasa a `Cita Rechazada (No Necesaria)` y la solicitud solo pasa a `Realizado` si no quedan
  citas pendientes.
- [ ] El flujo general de Comunicador conserva todas sus respuestas y comportamiento actual.
- [ ] El rechazo de una solicitud admite 350 caracteres en `observacion_rechazo` tanto en cliente como
  en servidor.
- [ ] Realizar y Rechazar muestran el nombre del orientador debajo de la descripcion, con fallback
  `Sin registro`.
- [ ] Las pruebas, TypeScript, lint y build finalizan correctamente.
