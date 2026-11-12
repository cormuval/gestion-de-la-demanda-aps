# Formulario web de solicitud de hora (reemplazo de Simple)

Fecha: 2026-11-12
Rama: `feat/formulario-web-solicitud-hora`
Antecedente: `2026-10-21-integraciones-externas-design.md` (endpoint `/api/integraciones/simple`).

## Problema

La entrada autónoma de pacientes es `https://solicitudhora.cmvalparaiso.cl`, una landing que redirige al
formulario de Simple (plataforma del Estado). Simple autentica con Clave Única, consulta el per cápita de gi para
saber el centro del paciente y envía la solicitud a gi, que la reenvía a `/api/integraciones/simple`.

Las solicitudes que llegan por esa vía **no traen teléfono**, y sin teléfono no se puede cumplir la etapa de
contacto del flujo principal. Simple no tiene soporte que pueda cambiar su integración.

## Objetivo

Un formulario propio en `solicitudhora.cmvalparaiso.cl` que crea solicitudes en `gestion_demanda` con teléfono de
contacto obligatorio, solo para pacientes inscritos en un establecimiento de la Corporación Municipal.

## Decisiones

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Autenticación del paciente | Sin Clave Única | Costo asumido: el RUT no se verifica contra la identidad de quien escribe. |
| Arquitectura | Sitio estático aparte + endpoint público en gd | Separado de la app interna, sin un servidor más que mantener; validación, catálogos y auditoría quedan en gd. |
| Hosting del sitio | server-das (expuesto a internet), nginx + certificado | Decisión del usuario. |
| Tecnología del sitio | Astro (salida estática) + Tailwind | HTML liviano, JS solo donde se necesita; sin runtime de servidor. |
| Anti-bots | Cloudflare Turnstile (invisible) + límite por IP + campo trampa | Sin interacción para el paciente; el endpoint queda abierto, así que necesita estas capas. |
| Centro del paciente | Se obtiene del per cápita de gi, no se pregunta | Igual que Simple; solo pueden continuar los inscritos. |
| Consulta al per cápita | La hace gd desde el servidor | La api-key de gi y los datos clínicos del registro nunca llegan al navegador. |
| Datos personales | Nombres, apellidos, fecha de nacimiento y género se toman del per cápita | Formulario más corto y datos más confiables (apellidos separados). |
| "Para mí / para otra persona" | Se elimina | Sin autenticación no hay identidad que distinguir: el formulario siempre describe al paciente. |
| Paciente existente | Solo se completan campos vacíos | No se sobrescriben datos con información no verificada. |
| Teléfono distinto al registrado | Se anota en la descripción de la solicitud | El número no se pierde y quien gestiona o llama lo ve, sin cambiar el esquema. |
| Respuestas al navegador | Nunca incluyen nombre, centro ni datos del paciente | Evita exponer datos de terceros con un RUT no verificado. |
| Cambios en gi | Ninguno de código | Se usa `GET /api/data/percapita` tal como está, con una api-key nueva para gd. |
| Endpoint de Simple | Sin cambios | Sigue recibiendo lo que llegue mientras exista. |

## Diseño

### 1. Sitio `solicitudhora` (repo nuevo)

Repo nuevo `cormuval/solicitud-hora-cmv`:

- **Framework y estilos:** Astro con salida estática (`output: "static"`) y Tailwind.
- **Formulario por pasos:** un script TypeScript sin framework de UI. No se usa React, porque el formulario es
  pequeño y así el sitio carga más rápido en celulares de gama baja.
- **Resultado del build:** HTML, CSS y JS estáticos en `dist/`. No hay Node corriendo en server-das.
- **Convenciones:** español en UI, comentarios y commits; 4 espacios de indentación.

Requisitos de presentación (obligatorios):

- **Mobile first:**
  - El diseño base es para 360–430 px; los breakpoints solo agregan cosas para pantallas más anchas.
  - Una sola columna, botones principales de ancho completo y sin scroll horizontal.
  - En escritorio el contenido se centra con un ancho máximo de lectura de unos 640 px.
- **Tipografía:** Barlow peso 500 (Medium) en todo el sitio; los títulos pueden usar 600.
  - Se sirve desde el propio sitio con `@fontsource/barlow`, sin Google Fonts, para no cargar recursos de terceros.
- **Textos de buen tamaño:**
  - Cuerpo e inputs: mínimo 18 px. Nunca menos de 16 px en inputs, para evitar el zoom automático de iOS.
  - Títulos: 28 px o más.
  - Áreas táctiles: mínimo 48 px de alto.
  - Contraste: WCAG AA.
- **Lenguaje neutral respecto del género:**
  - Se escribe en segunda persona ("te", "tu", "ingresa") y con sustantivos colectivos ("la comunidad", "la persona").
  - No se usan formas como "inscrito/a", "el usuario" ni "cuidador(a)".

Páginas:

1. **Landing:** texto general ("solicitud de atención en los establecimientos de salud de la Corporación
   Municipal de Valparaíso"), sin listado de establecimientos ni de prestaciones; aviso SAPU (síntomas de urgencia
   y horarios, igual al de Simple); botón "Iniciar solicitud".
2. **Paso 1 — RUT:** campo RUT con validación de dígito verificador en el cliente, Turnstile invisible y una línea
   de ayuda: *"Si estás haciendo la solicitud por otra persona, ingresa los datos de ella."*
3. **Paso 2 — Solicitud:** campos de la tabla siguiente; el selector de motivo usa los tipos que devolvió el paso 1.
4. **Confirmación:** "Recibimos tu solicitud. Te contactaremos por teléfono."

Mensajes del paso 1:

- `NO_INSCRITO`: "No encontramos una inscripción vigente en nuestros establecimientos. Acércate a tu CESFAM."
- `NO_DISPONIBLE` o error de red: "No pudimos verificar tus datos. Intenta nuevamente en unos minutos."

Campos del paso 2:

| Campo | Obligatorio | Validación |
| --- | --- | --- |
| Nombre social | No | ≤ 50 caracteres |
| Teléfono de contacto | Sí | 9 dígitos chilenos (se acepta con o sin `+56`) |
| Teléfono alternativo | No | Igual que el anterior |
| Correo | No | Email, ≤ 100 caracteres; se pide una vez |
| Discapacidad / cuidados | Sí | Una de: "Tengo credencial de discapacidad", "Cuido de forma principal a una persona con discapacidad", "Ninguna de las anteriores" (se guarda el texto elegido en `usuarios.discapacidad`) |
| Motivo | Sí | Uno de los tipos devueltos por el paso 1 |
| Describa el motivo | Sí | 10 a 1000 caracteres |
| Disponibilidad para llamar | Sí | `AM`, `PM` o `AM/PM` |

El sitio incluye un campo trampa oculto (`sitio_web`) que un humano no completa.

Despliegue: build estático copiado a server-das; nginx sirve `solicitudhora.cmvalparaiso.cl` con certificado. El
cambio de DNS desde la landing actual es el último paso, después de probar el sitio nuevo en un subdominio
temporal o por IP.

### 2. Endpoints en gd

Módulo nuevo `src/modules/solicitud-web/` (schemas, services, lib, types). Reutiliza `asegurarPaciente`,
`verificarCatalogos` y `errores` de `integraciones`, y `getColumnaTipoSolicitudPorCentro` de `catalogos`.
`/api/*` ya está fuera del middleware de sesión.

#### `POST /api/publico/solicitud-hora/verificar`

Entrada: `{ rut: string, captcha: string }`.

1. Límite por IP (ver Seguridad). Excedido: 429.
2. Valida el captcha con Turnstile (`siteverify`). Inválido: 400 `{ error: "CAPTCHA" }`.
3. Valida el formato y el dígito verificador del RUT, y lo normaliza a `XXXXXXXX-X` sin puntos y con `K` mayúscula. Inválido: 400 `{ error: "RUT" }`.
4. Consulta `GET {GI_PERCAPITA_URL}?rut=<rut>` con header `api-key: GI_API_KEY`, timeout de 10 s.
   - 404: 200 `{ ok: false, motivo: "NO_INSCRITO" }`.
   - Error, timeout u otro estado: 200 `{ ok: false, motivo: "NO_DISPONIBLE" }`.
   - `COD_CENTRO` sin centro en la tabla `centros`: `NO_INSCRITO`, y se registra en `logs`.
5. Responde 200 `{ ok: true, token, tipos: [{ id, nombre }] }`.
   - Tipos: `tipo_solicitud` activos con la columna del centro (`getColumnaTipoSolicitudPorCentro`) marcada.
   - Token: `base64url(payload).base64url(HMAC-SHA256(payload, SOLICITUD_WEB_TOKEN_SECRET))`, con
     payload `{ rut, centro_id, exp }` y `exp` = ahora + 20 minutos.

#### `POST /api/publico/solicitud-hora`

Entrada: `{ token, nombre_social, telefono, telefono_alternativo, correo, discapacidad, tipo_solicitud_id,
descripcion, disponibilidad_llamada, sitio_web }`.

1. Límite por IP. Excedido: 429.
2. `sitio_web` con contenido: responde 201 como si se hubiera guardado, no guarda nada y lo registra en `logs`.
3. Verifica firma y vigencia del token (`timingSafeEqual`). Inválido o vencido: 400 `{ error: "TOKEN" }`; el
   sitio vuelve al paso 1.
4. Valida el cuerpo con Zod (tabla de campos). Inválido: 400 `{ error: "DATOS", campos: [...] }`.
5. Verifica que `tipo_solicitud_id` esté habilitado para el `centro_id` del token. Si no lo está: 400 `{ error: "DATOS" }`.
6. Vuelve a consultar el per cápita para obtener nombres, apellidos, fecha de nacimiento y género. Si falla o el
   RUT ya no aparece: 503 `{ error: "NO_DISPONIBLE" }`.
