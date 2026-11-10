# Mejoramiento del ingreso de solicitudes para el orientador

Fecha: 2026-11-10  
Rama: `mejoramiento_orientador`  
Origen: requerimiento del equipo (10/11/2026).

## Problema

La vista **Crear Solicitud** bloquea una nueva solicitud cuando el paciente ya tiene otra solicitud
`En Curso` con la misma combinacion de tipo y motivo. Esta proteccion es correcta en general, pero
impide registrar atenciones activas simultaneas que son validas dentro de los programas **Control
cronico respiratorio** y **Control de salud mental**.

Ademas, el resumen del paciente confirmado no muestra su edad. El orientador debe deducirla desde la
fecha de nacimiento o abrir la edicion del usuario, lo que agrega friccion al ingreso y dificulta
detectar datos incompletos.

## Objetivo

1. Permitir multiples solicitudes `En Curso` para un mismo paciente cuando el tipo de solicitud sea
   **Control cronico respiratorio** o **Control de salud mental**, cualquiera sea el motivo asociado.
2. Conservar sin cambios el bloqueo de duplicados para todos los demas tipos de solicitud.
3. Mostrar la edad del paciente en el resumen de **Crear Solicitud**, calculada en el frontend desde
   su fecha de nacimiento.
4. Mostrar `Falta fecha de nacimiento` cuando el paciente no tenga ese dato registrado.

La mejora mantiene la premisa de integralidad centrada en el paciente: el orientador puede registrar
las necesidades concurrentes permitidas mientras sigue viendo los pendientes existentes y recibe una
advertencia explicita si falta un dato demografico relevante.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Alcance de la excepcion | Omitir el bloqueo para los dos programas indicados, incluso si coincide el motivo | El requerimiento permite una nueva solicitud aunque ya existan una o mas activas y establece que aplica a cualquiera de sus motivos. |
| Identificacion de programas | Comparar el nombre normalizado del tipo de solicitud | Evita acoplar la regla de negocio a IDs de catalogo que pueden variar entre ambientes. |
| Normalizacion | Ignorar mayusculas, minusculas, tildes y espacios laterales | Tolera la diferencia entre el nombre funcional y la capitalizacion de los datos de referencia. |
| Capas de validacion | Aplicar la misma regla en frontend y Server Action | La interfaz entrega feedback inmediato, pero el servidor conserva la autoridad ante llamadas directas y concurrencia. |
| Calculo de edad | Reutilizar `calcularEdad` en el componente cliente | Ya implementa el calculo correcto antes y despues del cumpleaños y acepta `Date`, texto o `null`. |
| Fecha de referencia | Fecha local al momento de renderizar el resumen | La edad mostrada debe corresponder al dia en que se crea la solicitud. |
| Persistencia | Sin cambios de esquema ni datos | La regla depende de catalogos existentes y la edad es informacion derivada. |

## Alcance funcional

### 1. Excepcion de duplicidad por programa

Al seleccionar **Control cronico respiratorio** o **Control de salud mental**, el formulario no
mostrara la alerta **Solicitud duplicada** ni deshabilitara **Guardar solicitud** a causa de una
solicitud activa previa. Esto aplicara a todos los motivos activos asociados al programa.

La excepcion permite crear una nueva solicitud aun cuando ya exista una solicitud `En Curso`:

- del mismo programa y el mismo motivo;
- del mismo programa y otro motivo; o
- entre varias solicitudes activas previas del programa.

Para cualquier otro tipo de solicitud se conserva la regla actual: una solicitud `En Curso` con el
mismo tipo y motivo bloquea un nuevo ingreso hasta que deje de estar activa.

La lista **Pendientes del paciente** seguira mostrando todas las solicitudes y citas vigentes. La
excepcion solo cambia la posibilidad de guardar; no oculta, cierra ni modifica pendientes existentes.

### 2. Edad en el resumen del paciente

Despues de buscar y confirmar un paciente, el resumen de informacion incorporara un campo **Edad**.
Si existe una fecha de nacimiento valida, mostrara:

`Edad: N años`

El valor se calculara en el frontend considerando si el cumpleaños del año en curso ya ocurrio. No
se guardara la edad calculada ni se solicitara al servidor un campo derivado nuevo.

Si `fecha_nacimiento` es `null`, esta vacia o no puede convertirse en una fecha valida, el resumen
mostrara exactamente:

`Falta fecha de nacimiento`

El mensaje no bloquea la creacion de la solicitud. El boton **Editar usuario** permanecera disponible
para completar o corregir el dato mediante el flujo existente.

## Diseno tecnico

### 1. Regla compartida de programas exceptuados

El modulo `solicitudes` incorporara una funcion pura que determine si un nombre de tipo de solicitud
admite solicitudes activas multiples. La lista permitida contendra exclusivamente:

- `Control cronico respiratorio`;
- `Control de salud mental`.

La funcion normalizara el texto antes de compararlo. No se usaran IDs, coincidencias parciales ni
palabras clave generales como `respiratorio` o `salud mental`, porque podrian exceptuar catalogos no
autorizados.

Esta funcion se ubicara junto a la logica de duplicados del modulo y sera consumible tanto por el
componente cliente como por la Server Action.

### 2. Validacion en `IngresarSolicitudView`

El componente obtendra desde `catalogos.tiposSolicitud` el nombre correspondiente al tipo seleccionado.
Antes de buscar una coincidencia en `pendientes.solicitudesPendientes`, evaluara la funcion compartida:

- si el tipo esta exceptuado, `solicitudDuplicada` sera `null`;
- si no esta exceptuado, se ejecutara `buscarSolicitudDuplicada` con la combinacion actual de tipo y
  motivo, igual que hoy.

