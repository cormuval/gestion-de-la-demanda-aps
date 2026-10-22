# Integraciones SAPU y contrarreferencia — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que derivaciones SAPU y gestión de contrarreferencia registren sus solicitudes (y citas) en `gestion_demanda`
a través de dos endpoints HTTPS nuevos del módulo `integraciones`, en vez de escribir por JDBC en la base de AppSheet.

**Architecture:** La app suma `POST /api/integraciones/sapu` (lote, resultado por fila, una transacción por fila) y
`POST /api/integraciones/contrarreferencia` (un caso, una transacción, 201/409/422/500), reutilizando autenticación,
paciente, catálogos y errores del módulo. Cada GAS conserva sus reglas de selección, IDs y centro, arma el cuerpo
con funciones puras testeables en Node y lo envía con `UrlFetchApp` con 3 intentos.

**Tech Stack:** Next.js 15 App Router, Prisma 6 / MySQL 8.4, Zod, Vitest (app). Google Apps Script V8 + clasp;
tests de funciones puras con `node` (GAS).

**Spec:** `docs/superpowers/specs/2026-10-22-integraciones-sapu-contrarreferencia-design.md`

## Repos y ramas

| Repo (ruta local) | Rama | Tareas |
| --- | --- | --- |
| `gestion-de-la-demanda-aps` (este repo) | `feat/integraciones-sapu-contrarreferencia` (ya existe, tiene la spec) | 1–6 |
| `../derivaciones-sapu-gestion-demanda` | `feat/envio-gestion-demanda` (crear desde `main`) | 7–8 |
| `../gestion-contrarreferencias-aps` | `feat/envio-gestion-demanda` (crear desde `main`) | 9–10 |

## Global Constraints

- Idioma español en código, comentarios, mensajes y commits. App: indentación 4 espacios y comentarios de imports
  por categoría (`// lib`, `// services`, `// types`…). GAS: respetar la indentación de cada archivo (SAPU 2
  espacios; contrarreferencia 2 espacios).
- Nunca escribir credenciales, api-keys ni URLs con contraseña en archivos o commits. Las keys viven solo en
  `ENV_PRODUCTION` / Script Properties.
- Fechas de entrada: `"YYYY-MM-DD HH:mm:ss"` en hora de Chile → `instanteDesdeHoraChile` (ya existe en
  `src/modules/integraciones/utils/normalizacion.ts`). Fechas de cita: `"YYYY-MM-DD"` → DATE UTC medianoche.
- Valores exactos: estado `"En Curso"`; SAPU tipo 17, funcionario `11111112-3`; contrarreferencia tipo 18,
  funcionario `11111111-1`; `priorizacion_admin` 3.6; `disponibilidad_llamada` `"AM/PM"`; acción
  `"En espera de validación"` / `"Realizar solicitud"`; cita `"Sin llamadas"`, `"Alta"`, 80,
  `"Agendar una hora con profesional"`.
- Variables: `INTEGRACION_KEY_SAPU`, `INTEGRACION_KEY_CONTRARREFERENCIA`. Script Properties GAS: `GD_API_URL`,
  `GD_API_KEY`. Lote SAPU máximo 500.
- Auditoría sin RUT, nombres ni teléfonos.
- Cada repo GAS necesita `.claspignore` que excluya `**/scripts/**`, `**/.git/**`, `.gitignore`, `**/node_modules/**`
  y `**/.claude/**` (hoy no tiene y `clasp push` subiría los tests).
- `npm run lint`, `npm test` y `npx tsc --noEmit` verdes al terminar cada tarea de la app.

## Review Focus

1. Recargar el mismo Excel SAPU: todas las filas vuelven `duplicada`, `guardados` = 0 y nada se modifica (Tarea 3).
2. `contrarreferencia_id` 43 frente a una solicitud con `Registro Contrarreferencia ID: 4321 | …`: no es duplicado (Tarea 5).
3. `fechaRegistroContralor` llega como `"2026-10-22 10:30:00.0"` (con fracción) desde `getString`: se envía sin fracción (Tarea 9).
4. Una tanda SAPU que falla por completo mientras otra se crea: la pantalla cuenta bien guardados/duplicados y marca con error solo las filas de la tanda fallida, con su número de fila del Excel (Tarea 8).
5. Fila SAPU con `centro_id` vacío o `fecha_inicio` imposible: solo esa fila `rechazada`, el lote sigue (Tarea 2/3).

