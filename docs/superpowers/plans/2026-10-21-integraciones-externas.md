# Integraciones externas (Simple y derivación interna) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Simple (vía gi) y la derivación interna (GAS) creen solicitudes en `gestion_demanda` a través de dos endpoints HTTPS de la app, sin escribir directo en MySQL.

**Architecture:** Módulo `integraciones` en la app: rutas delgadas (`src/app/api/integraciones/*/route.ts`) que autentican por api-key y delegan en servicios Prisma con transacción. gi deja de usar MySQL y reenvía el body de Simple; GAS reemplaza sus INSERT JDBC por un `UrlFetchApp.fetch`.

**Tech Stack:** Next.js 15 App Router, Prisma 6 / MySQL 8.4, Zod, Vitest (app y gi); Google Apps Script con tests en Node (`scripts/*.js`) en informe-diario-2.0.

**Spec:** `docs/superpowers/specs/2026-10-21-integraciones-externas-design.md`

## Global Constraints

- Dominio de la app: `https://gd.cmvalparaiso.cl` (gd2 en desuso).
- Rutas: `POST /api/integraciones/simple` (cliente `GI`) y `POST /api/integraciones/derivacion-interna` (cliente `GAS`).
- Keys: `INTEGRACION_KEY_GI`, `INTEGRACION_KEY_GAS`; header `api-key`; comparación con `timingSafeEqual`; variable ausente = rechazo.
- 403 con body exacto `{ "Mensaje": "api-key no valida" }`.
- Valores fijos: `estado_solicitud = "En Curso"`; Simple: `accion = "En espera de validación"`, `rut_orientador = "11111112-3"`; DI: `rut_orientador = rut_gestor = "11111112-2"`, validada `accion = "Realizar solicitud"`, pendiente `accion = "En espera de validación"`.
- Paciente nuevo: `nombre = "Sin registro"` (o el nombre de DI si viene con contenido), `apellido = ""`, `centro_id` de la solicitud.
- Cita DI: `id_cita = solicitud_id = id_solicitud`, `tipo_prestacion = "Agendar una hora con profesional"`, `estado_cita = "Sin llamadas"`, `priorizacion_clinica = "Media"`, `priorizacion = 60`.
- `fecha_inicio` de Simple: `YYYY-MM-DD HH:mm:ss` en `America/Santiago`, guardado como instante.
- Auditoría sin teléfono, correo ni nombre del paciente.
- Convenciones del repo de la app: español, 4 espacios, imports con comentarios `// lib`, `// types`; sin `console.log`.

## Review Focus

- **Body no JSON o vacío:** la ruta responde 400 `Datos inválidos`, no 500. → test en Task 5.
- **`centro_id` numérico (`650`)**: se guarda como `"650"`; `motivo_id` como texto `"12"` es inválido (400), no se castea en silencio. → tests en Task 2.
- **Paciente existente con `telefono: ""` en Simple:** no se borra el teléfono actual. → test en Task 3.
- **Validada con profesional o prestación inexistente:** 422 y no queda la solicitud escrita (transacción). → test en Task 4.
- **gi con la app caída o lenta:** Simple recibe 500 a los 15 s, nunca un cuelgue ni un 201 falso. → test en Task 6.

---

### Task 1: Base del módulo (tipos, normalización, hora de Chile, autenticación)

**Files:**
- Create: `src/modules/integraciones/types/integraciones.ts`
- Create: `src/modules/integraciones/utils/normalizacion.ts` (+ `normalizacion.test.ts`)
- Create: `src/modules/integraciones/lib/autenticarIntegracion.ts` (+ `autenticarIntegracion.test.ts`)
- Modify: `.env.example` (agregar `INTEGRACION_KEY_GI=""` e `INTEGRACION_KEY_GAS=""` con un comentario `# Integraciones externas`)

