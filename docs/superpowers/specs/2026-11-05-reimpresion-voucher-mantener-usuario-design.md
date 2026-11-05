# Reimpresion de voucher y mantener usuario al crear solicitudes

Fecha: 2026-11-05  
Rama: `reimpresion_de_voucher_y_Mantener_usuario`  
Origen: requerimiento del equipo (05/11/2026).

## Problema

El voucher de una solicitud solo se puede imprimir inmediatamente despues de crearla. Si se cierra
el modal o se necesita otra copia, la aplicacion no permite reconstruir ni reimprimir el comprobante
desde las solicitudes pendientes ni desde el historial del paciente.

Ademas, el flujo Crear solicitud reinicia completamente el paciente despues de un ingreso. Cuando un
mismo paciente necesita varias solicitudes distintas, el funcionario debe volver a buscar y confirmar
sus datos en cada oportunidad. Esto agrega pasos a una atencion que debiera revisar y resolver al
paciente de forma integral.

## Objetivo

1. Permitir reimprimir el comprobante vigente de una solicitud desde:
   - la tabla **Pendientes del paciente** de Crear solicitud; y
   - la vista **Historial del paciente**, exclusivamente para solicitudes cuyo estado vigente sea
     `En Curso`.
2. Incorporar en Crear solicitud la opcion **Mantener usuario**, desmarcada por defecto, para ingresar
   solicitudes adicionales al mismo paciente sin repetir su busqueda y confirmacion.
3. Reiniciar siempre los datos propios de una solicitud entre ingresos para impedir que se reutilicen
   accidentalmente en la siguiente solicitud.

La solucion respeta la premisa de integralidad centrada en el paciente: permite revisar sus pendientes
y registrar distintas necesidades durante una misma atencion, sin relajar el bloqueo de solicitudes
duplicadas.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Fuente de la reimpresion | Consultar nuevamente la solicitud al pulsar la accion | Evita imprimir datos o estados obsoletos almacenados en el navegador. |
| Estados imprimibles | Solo `En Curso`, validado otra vez en el servidor | El requerimiento excluye solicitudes realizadas o rechazadas y evita una condicion de carrera. |
| Formato | Reutilizar exactamente el comprobante existente | La reimpresion debe ser indistinguible de la impresion inicial. |
| Campos | Los que ya presenta el voucher actual; no se agrega profesional | Mantiene el alcance solicitado. |
| Fecha y hora | `fecha_inicio` original de la solicitud | Una reimpresion no altera el momento de ingreso. |
| Autorizacion | `solicitudes.ver` o `historial.ver`, mas centro activo | La accion se origina en dos vistas con permisos diferentes y debe respetar el aislamiento por centro. |
| Permiso nuevo | Ninguno | Los permisos actuales ya autorizan a consultar la solicitud en cada vista. |
| Persistencia del check | Solo estado local de la pantalla, inicialmente `false` | No es una preferencia permanente del funcionario. |
| Momento de limpieza | Solo despues de una creacion exitosa | Un error no debe hacer perder datos ingresados. |
| Pendientes conservados | Se vuelven a consultar despues de crear con el check marcado | La lista debe incluir inmediatamente la solicitud recien creada. |

## Alcance funcional

### 1. Reimpresion desde Pendientes del paciente

Cada solicitud mostrada en **Pendientes del paciente** tendra una accion **Reimprimir voucher**. Esta
tabla ya contiene solicitudes `En Curso`, pero el servidor volvera a validar el estado cuando se pulse
la accion.

Al seleccionar la accion:

1. El control queda deshabilitado mientras se consulta el voucher, para evitar solicitudes duplicadas.
2. La aplicacion obtiene los datos vigentes desde el servidor.
3. Si la consulta es valida, abre el mismo modal usado despues de crear una solicitud.
4. El funcionario puede cerrar el modal o usar **Imprimir**.

### 2. Reimpresion desde Historial del paciente

Cada tarjeta de solicitud mostrara **Reimprimir voucher** solamente cuando
`estado_solicitud === "En Curso"`. Las solicitudes realizadas, rechazadas o con cualquier otro estado
no mostraran la accion.

Aunque la interfaz oculte el control, el servidor siempre comprobara nuevamente el estado y el centro
antes de entregar los datos.

### 3. Contenido del voucher

El componente reutilizable conservara el formato, logotipos, textos y reglas de impresion actuales.
Mostrara los mismos datos que el comprobante ya implementado:

- identificador de la solicitud;
- fecha y hora originales;
- RUT del paciente;
- tipo de solicitud;
- motivo, o `Sin motivo`;
- disponibilidad de llamada, cuando exista;
- telefonos, cuando alguno exista; y
- nombre del centro, o el reemplazo actual cuando no este informado.

No mostrara el profesional ni agregara nuevos campos. El boton de reimpresion tampoco modifica la
solicitud, su fecha ni su estado.