---

### Task 1: Clientes nuevos y apellido en `asegurarPaciente`

**Files:**
- Modify: `src/modules/integraciones/types/integraciones.ts`
- Modify: `src/modules/integraciones/lib/autenticarIntegracion.ts`
- Modify: `src/modules/integraciones/lib/autenticarIntegracion.test.ts`
- Modify: `src/modules/integraciones/services/paciente.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `ClienteIntegracion = "GI" | "GAS" | "SAPU" | "CONTRARREFERENCIA"`; `DatosPaciente.apellido?: string | null`
  (al crear: `apellido ?? ""`; al actualizar no se toca).

- [ ] **Step 1: Test** en `autenticarIntegracion.test.ts`:

```ts
it("acepta las keys de SAPU y CONTRARREFERENCIA y no las cruza", () => {
    vi.stubEnv("INTEGRACION_KEY_SAPU", "k-sapu");
    vi.stubEnv("INTEGRACION_KEY_CONTRARREFERENCIA", "k-cr");
    expect(autenticarIntegracion(pedido("k-sapu"), "SAPU")).toBe(true);
    expect(autenticarIntegracion(pedido("k-cr"), "CONTRARREFERENCIA")).toBe(true);
    expect(autenticarIntegracion(pedido("k-sapu"), "CONTRARREFERENCIA")).toBe(false);
});
```

- [ ] **Step 2:** `npx vitest run src/modules/integraciones/lib` → FAIL (tipo/variable inexistente).
- [ ] **Step 3:** Ampliar `ClienteIntegracion` y `VARIABLE_POR_CLIENTE` (`SAPU: "INTEGRACION_KEY_SAPU"`,
  `CONTRARREFERENCIA: "INTEGRACION_KEY_CONTRARREFERENCIA"`). Agregar `apellido` a `DatosPaciente`. Agregar las dos
  variables vacías a `.env.example` bajo `# Integraciones externas`.
- [ ] **Step 4:** `npm test` → PASS (los tests existentes de Simple y DI siguen verdes: crean con `apellido: ""`).
- [ ] **Step 5:** Commit `feat(integraciones): clientes SAPU y contrarreferencia`.

### Task 2: Schemas de la carga SAPU

**Files:**
- Create: `src/modules/integraciones/schemas/sapu.schema.ts`
- Test: `src/modules/integraciones/schemas/sapu.schema.test.ts`

**Interfaces:**
- Produces:
  - `cargaSapuSchema`: `{ archivo: string | null; solicitudes: unknown[] }` — `archivo` opcional (vacío → null,
    recortado a 150); `solicitudes` arreglo de 1 a 500 elementos (`MAX_LOTE_SAPU = 500`, exportada). Las filas
    **no** se validan aquí.
  - `filaSapuSchema` → `FilaSapu = { id_solicitud: string; fecha_inicio: Date; paciente: { rut: string; nombre: string | null }; motivo_id: number; descripcion: string | null; centro_id: string }`.
  - Tipos `CargaSapu`, `FilaSapu` (`z.output`).

- [ ] **Step 1: Tests** (reglas de la tabla "Validación por fila" de la spec, sección 2):

