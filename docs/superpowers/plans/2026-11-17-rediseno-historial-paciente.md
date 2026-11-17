# Rediseño de tarjetas solicitud → cita → llamada: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar con las mismas tarjetas compartidas el bloque solicitud → cita → llamada en Historial
del paciente, Ingresar solicitud y Revisar solicitudes. Las tarjetas usan semáforo de estados,
rótulos explícitos y acordeón.

**Architecture:** Hay tarjetas de presentación puras en `src/shared/components/pacientes/tarjetas/`,
que reciben datos con forma común (`src/shared/types/tarjetasPaciente.ts`) y botones como
`ReactNode`. Junto a ellas viven dos utilidades compartidas: semáforo de estados y formato de
fechas. Cada pantalla adapta sus datos a esa forma. Las vistas de pendientes reciben las citas
anidadas en cada solicitud En Curso, todas, no solo las pendientes, y con sus llamadas.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Prisma (MySQL), Tailwind v3 +
shadcn/ui, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-17-rediseno-historial-paciente-design.md`

## Global Constraints

- Idioma español en UI, comentarios y commits; indentación de 4 espacios; `interface` para objetos;
  imports categorizados (`// lib`, `// components`, `// types`, `// utils`); alias `@/`.
- Formato de fecha único: `dd-mm-aaaa`; fecha y hora `dd-mm-aaaa HH:mm` (24 h, `America/Santiago`).
  Las columnas `@db.Date` (`fecha_estimada_atencion`) se formatean en UTC para no correrse un día.
- Valor ausente de persona o fecha: `—`.
- Rótulos exactos: `Solicitud:`, `Motivo:`, `Descripción del paciente:`, `Razón de rechazo:`,
  `Estado de la solicitud:`, `Orientador/a:`, `Gestor/a:`, `Fecha de creación:`, `Fecha de cierre:`,
  `Cita:`, `Observación del gestor/a:`, `Estado de la cita:`, `Cierre de la cita:`,
  `Fecha y hora agendadas:`, `Comunicador/a:`, `Resultado de la llamada:`,
  `Observación de la llamada:`, `Fecha y hora de la llamada:`, botones `Ver citas (n)` y
  `Ver llamadas (n)`.
- Semáforo: amarillo = En Curso / estados de cita pendientes / `No contesta`, `Llamada de aviso`;
  verde = `Realizado` / `Cita Aceptada`; rojo = `Rechazado` / cualquier `Cita Rechazada (...)`;
  gris = `null` o desconocido. El verde de la cita es más suave que el de la solicitud. El texto
  del estado siempre se ve.
- Colores con tokens del tema: amarillo→`secondary`, verde→`accent`, rojo→`destructive`,
  gris→`muted` (opacidad menor en la cita que en la solicitud).
- No se quita ninguna observación ni código visible. Revisar solicitudes conserva todos sus botones
  y su comportamiento.
- Server Actions: `ResultadoAccion<T>`, `requirePermiso`, `select` con solo los campos mostrados (no
  traer filas completas de `Funcionario`).

## Review Focus

1. Una `fecha_estimada_atencion` (`@db.Date`, guardada como `2026-03-26T00:00:00Z`) debe mostrarse
   `26-03-2026`, no `25-03-2026`. Lo cubren el test de `formatearFechaCalendario` (Task 1) y el de
   `CitaTarjeta` (Task 2).
2. Citas con `estado_cita = null` o con un estado heredado de AppSheet que no está en las constantes:
   badge gris con `Sin estado` o con el texto crudo, sin romper. Lo cubren Task 1 y Task 2.
3. Descripciones u observaciones muy largas sin espacios (la maqueta tiene
   `CONTROLSOLICITA CONTROLSOLICITA...`) no deben generar scroll horizontal. Se usa `break-words` y
   `whitespace-pre-line`; lo cubre Task 2.
4. Llamadas con `fecha_llamada` o `comunicador` nulos muestran `—`. Lo cubre Task 2.
5. Una solicitud sin citas muestra el texto de "sin citas" y no un botón `Ver citas (0)`. Lo cubre
   Task 2.

---

### Task 1: Utilidades compartidas, semáforo y formato de fechas

