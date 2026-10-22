# Integraciones externas: Simple y derivación interna

Fecha: 2026-10-21
Rama: `feat/integraciones-externas`
Origen: puesta en marcha del jueves 22/10/2026. Simple y el informe diario escriben hoy directo en la
base de AppSheet (`gestionDemanda`, VPS 46.202.151.191). Desde el corte deben escribir en `gestion_demanda`.

## Problema

Dos sistemas externos crean solicitudes en la base de AppSheet:

| Origen | Código actual | Conexión | Escribe |
| --- | --- | --- | --- |
| Simple | gi (`gestion-informacion-das`): `src/app/api/data/solicitud-simple/route.ts` | `mysql2` a `gestionDemanda` (hardcodeado) | solicitud + contacto del paciente |
| Derivación interna | GAS (`informe-diario-2.0`): `back-end/informe_diario/derivacionInternasGD.js` | JDBC directo a `gi.cmvalparaiso.cl:3306` | validada: solicitud + cita; pendiente: solo solicitud |

Apuntarlos a la base nueva no basta:

- **Red:** el MySQL del server DAS solo acepta conexiones de la LAN y de Tailscale. gi corre en el VPS (fuera del
  tailnet) y GAS se conecta desde IPs de Google. Además, MySQL 8.4 no trae `mysql_native_password`, que usa hoy GAS.
- **Datos:**
  - Ambos envían `estado_solicitud = "En curso"`. `verificarSolicitudPendiente` compara `"En Curso"` exacto, así
    que la solicitud aparecería en Gestionar solicitudes pero no se podría abrir.
  - GAS envía `accion = "Realizar Solicitud"`; la app usa `"Realizar solicitud"`.
  - La base nueva exige que el paciente exista (FK `solicitudes.rut_usuario → usuarios.rut`). En los últimos
    60 días, 138 de 5.334 solicitudes de estos orígenes (≈2,6 %) eran de pacientes sin registro en `usuarios`:
    fallarían y se perderían.
  - El alta de contacto de Simple (`INSERT INTO usuarios (rut, telefono, correo_contacto)`) falla porque `nombre`
    y `apellido` son obligatorios.

## Objetivo

Desde el corte, toda solicitud de Simple y toda derivación interna queda en `gestion_demanda`, visible y
gestionable en la app, sin pérdidas. **La app es la única que escribe en su base**: los sistemas externos le
envían los datos por HTTPS.

## Decisiones

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Conexión | Endpoint HTTPS en la app; sin cambios de red | Sin túneles ni puertos nuevos; sobrevive a la migración de gi al server DAS (decisión del 21/10/2026). |
| Dominio | `https://gd.cmvalparaiso.cl` | Es el dominio definitivo; gd2 queda en desuso. |
| Plazo | Todo listo para el corte | Sin periodo de transición ni conciliación periódica. |
| Rutas | Una por origen: `/api/integraciones/simple` y `/api/integraciones/derivacion-interna` | Contratos claros por origen. |
| Reglas de derivación | Se quedan en GAS; envía los IDs ya resueltos | Catálogo ya probado; portarlo no cabe en el plazo. |
| Simple | gi reenvía el body tal cual | Simple no puede cambiar su URL; gi mantiene su api-key y su auditoría. |
| Informe diario de gi | Fuera de alcance, sin cambios | No está en uso: en producción se usa el de GAS. |
| Paciente inexistente | Se crea con los datos que lleguen | Evita perder ≈2,6 % de las solicitudes; se completa desde "Editar usuario". |
| Autenticación | Una api-key por cliente, header `api-key` | Mismo esquema que gi; permite saber quién escribió. |
| `id_solicitud` repetido | 409 sin modificar nada | Un reintento no duplica ni pisa datos. |

## Diseño

### 1. Módulo `integraciones` en la app