No se alterara el contrato de `getPendientes`, porque el catalogo ya entrega el nombre requerido.

### 3. Validacion en `crearSolicitud`

La consulta que valida el tipo de solicitud incluira `nombre_tipo_solicitud` en su seleccion. Dentro
de la transaccion, despues de bloquear la fila del paciente, la accion aplicara la misma funcion:

- para un tipo exceptuado, no consultara ni bloqueara por duplicidad y continuara con la creacion;
- para los demas tipos, mantendra la busqueda actual por paciente, tipo, motivo y estado `En Curso`.

La validacion del tipo activo y habilitado para el centro, la validacion del motivo, el bloqueo del
paciente, la creacion transaccional y la auditoria se conservaran. Omitir la consulta de duplicidad
para los dos programas no elimina el bloqueo de fila: este sigue protegiendo la secuencia de creacion
y las demas invariantes del flujo.

### 4. Calculo y presentacion de edad

`IngresarSolicitudView` reutilizara `calcularEdad` desde las utilidades del modulo. El subcomponente
que renderiza el resumen del usuario calculara el valor a partir de `usuario.fecha_nacimiento`.

La presentacion seguira el patron visual existente del resumen, sin introducir componentes nuevos ni
cambiar el modal de edicion. El texto de ausencia se mostrara en el lugar del valor de edad y sera
visible sin abrir el modal.

## Seguridad, concurrencia y auditoria

- La excepcion visual no reemplaza la validacion del servidor.
- Solo se exceptuan los dos nombres completos definidos por la regla de negocio.
- La Server Action seguira exigiendo `solicitudes.crear`, centro activo, usuario existente, tipo
  habilitado y motivo valido.
- La transaccion seguira bloqueando al paciente antes de crear la solicitud.
- Las creaciones permitidas conservaran la auditoria exitosa vigente.
- Los duplicados bloqueados de otros programas conservaran la auditoria fallida y el mensaje actual.
- No se agregan permisos, migraciones ni cambios al esquema Prisma.

## Errores y casos limite

| Caso | Resultado |
| --- | --- |
| Programa exceptuado con una o mas solicitudes `En Curso` | Permite guardar una nueva solicitud. |
| Programa exceptuado con el mismo motivo activo | Permite guardar una nueva solicitud. |
| Otro programa con el mismo tipo y motivo `En Curso` | Conserva alerta y bloqueo actuales. |
| Nombre de catalogo con distinta capitalizacion o tildes | La normalizacion reconoce los dos nombres autorizados. |
| Nombre parecido, pero no igual al autorizado | Conserva el bloqueo normal de duplicados. |
| Fecha de nacimiento valida | Muestra la edad cumplida en años. |
| Cumpleaños aun no ocurrido este año | Resta un año al calculo base. |
| Fecha ausente o invalida | Muestra `Falta fecha de nacimiento` y no bloquea el ingreso. |

## Pruebas

### Utilidad de duplicados

Las pruebas unitarias cubriran:

- reconocimiento de `Control cronico respiratorio`;
- reconocimiento de `Control de salud mental`;
- equivalencia con mayusculas y tildes;
- rechazo de nombres parciales o de otros programas; y
- conservacion de la busqueda exacta por tipo y motivo para programas no exceptuados.

### Server Action

`crearSolicitud.action.test.ts` cubrira:

- creacion respiratoria aunque exista una solicitud activa del mismo tipo y motivo;
- creacion de salud mental aunque exista una solicitud activa del mismo tipo y motivo;
- aplicacion de la excepcion con distintos motivos de esos programas;
- omision de la consulta de duplicidad para tipos exceptuados;
- conservacion del rechazo para otro tipo con igual motivo; y
- conservacion del bloqueo de paciente y la creacion dentro de la transaccion.

### Vista Crear Solicitud

`IngresarSolicitudView.test.tsx` cubrira:

- ausencia de alerta y boton habilitado para respiratorio con un pendiente coincidente;
- ausencia de alerta y boton habilitado para salud mental con un pendiente coincidente;
- alerta y boton deshabilitado para un programa no exceptuado;
- edad correcta cuando el cumpleaños ya ocurrio;
- edad correcta cuando el cumpleaños aun no ocurre; y
- texto exacto `Falta fecha de nacimiento` cuando no existe fecha.

Las pruebas de fecha usaran tiempo controlado para no depender del dia en que se ejecute la suite.

## Criterios de aceptacion

1. Un paciente puede tener multiples solicitudes `En Curso` de **Control cronico respiratorio**.
2. Un paciente puede tener multiples solicitudes `En Curso` de **Control de salud mental**.
3. La posibilidad aplica a todos los motivos asociados y tambien cuando se repite el mismo motivo.
4. Los demas tipos de solicitud conservan el bloqueo por combinacion de tipo y motivo.
5. La excepcion funciona en la interfaz y en llamadas directas a la Server Action.
6. El resumen del paciente muestra `Edad: N años` calculada desde `fecha_nacimiento`.
7. Sin fecha valida, el resumen muestra exactamente `Falta fecha de nacimiento`.
8. La ausencia de fecha no impide crear ni gestionar la solicitud.
9. No se modifican el esquema de base de datos, los permisos ni los catalogos.

## Fuera de alcance

- Permitir duplicados para otros programas o mediante coincidencias parciales de nombres.
- Cambiar la definicion de solicitud activa, que sigue siendo `estado_solicitud = "En Curso"`.
- Cerrar, combinar u ocultar solicitudes existentes.
- Modificar motivos o tipos de solicitud en los catalogos.
- Guardar la edad en la base de datos o recalcular datos historicos.
- Hacer obligatoria la fecha de nacimiento para crear una solicitud.
- Cambiar el formulario o las reglas de edicion del usuario.