**Files:**
- Create: `src/shared/lib/semaforoEstado.ts`, `src/shared/lib/semaforoEstado.test.ts`
- Create: `src/shared/lib/formatoFecha.ts`, `src/shared/lib/formatoFecha.test.ts`

**Interfaces:**
- Produces:
  - `type TonoSemaforo = "amarillo" | "verde" | "rojo" | "gris"`
  - `tonoEstadoSolicitud(estado: string | null): TonoSemaforo`
  - `tonoEstadoCita(estado: string | null): TonoSemaforo`
  - `tonoRespuestaLlamada(respuesta: string | null): TonoSemaforo`
  - `formatearFecha(valor: Date | string | null): string`: `dd-mm-aaaa` en `America/Santiago`, o `—`
  - `formatearFechaHora(valor: Date | string | null): string`: `dd-mm-aaaa HH:mm`, o `—`
  - `formatearFechaCalendario(valor: Date | string | null): string`: `dd-mm-aaaa` en UTC, o `—`

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// semaforoEstado.test.ts: usar ESTADO_CITA y RESPUESTA_LLAMADA de @/modules/comunicador/types/comunicador
it.each([
    [ESTADO_CITA.SIN_LLAMADAS, "amarillo"], [ESTADO_CITA.NO_CONTESTA_1, "amarillo"],
    [ESTADO_CITA.NO_CONTESTA_2, "amarillo"], [ESTADO_CITA.SOLO_AVISO, "amarillo"],
    [ESTADO_CITA.ACEPTADA, "verde"],
    [ESTADO_CITA.RECHAZADA_NO_NECESARIA, "rojo"], [ESTADO_CITA.RECHAZADA_SOLICITANTE, "rojo"],
    [ESTADO_CITA.RECHAZADA_NUMERO_EQUIVOCADO, "rojo"], [ESTADO_CITA.RECHAZADA_SIN_RESPUESTA, "rojo"],
    [null, "gris"], ["Estado legado", "gris"]
])("tonoEstadoCita(%s) = %s", (estado, tono) => expect(tonoEstadoCita(estado)).toBe(tono));

it.each([
    [RESPUESTA_LLAMADA.NO_CONTESTA, "amarillo"], [RESPUESTA_LLAMADA.LLAMADA_AVISO, "amarillo"],
    [RESPUESTA_LLAMADA.ACEPTADA, "verde"],
    [RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA, "rojo"], [RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE, "rojo"],
    [RESPUESTA_LLAMADA.RECHAZADA_NUMERO_EQUIVOCADO, "rojo"], ["Otra", "gris"], [null, "gris"]
])("tonoRespuestaLlamada(%s) = %s", (r, tono) => expect(tonoRespuestaLlamada(r)).toBe(tono));

it.each([["En Curso", "amarillo"], ["Realizado", "verde"], ["Rechazado", "rojo"], ["Otro", "gris"], [null, "gris"]])(
    "tonoEstadoSolicitud(%s) = %s", (e, tono) => expect(tonoEstadoSolicitud(e)).toBe(tono));

// formatoFecha.test.ts
expect(formatearFecha(new Date("2025-12-30T15:00:00Z"))).toBe("30-12-2025");
expect(formatearFechaHora(new Date("2026-01-15T13:45:00Z"))).toBe("15-01-2026 10:45"); // UTC-3 en verano
expect(formatearFechaHora("2026-07-10T03:05:00Z")).toBe("09-07-2026 23:05");          // UTC-4 en invierno
expect(formatearFechaCalendario(new Date("2026-03-26T00:00:00Z"))).toBe("26-03-2026");
expect(formatearFecha(null)).toBe("—"); expect(formatearFechaHora(null)).toBe("—"); expect(formatearFechaCalendario(null)).toBe("—");
```

- [ ] **Step 2: Correr los tests y comprobar que fallan**

Run: `npx vitest run src/shared/lib/semaforoEstado.test.ts src/shared/lib/formatoFecha.test.ts`
Expected: FAIL (módulos inexistentes)

- [ ] **Step 3: Implementar ambos módulos**

`semaforoEstado.ts` importa las constantes de `@/modules/comunicador/types/comunicador` (hay
precedente de `shared` importando módulos) y usa listas explícitas, sin coincidencias por prefijo.
`formatoFecha.ts` usa `Intl.DateTimeFormat("es-CL", { ..., hourCycle: "h23" })` con `formatToParts`
para armar `dd-mm-aaaa` y `dd-mm-aaaa HH:mm` sin coma.

- [ ] **Step 4: Correr los tests y comprobar que pasan**

Run: el mismo comando del Step 2. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/semaforoEstado* src/shared/lib/formatoFecha*
git commit -m "feat(shared): semáforo de estados y formato único de fechas"
```

