# Mejoras transversales: REQ-8, REQ-13, REQ-21 y REQ-25

Fecha: 2026-11-10.
Estado: especificación para revisión del usuario; implementación no iniciada.

## Propósito y alcance

Facilitar la revisión de solicitudes, la localización de antecedentes por texto y la
identificación del paciente durante la gestión, el contacto telefónico y la consulta
de su historial. «General» en el levantamiento significa alcance transversal; no se
crea un módulo con ese nombre.

El diseño conserva el flujo ingreso → gestión → contacto y la mirada integral del
paciente. Los cambios se integran a los espacios existentes y no sustituyen las vistas
de otras solicitudes o citas pendientes del mismo paciente.

| Requerimiento | Módulos y superficies | Acuerdo |
| --- | --- | --- |
| REQ-8 | Gestor, dentro de Solicitudes; Comunicador | Ordenar las filas de la página actual mediante encabezados. |
| REQ-13 | Gestor y Comunicador | Buscar texto en todas las páginas del conjunto autorizado y filtrado. |
| REQ-21 | Historial | Mostrar fecha y hora agendadas en el resumen de citas aceptadas exclusivamente. |
| REQ-25 | Todas las superficies de identificación de pacientes, incluidos documentos, excepto vouchers | Nombre legal y debajo «Nombre social: …» cuando exista. |

## Decisiones y alternativas

- **Búsqueda local frente a búsqueda en servidor:** se eligió servidor para evitar
  resultados negativos causados por buscar solo entre las 100 filas descargadas.
  Se conserva la paginación y se filtra antes de aplicarla.
- **Coincidencia textual frente a búsqueda semántica:** se utiliza coincidencia de
  texto; no se incorpora IA, servicio externo, sinónimos ni tolerancia a errores.
- **Ordenamiento local frente a ordenamiento global:** se eligió local, independiente
  del alcance global de la búsqueda. El servidor conserva su priorización actual.
- **Presentación de nombres:** se mantiene el nombre legal como principal y se
  acompaña del nombre social explícitamente etiquetado, sin reemplazarlo.

Las siguientes reglas de detalle concretan esos acuerdos para revisión de este
documento: coincidencia de frase o fragmento literal, ciclo de ordenamiento con retorno
al orden original y selección de la última aceptación para datos históricos repetidos.

## REQ-8: ordenamiento en la página actual

- Gestor: fecha de ingreso (`fecha_inicio`) y nombre del tipo de solicitud.
- Comunicador: fecha estimada de atención (`fecha_estimada_atencion`) y estado.
- Cada encabezado habilitado permite ascendente, descendente y retorno al orden
  recibido del servidor. Solo hay un criterio manual activo por tabla.
- Las fechas se comparan como valores temporales; tipo y estado, alfabéticamente en
  español. Los valores ausentes quedan al final en ambas direcciones. Los empates
  conservan el orden recibido del servidor.
- Mostrar indicador visual, controles accesibles por teclado y `aria-sort` en el
  encabezado correspondiente. Una ayuda breve indica «Ordena esta página».
- Ordenar una copia de las filas descargadas: no mutar la respuesta ni emitir una
  consulta, cambiar la página o modificar el total por ordenar.
- El criterio se conserva al paginar y refrescar dentro de la misma vista; se aplica
  únicamente al nuevo conjunto descargado. Limpiar filtros también restaura el orden
  original. No se persiste entre visitas ni en base de datos.
- En Comunicador, «Siguiente» usa la secuencia visible y conserva sus reglas de
  actualización, foco y manejo de citas cerradas concurrentemente. La presentación
  no debe afirmar que el orden visible es por prioridad si hay un criterio manual.

## REQ-13: búsqueda en todas las páginas

### Comportamiento

- En Gestor se consulta únicamente `Solicitud.descripcion`.
- En Comunicador se consulta únicamente `Cita.observacion` (observación clínica).
- Se excluyen observaciones de llamadas, motivos de rechazo y otros campos de texto.
- Campo etiquetado según el contenido buscado. Se ejecuta al pulsar Buscar o Enter,
  dentro del mecanismo de aplicación de filtros existente, no por cada tecla.
- El texto se combina con AND con los demás filtros, el centro activo y las
  condiciones actuales de pertenencia a cada bandeja.
- Buscar reinicia la página a 1. Paginar y refrescar mantienen el texto aplicado;
  limpiar filtros lo elimina. Se distingue texto editado de texto aplicado.
- Un texto vacío o formado solo por espacios equivale a no filtrar. Se recortan
  espacios exteriores; el límite propuesto es 200 caracteres, validado con Zod.