```ts
const fila = { id_solicitud: "SAPU BARON-615-1", fecha_inicio: "2026-10-20 22:59:00",
    paciente: { rut: "12345678-9", nombre: "Juan" }, motivo_id: 56, descripcion: "Caso", centro_id: 615 };

it("lote: rechaza no-arreglo, vacío y más de 500; acepta 500 filas cualesquiera", () => {
    expect(cargaSapuSchema.safeParse({ solicitudes: {} }).success).toBe(false);
    expect(cargaSapuSchema.safeParse({ solicitudes: [] }).success).toBe(false);
    expect(cargaSapuSchema.safeParse({ solicitudes: Array(501).fill(fila) }).success).toBe(false);
    expect(cargaSapuSchema.safeParse({ solicitudes: Array(500).fill({ basura: 1 }) }).success).toBe(true);
});
it("fila: fecha Chile → instante real y centro número → texto", () => {
    const r = filaSapuSchema.parse(fila);
    expect(r.fecha_inicio.toISOString()).toBe("2026-10-21T01:59:00.000Z");
    expect(r.centro_id).toBe("615");
});
it("fila: nombre en blanco → null; nombre largo recortado a 50", () => { /* "  " → null; "n".repeat(80) → length 50 */ });
it("fila: rechaza fecha imposible, centro vacío, motivo texto y rut vacío", () => {
    for (const malo of [{ fecha_inicio: "2026-02-31 10:00:00" }, { fecha_inicio: "20/10/2026" }, { centro_id: "" },
        { centro_id: null }, { motivo_id: "56" }, { paciente: { rut: "" } }]) {
        expect(filaSapuSchema.safeParse({ ...fila, ...malo }).success).toBe(false);
    }
});
```

- [ ] **Step 2:** `npx vitest run src/modules/integraciones/schemas/sapu` → FAIL.
- [ ] **Step 3:** Implementar reutilizando `vacioANull` e `instanteDesdeHoraChile` (null → issue
  `"Formato esperado: YYYY-MM-DD HH:mm:ss"`). Si el patrón `textoTruncado` de `derivacionInterna.schema.ts` hace falta
  en ambos schemas nuevos, moverlo a `utils/normalizacion.ts` y reutilizarlo (sin cambiar su comportamiento).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(integraciones): schemas de la carga SAPU`.

### Task 3: Servicio `registrarCargaSapu`

**Files:**
- Create: `src/modules/integraciones/services/registrarCargaSapu.ts`
- Test: `src/modules/integraciones/services/registrarCargaSapu.test.ts` (mock de prisma como en `registrarDerivacionInterna.test.ts`)
- Modify: `src/modules/integraciones/types/integraciones.ts`

**Interfaces:**
- Consumes: `filaSapuSchema` (Task 2), `asegurarPaciente` con `apellido` (Task 1), `verificarCatalogos`,
  `ErrorIntegracion`, `aResultado`.
- Produces (en `types/integraciones.ts`):

```ts
export type EstadoFilaIntegracion = "creada" | "duplicada" | "rechazada";
export interface ResultadoFilaIntegracion { indice: number; id_solicitud: string | null; estado: EstadoFilaIntegracion; error?: string }
export interface ResultadoCargaIntegracion {
    resultados: ResultadoFilaIntegracion[];
    totales: { creadas: number; duplicadas: number; rechazadas: number };
}
```

  `registrarCargaSapu(filas: unknown[]): Promise<ResultadoCargaIntegracion>`.

Ruling sobre la spec: `indice` (posición 0-based dentro del lote) va **siempre**, no solo cuando falta el id; el GAS
lo usa para volver al número de fila del Excel. `id_solicitud` es null cuando la fila no lo trae válido (se toma
`String(fila.id_solicitud)` recortado si es texto no vacío, aunque otra regla de la fila falle).

- [ ] **Step 1: Tests**:
  - `"lote mixto: creada, duplicada, rechazada por catálogo y por schema, en orden"` — 4 filas; la 2.ª con
    `solicitud.findUnique` devolviendo un registro; la 3.ª con `motivo.findUnique` → null; la 4.ª sin
    `fecha_inicio`. Esperar `estado` en orden `["creada","duplicada","rechazada","rechazada"]`, `indice` 0..3,
    `error` de la 3.ª `"motivo_id 99 no existe"`, totales `{1,1,2}`, y `solicitud.create` llamado una vez.
  - `"crea la solicitud con los valores fijos SAPU"` — `solicitud.create` con
    `expect.objectContaining({ tipo_solicitud_id: 17, rut_orientador: "11111112-3", rut_gestor: "11111112-3", accion: "En espera de validación", estado_solicitud: "En Curso", priorizacion_admin: 3.6, disponibilidad_llamada: "AM/PM", fecha_validacion: null, ultimo_control: null, centro_id: "615" })`
    y `fecha_inicio` igual al Date de la fila.
  - `"paciente nuevo con nombre o Sin registro; existente no se modifica"` — `usuario.create` con
    `nombre: "Juan"` / `"Sin registro"`, `apellido: ""`, `centro_id: "615"`; con usuario existente,
    `usuario.update` no se llama.
  - `"P2002 de Solicitud en create → duplicada"`; `"error inesperado → rechazada con 'Error interno'"`
    (y `console.error` llamado).
  - `"cada fila usa su propia transacción"` — `$transaction` llamado una vez por fila válida.
- [ ] **Step 2:** `npx vitest run src/modules/integraciones/services/registrarCargaSapu` → FAIL.
- [ ] **Step 3:** Implementar en serie (un `for`, sin `Promise.all`). Por fila: `safeParse` → si falla, `rechazada`
  con el primer mensaje de error con su campo (`"fecha_inicio: Formato esperado…"`). Si no,
  `prisma.$transaction` con `verificarCatalogos({ tipo_solicitud_id: 17, motivo_id, rut_funcionario: "11111112-3" })`
  → `findUnique` duplicado → `asegurarPaciente(..., { actualizarContacto: false })` → `create`. Traducir con
  `aResultado`: `DUPLICADO` → `duplicada`; `CATALOGO` → `rechazada` + mensaje; `INTERNO` → `rechazada` +
  `"Error interno"`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(integraciones): registro de cargas SAPU por fila`.