---

### Task 2: Tarjetas compartidas

**Files:**
- Create: `src/shared/types/tarjetasPaciente.ts`
- Create: `src/shared/components/pacientes/tarjetas/estado-badge.tsx`
- Create: `src/shared/components/pacientes/tarjetas/llamada-tarjeta.tsx`
- Create: `src/shared/components/pacientes/tarjetas/cita-tarjeta.tsx`
- Create: `src/shared/components/pacientes/tarjetas/solicitud-tarjeta.tsx`
- Test: `src/shared/components/pacientes/tarjetas/tarjetas.test.tsx`

**Interfaces:**
- Consumes: Task 1 (tonos y formateadores); `CodigoId` de `@/shared/components/ui/codigo-id`.
- Produces:

```ts
// src/shared/types/tarjetasPaciente.ts
export interface LlamadaTarjetaDatos {
    id_llamada: string;
    fecha_llamada: Date | string | null;
    respuesta_usuario: string;
    comunicador: string | null;
    observacion: string | null;
}
export interface CitaTarjetaDatos {
    id_cita: string;
    estamento: string | null;
    prestacion: string | null;
    estado_cita: string | null;
    gestor: string | null;
    observacion: string | null;
    fecha_cierre: Date | string | null;
    hora_agendada: Date | string | null;
    fecha_estimada_atencion: Date | string | null;
    priorizacion_clinica: string | null;
    llamadas: LlamadaTarjetaDatos[];
}
export interface SolicitudTarjetaDatos {
    id_solicitud: string;
    motivo: string | null;
    tipo: string | null;
    descripcion: string | null;
    estado_solicitud: string;
    razon_rechazo: string | null;
    orientador: string | null;
    gestor: string | null;
    fecha_inicio: Date | string;
    fecha_cierre: Date | string | null;
}
```

  - `EstadoBadge({ rotulo, estado, tono, suave }: { rotulo: string; estado: string | null; tono: TonoSemaforo; suave?: boolean })`:
    muestra `"{rotulo}: {estado ?? "Sin estado"}"` y expone `data-tono={tono}` para los tests.
  - `LlamadaTarjeta({ llamada }: { llamada: LlamadaTarjetaDatos })`
  - `CitaTarjeta({ cita, detallePendiente, acciones }: { cita: CitaTarjetaDatos; detallePendiente?: boolean; acciones?: ReactNode })`.
    Con `detallePendiente` muestra la priorización clínica (badge) y `Fecha estimada: {formatearFechaCalendario}`.
    Sin él, no las muestra (Historial). El acordeón `Ver llamadas (n)` es estado local y parte
    cerrado, con `aria-expanded` y `aria-controls="llamadas-{id_cita}"`.
  - `SolicitudTarjeta({ solicitud, cantidadCitas, citasAbiertasInicial, textoSinCitas, acciones, children }: { solicitud: SolicitudTarjetaDatos; cantidadCitas: number; citasAbiertasInicial: boolean; textoSinCitas: string; acciones?: ReactNode; children?: ReactNode })`.
    `children` son las `CitaTarjeta`, dentro de la región `citas-{id_solicitud}` con barra
    lateral visible (`border-l-4`, tono `primary/40`). Si `cantidadCitas === 0`, muestra
    `textoSinCitas` y no muestra el botón. Es un `<article aria-labelledby>`.

Distribución de cada tarjeta: contenido a la izquierda y columna derecha alineada a la derecha
(`sm:flex-row`). En móvil se apila (`flex-col`), sin anchos fijos. Los textos libres (descripción,
observaciones, razón de rechazo) usan `whitespace-pre-line break-words` y todo el ancho. El
`Motivo:` es el texto más grande de la solicitud (`text-lg font-semibold` o mayor). La columna
derecha sigue el orden de la spec. `Fecha y hora agendadas:` se muestra solo si
`estado_cita === ESTADO_CITA.ACEPTADA`; su valor es `formatearFechaHora(hora_agendada)` o
`Fecha y hora no registradas`. Las `acciones` se muestran en la columna derecha, después de los
datos.

