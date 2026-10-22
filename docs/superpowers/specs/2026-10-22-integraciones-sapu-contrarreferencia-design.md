# Integraciones externas: derivaciones SAPU y contrarreferencia

Fecha: 2026-10-22
Rama: `feat/integraciones-sapu-contrarreferencia`
Antecedente: [Integraciones externas: Simple y derivación interna](2026-10-21-integraciones-externas-design.md).
Esta spec extiende el mismo módulo `integraciones` con dos clientes más.

## Problema

Después del corte del 22/10/2026 quedaron dos sistemas GAS que siguen escribiendo por JDBC en la base de AppSheet
(`gestionDemanda`, VPS 46.202.151.191):

| Sistema | Repo | Disparo | Escribe hoy |
| --- | --- | --- | --- |
| Derivaciones SAPU | `cormuval/derivaciones-sapu-gestion-demanda` | Un funcionario sube un Excel SAPU en la web app | N solicitudes por carga (`dominio/carga_sapu/repositorio_mysql.js`) |
| Gestión de contrarreferencia | `cormuval/gestion-contrarreferencias-aps` | El contralor (o UAPO / administrador) valida un caso | 1 solicitud; si es "Repetición de receta", además 1 cita; crea o actualiza el paciente (`syncContrarreferenciaToGestionDemanda_` en `Código.js`) |

Al 22/10 09:50 no se había perdido nada: la última carga SAPU en AppSheet es del 19/10 y la última
contrarreferencia del 21/10 16:03, ambas ya migradas. Pero:

- Lo que se escriba desde ahora en AppSheet no llega a la app.
- **Contrarreferencia hace el envío dentro de la transacción del contralor.** Al retirar AppSheet (23/10) el
  envío fallará y la validación se deshará: los contralores no podrán validar los casos que generan solicitud.
- SAPU no crea pacientes: en la base nueva la FK `solicitudes.rut_usuario → usuarios.rut` rechazaría las filas
  de pacientes sin registro.
- Ambos envían `estado_solicitud = "En curso"`; la app usa `"En Curso"`.
- `Código.js` de contrarreferencia tiene usuario y contraseña de la base de AppSheet escritos en el código.

## Objetivo

Todo caso que SAPU o contrarreferencia envíen a gestión de la demanda queda en `gestion_demanda`, visible y
gestionable en la app, sin pérdidas y sin duplicados. La app sigue siendo la única que escribe en su base: los
sistemas externos le envían los datos por HTTPS, igual que Simple y la derivación interna.

## Decisiones

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Conexión | Dos rutas nuevas en el módulo `integraciones`: `/api/integraciones/sapu` y `/api/integraciones/contrarreferencia` | Mismo esquema ya probado; reglas de cada origen aisladas, sin tocar las rutas en producción. |
| Alternativas descartadas | Endpoint genérico con `origen`; JDBC de GAS a la base nueva | El genérico llena el código de `if (origen)` y toca lo recién liberado; el JDBC rompe "solo la app escribe" y obliga a abrir MySQL. |
| Autenticación | Una api-key por cliente: `INTEGRACION_KEY_SAPU`, `INTEGRACION_KEY_CONTRARREFERENCIA` | Se puede revocar una sin afectar a la otra; la auditoría sabe quién escribió. |
| Contrarreferencia ante falla | Acoplado: si la app no confirma, se deshace la validación del contralor y ve el error | Igual que hoy; nunca queda un caso validado sin su solicitud. |
| Lote SAPU | Cada solicitud se guarda en su propia transacción; resultado por fila | Una fila mala no bloquea el archivo; recargar el mismo Excel no duplica. |
| Reglas de selección y centro | Se quedan en GAS (filtros, IDs, homologación de centro, motivo, modo) | Catálogos ya probados; la app usa el `centro_id` que recibe. |
| Valores fijos | Los pone la app (tipo, funcionario, estado, prioridades) | Mismo reparto que la derivación interna. |
| Paciente inexistente | Se crea con el nombre que llegue, o "Sin registro" | Igual que Simple y derivación interna; se completa desde "Editar usuario". |
| Duplicado en contrarreferencia | 409 sin crear nada (tampoco la cita) | Solicitud y cita se crean juntas; el GAS trata el 409 como éxito. |
| Centro 13 (contrarreferencia) | Se mantiene 13 → 600 | Decisión del usuario (22/10/2026). |