7. Llama a `registrarSolicitudWeb` y responde 201 `{ ok: true }`, salvo error interno (500).

CORS en ambas rutas: `OPTIONS` y `Access-Control-Allow-Origin` solo para `SOLICITUD_WEB_ORIGEN`
(`https://solicitudhora.cmvalparaiso.cl`). Otros orígenes no reciben los headers CORS.

### 3. Servicio `registrarSolicitudWeb`

En una transacción:

1. **Duplicado:** si el RUT tiene una solicitud `estado_solicitud = 'En Curso'` del mismo `tipo_solicitud_id`,
   no crea nada, registra el intento en `logs` y devuelve éxito; el paciente ve la misma confirmación.
2. **Paciente nuevo:** se crea en `usuarios` con:
   - `nombre` = `NOMBRES`.
   - `apellido` = `APELLIDO_PATERNO` + `APELLIDO_MATERNO`, separados por un espacio y recortados a 50.
   - `fecha_nacimiento` y `genero` del per cápita.
   - `centro_id` del token.
   - `nombre_social`, `telefono`, `telefono_alternativo`, `correo_contacto` y `discapacidad` del formulario.
3. **Paciente existente:** solo asigna los campos de la lista anterior que estén vacíos (null o cadena vacía); no
   modifica ninguno con valor. Si ya tenía `telefono` y es distinto del ingresado, agrega al final de la
   descripción: `\n\nTeléfono indicado en el formulario web: <telefono>`.
4. **Solicitud:**

| Campo | Valor |
| --- | --- |
| `id_solicitud` | `WEB-` + identificador único (≤ 50 caracteres) |
| `fecha_inicio` | ahora |
| `rut_usuario` | RUT del token |
| `tipo_solicitud_id` | elegido |
| `motivo_id` | `null` |
| `descripcion` | ingresada, más la nota de teléfono si corresponde |
| `disponibilidad_llamada` | elegida |
| `centro_id` | del token |
| `estado_solicitud` | `En Curso` |
| `accion` | `En espera de validación` |
| `rut_orientador` | `RUT_ORIENTADOR_WEB` |
| `rut_gestor`, `fecha_validacion` | `null` |

`RUT_ORIENTADOR_WEB` es un funcionario fijo "Formulario web" que se agrega al seed y se crea en producción,
igual que el orientador de Simple.

Todas las altas, duplicados y rechazos se auditan con `AuditLogger`, guardando RUT, ruta y resultado, sin teléfono ni correo.

### 4. Seguridad

- **Turnstile:** en el paso 1. El paso 2 queda amarrado por el token firmado, que solo emite un paso 1 con captcha válido.
- **Límite por IP:**
  - Se lleva en memoria, porque pm2 corre con una sola instancia.
  - Usa la IP de `X-Forwarded-For` que pone nginx.
  - `verificar`: 10 por IP cada 15 minutos.
  - Envío: 5 por IP cada hora.
- **Datos que se exponen:**
  - Lo único que un tercero puede averiguar es si un RUT está inscrito. Queda acotado por captcha y límite.
  - Las respuestas nunca incluyen nombre, centro, datos clínicos ni si existen solicitudes previas.
- **Variables nuevas en `ENV_PRODUCTION` y `.env.example`** (sin valor en el ejemplo): `GI_PERCAPITA_URL`, `GI_API_KEY`,
  `TURNSTILE_SECRET_KEY`, `SOLICITUD_WEB_TOKEN_SECRET`, `SOLICITUD_WEB_ORIGEN`. La site key pública de Turnstile
  va en el sitio.
- **En gi:** una api-key nueva para gd en la colección `apiKey` (`estado: true`). No hay cambios de código.

## Pruebas

- **Unitarias (Vitest):**
  - Validación y normalización de RUT y teléfono.
  - Firma, verificación y vencimiento del token.
  - Schemas Zod.
  - Mapeo del per cápita a paciente: apellidos y recorte a 50.
  - Límite por IP.
- **Servicio:**
  - Paciente nuevo.
  - Paciente existente con campos vacíos y llenos.
  - Nota de teléfono distinto.
  - Duplicado `En Curso`.
  - Tipo no habilitado para el centro.
- **Rutas:**
  - Captcha inválido.
  - `NO_INSCRITO` y `NO_DISPONIBLE` (gi mockeado).
  - Token vencido o adulterado.
  - Campo trampa.
  - 429.
  - CORS de origen permitido y no permitido.
- **Sitio:** prueba manual a 375 px y en escritorio de los cuatro mensajes (inscrito, no inscrito, gi caído,
  envío correcto) contra gd en local con las claves de prueba de Turnstile.

## Fuera de alcance

- Cambios de código en gi y en el endpoint de Simple.
- Columnas nuevas en `solicitudes`.
- Notificar al paciente por correo o SMS.
- Validar la identidad del paciente.