```
src/app/api/integraciones/simple/route.ts
src/app/api/integraciones/derivacion-interna/route.ts
src/modules/integraciones/
  schemas/   simple.schema.ts · derivacionInterna.schema.ts
  services/  registrarSolicitudSimple.ts · registrarDerivacionInterna.ts
  lib/       autenticarIntegracion.ts
  utils/     normalizacion.ts
  types/     integraciones.ts
```

- Las rutas solo manejan HTTP: autentican, parsean el JSON, llaman al servicio y traducen el resultado a un código.
- Los servicios devuelven `ResultadoAccion<T>`, con un `codigo` de error para que la ruta elija el estado HTTP.
- `/api/*` ya está fuera del matcher del middleware de sesión; no hay que tocarlo.

### 2. Autenticación

- Variables de entorno `INTEGRACION_KEY_GI` e `INTEGRACION_KEY_GAS` (en `ENV_PRODUCTION`, `.env.example` sin valor).
- `autenticarIntegracion(request, cliente)` compara el header `api-key` en tiempo constante (`timingSafeEqual`)
  contra la key del cliente de esa ruta: `GI` para `simple` y `GAS` para `derivacion-interna`.
- Si la variable no está definida o el header no coincide: 403 `{ "Mensaje": "api-key no valida" }` (mismo texto
  que gi) y `AuditLogger.logSecurity` con la ruta.

### 3. `POST /api/integraciones/simple`

Body: el contrato v2.2 de Simple (`gestion-informacion-das/docs/api/api-solicitud-simple-v2.2.md`).

Validación (Zod):

| Campo | Regla |
| --- | --- |
| `id_solicitud` | texto 1–50 |
| `fecha_inicio` | `YYYY-MM-DD HH:mm:ss` en hora de Chile (`America/Santiago`); se guarda como instante, igual que las solicitudes creadas en la app |
| `rut_usuario` | texto 1–50 |
| `tipo_solicitud_id` | entero |
| `motivo_id` | entero o `null` |
| `descripcion` | texto o `null` |
| `disponibilidad_llamada` | `AM`, `PM`, `AM/PM` o `null` |
| `priorizacion_admin` | número o `null` |
| `centro_id` | número o texto; se guarda como texto |
| `telefono`, `correo` | opcionales; vacío o `null` cuenta como ausente |

Los campos fijos del contrato (`rut_orientador`, `ultimo_control`, `rut_gestor`, `accion`, `razon_rechazo`,
`fecha_validacion`, `estado_solicitud`) se aceptan pero **no se usan**: el servicio escribe los valores de la app.

`registrarSolicitudSimple`, en una transacción:

1. Verifica que existan `tipo_solicitud_id`, `motivo_id` (si viene) y el funcionario `11111112-3`. Si falta
   alguno: error `CATALOGO` (422) con el ID que falló.
2. Si `id_solicitud` ya existe: error `DUPLICADO` (409).
3. Paciente:
   - No existe: lo crea con `nombre = "Sin registro"`, `apellido = ""`, `centro_id` de la solicitud y el
     teléfono/correo si llegan.
   - Existe: actualiza `telefono` y `correo_contacto` solo con los que lleguen con contenido.
4. Crea la solicitud con: `rut_orientador = "11111112-3"`, `ultimo_control = null`, `rut_gestor = null`,
   `accion = "En espera de validación"`, `razon_rechazo = null`, `fecha_validacion = null`,
   `estado_solicitud = "En Curso"` y el resto desde el body.

### 4. `POST /api/integraciones/derivacion-interna`

Body:

```json
{
    "modo": "validada",
    "paciente": { "rut": "12345678-9", "nombre": "Nombre completo o null" },
    "solicitud": {
        "id_solicitud": "ESP-a1b2c3",
        "tipo_solicitud_id": 3,
        "motivo_id": 12,
        "descripcion": "DERIVACIÓN INTERNA ...",
        "centro_id": 650
    },
    "cita": {
        "profesional_id": 4,
        "prestacion_id": 87,
        "fecha_estimada_atencion": "2026-11-15",
        "observacion": "DERIVACIÓN INTERNA ..."
    }
}
```