## Diseño

### 1. App: módulo `integraciones`

```
src/app/api/integraciones/sapu/route.ts
src/app/api/integraciones/contrarreferencia/route.ts
src/modules/integraciones/
  schemas/   sapu.schema.ts · contrarreferencia.schema.ts
  services/  registrarCargaSapu.ts · registrarContrarreferencia.ts
```

Se reutiliza lo existente:

- `autenticarIntegracion`: `ClienteIntegracion` suma `"SAPU"` y `"CONTRARREFERENCIA"`, con sus variables.
- `procesarIntegracion` (`lib/responder.ts`): sirve tal cual para contrarreferencia. SAPU responde 200 con
  resultados por fila, así que usa el mismo flujo (autenticar → parsear → validar → registrar → auditar) con una
  respuesta propia; el plan decide si se generaliza `procesarIntegracion` o se agrega una variante.
- `asegurarPaciente`: se le agrega `apellido` opcional (hoy siempre `""`). El resto no cambia.
- `verificarCatalogos`, `ErrorIntegracion` / `aResultado`, `instanteDesdeHoraChile`, `vacioANull`.

Usuarios de auditoría: "Integración SAPU" e "Integración CONTRARREFERENCIA" (sale de `Integración ${cliente}`).

### 2. `POST /api/integraciones/sapu`

Cuerpo:

```json
{
  "archivo": "SAPU_octubre.xlsx",
  "solicitudes": [
    {
      "id_solicitud": "SAPU BARON-615-123456",
      "fecha_inicio": "2026-10-20 22:59:00",
      "paciente": { "rut": "12345678-9", "nombre": "Juan Pérez" },
      "motivo_id": 56,
      "descripcion": "Caso derivado desde SAPU.\nDiagnóstico: …",
      "centro_id": 615
    }
  ]
}
```

Validación del lote (falla todo el request):

| Caso | Respuesta |
| --- | --- |
| api-key ausente o distinta | 403 (igual que las rutas existentes) |
| JSON inválido, `solicitudes` no es arreglo, vacío o con más de 500 elementos | 400 |

`archivo` es opcional (texto, solo para la auditoría).

Validación por fila (solo marca esa fila como `rechazada`):

| Campo | Regla |
| --- | --- |
| `id_solicitud` | texto 1–50, recortado |
| `fecha_inicio` | `"YYYY-MM-DD HH:mm:ss"` en hora de Chile → `instanteDesdeHoraChile`; inválida = rechazo |
| `paciente.rut` | texto 1–50 |
| `paciente.nombre` | opcional; vacío → null; recortado a 50 |
| `motivo_id` | entero, debe existir en el catálogo |
| `descripcion` | opcional; vacío → null |
| `centro_id` | número o texto no vacío → texto |

Por cada fila válida, en su propia transacción:

1. `verificarCatalogos` (tipo 17, motivo, funcionario `11111112-3`). Falla → `rechazada` con el mensaje.
2. Si existe `id_solicitud` → `duplicada`, sin tocar nada.
3. `asegurarPaciente` sin actualizar contacto (crea con nombre o "Sin registro", centro = `centro_id`).
4. Crea la solicitud:

| Campo | Valor |
| --- | --- |
| `tipo_solicitud_id` | 17 |
| `motivo_id`, `descripcion`, `centro_id` | los recibidos |
| `fecha_inicio` | la recibida (convertida) |
| `fecha_validacion` | null |
| `rut_orientador`, `rut_gestor` | `11111112-3` |
| `accion` | `"En espera de validación"` |
| `estado_solicitud` | `"En Curso"` |
| `priorizacion_admin` | 3.6 |
| `disponibilidad_llamada` | `"AM/PM"` |
| `ultimo_control` | null |

Un P2002 en la creación (otro request creó el mismo id entre medio) se informa como `duplicada`.
Las filas se procesan en orden y en serie.

Respuesta 200:

```json
{
  "resultados": [
    { "id_solicitud": "…", "estado": "creada" },
    { "id_solicitud": "…", "estado": "duplicada" },
    { "id_solicitud": "…", "estado": "rechazada", "error": "motivo_id 99 no existe" }
  ],
  "totales": { "creadas": 1, "duplicadas": 1, "rechazadas": 1 }
}
```

`resultados` mantiene el orden de entrada. Si una fila no trae `id_solicitud` válido, su resultado usa
`"id_solicitud": null` y `"indice"` con la posición. Los errores internos de una fila se informan como
`"Error interno"` sin detalle (el detalle va al log del servidor).

Auditoría: un registro por request con `archivo`, totales y status. Sin RUT ni nombres.

### 3. `POST /api/integraciones/contrarreferencia`

Cuerpo:

```json
{
  "contrarreferencia_id": 4321,
  "modo": "validada",
  "paciente": { "rut": "12345678-9", "nombre": "Ana María", "apellido": "Soto Díaz", "telefono": "+56912345678" },
  "solicitud": {
    "id_solicitud": "con-1234-20261022103000",
    "fecha_inicio": "2026-10-22 10:30:00",
    "descripcion": "Registro Contrarreferencia ID: 4321 | …",
    "centro_id": 615
  },
  "cita": {
    "id_cita": "Cita-Contr-1234-20261022103000",
    "profesional_id": 8,
    "prestacion_id": 144,
    "fecha_estimada_atencion": "2026-11-11",
    "observacion": "Gestionado desde Contrarreferencia por contralor: …"
  }
}
```

Validación (falla → 400):

| Campo | Regla |
| --- | --- |
| `contrarreferencia_id` | entero positivo |
| `modo` | `"validada"` (repetición de receta) o `"pendiente"` |
| `paciente.rut` | texto 1–50 |
| `paciente.nombre`, `paciente.apellido` | opcionales; vacío → null; recortados a 50 |
| `paciente.telefono` | opcional; vacío → null (si supera 150 se descarta, como en `asegurarPaciente`) |
| `solicitud.id_solicitud` | texto 1–50 |
| `solicitud.fecha_inicio` | `"YYYY-MM-DD HH:mm:ss"` hora de Chile |
| `solicitud.descripcion` | opcional; vacío → null |
| `solicitud.centro_id` | número o texto no vacío → texto |
| `cita` | obligatoria si `validada`, prohibida (o null) si `pendiente` |
| `cita.id_cita` | texto 1–50 |
| `cita.profesional_id`, `cita.prestacion_id` | enteros, deben existir |
| `cita.fecha_estimada_atencion` | `"YYYY-MM-DD"` → DATE |
| `cita.observacion` | opcional; recortada a 500 |

En una sola transacción:

1. `verificarCatalogos` (tipo 18, sin motivo, funcionario `11111111-1`, profesional y prestación de la cita).
   Falla → 422 `CATALOGO`.
2. Duplicado → 409 `DUPLICADO` sin crear nada si existe una solicitud con ese `id_solicitud` **o** cuya
   `descripcion` contenga `Registro Contrarreferencia ID: {contrarreferencia_id}` seguido de un separador
   (` |` o fin de texto, para que el 43 no calce con el 4321).
3. `asegurarPaciente` con `actualizarContacto: true`: si no existe se crea con nombre/apellido (o "Sin registro"
   y `""`), teléfono y centro; si existe y llega teléfono, se actualiza el teléfono. No se toca el correo.
4. Crea la solicitud:

| Campo | Valor |
| --- | --- |
| `tipo_solicitud_id` | 18 |
| `motivo_id` | null |
| `descripcion`, `centro_id` | los recibidos |
| `fecha_inicio` | la recibida (convertida) |
| `fecha_validacion` | `fecha_inicio` si `validada`; null si `pendiente` |
| `rut_orientador`, `rut_gestor` | `11111111-1` |
| `accion` | `"Realizar solicitud"` si `validada`; `"En espera de validación"` si `pendiente` |
| `estado_solicitud` | `"En Curso"` |
| `priorizacion_admin` | 3.6 |
| `disponibilidad_llamada` | `"AM/PM"` |
| `ultimo_control` | null |

