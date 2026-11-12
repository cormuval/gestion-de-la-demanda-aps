# Formulario web de solicitud de hora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formulario propio en `solicitudhora.cmvalparaiso.cl` que crea solicitudes en gd con teléfono obligatorio, solo para pacientes inscritos según el per cápita de gi.

**Architecture:** Dos endpoints públicos en gd (`/api/publico/solicitud-hora/verificar` y `/api/publico/solicitud-hora`) en un módulo nuevo `solicitud-web`, que consulta el per cápita de gi desde el servidor y emite un token HMAC entre pasos. Un sitio estático Astro en un repo nuevo (`cormuval/solicitud-hora-cmv`) servido por nginx en server-das.

**Tech Stack:**
- **gd:** Next.js 15 route handlers, Prisma, Zod, Vitest y `node:crypto`.
- **Sitio:** Astro (estático), Tailwind, `@fontsource/barlow`, TypeScript sin framework de UI, Vitest para la lógica pura.
- **Externos:** Cloudflare Turnstile.

**Spec:** `docs/superpowers/specs/2026-11-12-formulario-web-solicitud-hora-design.md`

## Global Constraints

- **Convenciones:** español en UI, comentarios y commits; 4 espacios; imports con comentarios de categoría (`// lib`, `// services`, ...); `interface` para objetos y `type` para uniones.
- **Respuestas al navegador:** nunca incluyen nombre, centro, datos clínicos ni si existen solicitudes previas.
- **Auditoría:** nunca registra teléfono ni correo; sí registra RUT, ruta y resultado.
- **Per cápita:** solo se consulta desde el servidor de gd, con el header `api-key: GI_API_KEY`, en `GET {GI_PERCAPITA_URL}?rut=<rut>` y con timeout de 10 s.
- **Token:** `base64url(JSON payload).base64url(HMAC-SHA256(payload, SOLICITUD_WEB_TOKEN_SECRET))`, con payload `{ rut, centro_id, exp }` y `exp` = ahora + 20 min, en ms epoch.
- **Límites por IP:** `verificar` 10 cada 15 min; envío 5 cada 60 min. La IP es el primer valor de `X-Forwarded-For`.
- **CORS:** solo para el origen `SOLICITUD_WEB_ORIGEN`; otros orígenes no reciben headers CORS.
- **Variables nuevas:** `GI_PERCAPITA_URL`, `GI_API_KEY`, `TURNSTILE_SECRET_KEY`, `SOLICITUD_WEB_TOKEN_SECRET`, `SOLICITUD_WEB_ORIGEN`. Van en `.env.example` sin valor y nunca se escriben valores reales en el repo.
- **Paciente existente:** solo se asignan los campos vacíos (null o `""`); nunca se sobrescribe un valor.
- **Sitio, requisitos de presentación:**
  - Mobile first (base 360–430 px, una columna, botones de ancho completo, `max-w` de unos 640 px en escritorio).
  - Barlow 500 (títulos 600) desde `@fontsource/barlow`.
  - Texto e inputs ≥ 18 px (inputs nunca < 16 px), títulos ≥ 28 px, áreas táctiles ≥ 48 px de alto, contraste WCAG AA.
- **Sitio, lenguaje neutral:** segunda persona; sin "inscrito/a", "el usuario" ni "cuidador(a)".
- **Datos de prueba:** RUTs ficticios (por ejemplo `12345678-5`) y nunca datos reales.

## Review Focus

1. **RUT ingresado con puntos, espacios o `k` minúscula:** debe aceptarse y normalizarse a `XXXXXXXX-X` antes de consultar gi (gi exige `^\d{7,8}-[0-9kK]$`). La prueba está en la Tarea 2.
2. **Teléfono ingresado como `+56 9 1234 5678`, `912345678` o `56912345678`:** debe normalizarse a `+56912345678`. Un número fijo de 9 dígitos (`322123456`) también es válido. La prueba está en la Tarea 1.
3. **Apellido materno vacío o null en el per cápita:** `apellido` no debe quedar con un espacio sobrante. La prueba está en la Tarea 2.
4. **Doble clic en "Enviar" o reintento por red lenta:** no debe crear dos solicitudes. La regla de duplicado `En Curso` del mismo tipo lo cubre (prueba en la Tarea 4) y el sitio deshabilita el botón mientras envía (Tarea 7).
5. **Token vencido a mitad del paso 2:** el sitio debe volver al paso 1 con un mensaje, sin perder lo escrito si se puede. La prueba de la ruta está en la Tarea 5 y la del sitio en la Tarea 7.