### Task 4: Ruta `POST /api/integraciones/sapu`

**Files:**
- Modify: `src/modules/integraciones/lib/responder.ts`
- Create: `src/app/api/integraciones/sapu/route.ts`
- Test: `src/app/api/integraciones/sapu/route.test.ts`

**Interfaces:**
- Consumes: `cargaSapuSchema` (Task 2), `registrarCargaSapu` (Task 3).
- Produces en `responder.ts`:
  `procesarCargaIntegracion<T>(request: Request, opciones: { cliente; ruta; schema: ZodType<T>; registrar: (datos: T) => Promise<ResultadoCargaIntegracion>; detalle: (datos: T, r: ResultadoCargaIntegracion) => string }): Promise<NextResponse>`.
  Extraer de `procesarIntegracion` un helper privado común para autenticar + leer JSON + validar (mismas respuestas
  403/400 y misma auditoría de fallos); `procesarIntegracion` conserva su comportamiento exacto.
  `procesarCargaIntegracion` responde 200 con el `ResultadoCargaIntegracion` tal cual y audita un
  `logDataAccess("CREATE", true, …, "solicitudes", { details: "<ruta> <detalle> → 200" })`.

- [ ] **Step 1: Tests** (patrón de `derivacion-interna/route.test.ts`, mockeando `registrarCargaSapu`):
  - key de GAS en esta ruta → 403 `{ Mensaje: "api-key no valida" }`.
  - `{ solicitudes: [] }` y `{ solicitudes: "x" }` → 400 con `error: "Datos inválidos"`; `registrarCargaSapu` no se llama.
  - lote válido → 200 con el cuerpo devuelto por el mock; `registrarCargaSapu` recibe el arreglo crudo.
  - auditoría: `details` contiene `"/api/integraciones/sapu"`, el `archivo`, `"creadas=1 duplicadas=0 rechazadas=1"` y `"→ 200"`; no contiene el RUT de las filas.
- [ ] **Step 2:** `npx vitest run src/app/api/integraciones` → FAIL en sapu; simple y derivación interna PASS.
- [ ] **Step 3:** Implementar helper, `procesarCargaIntegracion` y la ruta (`cliente: "SAPU"`,
  `detalle: (d, r) => \`${d.archivo ?? "sin archivo"} creadas=… duplicadas=… rechazadas=…\``).
- [ ] **Step 4:** `npm test` → PASS (incluye los tests de rutas existentes sin cambios).
- [ ] **Step 5:** Commit `feat(integraciones): ruta de carga SAPU`.

### Task 5: Schema y servicio de contrarreferencia