**Interfaces:**
- Produces:
  - `type ClienteIntegracion = "GI" | "GAS"`
  - `type CodigoErrorIntegracion = "DUPLICADO" | "CATALOGO" | "INTERNO"`
  - `type ResultadoIntegracion = { ok: true; data: { id_solicitud: string } } | { ok: false; codigo: CodigoErrorIntegracion; error: string }`
  - `vacioANull(valor: unknown): string | null` — `null`/`undefined`/texto vacío tras `trim` → `null`; si no, `String(valor).trim()`.
  - `instanteDesdeHoraChile(texto: string): Date | null` — parsea `YYYY-MM-DD HH:mm:ss` como hora de `America/Santiago`; `null` si el formato no calza.
  - `autenticarIntegracion(request: Request, cliente: ClienteIntegracion): boolean`

- [ ] **Step 1: Tests de `normalizacion.test.ts`**

```ts
it("vacioANull trata null, undefined y blancos como ausentes", () => {
    expect(vacioANull(null)).toBeNull();
    expect(vacioANull(undefined)).toBeNull();
    expect(vacioANull("   ")).toBeNull();
    expect(vacioANull(" +569 ")).toBe("+569");
    expect(vacioANull(650)).toBe("650");
});
it("instanteDesdeHoraChile convierte hora de Chile al instante real", () => {
    expect(instanteDesdeHoraChile("2026-10-19 16:33:51")?.toISOString()).toBe("2026-10-19T19:33:51.000Z");
    expect(instanteDesdeHoraChile("2026-07-15 10:00:00")?.toISOString()).toBe("2026-07-15T14:00:00.000Z");
    expect(instanteDesdeHoraChile("2026-09-06 00:30:00")?.toISOString()).toBe("2026-09-06T04:30:00.000Z");
    expect(instanteDesdeHoraChile("19/10/2026 16:33")).toBeNull();
});
```

- [ ] **Step 2: Tests de `autenticarIntegracion.test.ts`** (con `vi.stubEnv`)

```ts
it("acepta la key del cliente", () => { /* INTEGRACION_KEY_GI="k-gi"; header api-key: k-gi → true */ });
it("rechaza key incorrecta o ausente", () => { /* header "x" → false; sin header → false */ });
it("rechaza si la variable no está definida", () => { /* INTEGRACION_KEY_GAS sin definir; header "" → false */ });
it("la key de un cliente no sirve para el otro", () => { /* header k-gi con cliente "GAS" → false */ });
```

- [ ] **Step 3: Correr y ver fallar** — `npx vitest run src/modules/integraciones` → FAIL (módulos no existen).