---

## Parte A — gd (`gestion-de-la-demanda-aps`, rama `feat/formulario-web-solicitud-hora`)

Estructura del módulo:

```
src/modules/solicitud-web/
  lib/      token.ts · limiteIp.ts · percapita.ts · turnstile.ts · http.ts
  utils/    telefono.ts
  schemas/  solicitudWeb.schema.ts
  services/ tiposHabilitados.ts · registrarSolicitudWeb.ts
  types/    solicitudWeb.ts
src/app/api/publico/solicitud-hora/route.ts
src/app/api/publico/solicitud-hora/verificar/route.ts
```

### Task 1: Token, límite por IP y teléfono

**Files:**
- Create: `src/modules/solicitud-web/lib/token.ts`, `src/modules/solicitud-web/lib/limiteIp.ts`, `src/modules/solicitud-web/utils/telefono.ts`, `src/modules/solicitud-web/types/solicitudWeb.ts`
- Test: los `.test.ts` correspondientes, junto a cada archivo.

**Interfaces:**
- Produces:
  - `interface PayloadToken { rut: string; centro_id: string; exp: number }`, en `types/solicitudWeb.ts`.
  - `firmarToken(payload: PayloadToken, secreto: string): string`.
  - `verificarToken(token: string, secreto: string, ahora?: number): PayloadToken | null`. Devuelve null si la firma es inválida, si el formato es malo o si `exp <= ahora`. La firma se compara con `timingSafeEqual`.
  - `crearLimitador(maximo: number, ventanaMs: number): { permitir(clave: string, ahora?: number): boolean }`. Usa un `Map` en memoria con ventana fija por clave y descarta las claves vencidas al consultar.
  - `normalizarTelefono(texto: string): string | null`. Quita espacios, guiones y paréntesis, y acepta `+56XXXXXXXXX`, `56XXXXXXXXX` o `XXXXXXXXX` (9 dígitos). Devuelve `+56XXXXXXXXX`; cualquier otra cosa devuelve null.

- [ ] **Step 1: Escribir las pruebas que deben fallar**
  - `token.test.ts`:
    - Ida y vuelta: firmar y luego verificar devuelve el mismo payload.
    - Un payload alterado (otro RUT en base64) devuelve null.
    - Otro secreto devuelve null.
    - Con `exp = ahora - 1` devuelve null.
    - `"basura"`, `""` y `"a.b.c"` devuelven null sin lanzar error.
  - `limiteIp.test.ts`:
    - Con `crearLimitador(2, 1000)`, las llamadas en t=0, 1 y 2 dan `true`, `true` y `false`.
    - En t=1001 vuelve a `true`.
    - Claves distintas no se afectan entre sí.
  - `telefono.test.ts`:
    - `"+56 9 1234 5678"`, `"912345678"`, `"56912345678"` y `"(9) 1234-5678"` dan `"+56912345678"`.
    - `"322123456"` da `"+56322123456"`.
    - `"12345"`, `"+5491234567890"` y `"abc"` dan null.
- [ ] **Step 2:** Ejecutar `npx vitest run src/modules/solicitud-web`. Resultado esperado: FALLA porque los módulos no existen.
- [ ] **Step 3: Implementar las tres funciones y el tipo**
- [ ] **Step 4:** Ejecutar `npx vitest run src/modules/solicitud-web`. Resultado esperado: PASA.
- [ ] **Step 5: Commit** con el mensaje `feat(solicitud-web): token firmado, limite por IP y normalizacion de telefono`.

### Task 2: Clientes de per cápita y Turnstile

**Files:**
- Create: `src/modules/solicitud-web/lib/percapita.ts`, `src/modules/solicitud-web/lib/turnstile.ts`
- Test: `percapita.test.ts` y `turnstile.test.ts`, con `fetch` mockeado (`vi.stubGlobal("fetch", ...)`).