- [ ] **Step 1: Escribir los tests que fallan** (`tarjetas.test.tsx`, con fixtures mínimos)

```tsx
it("solicitud: rótulos, motivo destacado, tono y fechas", () => {
    render(<SolicitudTarjeta solicitud={solicitudRealizada} cantidadCitas={1} citasAbiertasInicial={false} textoSinCitas="Sin citas registradas.">
        <p>cita-hija</p></SolicitudTarjeta>);
    expect(screen.getByText("Estado de la solicitud: Realizado")).toHaveAttribute("data-tono", "verde");
    expect(screen.getByText(/Motivo: Consulta de morbilidad odontológica/)).toBeInTheDocument();
    expect(screen.getByText(/Orientador\/a:/)).toBeInTheDocument();
    expect(screen.getByText(/Gestor\/a:/)).toBeInTheDocument();
    expect(screen.getByText(/Fecha de creación: 30-12-2025/)).toBeInTheDocument();
    expect(screen.getByText(/Descripción del paciente:/)).toBeInTheDocument();
});
it("solicitud: Ver citas (n) parte cerrado y alterna", async () => {
    // citasAbiertasInicial=false → 'cita-hija' no visible; click en "Ver citas (1)" → visible; aria-expanded true
});
it("solicitud: citasAbiertasInicial muestra las citas sin clic", () => { /* 'cita-hija' visible */ });
it("solicitud sin citas: texto y sin botón Ver citas (0)", () => {
    // cantidadCitas=0 → getByText("Sin citas registradas."); queryByRole("button", { name: /Ver citas/ }) === null
});
it("solicitud rechazada muestra Razón de rechazo y tono rojo", () => { /* ... */ });
it("descripción larga usa break-words y whitespace-pre-line", () => {
    // el párrafo de la descripción tiene las clases "break-words" y "whitespace-pre-line"
});
it("cita aceptada: tono verde suave, gestor, agenda y llamadas colapsadas", async () => {
    // getByText("Estado de la cita: Cita Aceptada") data-tono "verde"
    // getByText(/Fecha y hora agendadas: 15-01-2026 10:45/)  (hora_agendada 2026-01-15T13:45:00Z)
    // getByText(/Observación del gestor\/a:/); "Ver llamadas (1)" con aria-expanded="false"
    // click → getByText(/Comunicador\/a:/), getByText("Resultado de la llamada: Cita Aceptada")
});
it("cita con estado null: badge gris 'Estado de la cita: Sin estado'", () => {});
it("cita con detallePendiente muestra fecha estimada sin correrse un día", () => {
    // fecha_estimada_atencion 2026-03-26T00:00:00Z → getByText("Fecha estimada: 26-03-2026")
});
it("cita sin detallePendiente no muestra fecha estimada ni priorización", () => {});
it("llamada con fecha y comunicador nulos muestra —", () => {
    // getByText("Comunicador/a: —") (o el rótulo y el valor en nodos hermanos: usar el matcher que corresponda)
    // getByText(/Fecha y hora de la llamada: —/)
});
it("cita sin llamadas: al abrir muestra 'Sin llamadas registradas.'", async () => {});
it("acciones se renderizan dentro de la tarjeta", () => { /* acciones={<button>Cerrar cita</button>} */ });
```

- [ ] **Step 2: Correr los tests y comprobar que fallan**

Run: `npx vitest run src/shared/components/pacientes/tarjetas`
Expected: FAIL (componentes inexistentes)

- [ ] **Step 3: Implementar los tipos y los cuatro componentes** con las firmas de Interfaces.
Usar la skill `shadcn` y reutilizar `Badge`, `Button` y `CodigoId`. Si `EstadoBadge` necesita
clases de tono, se pasan por `className` a `Badge`, sin crear variantes nuevas.

- [ ] **Step 4: Correr los tests y comprobar que pasan**