### 4. Mantener usuario

La tarjeta **Nueva solicitud** mostrara un checkbox **Mantener usuario** cerca del boton
**Guardar solicitud**, una vez que exista un usuario confirmado. El checkbox estara desmarcado al
iniciar el flujo.

Despues de crear una solicitud exitosamente:

- siempre se abre el voucher de la solicitud creada;
- siempre se reinician Tipo de solicitud, Motivo, Disponibilidad de llamada y Descripcion;
- si **Mantener usuario** esta marcado:
  - se conservan el RUT buscado, el usuario confirmado y sus datos;
  - el checkbox permanece marcado para permitir una secuencia de ingresos; y
  - se actualiza Pendientes del paciente desde el servidor para incluir la nueva solicitud;
- si **Mantener usuario** esta desmarcado:
  - se reinician el RUT, la revision previa, el usuario confirmado y sus pendientes; y
  - el checkbox permanece en su valor inicial desmarcado.

Buscar o comenzar el flujo con otro RUT reinicia **Mantener usuario** a desmarcado. Si la creacion
falla, no se limpia ningun campo ni se cambia el checkbox.

El comportamiento no omite la validacion de duplicados: cada nueva combinacion de tipo y motivo se
valida en la interfaz y nuevamente dentro de la transaccion de creacion existente.

## Diseno tecnico

### 1. Contrato y componente reutilizable

El tipo del voucher dejara de derivarse exclusivamente del resultado de `crearSolicitud`. Se definira
un contrato reutilizable dentro del modulo `solicitudes`, con la informacion que consume el
comprobante.

El modal y sus auxiliares visuales se extraeran de
`src/modules/solicitudes/components/IngresarSolicitudView.tsx` a un componente enfocado, por ejemplo:

- `src/modules/solicitudes/components/VoucherSolicitudModal.tsx`.

`IngresarSolicitudView` y `HistorialPacienteView` usaran el mismo componente. No se duplicaran el
marcado, los estilos de impresion ni el formateo de fecha y hora.

### 2. Server Action `getVoucherSolicitud`

Se incorporara una Server Action en el modulo `solicitudes`, por ejemplo:

- `src/modules/solicitudes/actions/getVoucherSolicitud.action.ts`.

Entrada: `idSolicitud: string`, validado con Zod.  
Salida: `ResultadoAccion<VoucherSolicitud>`.

Flujo:

1. Exigir al menos uno de los permisos `solicitudes.ver` o `historial.ver` mediante la semantica OR
   existente de `requirePermiso`.
2. Exigir que el funcionario tenga centro activo.
3. Consultar por `id_solicitud`, `centro_id` del funcionario y `estado_solicitud = "En Curso"`.
4. Seleccionar solo los campos necesarios y sus relaciones: usuario, tipo de solicitud, motivo y
   centro.
5. Si no se encuentra una fila, realizar una consulta escalar por identificador para distinguir una
   solicitud cerrada del caso inexistente o ajeno al centro, sin devolver datos de esta ultima.
6. Mapear el resultado al mismo contrato usado por la creacion.
7. Auditar la lectura con `AuditLogger` sin registrar informacion adicional del paciente.

La accion no actualizara datos. La creacion inicial continuara construyendo el mismo contrato a partir
de la solicitud recien insertada.

### 3. Integracion con Pendientes

`ListaPendientes` ya acepta `accionesSolicitud`, por lo que la presentacion generica de la cascada no
necesita conocer la logica del voucher. `PendientesCascada` recibira o construira la accion apropiada
para cada solicitud y comunicara el voucher obtenido a `IngresarSolicitudView`, que administrara un
unico modal.

La carga mantendra identificado el boton activo. No se bloquearan las demas funciones de la pantalla
mas alla de lo necesario para evitar una segunda carga del mismo comprobante.

### 4. Integracion con Historial

`SolicitudItem` recibira la funcion para solicitar el voucher. Renderizara el boton solo para
`En Curso`. `HistorialPacienteView` mantendra el voucher activo y el identificador en carga, y montara
el mismo `VoucherSolicitudModal` que usa Crear solicitud.

No se incorporaran datos del voucher a `getHistorialPaciente`: se cargaran bajo demanda para evitar
ampliar permanentemente la respuesta del historial.

### 5. Estado de Mantener usuario

`IngresarSolicitudView` agregara un estado booleano `mantenerUsuario`, inicializado en `false`.
La limpieza se separara en operaciones explicitas:

- limpiar solamente el formulario de solicitud; y
- reiniciar por completo el flujo de paciente y solicitud.

El camino exitoso elegira una de ellas segun el checkbox. Cuando se conserva al paciente, despues de
limpiar el formulario se llamara nuevamente a `getPendientes(rutRevisado)`. Si esta actualizacion
secundaria falla, la solicitud seguira considerandose creada y se mostrara un toast indicando que no
fue posible actualizar la lista; el usuario y el formulario limpio se conservaran.