**Interfaces:**
- Consumes: `normalizarRut` y `esRutChilenoValido` desde `@/modules/solicitudes/utils/rut`.
- Produces:
  - `interface PacientePercapita { nombre: string; apellido: string; fecha_nacimiento: Date | null; genero: string | null; centro_id: string }`, en `types/solicitudWeb.ts`.
  - `type ResultadoPercapita = { estado: "INSCRITO"; paciente: PacientePercapita } | { estado: "NO_INSCRITO" } | { estado: "NO_DISPONIBLE" }`.
  - `consultarPercapita(rut: string): Promise<ResultadoPercapita>`:
    - Lee `GI_PERCAPITA_URL` y `GI_API_KEY`; si falta alguna, devuelve `NO_DISPONIBLE`.
    - Llama con `AbortSignal.timeout(10_000)` y el RUT ya normalizado.
    - 404 da `NO_INSCRITO`; 200 da `INSCRITO`; cualquier otro estado o excepción da `NO_DISPONIBLE`.
  - `mapearPercapita(registro: Record<string, unknown>): PacientePercapita | null`:
    - `nombre` = `NOMBRES` recortado a 50.
    - `apellido` = `[APELLIDO_PATERNO, APELLIDO_MATERNO]` filtrando vacíos, unido con `" "` y recortado a 50.
    - `fecha_nacimiento`: parsea `FECHA_NACIMIENTO` en formato `YYYY-MM-DD` o `DD-MM-YYYY`; si no se puede, null.
    - `genero` = `GENERO` o null.
    - `centro_id` = `String(COD_CENTRO)`.
    - Devuelve null si faltan `NOMBRES` o `COD_CENTRO`. En ese caso `consultarPercapita` responde `NO_DISPONIBLE`.
  - `verificarCaptcha(token: string, ip: string | null): Promise<boolean>`:
    - Hace POST a `https://challenges.cloudflare.com/turnstile/v0/siteverify` como form con `secret=TURNSTILE_SECRET_KEY`, `response` y `remoteip`.
    - Devuelve `success === true`.
    - Si falta el secreto, el token está vacío o hay un error de red, devuelve false.

- [ ] **Step 1: Escribir las pruebas que deben fallar**
  - `consultarPercapita`:
    - `"12.345.678-5"` llama a la URL con `?rut=12345678-5` y el header `api-key`.
    - 404 da `NO_INSCRITO`.
    - 500 da `NO_DISPONIBLE`.
    - `fetch` que rechaza da `NO_DISPONIBLE`.
    - Sin `GI_API_KEY` da `NO_DISPONIBLE` sin llamar a `fetch`.
  - `mapearPercapita`:
    - El registro completo arma `apellido` como `"PEREZ SOTO"` y `centro_id` como `"615"`.
    - `APELLIDO_MATERNO: null` y `""` dan `"PEREZ"`, sin espacio al final.
    - Un `NOMBRES` de 60 caracteres queda en 50.
  - `verificarCaptcha`:
    - `success: true` da true.
    - `success: false` da false.
    - Sin secreto da false.
    - El cuerpo enviado contiene `remoteip`.
- [ ] **Step 2:** Ejecutar `npx vitest run src/modules/solicitud-web/lib`. Resultado esperado: FALLA.
- [ ] **Step 3: Implementar `percapita.ts` y `turnstile.ts`**
- [ ] **Step 4:** Ejecutar la misma prueba. Resultado esperado: PASA.
- [ ] **Step 5: Commit** con el mensaje `feat(solicitud-web): clientes de per capita (gi) y Turnstile`.

### Task 3: Schemas y tipos habilitados por centro

**Files:**
- Create: `src/modules/solicitud-web/schemas/solicitudWeb.schema.ts`, `src/modules/solicitud-web/services/tiposHabilitados.ts`
- Test: `solicitudWeb.schema.test.ts` y `tiposHabilitados.test.ts` (Prisma mockeado como en `registrarSolicitudSimple.test.ts`).