**Files:**
- Create: `src/modules/integraciones/schemas/contrarreferencia.schema.ts` (+ `.test.ts`)
- Create: `src/modules/integraciones/services/registrarContrarreferencia.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: Task 1 (`apellido`), helpers de Task 2 (`textoTruncado` si se movió, fecha Chile), `verificarCatalogos`, `aResultado`.
- Produces: `contrarreferenciaSchema`, tipo `Contrarreferencia` (reglas de la tabla de la spec, sección 3);
  `registrarContrarreferencia(datos: Contrarreferencia): Promise<ResultadoIntegracion>`.

- [ ] **Step 1: Tests de schema**: `validada` sin cita → issue en `cita`; `pendiente` con cita → issue en `cita`;
  `pendiente` con `cita: null` u omitida → `cita === null`; `fecha_inicio` `"2026-10-22 10:30:00"` →
  `"2026-10-22T13:30:00.000Z"`; `fecha_estimada_atencion` `"2026-02-31"` rechazada; `contrarreferencia_id` 0 o
  `"4321"` rechazado; nombre/apellido 80 caracteres → 50; `observacion` 700 → 500; teléfono `""` → null.
- [ ] **Step 2: Tests de servicio**:
  - validada: `solicitud.create` con `tipo_solicitud_id: 18, motivo_id: null, rut_orientador/rut_gestor: "11111111-1", accion: "Realizar solicitud", estado_solicitud: "En Curso", priorizacion_admin: 3.6, disponibilidad_llamada: "AM/PM"`, `fecha_validacion` = `fecha_inicio`; `cita.create` con `id_cita` recibido, `rut_gestor: "11111111-1"`, `estado_cita: "Sin llamadas"`, `priorizacion_clinica: "Alta"`, `priorizacion: 80`, `tipo_prestacion: "Agendar una hora con profesional"`, `fecha_creacion` = `fecha_inicio`, `centro_id` de la solicitud.
  - pendiente: `accion: "En espera de validación"`, `fecha_validacion: null`, sin `cita.create`.
  - duplicado por id → `{ ok: false, codigo: "DUPLICADO" }` sin `create`.
  - duplicado por descripción: candidato `"Registro Contrarreferencia ID: 4321 | Correo…"` con id 4321 → DUPLICADO;
    con id 43 → se crea; candidato que termina en `"…ID: 43"` con id 43 → DUPLICADO.
  - paciente nuevo: `usuario.create` con `nombre: "Ana María"`, `apellido: "Soto Díaz"`, teléfono y centro; sin nombre → `"Sin registro"` y `""`.
  - paciente existente con teléfono → `usuario.update` con `{ telefono }` solamente; sin teléfono → no se llama.
  - profesional inexistente → `CATALOGO` `"profesional_id 8 no existe"`.
- [ ] **Step 3:** `npx vitest run src/modules/integraciones` → FAIL.
- [ ] **Step 4:** Implementar. Duplicado: `findUnique` por id; si no hay, `findMany({ where: { tipo_solicitud_id: 18, descripcion: { contains: \`Registro Contrarreferencia ID: ${id}\` } }, select: { descripcion: true } })`
  y confirmar en JS con `new RegExp(\`Registro Contrarreferencia ID: ${id}( \\||$)\`)`. Paciente con
  `asegurarPaciente(tx, { rut, nombre, apellido, centro_id, telefono }, { actualizarContacto: true })` (no pasar correo).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat(integraciones): registro de contrarreferencias`.

### Task 6: Ruta `POST /api/integraciones/contrarreferencia`

**Files:**
- Create: `src/app/api/integraciones/contrarreferencia/route.ts`
- Test: `src/app/api/integraciones/contrarreferencia/route.test.ts`

**Interfaces:**
- Consumes: `procesarIntegracion` (sin cambios de contrato), Task 5.

- [ ] **Step 1: Tests** (mock del servicio): key de SAPU → 403; cuerpo sin `modo` → 400; ok → 201
  `{ message: "Solicitud creada con éxito", id_solicitud }`; DUPLICADO → 409; CATALOGO → 422 con el mensaje;
  auditoría `details` = `"/api/integraciones/contrarreferencia con-1234-… cr=4321 validada → 201"`, sin RUT ni teléfono.
- [ ] **Step 2:** `npx vitest run src/app/api/integraciones/contrarreferencia` → FAIL.
- [ ] **Step 3:** Implementar la ruta con `cliente: "CONTRARREFERENCIA"`,
  `detalle: (d) => \`${d.solicitud.id_solicitud} cr=${d.contrarreferencia_id} ${d.modo}\``.
- [ ] **Step 4:** `npm run lint && npx tsc --noEmit && npm test` → todo verde.
- [ ] **Step 5:** Commit `feat(integraciones): ruta de contrarreferencia`.

### Task 7: SAPU — cuerpo del envío (funciones puras)

Repo `../derivaciones-sapu-gestion-demanda`, rama `feat/envio-gestion-demanda`.

**Files:**
- Create: `.claspignore` (ver Global Constraints)
- Modify: `dominio/carga_sapu/servicio.js`, `infraestructura/fechas.js`
- Create: `scripts/test_payload_sapu_gd.js`

**Interfaces:**
- Produces:
  - `formatearFechaHoraGD(fecha: Date): string` → `"YYYY-MM-DD HH:mm:ss"` con `getFullYear()`… (zona del script) en `infraestructura/fechas.js`.
  - `SAPU_MAP.paciente = 'Paciente'`.
  - `construirSolicitudSAPU(headers, row)` devuelve `null` (omitida) o
    `{ id_solicitud, fecha_inicio: string, paciente: { rut, nombre: string | null }, motivo_id, descripcion, centro_id }`
    con las mismas reglas de filtro, centro, motivo, id y descripción de hoy; ya no arma los campos fijos.
  - `procesarSAPU(headers, data)` → `{ validas: Array<{ fila: number, solicitud }>, invalidas: [{ fila, errores }] }`
    (`fila` = índice + 2, número de fila del Excel).

- [ ] **Step 1: Test** `scripts/test_payload_sapu_gd.js` (Node, carga los `.js` con `eval` como
  `informe-diario-2.0/scripts/test_payload_derivacion_gd.js`; `assert` de Node). Casos: fila Barón con
  "HIPERTENSION ESENCIAL (PRIMARIA)" → `centro_id` 615, `motivo_id` 56, `fecha_inicio` `"2026-10-20 22:59:00"`
  (fecha `"20-10-2026"`, hora `"22:59"`), `paciente.nombre` desde `Paciente`, sin `rut_orientador`; centro
  "EXTERNO" → omitida; diagnóstico no permitido → omitida; centro desconocido → en `invalidas` con `fila` 3 si es la
  segunda fila de datos; `Paciente` vacío → `nombre: null`.
- [ ] **Step 2:** `node scripts/test_payload_sapu_gd.js` → FAIL.
- [ ] **Step 3:** Implementar. `fecha_inicio`: `formatearFechaHoraGD(normalizarFechaHoraSAPU(fechaAdm, horaAdm))`.
- [ ] **Step 4:** `node scripts/test_payload_sapu_gd.js` → PASS.
- [ ] **Step 5:** Commit `feat: cuerpo de envío SAPU para gestión de la demanda`.

### Task 8: SAPU — envío HTTPS y pantalla

**Files:**
- Create: `infraestructura/gestion_demanda.js` (cliente HTTPS)
- Modify: `interfaz/api.js`, `web/js/app.html` (y `web/js/modales.html` si el resultado se pinta ahí), `infraestructura/registro_cargas.js` si hace falta
- Delete: `dominio/carga_sapu/repositorio_mysql.js`; quitar `getJdbcUrl` de `configuracion/constante.js`
- Modify: `scripts/test_payload_sapu_gd.js`

**Interfaces:**
- Consumes: `procesarSAPU` (Task 7); respuesta de la app `{ resultados: [{ indice, id_solicitud, estado, error? }], totales }`.
- Produces:
  - `partirEnTandasGD(lista, tamano = 500): Array<Array>` (pura).
  - `combinarResultadosSapuGD(validas, respuestasPorTanda): { guardados, duplicados, errores: string[] }` (pura).
    `respuestasPorTanda[i]` es el cuerpo 200 parseado o `null` si la tanda falló; cada `indice` se mapea a
    `validas[offsetTanda + indice].fila`; rechazadas → `"Fila N: <error>"`; tanda null →
    `"Fila N: No se pudo enviar a gestión de la demanda"` por cada fila.
  - `enviarTandaSapuGD(solicitudes, archivo): Object | null` — `UrlFetchApp` a
    `GD_API_URL + "/api/integraciones/sapu"`, 3 intentos con `debeReintentarGD` y esperas `[1000, 2000]` (copiar de
    `informe-diario-2.0/back-end/informe_diario/enviarDerivacionGD.js`); 200 → cuerpo parseado; otro final →
    `console.error("[GD-SAPU-FALLIDA] <archivo> <n tanda> <código> <detalle>")` y `null`. Sin propiedades → lanza
    `Error("Faltan las propiedades GD_API_URL o GD_API_KEY")`.
  - `apiCargarSAPU` → `{ ok, guardados, duplicados, omitidos, errores }`; `omitidos` = filas inválidas locales;
    `registrarCargaSAPU(rows.length, guardados, nombreArchivo)` con `guardados` = creadas.

- [ ] **Step 1: Tests** en el script: `partirEnTandasGD` con 1001 → tamaños `[500,500,1]`;
  `combinarResultadosSapuGD` con 2 tandas (la 1.ª con creada/duplicada/rechazada, la 2.ª `null`) → conteos y
  mensajes con los números de fila correctos (Review Focus 4).
- [ ] **Step 2:** `node scripts/test_payload_sapu_gd.js` → FAIL.
- [ ] **Step 3:** Implementar; frontend muestra "Guardadas X · Ya existían Y · Con error Z" y la lista de errores.
  Eliminar el JDBC y las referencias a `MYSQL_*` (`grep -rn "Jdbc\|MYSQL_" .` sin resultados fuera de `.git`).
- [ ] **Step 4:** `node scripts/test_payload_sapu_gd.js` → PASS; `grep` anterior vacío.
- [ ] **Step 5:** Commit `feat: enviar cargas SAPU a gestión de la demanda por HTTPS`.

### Task 9: Contrarreferencia — cuerpo del envío (funciones puras)

Repo `../gestion-contrarreferencias-aps`, rama `feat/envio-gestion-demanda`.

**Files:**
- Create: `.claspignore`
- Create: `gestion_demanda_gd.js` (funciones puras y cliente; Task 10 agrega el cliente)
- Create: `scripts/test_payload_contrarreferencia_gd.js` (carga `Código.js` y `gestion_demanda_gd.js` con `eval`)

**Interfaces:**
- Consumes (de `Código.js`, sin cambios): `buildGestionDemandaSolicitudId_`, `buildGestionDemandaCitaId_`,
  `homologateGestionDemandaCentroId_`, `buildGestionDemandaDescripcion_`, `isRecetaRepeticionGestionDemanda_`,
  `splitPacienteNameForGestionDemanda_`.
- Produces:
  - `normalizarFechaHoraGD(valor: string | Date): string` → `"YYYY-MM-DD HH:mm:ss"`; texto: toma los primeros 19
    caracteres si calzan con `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}`; Date: formato con la zona del script; otro → lanza.
  - `construirPayloadContrarreferenciaGD(record, hoy: Date): Object` con el cuerpo de la spec, sección 3:
    `modo` según receta; `paciente` con nombre/apellido de `splitPacienteNameForGestionDemanda_` (vacío → null) y
    `telefono` recortado (vacío → null); `solicitud.centro_id` homologado; `cita` solo en `validada` con
    `profesional_id: 8`, `prestacion_id: 144`, `fecha_estimada_atencion` = `hoy + 20 días` como `"YYYY-MM-DD"` y la
    `observacion` actual (`Gestionado desde Contrarreferencia por contralor: … | … | …`).

  Si `Código.js` no carga en Node por usar APIs de GAS en el nivel superior, el test define stubs mínimos
  (`PropertiesService`, `Session.getScriptTimeZone`, `Utilities.formatDate`) antes del `eval`.

- [ ] **Step 1: Tests**: receta → `modo "validada"` con cita y fecha +20 días; otra indicación → `"pendiente"` sin
  `cita`; `"2026-10-22 10:30:00.0"` → `"2026-10-22 10:30:00"` (Review Focus 3); centro origen 13 → `centro_id`
  600; 6 → 615; nombre "Ana María Soto Díaz" → `"Ana María"` / `"Soto Díaz"`; teléfono `""` → null.
- [ ] **Step 2:** `node scripts/test_payload_contrarreferencia_gd.js` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: cuerpo de envío de contrarreferencia para gestión de la demanda`.

### Task 10: Contrarreferencia — envío HTTPS acoplado a la validación

**Files:**
- Modify: `gestion_demanda_gd.js`, `Código.js`, `scripts/test_payload_contrarreferencia_gd.js`

**Interfaces:**
- Consumes: Task 9.
- Produces:
  - `interpretarRespuestaContrarreferenciaGD(codigo: number | null, cuerpo: string, idSolicitud): Object` (pura):
    201 → `{ created: true, skipped: false, idSolicitud }`; 409 → `{ created: false, skipped: true, reason: "duplicate", idSolicitud }`;
    otro → lanza `Error("No se pudo registrar la solicitud en gestión de la demanda: <error del cuerpo o código>")`.
  - `enviarContrarreferenciaGD(payload): Object` — 3 intentos (`debeReintentarGD`, esperas `[1000, 2000]`) a
    `GD_API_URL + "/api/integraciones/contrarreferencia"`; antes de lanzar registra
    `console.error("[GD-CONTRARREFERENCIA-FALLIDA] <contrarreferencia_id> <código> <detalle>")`. Sin propiedades → lanza.
  - `syncContrarreferenciaToGestionDemanda_(record)` mantiene firma y las validaciones previas (salto
    "alta"/"repetida", RUT y fecha obligatorios); el cuerpo pasa a
    `enviarContrarreferenciaGD(construirPayloadContrarreferenciaGD(record, new Date()))`.

- [ ] **Step 1: Tests**: `interpretarRespuestaContrarreferenciaGD` con 201, 409, 422 (`{"error":"prestacion_id 144 no existe"}` → mensaje incluido) y `null`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementar. Eliminar `getGestionDemandaConnection_`, `GESTION_DEMANDA_DB_INLINE_` y las funciones
  JDBC sobre gestionDemanda (`findGestionDemandaUsuarioByRut_`, `insertGestionDemandaUsuario_`,
  `updateGestionDemandaUsuarioTelefono_`, `syncGestionDemandaUsuario_`, `findExistingGestionDemandaSolicitud_`,
  `insertGestionDemandaSolicitud_`, `findExistingGestionDemandaCitaBySolicitudId_`, `insertGestionDemandaCita_`).
  Las tres llamadas (líneas ~1764, ~1910, ~2009) no cambian: el `throw` cae en su `catch` con `rollback`.
- [ ] **Step 4:** test → PASS; `grep -n "GESTION_DEMANDA_DB\|46.202.151.191\|getGestionDemandaConnection_" *.js` vacío.
- [ ] **Step 5:** Commit `feat: enviar contrarreferencias a gestión de la demanda por HTTPS`.

---

## Puesta en marcha (controlador con el usuario; no es tarea de subagente)

1. PRs de los tres repos; el usuario los aprueba. Merge de la app primero.
2. Generar las dos keys en el server (`~/integraciones-keys.env`), sumarlas a `ENV_PRODUCTION` desde el `.env` del
   server con `gh secret set` (diff redactado) y redesplegar.
3. `curl` a producción: carga SAPU de 1 fila de prueba (centro 501) y una contrarreferencia `pendiente` de prueba;
   verificar en BD y borrar.
4. El usuario carga `GD_API_URL` / `GD_API_KEY` en ambos GAS y borra `MYSQL_*` / `GESTION_DEMANDA_DB_*`;
   `clasp push` y `clasp deploy -i <deployment de producción>` en cada uno.
5. Prueba real y `logs` ("Integración SAPU" / "Integración CONTRARREFERENCIA").
6. Conciliación: tipo 17/18 en AppSheet posteriores al 21/10 16:03 → copiar a la app antes del retiro.
