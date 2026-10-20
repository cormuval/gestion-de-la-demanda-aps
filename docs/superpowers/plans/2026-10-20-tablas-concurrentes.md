# Tablas con varios funcionarios en simultáneo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en Gestionar solicitudes y Contactar pacientes nadie abra una fila que otro funcionario ya gestionó, y que las tablas se mantengan al día solas.

**Architecture:**
- Dos Server Actions de solo lectura verifican si una solicitud o una cita sigue pendiente, con el mismo permiso y las mismas condiciones que la acción que protegen.
- Un hook compartido recarga la tabla al volver a la pestaña y cada 60 s, en pausa si hay un modal abierto.
- Las vistas verifican antes de abrir, recargan en silencio y cierran el modal si el guardado choca con una gestión ajena.

**Tech Stack:** Next.js 15 (Server Actions), React 19, Prisma 6, sonner, Vitest + Testing Library (fake timers).

**Spec:** `docs/superpowers/specs/2026-10-20-tablas-concurrentes-design.md`

## Global Constraints

- **Rama:** `feat/concurrencia-tablas`, apilada sobre `feat/filtros-panel-y-nombres` (PR #41). Las vistas ya usan `PanelFiltros` y `filtrosAplicados`.
- **Actions:**
  - Devuelven `ResultadoAccion<T>` y nunca usan `throw new Error`; lo prohíbe el test `resultado-accion-por-action.test.ts`.
  - El guard es la primera línea.
  - Un archivo con `"use server"` solo exporta funciones async: las constantes compartidas van en archivos `types/`.
- **Textos exactos:**
  - Aviso al abrir una solicitud gestionada: `` `Otro funcionario ya gestionó esta solicitud (${estado})` ``
  - Aviso al abrir una cita cerrada: `` `Esta cita ya fue cerrada (${estado})` ``
  - Aviso de fila inexistente en el centro: `"Esta solicitud ya no está disponible en tu centro"` y `"Esta cita ya no está disponible en tu centro"`
  - Error de guardado de solicitud (ya existe): `"La solicitud no esta pendiente de validacion o no pertenece a tu centro"`
  - Error de guardado de cita (ya existe): `"La cita ya está cerrada"`
- **Avisos:** usan `toast.warning`.
- **Refresco:** intervalo de `60_000` ms; solo con `document.visibilityState === "visible"`; en pausa con cualquier modal de gestión abierto.
- **Convenciones:** español, 4 espacios, imports categorizados, alias `@/`.

## Review Focus

1. **Doble clic en "Llamar" o "Realizar" mientras la verificación está en vuelo:** no debe abrir el modal dos veces ni lanzar dos verificaciones. Test en las Tasks 4 y 5: la segunda pulsación durante la verificación se ignora.
2. **Recarga automática que responde después de que el usuario cambió de filtro o de página:** no debe pisar el resultado más nuevo. Test en la Task 4: la recarga silenciosa usa los filtros aplicados al momento de responder y descarta una respuesta obsoleta.
3. **Pestaña oculta por horas y luego visible:** un solo refresco al volver, no una ráfaga acumulada. Test en la Task 1.
4. **El modal se cierra:** el intervalo se reanuda sin esperar otros 60 s extra ni recargar dos veces. Test en la Task 1: tras `pausado` true → false, la siguiente recarga ocurre en el próximo tick del intervalo.
5. **La verificación devuelve `ok: false` por funcionario sin centro:** se abre igual el modal, sin toast de advertencia. Test en las Tasks 4 y 5.

---

### Task 1: Hook `useRefrescoAutomatico`

**Files:**
- Create: `src/shared/hooks/useRefrescoAutomatico.ts`
- Test: `src/shared/hooks/useRefrescoAutomatico.test.ts`

**Interfaces:**
- Produces: `useRefrescoAutomatico(recargar: () => void, opciones?: { intervaloMs?: number; pausado?: boolean }): void`. Por defecto `intervaloMs = 60_000` y `pausado = false`.

- [ ] **Step 1: Escribir los tests que fallan** con `vi.useFakeTimers()`, `renderHook` y el estado de visibilidad mockeado vía `Object.defineProperty(document, "visibilityState", …)`:
  - `"recarga cada intervalo con la pestana visible"`: tras avanzar 60 000 ms, 1 llamada; tras 120 000 ms, 2.
  - `"no recarga con la pestana oculta y recarga una vez al volver"`: con la pestaña oculta y 5 intervalos avanzados, 0 llamadas. Al disparar `visibilitychange` con la pestaña visible, 1 llamada.
  - `"no recarga mientras esta pausado y reanuda al despausar"`: con `pausado: true`, avanzar 60 s y `visibilitychange` no producen llamadas. Tras rerender con `pausado: false` y avanzar 60 s, 1 llamada.
  - `"usa la ultima funcion recargar sin reiniciar el intervalo"`: tras rerender con una nueva `recargar` a los 30 s y avanzar otros 30 s, se llama la nueva una vez.
  - `"limpia el intervalo y el listener al desmontar"`: tras `unmount`, avanzar el tiempo y disparar `visibilitychange` no producen llamadas.
- [ ] **Step 2: Correrlos** con `npx vitest run src/shared/hooks`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - Guardar `recargar` y `pausado` en refs actualizadas en cada render, para que el intervalo no se reinicie.
  - El `setInterval` y el listener de `visibilitychange` se crean en un `useEffect` que depende solo de `intervaloMs`.
- [ ] **Step 4: Verificar** que `npx vitest run src/shared/hooks` pasa.
- [ ] **Step 5: Commit** con el mensaje `feat: hook useRefrescoAutomatico`.

### Task 2: `verificarSolicitudPendiente`

**Files:**
- Create: `src/modules/solicitudes/types/gestion.ts`: `export const ERROR_SOLICITUD_NO_PENDIENTE = "La solicitud no esta pendiente de validacion o no pertenece a tu centro";` y `export interface EstadoPendiente { pendiente: boolean; estado: string | null }`.
- Modify: `src/modules/solicitudes/actions/gestionarSolicitud.action.ts`: usar la constante en el `return` existente, sin cambiar el texto.
- Create: `src/modules/solicitudes/actions/verificarSolicitudPendiente.action.ts`
- Test: `src/modules/solicitudes/actions/verificarSolicitudPendiente.action.test.ts`
- Modify: `src/modules/permisos-por-action.test.ts`: fila `{ nombre: "verificarSolicitudPendiente", invocar: () => verificarSolicitudPendiente("SOL-1"), permisos: ["solicitudes.gestionar"] }` y conteo 31 → 32.

**Interfaces:**
- Produces:
  - `verificarSolicitudPendiente(idSolicitud: string): Promise<ResultadoAccion<EstadoPendiente>>`
  - `EstadoPendiente`
  - `ERROR_SOLICITUD_NO_PENDIENTE`

- [ ] **Step 1: Escribir los tests que fallan** mockeando prisma (`solicitud.findFirst`, `funcionario.findUnique`) y `requirePermiso` con `centro_id: "655"`:
  - `"exige solicitudes.gestionar"`.
  - `"pendiente cuando sigue en espera de validacion"`: con `{ estado_solicitud: "En Curso", accion: "En espera de validación" }` devuelve `{ ok: true, data: { pendiente: true, estado: "En Curso" } }`.
  - `"no pendiente cuando ya fue gestionada"`: con `Rechazado` devuelve `{ pendiente: false, estado: "Rechazado" }`. Con `En Curso` y acción `Realizar solicitud` devuelve `{ pendiente: false, estado: "En Curso" }`.
  - `"inexistente en el centro"`: con `null` devuelve `{ pendiente: false, estado: null }`. El `where` lleva `{ id_solicitud: "SOL-1", centro_id: "655" }`.
  - `"usa el centro del funcionario si la sesion no tiene"` y `"sin centro devuelve el error estandar"`.
- [ ] **Step 2: Correrlos.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - Archivo con `"use server"`.
  - Para el centro, replicar la resolución de `gestionarSolicitud` (sesión → `funcionario.centro_id`). Si ese helper ya está extraído en un util del módulo, reutilizarlo; si no, copiar el patrón local que usan las demás actions del módulo.
  - `select` solo de `estado_solicitud` y `accion`.
  - Usar `ACCION_ESPERA_VALIDACION` existente.
- [ ] **Step 4: Verificar** con `npx vitest run src/modules/solicitudes/actions src/modules/permisos-por-action.test.ts src/modules/resultado-accion-por-action.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** con el mensaje `feat(solicitudes): verificarSolicitudPendiente`.

### Task 3: `verificarCitaPendiente`

**Files:**
- Modify: `src/modules/comunicador/types/comunicador.ts`: `export const ERROR_CITA_CERRADA = "La cita ya está cerrada";`.
- Modify: `src/modules/comunicador/actions/registrarLlamada.action.ts`: usar `ERROR_CITA_CERRADA` sin cambiar el texto.
- Create: `src/modules/comunicador/actions/verificarCitaPendiente.action.ts`
- Test: `src/modules/comunicador/actions/verificarCitaPendiente.action.test.ts`
- Modify: `src/modules/permisos-por-action.test.ts`: fila con `["comunicador.llamar"]` y conteo 32 → 33.

**Interfaces:**
- Consumes: `EstadoPendiente` (Task 2).
- Produces: `verificarCitaPendiente(idCita: string): Promise<ResultadoAccion<EstadoPendiente>>` y `ERROR_CITA_CERRADA`.

- [ ] **Step 1: Escribir los tests que fallan** (`cita.findFirst` mockeado; sesión con `centro_id: "655"`):
  - `"exige comunicador.llamar"`.
  - `"sin centro devuelve el error estandar"`: el mismo texto que `registrarLlamada` y las demás actions del Comunicador.
  - `"pendiente"`: `"No contesta (1)"` → `true`. `null` → `true`, con `estado: null`.
  - `"cerrada"`: `"Cita Aceptada"` → `{ pendiente: false, estado: "Cita Aceptada" }`.
  - `"inexistente en el centro"`: → `{ pendiente: false, estado: null }`. El `where` lleva `{ id_cita: "CITA-1", centro_id: "655" }`.
- [ ] **Step 2: Correrlos.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - Archivo con `"use server"`.
  - `pendiente` es `esEstadoPendiente(estado) || estado === null`.
  - Distinguir "inexistente" (sin fila) de "sin estado" (fila con `estado_cita` null).
- [ ] **Step 4: Verificar** con `npx vitest run src/modules/comunicador/actions src/modules/permisos-por-action.test.ts src/modules/resultado-accion-por-action.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** con el mensaje `feat(comunicador): verificarCitaPendiente`.

### Task 4: Gestionar solicitudes

**Files:**
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Test: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `useRefrescoAutomatico` (Task 1); `verificarSolicitudPendiente` y `ERROR_SOLICITUD_NO_PENDIENTE` (Task 2).

- [ ] **Step 1: Escribir los tests que fallan** (mock de `verificarSolicitudPendiente`, que por defecto devuelve `pendiente: true`):
  - `"no abre Realizar si otro funcionario ya la gestiono"`: con `{ ok: true, data: { pendiente: false, estado: "Rechazado" } }` no hay diálogo "Realizar solicitud", aparece `toast.warning("Otro funcionario ya gestionó esta solicitud (Rechazado)")` y `getSolicitudes` se llama otra vez.
  - `"avisa cuando ya no esta disponible en el centro"`: con `estado: null` aparece `"Esta solicitud ya no está disponible en tu centro"`.
  - `"abre igual si la verificacion falla"`: tanto con `{ ok: false, error: "x" }` como con un rechazo, el diálogo se abre y no hay `toast.warning`.
  - `"ignora una segunda pulsacion mientras verifica"`: con la verificación pendiente, dos clics en "Rechazar solicitud" producen una sola llamada a `verificarSolicitudPendiente`.
  - `"cierra el modal y recarga si al guardar otro se adelanto"`: si `gestionarSolicitud` devuelve `{ ok: false, error: ERROR_SOLICITUD_NO_PENDIENTE }`, el diálogo se cierra y `getSolicitudes` se recarga. Con otro error, el diálogo sigue abierto (el test existente lo cubre).
  - `"refresca en silencio cada 60 s sin mostrar errores"`: con fake timers, tras 60 s se llama `getSolicitudes` con los filtros aplicados. Si esa recarga devuelve `ok: false`, no hay `toast.error`, sigue la fila `SOL-1` y no hay alerta de error.
  - `"no refresca con un modal abierto"`.
  - `"descarta una recarga silenciosa obsoleta"`: si una recarga silenciosa responde después de que el usuario aplicó filtros nuevos, su resultado no reemplaza la tabla.
- [ ] **Step 2: Correrlos.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - **`loadSolicitudes(nextFilters, opciones?: { silencioso?: boolean })`:**
    - Si es silencioso, no toca `loading`, `solicitudesError` ni toasts.
    - Un contador de peticiones (ref) descarta respuestas que no sean la última, silenciosas o no.
  - **`verificarAntesDeAbrir(solicitud, abrir)`:** guarda el id en verificación (ref o estado) para ignorar pulsaciones repetidas. Lo usan `openRechazo` y `openRealizar`.
  - **Al guardar:** si `result.error === ERROR_SOLICITUD_NO_PENDIENTE`, cerrar el modal correspondiente y llamar a `loadSolicitudes(filtrosAplicados)`.
  - **Refresco:** `useRefrescoAutomatico(() => loadSolicitudes(filtrosAplicados, { silencioso: true }), { pausado })`. `pausado` es verdadero si hay algún modal abierto: `rechazoSolicitud`, `realizarSolicitud`, `otrasSolicitudBase`, `citaEditando` o `editingUsuario`.
- [ ] **Step 4: Verificar** que `npx vitest run src/modules/solicitudes` pasa.
- [ ] **Step 5: Commit** con el mensaje `feat(solicitudes): verificar antes de gestionar y refresco automatico`.

### Task 5: Contactar pacientes

**Files:**
- Modify: `src/modules/comunicador/components/ComunicadorView.tsx`
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`: prop `onCitaCerrada?: () => void`, llamada después del toast cuando `resultado.error === ERROR_CITA_CERRADA`.
- Test: `src/modules/comunicador/components/ComunicadorView.test.tsx`, `RegistrarLlamadaModal.test.tsx`

**Interfaces:**
- Consumes: `useRefrescoAutomatico` (Task 1); `verificarCitaPendiente` y `ERROR_CITA_CERRADA` (Task 3).

- [ ] **Step 1: Escribir los tests que fallan:**
  - **Vista**, "no abre Llamar si la cita ya fue cerrada": con `pendiente: false` y estado `"Cita Aceptada"`, no hay diálogo "Registrar llamada", aparece `toast.warning("Esta cita ya fue cerrada (Cita Aceptada)")` y `getCitasPendientes` se recarga.
  - **Vista**, `estado: null`: aparece `"Esta cita ya no está disponible en tu centro"`.
  - **Vista**, "abre igual si la verificacion falla" y "ignora una segunda pulsacion mientras verifica".
  - **Modal**, "avisa al padre si la cita ya estaba cerrada": con `{ ok: false, error: "La cita ya está cerrada" }` se llama `onCitaCerrada`. Con otro error no se llama.
  - **Vista**, al recibir `onCitaCerrada`: se cierra el modal y se recarga la cola.
  - **Vista**, refresco silencioso cada 60 s: usa los filtros aplicados y la página; si falla, no hay toast y se conservan las filas.
  - **Vista**, no refresca con un modal abierto: `citaSel`, `citaHistorial`, `citaOtras` o `editarPaciente.open`.
- [ ] **Step 2: Correrlos.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - `cargar(opciones?: { silencioso?: boolean })` sigue el mismo patrón que la Task 4: contador de peticiones y modo silencioso sin tocar `cargando`, `errorCola` ni toasts.
  - `abrirGestion` verifica antes de pedir el contacto y de abrir el modal.
- [ ] **Step 4: Verificar** con `npx tsc --noEmit && npm run lint && npx vitest run`. Expected: todo en verde.
- [ ] **Step 5: Commit** con el mensaje `feat(comunicador): verificar antes de llamar y refresco automatico`.