**Interfaces:**
- Consumes: `normalizarTelefono` (Tarea 1) y `getColumnaTipoSolicitudPorCentro` desde `@/modules/catalogos/utils/centroTipoSolicitud`.
- Produces:
  - `verificarSchema = z.object({ rut: string, captcha: string min 1 })`.
    - `rut` pasa por `normalizarRut` y luego se refina con `esRutChilenoValido`.
  - `OPCIONES_DISCAPACIDAD`: los tres textos exactos del spec ("Tengo credencial de discapacidad", "Cuido de forma principal a una persona con discapacidad", "Ninguna de las anteriores").
  - `envioSchema = z.object({ ... })` con estos campos:
    - `token`: string min 1.
    - `nombre_social`: opcional, vacío → null, ≤ 50.
    - `telefono`: obligatorio y normalizado; inválido → error en `telefono`.
    - `telefono_alternativo`: opcional, normalizado; vacío → null, inválido → error.
    - `correo`: opcional; vacío → null, email ≤ 100.
    - `discapacidad`: `z.enum(OPCIONES_DISCAPACIDAD)`.
    - `tipo_solicitud_id`: entero positivo; acepta número o texto de dígitos.
    - `descripcion`: trim, de 10 a 1000.
    - `disponibilidad_llamada`: `z.enum(["AM", "PM", "AM/PM"])`.
    - `sitio_web`: opcional, string.
  - `type EnvioSolicitudWeb = z.infer<typeof envioSchema>`.
  - `tiposHabilitados(centro_id: string): Promise<Array<{ id: number; nombre: string }>>`:
    - Busca `nombre_centro` en `centros` y obtiene la columna con `getColumnaTipoSolicitudPorCentro`.
    - Si no hay centro o columna, devuelve `[]`.
    - Si hay, devuelve los `tipo_solicitud` con `estado = "Activo"` y `{ [columna]: "1" }`, ordenados por `nombre_tipo_solicitud`.
    - **Antes de fijar el valor `"1"`**, revisar qué valor marca "habilitado" en `prisma/seed-data/referencia.sql` y en `IngresarSolicitudView` y usar ese mismo.

- [ ] **Step 1: Escribir las pruebas que deben fallar**
  - `verificarSchema`:
    - Con `"12.345.678-5"` queda `rut === "12345678-5"`.
    - Un DV inválido da error en `rut`.
  - `envioSchema`:
    - Un cuerpo válido mínimo deja `telefono` en `"+56912345678"` y `correo` en null.
    - Una `descripcion` de 9 caracteres falla.
    - `discapacidad: "cuidador(a)"` falla.
    - `disponibilidad_llamada: "Noche"` falla.
    - `tipo_solicitud_id: "3"` da 3.
  - `tiposHabilitados`:
    - Un centro "Centro De Salud FamiliarBarón" consulta la columna `baron`.
    - Un centro inexistente da `[]`.
- [ ] **Step 2:** Ejecutar la prueba. Resultado esperado: FALLA.
- [ ] **Step 3: Implementar**
- [ ] **Step 4:** Ejecutar la prueba. Resultado esperado: PASA.
- [ ] **Step 5: Commit** con el mensaje `feat(solicitud-web): schemas del formulario y tipos habilitados por centro`.

### Task 4: Servicio `registrarSolicitudWeb` y orientador del formulario

**Files:**
- Create: `src/modules/solicitud-web/services/registrarSolicitudWeb.ts`
- Modify: `prisma/seed.ts`. Agregar un upsert, en ambos modos de seed, del funcionario de sistema con estos datos:
  - `rut: "11111113-8"`, `email: "formulario.web@sistema.local"`, `nombre: "Formulario web"`.
  - `rol: "Orientador"`, `estado: "Inactivo"`. Al estar inactivo no puede iniciar sesión, pero satisface la FK.
- Test: `registrarSolicitudWeb.test.ts` (mismo patrón de `tx` mockeado que `registrarSolicitudSimple.test.ts`).

**Interfaces:**
- Consumes: `EnvioSolicitudWeb` (Tarea 3), `PacientePercapita` (Tarea 2), `verificarCatalogos`, `aResultado` y `ErrorIntegracion` desde `@/modules/integraciones/services/*`.
- Produces:
  - `RUT_ORIENTADOR_WEB = "11111113-8"`.
  - `type ResultadoSolicitudWeb = { ok: true; estado: "CREADA"; id_solicitud: string } | { ok: true; estado: "DUPLICADA" } | { ok: false; codigo: "CATALOGO" | "INTERNO"; error: string }`.
  - `registrarSolicitudWeb(entrada: { rut: string; centro_id: string; envio: EnvioSolicitudWeb; percapita: PacientePercapita; ahora?: Date }): Promise<ResultadoSolicitudWeb>`.