Run: `npx vitest run src/shared/components/pacientes/tarjetas`. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/tarjetasPaciente.ts src/shared/components/pacientes/tarjetas
git commit -m "feat(shared): tarjetas de solicitud, cita y llamada con semáforo"
```

---

### Task 3: Historial, datos (gestor de la cita y orden)

**Files:**
- Modify: `src/modules/historial/types/historial.ts`
- Modify: `src/modules/historial/actions/getHistorialPaciente.action.ts`
- Create: `src/modules/historial/utils/orden.ts`, `src/modules/historial/utils/orden.test.ts`
- Test: `src/modules/historial/actions/getHistorialPaciente.action.test.ts`

**Interfaces:**
- Consumes: `CitaTarjetaDatos`, `LlamadaTarjetaDatos`, `SolicitudTarjetaDatos` (Task 2).
- Produces:
  - `LlamadaHistorial extends LlamadaTarjetaDatos` (conserva `hora_agendada: Date | null`).
  - `CitaHistorial extends CitaTarjetaDatos` (agrega `cerrada: boolean`; `gestor` sale de
    `Cita.gestor.nombre`; `priorizacion_clinica` se selecciona aunque el historial no la muestre).
  - `SolicitudHistorial extends SolicitudTarjetaDatos` (agrega `accion`, `citas: CitaHistorial[]`).
    `gestor` sigue siendo el de la solicitud.
  - `ordenarSolicitudesHistorial<T extends { estado_solicitud: string; fecha_inicio: Date | string }>(solicitudes: T[]): T[]`:
    primero En Curso y después el resto, cada grupo por `fecha_inicio` descendente. No muta la
    entrada.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// orden.test.ts
const r = ordenarSolicitudesHistorial([
    { id: "A", estado_solicitud: "Realizado", fecha_inicio: new Date("2026-11-02") },
    { id: "B", estado_solicitud: "En Curso",  fecha_inicio: new Date("2026-05-01") },
    { id: "C", estado_solicitud: "Rechazado", fecha_inicio: new Date("2026-10-19") },
    { id: "D", estado_solicitud: "En Curso",  fecha_inicio: new Date("2026-07-01") }
]);
expect(r.map((s) => s.id)).toEqual(["D", "B", "A", "C"]);
// getHistorialPaciente.action.test.ts: el select de citas incluye gestor { select: { nombre: true } }
// y priorizacion_clinica; el mapper expone cita.gestor = "Nombre Gestor"; la data sale en el orden de ordenarSolicitudesHistorial.
```

- [ ] **Step 2: Correr los tests y comprobar que fallan**

Run: `npx vitest run src/modules/historial/utils/orden.test.ts src/modules/historial/actions`
Expected: FAIL

- [ ] **Step 3: Implementar**: tipos, `orden.ts`, y en la acción agregar
`gestor: { select: { nombre: true } }` y `priorizacion_clinica: true` al select de citas, mapearlos y
aplicar `ordenarSolicitudesHistorial` al resultado. El `orderBy` de Prisma puede quedar como está.

- [ ] **Step 4: Correr los tests y comprobar que pasan**

Run: el mismo comando del Step 2. Expected: PASS

- [ ] **Step 5: Commit** `feat(historial): gestor en la cita y orden En Curso primero`

---

### Task 4: Historial, vista con las tarjetas

**Files:**
- Modify: `src/modules/historial/components/HistorialPacienteView.tsx`
- Test: `src/modules/historial/components/HistorialPacienteView.test.tsx`

**Interfaces:**
- Consumes: `SolicitudTarjeta`, `CitaTarjeta` (Task 2); tipos del historial (Task 3), que ya son
  compatibles y no necesitan adaptador.

- [ ] **Step 1: Ajustar y agregar tests**

Hay que actualizar los tests cuyos textos cambian, como `Inicio:` → `Fecha de creación:`,
`Gestor:` → `Gestor/a:` o `Cierre:` → `Fecha de cierre:` y `Cierre de la cita:`, y los clics
previos en `Ver citas (n)`. **No se elimina ningún caso de comportamiento**: búsqueda obsoleta
descartada, errores, reimpresión de voucher sin duplicados, reinicio al buscar de nuevo. Se agregan:

```tsx
it("las citas parten colapsadas y se abren con Ver citas (n)", async () => {});
it("muestra En Curso primero", async () => { /* orden de los article según la data mockeada ya ordenada */ });
it("no muestra fecha estimada ni priorización en el historial", async () => {});
it("muestra Gestor/a en la solicitud y en la cita", async () => {});
it("una búsqueda nueva vuelve a colapsar las citas", async () => {});
```