- `modo`: `"validada"` o `"pendiente"`. `cita` es obligatoria si es validada y no debe venir si es pendiente.
- `fecha_inicio` y `fecha_validacion` son el momento de recepción; GAS ya usaba la hora de envío.

`registrarDerivacionInterna`, en una transacción:

1. Verifica `tipo_solicitud_id`, `motivo_id`, el funcionario `11111112-2` y, si es validada, `profesional_id`
   y `prestacion_id`. Si falta alguno: `CATALOGO` (422).
2. `id_solicitud` existente: `DUPLICADO` (409).
3. Paciente inexistente: lo crea con `nombre = paciente.nombre` si viene con contenido, si no `"Sin registro"`;
   `apellido = ""`; `centro_id` de la solicitud. Si existe, no lo modifica.
4. Crea la solicitud: `rut_orientador = rut_gestor = "11111112-2"`, `ultimo_control = null`,
   `disponibilidad_llamada = null`, `priorizacion_admin = 2`, `fecha_validacion = ahora`,
   `estado_solicitud = "En Curso"` y `accion`:
   - validada: `"Realizar solicitud"`;
   - pendiente: `"En espera de validación"`.
5. Si es validada, crea la cita: `id_cita = solicitud_id = id_solicitud`, `rut_gestor = "11111112-2"`,
   `tipo_prestacion = "Agendar una hora con profesional"`, `estado_cita = "Sin llamadas"`,
   `priorizacion_clinica = "Media"`, `priorizacion = 60`, `centro_id` de la solicitud,
   `fecha_creacion = ahora` y el resto desde `cita`.

Si falla cualquier paso, no queda nada escrito.

### 5. Respuestas (ambas rutas)

| Caso | HTTP | Body |
| --- | --- | --- |
| Creada | 201 | `{ "message": "Solicitud creada con éxito", "id_solicitud": "…" }` |
| Body inválido | 400 | `{ "error": "Datos inválidos", "detalles": { campo: [mensajes] } }` |
| api-key inválida | 403 | `{ "Mensaje": "api-key no valida" }` |
| `id_solicitud` repetido | 409 | `{ "error": "La solicitud ya existe" }` |
| Catálogo o funcionario inexistente | 422 | `{ "error": "tipo_solicitud_id 99 no existe" }` (u otro ID) |
| Error interno | 500 | `{ "error": "Error interno del servidor" }`; el detalle solo en el log |

### 6. Auditoría

- Cada intento autenticado: `AuditLogger.logDataAccess("CREATE", ok, { name: "Integración GI" | "Integración GAS" }, "solicitudes", { details })`.
- `details` lleva la ruta, el `id_solicitud`, el modo y el código de resultado. No lleva teléfono, correo ni nombre.

### 7. gi: reenvío de Simple

En `gestion-informacion-das/src/app/api/data/solicitud-simple/route.ts`:

- Mantiene la URL, la validación de su api-key (Mongo) y `auditApi`.
- Quita la conexión MySQL y el upsert de `usuarios`.
- `fetch(`${GD_API_URL}/api/integraciones/simple`)` con header `api-key: GD_API_KEY`, body intacto y
  timeout de 15 s (`AbortSignal.timeout`).
- Respuesta a Simple, sin cambiar su contrato:
  - 201 de la app → 201 `{ message: "Solicitud creada con éxito", result: { affectedRows: 1 } }`;
  - 403 propio (api-key de Simple) → 403 como hoy;
  - cualquier otro resultado o timeout → 500 `{ error: "Error interno del servidor" }`, con el código y el
    error de la app en `auditApi`.
- Variables nuevas en el workflow de deploy de gi: `GD_API_URL=https://gd.cmvalparaiso.cl` y `GD_API_KEY`
  desde un secret nuevo del repo de gi.

### 8. GAS: envío de derivaciones

En `informe-diario-2.0/back-end/informe_diario/derivacionInternasGD.js`:

- `procesarDerivacionInterna` mantiene las reglas, el catálogo y la etapa efectiva.
- `crearSolicitudValidadaDI` + `crearCitaDI` se reemplazan por un envío con `modo: "validada"`;
  `crearSolicitudDI` por uno con `modo: "pendiente"`. Una función `enviarDerivacionGD(payload)` hace el
  `UrlFetchApp.fetch` (`muteHttpExceptions: true`) y deja en `console` el código y el error si no es 201.
- `paciente.nombre` sale de `infoDerivacion.paciente.nombrePaciente` si existe.
- `id_solicitud` y `descripcion` se arman igual que hoy.
- `GD_API_URL` y `GD_API_KEY` se leen de `PropertiesService.getScriptProperties()`, no del código.
- `conectarBD()` queda sin uso para derivaciones; no se borra en este cambio.

## Errores

| Caso | Resultado |
| --- | --- |
| Paciente inexistente | Se crea con los datos disponibles; la solicitud entra |
| Contacto vacío en Simple | No se toca el paciente existente |
| Reintento con el mismo `id_solicitud` | 409; GAS lo registra en su log, gi responde 500 a Simple |
| Tipo, motivo, profesional o prestación inexistente | 422; no se escribe nada |
| Falla la cita en una validada | Se revierte también la solicitud |
| App caída o lenta para gi | 500 a Simple después de 15 s (Simple ya conoce ese código) |
| Falta la key en el entorno | 403 en todo intento (falla cerrada) |

## Tests (Vitest)

- `normalizacion`: vacíos a `null`, `centro_id` a texto, `fecha_inicio` en hora de Chile.
- Esquemas: bodies válidos e inválidos por campo; `cita` obligatoria solo en validada.
- `autenticarIntegracion`: key correcta, incorrecta, ausente y variable sin definir; la key de un cliente no
  sirve en la ruta del otro.
- Servicios (Prisma mockeado):
  - paciente nuevo (con y sin nombre) y existente;
  - contacto con datos, vacío y ausente;
  - validada (solicitud + cita) y pendiente (solo solicitud);
  - valores fijos de la app aunque el body traiga otros;
  - duplicado (409) y catálogo inexistente (422).
- Rutas: 403, 400, 409, 422 y 201.
- gi: reenvío exitoso (201), error de la app (500) y timeout (500).

## Prueba integrada (antes del corte)

1. La app en local apuntando a `gestion_demanda_ensayo`, con las keys de prueba.
2. gi en local enviando un body de Simple → solicitud visible en Gestionar solicitudes (centro 501) y abrible.
3. Un deploy de prueba de GAS enviando una derivación validada y una pendiente → cita visible en Contactar
   pacientes y solicitud en Gestionar solicitudes.
4. Paciente inexistente en las tres pruebas → aparece como "Sin registro".

## Corte (jueves 22/10/2026, antes de las 08:00)

1. Migración definitiva en `gestion_demanda`; verificar que existan `11111112-2` y `11111112-3`.
2. `ENV_PRODUCTION`:
   - `DATABASE_URL` vuelve a `gestion_demanda`;
   - `AUTH_URL=https://gd.cmvalparaiso.cl/api/auth`;
   - se agregan `INTEGRACION_KEY_GI` e `INTEGRACION_KEY_GAS`.

   Después, redeploy de la app.
3. Prueba de humo con un `id_solicitud` de prueba en el centro 501 por cada ruta; luego se borra.
4. Deploy de gi con `GD_API_URL` y `GD_API_KEY`; nueva versión de GAS con sus propiedades.
5. Verificación: contar en `gestionDemanda` las solicitudes de `11111112-%` creadas después de la
   extracción. Si hay, se copian a mano a `gestion_demanda`.

## Fuera de alcance

- El informe diario de gi (no está en uso).
- Mover las reglas de derivación de GAS a la app.
- Sacar las credenciales hardcodeadas de `informe-diario-2.0/back-end/api.js` (recomendado aparte).
- Sincronizar estados de vuelta hacia Simple.