- Comportamiento: todo ocurre en una sola transacción y sigue la sección 3 del spec al pie de la letra.
  - **Validación:** `verificarCatalogos` con `tipo_solicitud_id` y `rut_funcionario: RUT_ORIENTADOR_WEB`.
  - **Duplicado:** si hay una solicitud con `findFirst({ rut_usuario, tipo_solicitud_id, estado_solicitud: "En Curso" })`, devuelve `DUPLICADA`.
  - **Paciente nuevo:** se crea con los datos del per cápita y los del formulario.
  - **Paciente existente:** solo se asignan los campos vacíos entre `nombre_social`, `telefono`, `telefono_alternativo`, `correo_contacto` y `discapacidad`.
  - **Nota de teléfono:** si el paciente ya tenía `telefono` y es distinto, se agrega `\n\nTeléfono indicado en el formulario web: <telefono>` a la descripción.
  - **`id_solicitud`:** `WEB-` + `randomUUID()` sin guiones, recortado a 50.
  - **Resto de campos de la solicitud:** según la tabla del spec.
  - **No escribe `centro_id` del paciente existente** aunque esté vacío, porque no es un campo de contacto. Para un paciente nuevo, `centro_id` es el del token.

- [ ] **Step 1: Escribir las pruebas que deben fallar**
  - **Paciente nuevo:**
    - `usuario.create` recibe `nombre`, `apellido`, `fecha_nacimiento`, `genero`, `centro_id: "615"` y `telefono: "+56912345678"`.
    - `solicitud.create` recibe `estado_solicitud: "En Curso"`, `accion: "En espera de validación"`, `rut_orientador: "11111113-8"` y `motivo_id: null`, con `id_solicitud` que empieza con `"WEB-"`.
  - **Paciente existente con `telefono: "+56900000000"` y `correo_contacto: null`:**
    - `usuario.update` recibe solo `correo_contacto`, no `telefono`.
    - La descripción termina con `"Teléfono indicado en el formulario web: +56912345678"`.
  - **Paciente existente con el mismo teléfono:** la descripción queda sin nota.
  - **Paciente existente sin campos vacíos que asignar:** no se llama a `usuario.update`.
  - **Duplicado:** si `solicitud.findFirst` devuelve una fila, el resultado es `{ ok: true, estado: "DUPLICADA" }` y `solicitud.create` no se llama.
  - **Tipo inexistente:** devuelve `{ ok: false, codigo: "CATALOGO" }`.
- [ ] **Step 2:** Ejecutar `npx vitest run src/modules/solicitud-web/services`. Resultado esperado: FALLA.
- [ ] **Step 3: Implementar el servicio y el upsert del seed**
- [ ] **Step 4:** Ejecutar `npx vitest run src/modules/solicitud-web/services` y `npx tsc --noEmit`. Resultado esperado: PASA.
- [ ] **Step 5: Commit** con el mensaje `feat(solicitud-web): servicio de registro y orientador "Formulario web"`.

### Task 5: Rutas públicas, CORS y variables de entorno

**Files:**
- Create: `src/modules/solicitud-web/lib/http.ts`, `src/app/api/publico/solicitud-hora/verificar/route.ts`, `src/app/api/publico/solicitud-hora/route.ts`
- Modify: `.env.example`. Agregar las 5 variables sin valor, con un comentario por cada una.
- Test: `route.test.ts` en cada carpeta, con los servicios y libs mockeados como en `src/app/api/integraciones/simple/route.test.ts`.

**Interfaces:**
- Consumes: todo lo producido por las Tareas 1 a 4.
- Produces, en `http.ts`:
  - `ipDe(request: Request): string | null`: primer valor de `x-forwarded-for`, recortado.
  - `encabezadosCors(request: Request): Record<string, string>`:
    - Si `origin === process.env.SOLICITUD_WEB_ORIGEN`, devuelve `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: content-type`, `Access-Control-Max-Age: 600` y `Vary: Origin`.
    - Con cualquier otro origen devuelve `{}`.
  - `responder(request: Request, cuerpo: unknown, status: number): NextResponse`: el JSON más `encabezadosCors`.
  - `limitadorVerificar` y `limitadorEnvio`: instancias de módulo de `crearLimitador` con los valores de Global Constraints.