5. Si `validada`, crea la cita:

| Campo | Valor |
| --- | --- |
| `id_cita` | el recibido |
| `solicitud_id`, `rut_usuario`, `centro_id` | los de la solicitud |
| `rut_gestor` | `11111111-1` |
| `tipo_prestacion` | `"Agendar una hora con profesional"` |
| `profesional_id`, `prestacion_id`, `fecha_estimada_atencion`, `observacion` | los recibidos |
| `estado_cita` | `"Sin llamadas"` |
| `priorizacion_clinica` | `"Alta"` |
| `priorizacion` | 80 |
| `fecha_creacion` | `fecha_inicio` |

Respuestas: las de `procesarIntegracion` (201 / 400 / 403 / 409 / 422 / 500). Un P2002 sobre `Solicitud` o
`Cita` → 409. Auditoría: `id_solicitud`, `contrarreferencia_id` y `modo`, sin datos del paciente.

### 4. GAS: derivaciones SAPU

Repo `cormuval/derivaciones-sapu-gestion-demanda`.

- `dominio/carga_sapu/servicio.js`: `construirSolicitudSAPU` sigue igual en filtros, centro, motivo, id y
  descripción; agrega `nombre` desde la columna `Paciente` y entrega `fecha_inicio` como
  `"YYYY-MM-DD HH:mm:ss"` (formateada con la zona del script, `America/Santiago`). Deja de armar los campos
  fijos que ahora pone la app.
- `dominio/carga_sapu/repositorio_mysql.js` se reemplaza por un cliente HTTPS (`enviarCargaSapuGD`): parte las
  solicitudes en tandas de 500, hace `POST` con `UrlFetchApp` (`muteHttpExceptions`, header `api-key`) y junta
  los resultados. Reintenta hasta 3 veces ante excepción, 5xx o 429; si una tanda falla del todo, sus filas
  quedan como error `"No se pudo enviar a gestión de la demanda"` y se registra
  `[GD-SAPU-FALLIDA] <archivo> <tanda> <código>`. Reenviar la misma tanda es seguro (duplicadas).
- `interfaz/api.js` (`apiCargarSAPU`): la respuesta al frontend pasa a
  `{ ok, guardados, duplicados, omitidos, errores }`. `guardados` = creadas; `errores` incluye las filas
  rechazadas por validación local y por la app (`Fila N: …`).
- `web/js/app.html`: muestra también "ya existían".
- `registrarCargaSAPU` anota `guardados` = creadas.
- Se eliminan `getJdbcUrl`, `getMySqlConnection`, `probarConexionMySQL` y las propiedades `MYSQL_*`.
- Script Properties nuevas: `GD_API_URL = https://gd.cmvalparaiso.cl`, `GD_API_KEY` = key SAPU.

### 5. GAS: gestión de contrarreferencia

Repo `cormuval/gestion-contrarreferencias-aps`.

- `syncContrarreferenciaToGestionDemanda_(record)` mantiene su firma, sus tres llamadas y las reglas de salto
  (indicación "alta"/"repetida"), de centro (`homologateGestionDemandaCentroId_`, sin cambios), de id y de
  descripción. En vez de JDBC arma el cuerpo de la sección 3 y lo envía con `UrlFetchApp`:
  - `modo = "validada"` si `isRecetaRepeticionGestionDemanda_`, si no `"pendiente"`.
  - Nombre y apellido con `splitPacienteNameForGestionDemanda_`.
  - `fecha_inicio` = `fechaRegistroContralor` normalizada a `"YYYY-MM-DD HH:mm:ss"` (quita la fracción `.0`
    que agrega `getString`).
  - `fecha_estimada_atencion` = hoy + 20 días como `"YYYY-MM-DD"`.
  - Cita con profesional 8, prestación 144 y la observación actual.