- Coincidencia por fragmento literal, incluyendo frases: no se separa en palabras
  ni se interpreta como operadores. `%`, `_` y el carácter de escape deben buscarse
  literalmente, mediante escape explícito y parámetros SQL seguros.
- La búsqueda no distinguirá mayúsculas y minúsculas ni vocales con y sin tilde.
  El plan comprobará la intercalación real de ambas columnas y definirá una
  comparación compatible de forma explícita si la existente no cumple ese contrato.
- El conteo y la consulta de filas usan exactamente los mismos criterios; el total
  representa coincidencias en todas las páginas. Los nulos no coinciden.
- Se mantienen 100 filas por página, sin descargar el conjunto completo al cliente.

### Implementación prevista y costo

Extender los schemas de filtros y las acciones actuales. En Gestor hay dos rutas de
consulta, Prisma y SQL cuando se filtra por edad: ambas deben aplicar el mismo filtro
textual y el mismo escape. En Comunicador extender las condiciones SQL parametrizadas.

Revisar el conteo de Comunicador y evitar joins cuando no sean necesarios para los
filtros activos. La eliminación de un join requiere comprobar la equivalencia del
resultado y las relaciones de datos; no basta con que una muestra coincida. No se
incluye una reestructuración general de consultas ni migración de índices por defecto.

### Evidencia de producción

Consultas de solo lectura realizadas el 2026-11-10 por SSH, con resultados agregados.
No se modificó la base de datos. Los conteos exactos de tablas difieren de las
estimaciones de `information_schema`, por lo que se usan los exactos aquí.

| Medida | Solicitudes | Citas |
| --- | ---: | ---: |
| Total histórico | 281.239 | 311.509 |
| Pendientes de la bandeja correspondiente | 13.934 | 52.883 |
| Mayor cantidad pendiente en un centro | 3.655 | 15.125 |
| Longitud media del texto, entre valores no nulos | 57 caracteres | 65 caracteres |

Los índices incluyen `(centro_id, accion)` en Solicitudes y `(centro_id, estado_cita)`
en Citas. No hay índices FULLTEXT en esas tablas. Los índices de ámbito ayudan a
reducir candidatos; no indexan directamente una coincidencia `%fragmento%`.

En los centros con mayor volumen, usando los fragmentos `control`, `dental` y uno sin
coincidencias:

| Consulta medida | Gestor | Comunicador |
| --- | --- | --- |
| Conteo con texto | 41–64 ms | 383–736 ms con joins |
| Página simplificada con texto y orden vigente | 39–60 ms | 384–508 ms |

El conteo base de Comunicador con joins tardó 3.341 ms en una muestra y otra ejecución
superó el límite preventivo de 5 segundos. El conteo base sin joins tardó 80 ms.
En Gestor hubo una primera lectura del conteo base de 2.081 ms, frente a 75 ms en
la repetición. Por tanto, los tiempos calientes no son garantías de latencia.

Las páginas medidas proyectaban una constante y mantenían filtros, joins y orden;
no incluían todos los campos, subconsultas de llamadas, serialización, auditoría,
red ni renderizado de la aplicación. No se realizó una prueba de concurrencia.

El servidor reportó aproximadamente 11,8 GB de memoria disponible y carga de 0,4
en esa muestra. Esto no equivale a una medición de capacidad bajo carga.

Estimación preliminar de implementación de REQ-13: **2–3 jornadas** para ambos módulos,
incluyendo revisión del conteo y validación. La muestra no justifica ampliar el
servidor ni contratar servicios; no permite estimar un costo monetario mensual sin
tráfico, concurrencia y condiciones de facturación. Validar las consultas completas
antes de publicar y revisar índices si la evidencia posterior lo exige.

## REQ-21: fecha y hora de citas aceptadas

- Mostrar «Fecha y hora agendadas: …» directamente en el resumen de la cita en
  Historial, sin exigir desplegar llamadas.
- Aplicar exclusivamente cuando `estado_cita` sea `Cita Aceptada`, usando las
  constantes existentes. Otros estados no muestran etiqueta ni mensaje de ausencia.
- Fuente: `Llamada.hora_agendada` de la última llamada cuya respuesta sea
  `Cita Aceptada`. Ordenar por fecha de llamada y desempatar por ID para resultados
  deterministas. Si esa aceptación no tiene fecha agendada, mostrar
  «Fecha y hora no registradas»; no recuperar silenciosamente una agenda anterior.
- No inferir desde fecha estimada, fecha de llamada o fecha de cierre.
- Mostrar fecha y hora en formato español de Chile y zona `America/Santiago`,
  incluyendo su ajuste estacional. Verificar con valores persistidos y la convención
  de almacenamiento del proyecto para evitar desplazamientos horarios.