## Seguridad y auditoria

- El identificador recibido del navegador nunca sera suficiente para acceder al voucher.
- La Server Action comprobara permiso, centro activo y estado vigente.
- Una solicitud de otro centro se tratara igual que una inexistente para no revelar su existencia.
- La habilitacion visual del boton no reemplaza las comprobaciones del servidor.
- Cada obtencion exitosa para reimpresion se auditara como lectura. Los intentos rechazados por estado
  podran auditarse como fallidos siguiendo el patron vigente de `AuditLogger`.
- No se agregan permisos, migraciones ni cambios al esquema Prisma.

## Errores y mensajes

| Caso | Resultado |
| --- | --- |
| Solicitud cambio desde `En Curso` a otro estado | `ok: false`, `Solo se pueden reimprimir vouchers de solicitudes En Curso` |
| Solicitud inexistente o de otro centro | `ok: false`, mensaje generico `No fue posible obtener el voucher de la solicitud` |
| Funcionario sin centro activo | `ok: false` con el mensaje estandar de centro no asignado |
| Sin ninguno de los permisos admitidos | `requirePermiso` rechaza la operacion |
| Falla inesperada al consultar el voucher | Toast de error; no se abre ni se reemplaza el modal |
| Falla al crear una solicitud | Se conservan paciente, checkbox y todos los campos ingresados |
| Falla al refrescar pendientes despues de crear | La creacion y el voucher se mantienen; toast de advertencia y paciente conservado |

## Pruebas

### Server Action

`getVoucherSolicitud.action.test.ts` cubrira:

- acceso con `solicitudes.ver`;
- acceso con `historial.ver`;
- rechazo sin ninguno de esos permisos;
- rechazo de funcionario sin centro;
- filtro simultaneo por identificador, centro y estado `En Curso`;
- mensaje especifico si la solicitud existe en el centro pero ya no esta `En Curso`;
- mensaje generico para solicitud inexistente o de otro centro;
- mapeo exacto de fecha original, RUT, tipo, motivo, disponibilidad, telefonos y centro; y
- auditoria de la lectura.

### Voucher reutilizable

Las pruebas del componente verificaran:

- que conserva los campos y textos actuales;
- que no muestra un campo Profesional;
- que usa la fecha y hora de `fecha_inicio`;
- campos opcionales con y sin valor; y
- cierre e impresion mediante los controles existentes.

### Crear solicitud y pendientes

`IngresarSolicitudView.test.tsx` y `PendientesCascada.test.tsx` cubriran:

- checkbox desmarcado al iniciar;
- accion de reimpresion por cada solicitud pendiente;
- estado de carga y apertura del voucher;
- creacion exitosa con el checkbox desmarcado: reinicio completo;
- creacion exitosa con el checkbox marcado: conserva paciente y limpia Tipo, Motivo,
  Disponibilidad y Descripcion;
- actualizacion de pendientes que incorpora la solicitud creada;
- error de creacion sin limpieza de datos; y
- cambio de RUT que devuelve el checkbox a desmarcado.

### Historial

`HistorialPacienteView.test.tsx` cubrira:

- boton visible para solicitudes `En Curso`;
- boton ausente para solicitudes realizadas, rechazadas o en cualquier otro estado;
- obtencion y apertura del voucher reutilizable;
- boton deshabilitado durante la carga; y
- error sin alterar el historial ya cargado.

## Criterios de aceptacion

1. Una solicitud `En Curso` se puede reimprimir desde Pendientes del paciente y desde Historial del
   paciente usando el mismo comprobante actual.
2. Una solicitud que no esta `En Curso` no ofrece la accion en Historial y tampoco entrega un voucher
   si se invoca directamente la Server Action.
3. La reimpresion conserva fecha y hora originales y no incorpora el profesional ni nuevos campos.
4. El checkbox **Mantener usuario** aparece desmarcado por defecto.
5. Con el checkbox marcado, una creacion exitosa conserva al paciente y actualiza sus pendientes.
6. Despues de toda creacion exitosa se vacian Tipo de solicitud, Motivo, Disponibilidad de llamada y
   Descripcion.
7. Con el checkbox desmarcado, una creacion exitosa reinicia tambien el paciente y el RUT.
8. Un error de creacion no limpia el formulario.
9. Las validaciones de permisos, centro, estado y duplicados siguen aplicandose en el servidor.

## Fuera de alcance

- Reimprimir solicitudes realizadas, rechazadas o en otro estado.
- Cambiar el contenido o el diseno visual del comprobante existente.
- Agregar el profesional u otros campos al voucher.
- Descargar el voucher como PDF o almacenarlo como archivo.
- Guardar **Mantener usuario** como preferencia permanente.
- Alterar las reglas de duplicidad de solicitudes.
- Modificar el esquema de base de datos o crear permisos nuevos.