- [ ] **Step 2: Correr los tests y comprobar que fallan**

Run: `npx vitest run src/modules/historial/components`. Expected: FAIL en los casos nuevos.

- [ ] **Step 3: Reemplazar `SolicitudItem`/`CitaItem`** por `SolicitudTarjeta`
(`citasAbiertasInicial={false}`, `textoSinCitas="Sin citas registradas."`, `acciones` = el botón
"Reimprimir voucher" solo si está En Curso, con la lógica actual) y `CitaTarjeta` sin
`detallePendiente`. Se borran `formatFecha`, `formatFechaHora`, `citasExpandidas` y `toggleCita`.
Para que una búsqueda nueva reinicie el acordeón, el bloque de resultados se monta con un `key`
que cambia en cada búsqueda (p. ej. `idUltimaBusqueda.current`).

- [ ] **Step 4: Correr los tests y comprobar que pasan**

Run: `npx vitest run src/modules/historial`. Expected: PASS

- [ ] **Step 5: Commit** `feat(historial): vista con tarjetas compartidas y acordeón de citas`

---

### Task 5: Pendientes, datos (citas anidadas con llamadas)

**Files:**
- Create: `src/modules/solicitudes/utils/selectCascada.ts`
- Modify: `src/modules/solicitudes/types/pendientes.ts`
- Modify: `src/modules/solicitudes/actions/getPendientes.action.ts`
- Modify: `src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts`
- Test: `src/modules/solicitudes/actions/getPendientes.action.test.ts`, `getOtrasSolicitudes.action.test.ts`

**Interfaces:**
- Produces (`types/pendientes.ts`):

```ts
export interface LlamadaCascada {
    id_llamada: string; fecha_llamada: Date | null; respuesta_usuario: string;
    observacion: string | null; hora_agendada: Date | null; comunicador: { nombre: string } | null;
}
export interface CitaCascada {            // campos actuales + gestor + llamadas
    id_cita: string; solicitud_id: string | null; estado_cita: string | null; observacion: string | null;
    priorizacion_clinica: string | null; fecha_estimada_atencion: Date | string | null;
    profesional: { nombre: string } | null; prestacion: { nombre_prestacion: string } | null;
    gestor: { nombre: string } | null; llamadas: LlamadaCascada[];
}
export interface SolicitudCascada<C extends CitaCascada = CitaCascada> {   // campos actuales + ...
    id_solicitud: string; fecha_inicio: Date | string; descripcion: string | null; estado_solicitud: string;
    accion: string | null; razon_rechazo: string | null; fecha_validacion: Date | string | null;
    tipoSolicitud: { nombre_tipo_solicitud: string } | null; motivo: { nombre_motivo: string } | null;
    orientador: { nombre: string } | null; gestor: { nombre: string } | null;
    citas: C[];                            // TODAS las citas de la solicitud, orden fecha_creacion asc
}
// CitaCascadaConEdicion y CitaCascadaContexto se mantienen.
```

  - `selectCascada.ts` exporta `LLAMADA_CASCADA_SELECT`, `CITA_CASCADA_SELECT` y
    `SOLICITUD_CASCADA_SELECT` (`satisfies Prisma.*Select`), con solo los campos de arriba. Llamadas
    con `orderBy: { fecha_llamada: "asc" }`; citas anidadas con `orderBy: { fecha_creacion: "asc" }`.
    `SOLICITUD_CASCADA_SELECT` incluye además `tipo_solicitud_id`, `motivo_id` y `centro_id`, que
    usan la detección de duplicados y el voucher.
  - `getPendientes`: `solicitudesPendientes` usa `SOLICITUD_CASCADA_SELECT` (citas anidadas sin
    filtro de estado ni de centro). `citasPendientes` **mantiene su filtro actual** (solo estados
    pendientes, sin filtro de centro) y pasa a `CITA_CASCADA_SELECT`. Se mantiene la auditoría.
  - `getOtrasSolicitudes`: devuelve `{ solicitudes: SolicitudCascada<CitaCascadaContexto>[] }`, con
    las citas anidadas filtradas por `centro_id: centroId` y sin filtro de estado. Cada cita trae
    `editable = esCitaEditable({ estado_cita, cantidadLlamadas: llamadas.length })` y
    `puedeRegistrarRechazo = esEstadoPendiente(estado_cita)`. Se elimina la consulta plana de citas.
    Se mantienen los filtros y el orden actuales de las solicitudes.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// getPendientes.action.test.ts