- Cada ruta exporta `OPTIONS` (204 con CORS) y `POST`, siguiendo los pasos numerados del spec, sección 2:
  - `verificar`:
    - Exceso de límite → 429 `{ error: "LIMITE" }`.
    - JSON inválido o schema → 400 `{ error: "RUT" }`; si el error es de `captcha`, 400 `{ error: "CAPTCHA" }`.
    - Captcha falso → 400 `{ error: "CAPTCHA" }`.
    - Per cápita → 200 `{ ok: false, motivo }` o `{ ok: true, token, tipos }`.
    - `centro_id` sin fila en `centros` → `NO_INSCRITO`, con log.
  - Envío:
    - Exceso de límite → 429.
    - `sitio_web` no vacío → 201 `{ ok: true }` sin guardar, con log.
    - Token inválido → 400 `{ error: "TOKEN" }`.
    - Schema inválido → 400 `{ error: "DATOS", campos: [...] }`.
    - Tipo no habilitado para `centro_id` → 400 `{ error: "DATOS", campos: ["tipo_solicitud_id"] }`.
    - Per cápita distinto de `INSCRITO` → 503 `{ error: "NO_DISPONIBLE" }`.
    - Servicio `ok` (creada o duplicada) → 201 `{ ok: true }`; error → 500 `{ error: "INTERNO" }`.
- Auditoría: `AuditLogger.logDataAccess("CREATE", ok, { name: "Formulario web" }, "solicitudes", { details })`.
  - `details` es `"<ruta> rut=<rut> → <status>"`, más `" duplicada"`, `" trampa"` o `" sin centro"` cuando corresponda.
  - `verificar` usa la acción `"SEARCH"` si el tipo `LogAction` la admite; si no, `"READ"`. Revisar `src/shared/lib/logger.ts`.

- [ ] **Step 1: Escribir las pruebas que deben fallar**
  - `verificar`, un caso por cada salida de la lista anterior.
  - CORS:
    - Con `origin` igual a `SOLICITUD_WEB_ORIGEN`, la respuesta trae `access-control-allow-origin`.
    - Con otro origen no la trae.
    - `OPTIONS` responde 204.
  - Envío:
    - Campo trampa: 201 sin llamar a `registrarSolicitudWeb`.
    - Token vencido: 400 `TOKEN`.
    - Tipo no habilitado: 400.
    - gi caído: 503.
    - Éxito: 201 `{ ok: true }`.
    - Duplicada: 201 `{ ok: true }`, idéntico al éxito.
    - Exceso de límite: 429.
  - Ninguna respuesta contiene `nombre`, `apellido` ni `centro_id`: comprobar con `JSON.stringify(cuerpo)`.
  - Ninguna llamada a `AuditLogger` contiene el teléfono.
- [ ] **Step 2:** Ejecutar `npx vitest run src/app/api/publico`. Resultado esperado: FALLA.
- [ ] **Step 3: Implementar `http.ts`, las dos rutas y `.env.example`**
- [ ] **Step 4:** Ejecutar `npm run lint && npx tsc --noEmit && npm test`. Resultado esperado: todo PASA.
- [ ] **Step 5: Commit** con el mensaje `feat(solicitud-web): endpoints publicos de verificacion y envio`.

---

## Parte B — Sitio (`cormuval/solicitud-hora-cmv`, repo nuevo)

El repo remoto ya existe (privado, creado por el coordinador) y está clonado en `~/Projects/solicitud-hora-cmv`. Los workers commitean en `main` local; **no hacen push**.

### Task 6: Proyecto Astro, layout y landing