- [ ] **Step 4: Implementar**
  - `instanteDesdeHoraChile`: regex `^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$`, `Date.UTC` con los componentes y luego el mismo algoritmo de desfase de `horaChileAInstante` (`prisma/scripts/migracion-appsheet/reglas.ts`, PR #43): `Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hourCycle: "h23", ... })`, un reintento cerca del cambio de hora y avance en la hora inexistente. Se copia el algoritmo, no se importa desde `prisma/scripts`.
  - `autenticarIntegracion`: lee `process.env[cliente === "GI" ? "INTEGRACION_KEY_GI" : "INTEGRACION_KEY_GAS"]`; si falta o está vacía → `false`; compara `Buffer`s con `timingSafeEqual` solo si tienen el mismo largo.

- [ ] **Step 5: Correr y ver pasar** — `npx vitest run src/modules/integraciones` → PASS.

- [ ] **Step 6: Commit** — `feat(integraciones): tipos, normalización y autenticación por api-key`

---

### Task 2: Esquemas Zod

**Files:**
- Create: `src/modules/integraciones/schemas/simple.schema.ts` (+ test)
- Create: `src/modules/integraciones/schemas/derivacionInterna.schema.ts` (+ test)

**Interfaces:**
- Consumes: `vacioANull`, `instanteDesdeHoraChile` (Task 1).
- Produces:
  - `simpleSchema` y `type SolicitudSimple = z.output<typeof simpleSchema>` con: `id_solicitud: string`, `fecha_inicio: Date`, `rut_usuario: string`, `tipo_solicitud_id: number`, `motivo_id: number | null`, `descripcion: string | null`, `disponibilidad_llamada: "AM" | "PM" | "AM/PM" | null`, `priorizacion_admin: number | null`, `centro_id: string`, `telefono: string | null`, `correo: string | null`.
  - `derivacionInternaSchema` y `type DerivacionInterna = z.output<...>`: `{ modo: "validada" | "pendiente"; paciente: { rut: string; nombre: string | null }; solicitud: { id_solicitud: string; tipo_solicitud_id: number; motivo_id: number | null; descripcion: string | null; centro_id: string }; cita: { profesional_id: number; prestacion_id: number; fecha_estimada_atencion: Date; observacion: string | null } | null }`.

Reglas: textos con `trim`, `id_solicitud` 1–50, `rut` 1–50; IDs con `z.number().int()` (sin coerción: `"12"` es inválido); `centro_id` acepta número o texto y sale como texto no vacío; `telefono`/`correo` opcionales pasados por `vacioANull`; los campos fijos del contrato de Simple se permiten y se descartan (`.strip()` por defecto); `fecha_estimada_atencion` en `YYYY-MM-DD` → `Date` UTC a medianoche (columna DATE); `superRefine`: `cita` obligatoria si `modo = "validada"` y prohibida si `"pendiente"`.

- [ ] **Step 1: Tests** (`safeParse`):
  - El ejemplo del contrato v2.2 (`gestion-informacion-das/docs/api/api-solicitud-simple-v2.2.md`) es válido; `centro_id: 501` sale `"501"`; `fecha_inicio` sale `2026-05-14T16:25:15.000Z`; `telefono: ""` sale `null`.
  - Inválidos: `motivo_id: "12"`, `disponibilidad_llamada: "Noche"`, `fecha_inicio: "14/05/2026"`, `id_solicitud: ""` → `success: false` con el campo en `error.flatten().fieldErrors`.
  - DI validada sin `cita` → inválido en `cita`; pendiente con `cita` → inválido; pendiente con `cita: null` u omitida → válido; `paciente.nombre: "  "` sale `null`.
- [ ] **Step 2: Ver fallar** — `npx vitest run src/modules/integraciones/schemas` → FAIL.
- [ ] **Step 3: Implementar los dos esquemas.**
- [ ] **Step 4: Ver pasar** — mismo comando → PASS.
- [ ] **Step 5: Commit** — `feat(integraciones): esquemas de Simple y derivación interna`

---

### Task 3: Servicio de Simple y alta de paciente

**Files:**
- Create: `src/modules/integraciones/services/paciente.ts`
- Create: `src/modules/integraciones/services/catalogos.ts`
- Create: `src/modules/integraciones/services/registrarSolicitudSimple.ts` (+ test)

**Interfaces:**
- Consumes: `SolicitudSimple` (Task 2), `ResultadoIntegracion` (Task 1).
- Produces:
  - `type Tx = Prisma.TransactionClient`
  - `asegurarPaciente(tx: Tx, datos: { rut: string; nombre: string | null; centro_id: string; telefono?: string | null; correo?: string | null }, opciones: { actualizarContacto: boolean }): Promise<void>` — si no existe crea con `nombre ?? "Sin registro"`, `apellido: ""`; si existe y `actualizarContacto`, actualiza solo `telefono`/`correo_contacto` no nulos (sin datos no hace `update`).
  - `class ErrorIntegracion extends Error { codigo: CodigoErrorIntegracion }` (solo uso interno en servicios; las rutas reciben `ResultadoIntegracion`).
  - `verificarCatalogos(tx: Tx, ids: { tipo_solicitud_id: number; motivo_id: number | null; rut_funcionario: string; profesional_id?: number; prestacion_id?: number }): Promise<void>` — lanza `ErrorIntegracion("CATALOGO", "<campo> <valor> no existe")` por el primero que falte (`findUnique` por PK).
  - `registrarSolicitudSimple(datos: SolicitudSimple): Promise<ResultadoIntegracion>`

Flujo de `registrarSolicitudSimple` dentro de `prisma.$transaction(async (tx) => …)`: `verificarCatalogos` (funcionario `11111112-3`) → `tx.solicitud.findUnique` por id; si existe `ErrorIntegracion("DUPLICADO", "La solicitud ya existe")` → `asegurarPaciente(..., { actualizarContacto: true })` → `tx.solicitud.create` con los valores fijos de Global Constraints. Fuera de la transacción: `ErrorIntegracion` → `{ ok: false, codigo, error }`; `Prisma.PrismaClientKnownRequestError` `P2002` → `DUPLICADO`; cualquier otro → `{ ok: false, codigo: "INTERNO", error: "Error interno del servidor" }` y `console.error` del detalle.

- [ ] **Step 1: Tests** (mock de `@/shared/lib/prisma` con `$transaction: vi.fn((fn) => fn(tx))` y un `tx` con `solicitud`, `usuario`, `tipoSolicitud`, `motivo`, `funcionario`):
  - "crea paciente Sin registro si no existe y la solicitud con valores fijos": `usuario.create` con `{ rut, nombre: "Sin registro", apellido: "", centro_id: "501", telefono: "+56987654321", correo_contacto: "paciente@example.cl" }`; `solicitud.create` con `estado_solicitud: "En Curso"`, `accion: "En espera de validación"`, `rut_orientador: "11111112-3"`, `rut_gestor: null`, `fecha_validacion: null`; resultado `{ ok: true, data: { id_solicitud: "DES99-2" } }`.
  - "paciente existente: actualiza solo el contacto que llega": `telefono: "+569", correo: null` → `usuario.update` con `{ telefono: "+569" }` únicamente.
  - "paciente existente sin contacto: no lo modifica": `usuario.update` no llamado.
  - "id repetido → DUPLICADO sin crear nada".
  - "tipo inexistente → CATALOGO con mensaje `tipo_solicitud_id 99 no existe`".
  - "P2002 al crear → DUPLICADO"; "error genérico → INTERNO con mensaje genérico".
- [ ] **Step 2: Ver fallar** — `npx vitest run src/modules/integraciones/services` → FAIL.
- [ ] **Step 3: Implementar** `paciente.ts`, `catalogos.ts`, `registrarSolicitudSimple.ts`.
- [ ] **Step 4: Ver pasar** → PASS.
- [ ] **Step 5: Commit** — `feat(integraciones): registrar solicitud de Simple`

---

### Task 4: Servicio de derivación interna

**Files:**
- Create: `src/modules/integraciones/services/registrarDerivacionInterna.ts` (+ test)

**Interfaces:**
- Consumes: `DerivacionInterna` (Task 2); `asegurarPaciente`, `verificarCatalogos`, `ErrorIntegracion`, `Tx` (Task 3).
- Produces: `registrarDerivacionInterna(datos: DerivacionInterna, ahora?: Date): Promise<ResultadoIntegracion>` (`ahora` por defecto `new Date()`, para tests).

En una transacción: `verificarCatalogos` (funcionario `11111112-2`; `profesional_id` y `prestacion_id` si hay cita) → duplicado → `asegurarPaciente(..., { actualizarContacto: false })` con `nombre = paciente.nombre` → `tx.solicitud.create` (`fecha_inicio = fecha_validacion = ahora`, `disponibilidad_llamada: null`, `priorizacion_admin: 2`, `ultimo_control: null`, `accion` por modo) → si validada `tx.cita.create` con los fijos de Global Constraints, `fecha_creacion = ahora`, `rut_usuario = paciente.rut`. Mismo manejo de errores que Task 3 (extraer `aResultado(error): ResultadoIntegracion` a `services/errores.ts` si Task 3 lo dejó inline).

- [ ] **Step 1: Tests:**
  - "validada: solicitud Realizar solicitud y cita Sin llamadas": `solicitud.create` con `accion: "Realizar solicitud"`, `estado_solicitud: "En Curso"`, `rut_orientador: "11111112-2"`, `rut_gestor: "11111112-2"`, `priorizacion_admin: 2`; `cita.create` con `id_cita` = `solicitud_id` = `"ESP-a1b2c3"`, `estado_cita: "Sin llamadas"`, `priorizacion: 60`, `priorizacion_clinica: "Media"`, `tipo_prestacion: "Agendar una hora con profesional"`, `centro_id: "650"`.
  - "pendiente: solo solicitud En espera de validación": `cita.create` no llamado.
  - "usa el nombre de la derivación al crear el paciente" / "sin nombre → Sin registro" / "paciente existente no se modifica" (`usuario.update` no llamado).
  - "prestación inexistente → CATALOGO y no crea solicitud ni cita".
  - "falla la cita → la transacción propaga el error": `cita.create` rechaza → resultado `INTERNO` (el rollback lo garantiza `$transaction`; el test verifica que el error sale del callback).
- [ ] **Step 2: Ver fallar** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Ver pasar** → PASS.
- [ ] **Step 5: Commit** — `feat(integraciones): registrar derivación interna`

---

### Task 5: Rutas HTTP y auditoría

**Files:**
- Create: `src/modules/integraciones/lib/responder.ts` (+ test)
- Create: `src/app/api/integraciones/simple/route.ts` (+ `route.test.ts`)
- Create: `src/app/api/integraciones/derivacion-interna/route.ts` (+ `route.test.ts`)

**Interfaces:**
- Consumes: `autenticarIntegracion` (Task 1), esquemas (Task 2), servicios (Tasks 3–4), `AuditLogger` (`src/shared/lib/logger.ts`).
- Produces: `procesarIntegracion<T>(request: Request, opciones: { cliente: ClienteIntegracion; ruta: string; schema: ZodType<T>; registrar: (datos: T) => Promise<ResultadoIntegracion>; detalle: (datos: T) => string }): Promise<NextResponse>`; cada `route.ts` exporta solo `POST` que llama a `procesarIntegracion`.

Flujo: auth falla → `AuditLogger.logSecurity("CREATE", false, { name: "Integración <cliente>" }, { details: ruta })` + 403. JSON inválido o `safeParse` falla → 400 `{ error: "Datos inválidos", detalles: fieldErrors }` (JSON roto: `detalles: {}`). Resultado → 201 `{ message: "Solicitud creada con éxito", id_solicitud }` / 409 `{ error }` / 422 `{ error }` / 500 `{ error: "Error interno del servidor" }`. Toda petición autenticada se audita con `logDataAccess("CREATE", ok, { name: "Integración GI" | "Integración GAS" }, "solicitudes", { details: \`${ruta} ${detalle(datos)} → ${status}\` })`; `detalle` devuelve `id_solicitud` (Simple) o `id_solicitud modo` (DI), nunca datos de contacto.

- [ ] **Step 1: Tests de rutas** (mock de servicios, logger y `vi.stubEnv`):
  - `simple`: sin key → 403 con body exacto `{ Mensaje: "api-key no valida" }` y `logSecurity` llamado; key de GAS en la ruta simple → 403; body `"no-json{"` → 400 `Datos inválidos`; ejemplo v2.2 → 201 con `id_solicitud`; servicio `DUPLICADO` → 409; `CATALOGO` → 422; `INTERNO` → 500 con mensaje genérico.
  - `derivacion-interna`: 201 validada; 400 por validada sin cita.
  - La auditoría del 201 no contiene `+56987654321` ni `paciente@example.cl`.
- [ ] **Step 2: Ver fallar** — `npx vitest run src/app/api/integraciones src/modules/integraciones` → FAIL.
- [ ] **Step 3: Implementar** `responder.ts` y las dos rutas.
- [ ] **Step 4: Verificación completa** — `npm test`, `npx tsc --noEmit` y `npm run lint` → sin errores; `npm run build` → compila con las rutas `/api/integraciones/*`.
- [ ] **Step 5: Commit** — `feat(integraciones): rutas HTTP con api-key y auditoría`

---

### Task 6: gi — reenvío de Simple a la app

Repo: `/Users/usuario/Projects/gestion-informacion-das`, rama `feat/simple-hacia-gestion-demanda` desde `main`.

**Files:**
- Modify: `src/app/api/data/solicitud-simple/route.ts`
- Create: `src/app/api/data/solicitud-simple/route.test.ts`
- Modify: `.github/workflows/node.js.yml` (bloque del `.env`: `GD_API_URL=https://gd.cmvalparaiso.cl` y `GD_API_KEY=${{ secrets.GD_API_KEY }}`)
- Modify: `.env.example` (`GD_API_URL=http://localhost:3000`, `GD_API_KEY=`)

**Interfaces:**
- Consumes: contrato HTTP de la app (Task 5): 201 `{ message, id_solicitud }`, 403/400/409/422/500 `{ error }`.

Cambios: se mantiene `conexionMongoBD` + `validarApiKey` + 403 propio y `auditApi`. Se quitan `mysql2`, el `INSERT` y el upsert de `usuarios`. Se envía `fetch(\`${process.env.GD_API_URL}/api/integraciones/simple\`, { method: "POST", headers: { "Content-Type": "application/json", "api-key": process.env.GD_API_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) })`. 201 → 201 `{ message: "Solicitud creada con éxito", result: { affectedRows: 1 } }`; cualquier otro código o excepción → 500 `{ error: "Error interno del servidor" }` y `auditApi(... success: false, error: \`gd ${status}: ${error}\` )`. Se eliminan los `console.log` de key y body.

- [ ] **Step 1: Tests** (mock de `@/shared/lib/database`, `@/shared/lib/auth`, `@/shared/lib/logger` y `global.fetch`):
  - "key de Simple inválida → 403 sin llamar a la app".
  - "reenvía el body intacto con la key de la app y responde 201 con result" (verifica URL, header `api-key` y `JSON.parse(body)` igual al recibido).
  - "la app responde 409 → 500 genérico y auditApi con success false".
  - "timeout (fetch rechaza con `TimeoutError`) → 500 genérico".
- [ ] **Step 2: Ver fallar** — `npx vitest run src/app/api/data/solicitud-simple` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** — `npm test`, `npx tsc --noEmit`, `npm run lint` del repo gi → sin errores nuevos.
- [ ] **Step 5: Commit** — `feat(solicitud-simple): reenviar a gestión de la demanda en vez de escribir en MySQL`

---

### Task 7: GAS — envío de derivaciones a la app

Repo: `/Users/usuario/Projects/informe-diario-2.0`, rama `feat/derivacion-hacia-gestion-demanda` desde `main`.

**Files:**
- Create: `back-end/informe_diario/enviarDerivacionGD.js`
- Modify: `back-end/informe_diario/derivacionInternasGD.js` (ramas de `procesarDerivacionInterna` y las tres funciones `crear*DI`)
- Create: `scripts/test_payload_derivacion_gd.js`

**Interfaces:**
- Consumes: contrato de `POST /api/integraciones/derivacion-interna` (spec §4).
- Produces (globales GAS):
  - `construirPayloadDerivacionGD(infoDerivacion, modo, ids)` → objeto del contrato; `ids = { tipoSolicitudId, motivoId, profesionalId, prestacionId }`. Pura, sin APIs de GAS.
  - `formatearFechaGD(fecha)` → `"YYYY-MM-DD"`: si es texto que empieza con `YYYY-MM-DD`, esos 10 caracteres; si es `Date`, con `getFullYear/getMonth/getDate` (zona del script).
  - `enviarDerivacionGD(payload)` → `UrlFetchApp.fetch(GD_API_URL + "/api/integraciones/derivacion-interna", { method: "post", contentType: "application/json", headers: { "api-key": GD_API_KEY }, payload: JSON.stringify(payload), muteHttpExceptions: true })`; si el código no es 201, `console.error` con código y cuerpo; nunca lanza.

Reglas del payload: `paciente = { rut: rutPaciente, nombre: nombrePaciente || null }`; `solicitud.id_solicitud` y `descripcion` como hoy (`establecimientoRem.substring(0, 3) + "-" + actividad.id.substring(0, 6)` y el texto `DERIVACIÓN INTERNA…`); `centro_id = obtenerIdCentroDI(establecimientoRem)`; si `modo === "validada"`: `cita = { profesional_id, prestacion_id, fecha_estimada_atencion: formatearFechaGD(fecha con el fallback de 3 vías de crearCitaDI), observacion: descripcion }`. **Si en validada `profesionalId` o `prestacionId` es `null`, el payload se arma como `modo: "pendiente"` sin cita** (hoy quedaba una solicitud validada sin cita, invisible para todos). En `procesarDerivacionInterna`, la rama `comunicador` llama una vez con `"validada"` y la otra con `"pendiente"`. `GD_API_URL` y `GD_API_KEY` vía `PropertiesService.getScriptProperties()`; sin ellas `console.error` y no se envía.

- [ ] **Step 1: Test Node** (`eval` de `catalogoDerivacionInterna.js`, `derivacionInternasGD.js` y `enviarDerivacionGD.js`, como `scripts/test_etapa_por_centro.js`), casos:
  - validada completa → `modo "validada"`, `cita.fecha_estimada_atencion === "2026-11-15"` con `fechaProximoControlDI: "2026-11-15"`, `solicitud.centro_id === 650` para `ESPERANZA`.
  - validada con `prestacionId: null` → `modo "pendiente"` y `cita` ausente.
  - pendiente → sin `cita`; `paciente.nombre === null` si `nombrePaciente` falta.
  - `formatearFechaGD(new Date(2026, 10, 15))` → `"2026-11-15"`.
- [ ] **Step 2: Ver fallar** — `node scripts/test_payload_derivacion_gd.js` → error (función no definida).
- [ ] **Step 3: Implementar** y reemplazar los `INSERT` JDBC de derivación por `enviarDerivacionGD(construirPayloadDerivacionGD(...))`. `conectarBD` no se borra.
- [ ] **Step 4: Ver pasar** — `node scripts/test_payload_derivacion_gd.js` y los demás `node scripts/test_*.js` → OK.
- [ ] **Step 5: Commit** — `feat(derivacion-interna): enviar a gestión de la demanda por HTTPS`

---

### Task 8: Prueba integrada contra `gestion_demanda_ensayo` (la hace el controlador, no un subagente)

- [ ] **Step 1:** App local (rama `feat/integraciones-externas`) con `DATABASE_URL` a `gestion_demanda_ensayo` (vía túnel al server) y keys de prueba en `.env`.
- [ ] **Step 2:** `curl` a `/api/integraciones/simple` con el ejemplo v2.2 (`id_solicitud: "PRU-INT-001"`, `centro_id: 501`, RUT inexistente) → 201; en la BD: paciente `Sin registro`, solicitud `En Curso`; en la app (centro 501) aparece en Gestionar solicitudes y **se puede abrir**. Repetir → 409.
- [ ] **Step 3:** gi local (`GD_API_URL=http://localhost:3000`) → POST a su `/api/data/solicitud-simple` → 201 y fila creada.
- [ ] **Step 4:** `curl` a `/api/integraciones/derivacion-interna` validada (`PRU-INT-002`) y pendiente (`PRU-INT-003`) → cita en Contactar pacientes y solicitud en Gestionar solicitudes.
- [ ] **Step 5:** GAS en el deployment de prueba (`AKfycbzcV…`) con `GD_API_URL` apuntando a un túnel público temporal de la app local o, si no hay, se deja para la prueba de humo del corte.
- [ ] **Step 6:** Borrar `PRU-INT-*` (citas, solicitudes y pacientes creados) del ensayo.