// - findMany de solicitud recibe select con citas anidadas (sin where de estado) que incluyen llamadas y gestor
// - findMany de solicitud NO usa include (no trae Funcionario completo)
// - findMany de cita mantiene where { rut_usuario, estado_cita: { in: ESTADOS_PENDIENTES } }
// - el select de solicitud incluye tipo_solicitud_id, motivo_id, centro_id
// getOtrasSolicitudes.action.test.ts
// - una cita anidada "Cita Aceptada" sale con editable=false y puedeRegistrarRechazo=false
// - una cita "Sin llamadas" sin llamadas sale editable=true, puedeRegistrarRechazo=true
// - una cita "No contesta (1)" con 1 llamada sale editable=false, puedeRegistrarRechazo=true
// - las citas anidadas se filtran por centro_id del funcionario
```

- [ ] **Step 2: Correr los tests y comprobar que fallan**

Run: `npx vitest run src/modules/solicitudes/actions/getPendientes.action.test.ts src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar** `selectCascada.ts`, los tipos y las dos acciones. Este paso rompe el
tipado de `ListaPendientes` y `RevisarSolicitudesView`; eso se corrige en los Tasks 6 y 7.
`npx tsc --noEmit` todavía puede fallar en esos archivos.

- [ ] **Step 4: Correr los tests y comprobar que pasan**

Run: el mismo comando del Step 2. Expected: PASS

- [ ] **Step 5: Commit** `feat(solicitudes): pendientes con todas las citas y sus llamadas anidadas`

---

### Task 6: Pendientes del orientador con tarjetas

**Files:**
- Create: `src/modules/solicitudes/utils/tarjetasPendientes.ts`, `src/modules/solicitudes/utils/tarjetasPendientes.test.ts`
- Modify: `src/modules/solicitudes/components/PendientesCascada.tsx` (`ListaPendientes` y `PendientesCascada`)
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx` (solo si el tipo cambia)
- Test: `src/modules/solicitudes/components/PendientesCascada.test.tsx`, `IngresarSolicitudView.test.tsx`

**Interfaces:**
- Consumes: tipos del Task 5; tarjetas del Task 2. Para la cita: `fechaCierreCita` de
  `@/modules/historial/utils/cierre` y `resolverAgendaCita` de `@/modules/historial/utils/agendaCita`.
  Para la solicitud: `fechaCierreSolicitud`.
- Produces:
  - `aCitaTarjeta(cita: CitaCascada): CitaTarjetaDatos`
  - `aSolicitudTarjeta(solicitud: SolicitudCascada): SolicitudTarjetaDatos`
  - Nuevas props de `ListaPendientes`:

```ts
export interface ListaPendientesProps<C extends CitaCascada, S extends SolicitudCascada<C>> {
    solicitudes: S[];
    citasSueltas?: C[];                       // citas pendientes sin solicitud En Curso ("Otras citas")
    accionesSolicitud?: (solicitud: S) => ReactNode;
    accionesCita?: (cita: C) => ReactNode;
}
```

`ListaPendientes` renderiza `SolicitudTarjeta` con `citasAbiertasInicial`,
`textoSinCitas="Sin citas en esta solicitud."` y una `CitaTarjeta` por cada `solicitud.citas`, con
`detallePendiente={esEstadoPendiente(cita.estado_cita)}`. Para las citas cerradas no llama a
`accionesCita`. El grupo "Otras citas" con `citasSueltas` se mantiene con su texto actual.
`PendientesCascada` calcula `citasSueltas = citasPendientes.filter(c => !idsSolicitudesEnCurso.has(c.solicitud_id))`.
Conserva el voucher limitado al centro activo y el estado vacío actual.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// tarjetasPendientes.test.ts
// aCitaTarjeta: estamento = profesional.nombre, prestacion = prestacion.nombre_prestacion, gestor = gestor.nombre,
//   comunicador de cada llamada = comunicador.nombre; cita "Cita Aceptada" con llamada aceptada a las
//   2026-01-15T12:00Z → fecha_cierre = esa fecha; hora_agendada = la hora_agendada de esa llamada.
// aSolicitudTarjeta: Rechazado con fecha_validacion → fecha_cierre = fecha_validacion; motivo/tipo/orientador/gestor por nombre.
// PendientesCascada.test.tsx
it("las citas parten abiertas y una cita cerrada se ve con su tono, sin acciones de cita", () => {});
it("cita pendiente muestra Fecha estimada y priorización", () => {});
it("citas pendientes sin solicitud En Curso aparecen en 'Otras citas'", () => {});
it("voucher solo para solicitudes del centro activo (comportamiento actual)", () => {});
it("muestra llamadas de citas de otros centros", () => {});
```