**Files:**
- Create: `package.json`, `astro.config.mjs` (`output: "static"`), `tailwind.config.mjs`, `tsconfig.json`, `.editorconfig` (4 espacios), `.gitignore`, `AGENTS.md`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/styles/global.css`, `public/` (logo de la Corporación, si el usuario lo entrega; mientras tanto, texto).

**Interfaces:**
- Produces:
  - `Base.astro` con las props `{ titulo: string }`.
    - Importa `@fontsource/barlow/500.css` y `@fontsource/barlow/600.css`.
    - Define `font-family: Barlow` en `body`, el tamaño base de 18 px, el contenedor `mx-auto w-full max-w-[640px] px-4` y el lang `es`.
  - Variables públicas de build: `PUBLIC_GD_API_URL` y `PUBLIC_TURNSTILE_SITE_KEY`, en `.env.example` sin valor.
  - `AGENTS.md` con las Global Constraints del sitio (presentación y lenguaje neutral) y los comandos.
- Contenido de la landing (`index.astro`):
  - **Título:** "Solicitud de hora".
  - **Texto:** "Te invitamos a solicitar atención en los establecimientos de salud de la Corporación Municipal de Valparaíso de forma ágil y sencilla."
  - **Aviso SAPU:** el texto de urgencias y los horarios de la captura de Simple. Los horarios van en una lista, en lenguaje neutral y en un recuadro de aviso.
  - **Botón:** "Iniciar solicitud", que lleva a `/solicitud`.

- [ ] **Step 1:** Crear el proyecto con `npm create astro@latest -- --template minimal --typescript strict --no-git --install`. Luego ejecutar `npx astro add tailwind` y `npm i @fontsource/barlow`, y agregar `vitest` como dependencia de desarrollo.
- [ ] **Step 2: Implementar el layout y la landing**
- [ ] **Step 3: Verificar**
  - Ejecutar `npm run build`. Resultado esperado: termina sin errores y existe `dist/index.html`.
  - Abrir la página con `npx astro preview` a 375 px y a 1280 px: sin scroll horizontal y con la fuente Barlow aplicada (verificarlo en las herramientas de desarrollador, en "computed font-family").
- [ ] **Step 4: Commit** (sin `git init`: el clon ya existe) con el mensaje `feat: proyecto Astro con landing de solicitud de hora`.

### Task 7: Formulario por pasos

**Files:**
- Create: `src/pages/solicitud.astro`, `src/scripts/formulario.ts` (controlador DOM), `src/lib/validacion.ts`, `src/lib/api.ts`, `src/lib/textos.ts`
- Test: `src/lib/validacion.test.ts` y `src/lib/api.test.ts` (Vitest con `fetch` mockeado).

**Interfaces:**
- Produces:
  - `validarRut(texto: string): string | null`: devuelve el RUT normalizado o null, con el mismo algoritmo que `esRutChilenoValido` de gd.
  - `validarTelefono(texto: string): boolean`: mismas reglas que `normalizarTelefono` de gd.
  - `verificarRut(rut: string, captcha: string): Promise<{ ok: true; token: string; tipos: { id: number; nombre: string }[] } | { ok: false; motivo: "NO_INSCRITO" | "NO_DISPONIBLE" | "CAPTCHA" | "RUT" | "LIMITE" }>`.
  - `enviarSolicitud(cuerpo: CuerpoEnvio): Promise<{ ok: true } | { ok: false; error: "TOKEN" | "DATOS" | "NO_DISPONIBLE" | "LIMITE" | "INTERNO"; campos?: string[] }>`.
    - Cualquier status inesperado o error de red se traduce a `NO_DISPONIBLE`.
  - En `textos.ts`, un mensaje por cada código, con estos textos exactos:
    - `NO_INSCRITO`: "No encontramos una inscripción vigente en nuestros establecimientos. Acércate a tu CESFAM."
    - `NO_DISPONIBLE`: "No pudimos verificar tus datos. Intenta nuevamente en unos minutos."
    - `TOKEN`: "Tu sesión expiró. Ingresa tu RUT nuevamente."
    - `LIMITE`: "Hiciste demasiados intentos. Intenta nuevamente más tarde."
    - Confirmación: "Recibimos tu solicitud. Te contactaremos por teléfono."
- Página `solicitud.astro`, con las tres secciones en la misma página; el script muestra una y oculta las otras:
  - **Paso 1:**
    - Campo RUT con `inputmode="text"` y `autocomplete="off"`.
    - Ayuda: "Si estás haciendo la solicitud por otra persona, ingresa los datos de ella."
    - Widget de Turnstile invisible (`https://challenges.cloudflare.com/turnstile/v0/api.js`).
    - Botón "Continuar".
  - **Paso 2:**
    - Los campos de la tabla del spec, con `inputmode="tel"` en los teléfonos y `type="email"` en el correo.
    - Discapacidad como radios con los tres textos exactos.
    - Motivo como radios generados con `tipos`.
    - Disponibilidad como radios AM, PM y AM/PM, con las etiquetas "AM (8:00 a 13:00)", "PM (14:00 a 17:00)" y "AM / PM (8:00 a 17:00)".
    - Campo trampa `sitio_web`, oculto con CSS fuera de pantalla (no `type=hidden`), con `tabindex=-1` y `autocomplete=off`.
    - Botones "Volver" y "Enviar solicitud".
  - **Confirmación.**