- 201 → `{ created: true, idSolicitud }`; 409 → `{ skipped: true, reason: "duplicate", idSolicitud }`.
  Cualquier otro resultado, tras los reintentos (3, ante excepción / 5xx / 429), lanza
  `Error("No se pudo registrar la solicitud en gestión de la demanda: <mensaje>")` y registra
  `[GD-CONTRARREFERENCIA-FALLIDA] <contrarreferencia_id> <código>`; el `catch` existente hace `rollback` y el
  contralor ve el error.
- Se eliminan `getGestionDemandaConnection_`, `GESTION_DEMANDA_DB_INLINE_` (credenciales en código) y las
  funciones JDBC sobre `usuarios`, `solicitudes` y `citas` de gestionDemanda.
- Script Properties nuevas: `GD_API_URL`, `GD_API_KEY` = key contrarreferencia. Se borran las
  `GESTION_DEMANDA_DB_*`.

El timeout de `UrlFetchApp` mantiene abierta la transacción JDBC propia de contrarreferencia mientras dura el
envío; con la app respondiendo en < 1 s no es un problema, y es el mismo comportamiento que hoy con el JDBC.

## Errores

| Situación | SAPU | Contrarreferencia |
| --- | --- | --- |
| api-key inválida | 403; GAS informa error de toda la carga | 403; se deshace la validación |
| Fila / cuerpo inválido | fila `rechazada` | 400; se deshace la validación |
| Catálogo inexistente | fila `rechazada` | 422; se deshace la validación |
| Ya existe | fila `duplicada` | 409; GAS lo toma como éxito |
| App caída / 5xx | 3 reintentos; filas de la tanda con error | 3 reintentos; se deshace la validación |

## Tests (Vitest, app)

- `sapu.schema`: lote vacío, > 500, fila inválida no invalida el lote, fecha imposible, nombre en blanco → null,
  centro número → texto.
- `registrarCargaSapu`: creada / duplicada / rechazada por catálogo en el mismo lote, orden de resultados,
  P2002 → duplicada, valores fijos de la solicitud, paciente nuevo con nombre o "Sin registro", paciente
  existente sin cambios.
- `contrarreferencia.schema`: `validada` sin cita, `pendiente` con cita, fechas inválidas, recortes.
- `registrarContrarreferencia`: validada crea solicitud + cita con los valores fijos; pendiente solo solicitud;
  duplicado por id y por `contrarreferencia_id` en la descripción (43 no calza con 4321); paciente nuevo con
  apellido; paciente existente con teléfono actualizado; catálogo → `CATALOGO`.
- Rutas: 403 sin key, 400 con lote mal formado, 200 con totales (SAPU), 201/409 (contrarreferencia).

GAS: un script de prueba por repo (como `scripts/test_payload_derivacion_gd.js` en informe diario) que arme el
cuerpo desde un registro de ejemplo y verifique formato de fechas, modo y centro.

## Puesta en marcha

1. Merge del PR de la app; agregar `INTEGRACION_KEY_SAPU` y `INTEGRACION_KEY_CONTRARREFERENCIA` a
   `ENV_PRODUCTION` (y a `~/integraciones-keys.env` del server) y redesplegar.
2. Prueba con `curl` contra producción: una carga SAPU de 1 fila de prueba y una contrarreferencia de prueba
   (centro 501); verificar y borrar.
3. Script Properties en ambos GAS (las carga el usuario), `clasp push` y nuevo deployment de cada web app
   sobre su deployment de producción.
4. Prueba real: un contralor valida un caso de receta y otro pendiente; una carga SAPU pequeña. Confirmar en
   `logs` ("Integración SAPU" / "Integración CONTRARREFERENCIA").
5. Conciliación: revisar en AppSheet si entraron solicitudes tipo 17 o 18 después del 21/10 16:03 y copiarlas
   antes del retiro.

Debe quedar en producción antes del retiro de AppSheet (23/10/2026).

## Fuera de alcance

- Cambiar las reglas de selección SAPU (centros excluidos, diagnósticos) o la homologación de centros.
- El resumen de contrarreferencias atrasadas (`resumen_contrarreferencia.js`): lee solo la base de
  contrarreferencia.
- Crear la cita de una solicitud de receta ya existente sin cita (comportamiento previo que no se replica).
- Rotar la contraseña de la base de AppSheet expuesta en `Código.js` (se retira la base).