- El historial ya consulta y transporta `hora_agendada`: agregar la resolución del
  dato a nivel de cita sin cambiar las reglas de aceptación ni cerrar citas.

## REQ-25: identificación del paciente

- En cada presentación de nombre legal del paciente: conservarlo y mostrar debajo
  «Nombre social: …» cuando `Usuario.nombre_social` tenga contenido no vacío.
- Omitir completamente la línea si el valor es nulo, vacío o solo espacios.
- Incluir Ingreso, tabla y detalle de Gestor, tabla y modal de llamada de Comunicador,
  cabecera de Historial y las demás superficies existentes que identifiquen por nombre
  al paciente. Los campos de edición mantienen sus etiquetas y función actuales.
- Incluir documentos que presenten el nombre legal, con excepción de los vouchers.
  Por privacidad, el voucher conserva su contenido actual: no se agrega nombre legal
  ni nombre social, tanto al emitirlo como al reimprimirlo.
- Revisar el inventario completo de presentaciones del paciente al elaborar el plan;
  los nombres de funcionarios, roles, centros y catálogos no corresponden a este cambio.
- Extender las proyecciones y tipos de Comunicador e Historial con el nombre
  social; no depender de abrir un formulario de edición para obtenerlo.
- Usar una presentación compartida pequeña para los nombres en pantallas de varios
  módulos, ubicada en `shared`. Los documentos incluidos respetan el mismo contenido.
  Los datos y consultas permanecen en sus módulos; no se agregan campos de nombre
  al contrato de datos del voucher.
- Conservar las reglas de autorización y centro. En Historial, si el paciente no
  tiene solicitudes en el centro autorizado, tampoco se revela su nombre social.

## Errores, seguridad y límites

Server Actions con validación Zod, permisos existentes, `ResultadoAccion` y auditoría
de consultas según las convenciones actuales. Los errores se presentan mediante el
feedback existente, sin exponer SQL ni datos de conexión. Las respuestas obsoletas
de búsquedas no pueden reemplazar resultados de filtros o centro más recientes.

No se crean permisos, tablas ni un módulo General. No se amplía la búsqueda a todo
el histórico o a otros centros. No se modifica la prioridad clínica ni se incorpora
ordenamiento global. Los vouchers quedan excluidos de la incorporación de nombres
por privacidad, incluyendo su emisión y reimpresión.

## Validación y criterios de aceptación

1. Ordenar cada columna acordada en ambas direcciones y restaurar el orden original;
   verificar fechas nulas, empates, conservación al paginar y ausencia de consultas
   adicionales. «Siguiente» sigue las filas visibles en Comunicador.
2. Encontrar desde la primera página una coincidencia originalmente situada en otra;
   comprobar total y paginación, filtros combinados, limpieza y ausencia de resultados.
3. Comprobar búsqueda en ambas rutas de Gestor, con y sin filtro de edad; texto vacío,
   mayúsculas, tildes y caracteres SQL literales. Verificar aislamiento por centro.
4. Probar que el conteo optimizado de Comunicador conserva resultados con los filtros
   de paciente y solicitud que requieran relaciones y no elimina condiciones de ámbito.
5. Cita aceptada: fecha agendada visible sin desplegar llamadas; dato ausente: mensaje
   acordado. Otros estados: ausencia total del campo, aunque haya llamadas previas
   aceptadas. Cubrir varias aceptaciones y conversión horaria.
6. Nombre social presente, ausente y extenso en cada superficie incluida en el inventario.
   Mantener nombre legal, RUT y restricciones de acceso. Comprobar que ni la emisión
   ni la reimpresión del voucher incorporan nombre legal o nombre social.
7. Medir consultas completas de búsqueda con datos representativos de los centros de
   mayor volumen, documentando latencia y plan de ejecución; comparar con la base actual.
8. Ejecutar pruebas pertinentes de Vitest/Testing Library y los checks del proyecto
   (lint, tipos y build) antes de declarar terminada la implementación. Revisar
   visualmente tablas, modales, historial y formato de impresión.

## Secuencia sugerida para el plan posterior

1. Inventariar superficies de identificación y concretar consultas y contratos de datos.
2. REQ-25 y REQ-21: completar contexto del paciente e historial.
3. REQ-13: búsqueda en servidor y revisión acotada del conteo.
4. REQ-8: orden local y adaptación de «Siguiente» a la secuencia visible.
5. Validación integrada, impresión y mediciones de rendimiento.

Esta secuencia no sustituye el plan de implementación. El siguiente paso, tras la
revisión y aprobación de esta especificación, es elaborar dicho plan con writing-plans.