- Comportamiento:
  - Los errores de validación aparecen bajo cada campo, con `aria-live`.
  - Mientras se espera una respuesta, el botón queda deshabilitado y con el texto "Enviando…".
  - Con `TOKEN`, el sitio vuelve al paso 1, conserva los valores del paso 2 en memoria y muestra el mensaje.
  - Con `DATOS`, marca los `campos` devueltos.

- [ ] **Step 1: Escribir las pruebas que deben fallar**
  - `validarRut`: `"12.345.678-5"` da `"12345678-5"`; con DV malo da null.
  - `validarTelefono`: los mismos casos de la Tarea 1.
  - `verificarRut`:
    - 200 `{ ok: false, motivo: "NO_INSCRITO" }` da ese mismo valor.
    - 429 da `LIMITE`.
    - Un error de red da `NO_DISPONIBLE`.
  - `enviarSolicitud`: 201 da `{ ok: true }`; 400 `TOKEN` da `TOKEN`.
- [ ] **Step 2:** Ejecutar `npx vitest run`. Resultado esperado: FALLA.
- [ ] **Step 3: Implementar las libs, la página y el script**
- [ ] **Step 4: Verificar**
  - Ejecutar `npx vitest run && npm run build`. Resultado esperado: PASA.
  - Prueba manual a 375 px contra gd local, con `SOLICITUD_WEB_ORIGEN=http://localhost:4321` y las claves de prueba de Turnstile (site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`).
  - Con `GI_PERCAPITA_URL` apuntando a un mock local, recorrer los cuatro casos: inscrito, no inscrito, gi caído y envío correcto.
  - Confirmar que la solicitud aparece en "Gestionar solicitudes".
- [ ] **Step 5: Commit** con el mensaje `feat: formulario por pasos con verificacion de inscripcion`.

### Task 8: Despliegue y puesta en marcha

**Files:**
- Create en el sitio: `deploy/nginx-solicitudhora.conf` (server block estático, `root /var/www/solicitud-hora/dist`, `try_files $uri $uri/ $uri.html =404`, caché larga para `/_astro/`, headers `X-Content-Type-Options` y `Referrer-Policy`), y `README.md` con build, variables y pasos de despliegue.
- Modify en gd: no cambia nada. El seed corre en cada deploy (`deploy.yml`), así que el orientador web se crea solo.

**Checklist operativo.** Lo ejecuta o aprueba el usuario. No hay que hacerlo sin pedirlo:

1. Crear el sitio en Cloudflare Turnstile para `solicitudhora.cmvalparaiso.cl` y el dominio temporal `hora.cmvalparaiso.cl`.
2. Crear en gi una api-key para gd: `apiKey` con `estado: true`.
3. Agregar las 5 variables al secret `ENV_PRODUCTION` del entorno `produccion`.
   - Se construye a partir del `.env` del servidor y se pasa por pipe a `gh secret set ENV_PRODUCTION --env produccion`, mostrando solo los nombres de las variables.
   - `SOLICITUD_WEB_ORIGEN` toma primero `https://hora.cmvalparaiso.cl`.
4. Hacer merge y deploy de gd. Verificar que el funcionario `11111113-8` existe.
5. Publicar el sitio en server-das bajo `hora.cmvalparaiso.cl` (DNS ya apunta a server-das), con certificado, y repetir los cuatro casos de la Tarea 7 contra producción con un RUT de prueba acordado con el usuario.
6. Cambiar `SOLICITUD_WEB_ORIGEN` al dominio definitivo y el DNS de `solicitudhora.cmvalparaiso.cl` a server-das.

- [ ] **Step 1:** Escribir `deploy/nginx-solicitudhora.conf` y `README.md`.
- [ ] **Step 2:** Ejecutar `nginx -t` sobre el archivo en un contenedor (`docker run --rm -v $PWD/deploy:/etc/nginx/conf.d nginx nginx -t`). Resultado esperado: `syntax is ok`.
- [ ] **Step 3: Commit** con el mensaje `docs: despliegue en server-das`.