En `IngresarSolicitudView.test.tsx`, actualizar los fixtures de `solicitudesPendientes` (agregar
`citas: []`, `orientador`, `gestor`, `razon_rechazo` y `fecha_validacion`) y verificar que el caso
de duplicado sigue pasando sin cambiar sus aserciones.

- [ ] **Step 2: Correr los tests y comprobar que fallan**

Run: `npx vitest run src/modules/solicitudes/utils/tarjetasPendientes.test.ts src/modules/solicitudes/components/PendientesCascada.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar** el adaptador, `ListaPendientes` y `PendientesCascada`.

- [ ] **Step 4: Correr los tests y comprobar que pasan**

Run: `npx vitest run src/modules/solicitudes/utils src/modules/solicitudes/components/PendientesCascada.test.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit** `feat(solicitudes): pendientes del orientador con tarjetas compartidas`

---

### Task 7: Revisar solicitudes (gestor) con tarjetas y los mismos botones

**Files:**
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx` (≈ líneas 1130-1240, contexto)
- Test: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `ListaPendientes` (Task 6) y la nueva respuesta de `getOtrasSolicitudes` (Task 5),
  `{ solicitudes: SolicitudCascada<CitaCascadaContexto>[] }`.

- [ ] **Step 1: Ajustar y agregar tests**

Actualizar los mocks de `getOtrasSolicitudes` a la forma anidada. Agregar:

```tsx
it("contexto: muestra Realizar/Rechazar/Usuario y, en cita pendiente editable, Cerrar cita/Editar prioridad/Editar fecha estimada", () => {});
it("contexto: una cita cerrada dentro de la solicitud se ve sin botones de cita", () => {});
it("contexto vacío: 'No hay otras solicitudes ni citas en curso para este RUT en tu centro.'", () => {});
```

Los 55 tests existentes deben seguir pasando. Solo se cambian selectores o fixtures, nunca la
aserción de un comportamiento.

- [ ] **Step 2: Correr los tests y comprobar que fallan**

Run: `npx vitest run src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`
Expected: FAIL (mocks o tipos de la forma nueva)

- [ ] **Step 3: Implementar**: `estaVacio = contexto.solicitudes.length === 0`; pasar
`solicitudes={contexto.solicitudes}` a `ListaPendientes`, sin `citasSueltas`. Las funciones
`accionesSolicitud` y `accionesCita` no cambian.

- [ ] **Step 4: Correr los tests y comprobar que pasan**

Run: el mismo comando del Step 2. Expected: PASS

- [ ] **Step 5: Commit** `feat(solicitudes): contexto del gestor con tarjetas compartidas`

---

### Task 8: Verificación integral

**Files:** ninguno nuevo (solo correcciones si algo falla).

- [ ] **Step 1:** `npm run lint`. Expected: sin errores.
- [ ] **Step 2:** `npx tsc --noEmit`. Expected: sin errores.
- [ ] **Step 3:** `npm test`. Expected: todo en verde.
- [ ] **Step 4:** `npm run build`. Expected: build exitoso.
- [ ] **Step 5:** Con `npm run dev`, revisar las tres pantallas con un RUT que tenga solicitudes en
  los tres estados, citas con varias llamadas y una descripción larga. Hacerlo a 375 px y en
  escritorio. Sin scroll horizontal, la columna derecha se apila en móvil y los colores coinciden con
  la tabla del semáforo. En Revisar solicitudes, ejecutar un "Editar prioridad" y confirmar que el
  contexto se recarga bien.
- [ ] **Step 6:** Commit de correcciones, si hubo: `fix: ajustes de verificación del rediseño de tarjetas`.
