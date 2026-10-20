# Tablas con varios funcionarios en simultáneo

Fecha: 2026-10-20
Rama: `feat/concurrencia-tablas` (sobre `feat/filtros-panel-y-nombres`, PR #41)
Origen: día de pruebas sobre producción con datos de ensayo (19–20/10/2026).

## Problema

En algunos centros varios funcionarios trabajan a la vez en **Gestionar solicitudes** y en
**Contactar pacientes**. Cada tabla se carga una vez y no se entera de lo que hacen los demás.
Un funcionario puede abrir una solicitud o una cita que otro **ya terminó**: completa el formulario
y solo al guardar el sistema lo rechaza.

El backend ya protege los datos:
- `gestionarSolicitud` exige que la solicitud siga `En Curso` con acción `En espera de validación`.
- `registrarLlamada` rechaza una cita cerrada.

Lo que falta es la experiencia: avisar antes y mantener la tabla al día.

## Objetivo

Que el funcionario no pierda tiempo en filas que otro ya gestionó:

1. Antes de abrir el formulario de gestión, el sistema verifica que la fila siga pendiente.
2. La tabla se mantiene al día sola, sin perder filtros ni página.

## Decisiones

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Problema a resolver | Trabajo perdido sobre filas ya gestionadas | Es el caso más frecuente (decisión del 20/10/2026). |
| Llamadas simultáneas al mismo paciente | Fuera de alcance | Requiere un bloqueo "En gestión por X" con vencimiento; se evaluará si el caso aparece. |
| Verificación | Server Action liviana por fila antes de abrir el modal | Responde con el estado actual; no cambia nada. |
| Falla de la verificación | Se abre igual el modal | Es una ayuda: el backend sigue rechazando un guardado inválido. |
| Refresco | Al volver a la pestaña y cada 60 s, solo con la pestaña visible | Equilibrio entre frescura y carga del servidor (decisión del 20/10/2026). |
| Refresco con modal abierto | En pausa | No cambiar la tabla debajo de una gestión en curso. |
| Recarga automática | Silenciosa: sin skeleton, sin atenuar, sin toast de error | No interrumpir; si falla, se conserva lo último cargado y se reintenta en el ciclo siguiente. |
| Tiempo real (websockets) | Fuera de alcance | Excede lo necesario para el problema. |

## Diseño

### 1. Verificaciones (Server Actions de solo lectura)

**`verificarSolicitudPendiente(idSolicitud: string)`**
- Archivo: `src/modules/solicitudes/actions/verificarSolicitudPendiente.action.ts`.
- Guard `requirePermiso("solicitudes.gestionar")`, el mismo que `gestionarSolicitud`.
- Centro del funcionario igual que en `gestionarSolicitud`: el de la sesión o, si no hay, el del
  funcionario en la BD. Sin centro devuelve el error estándar.
- Busca la solicitud por `id_solicitud` y `centro_id`, y devuelve
  `ResultadoAccion<{ pendiente: boolean; estado: string | null }>`:
  - `pendiente` es `true` si `estado_solicitud = "En Curso"` y `accion = "En espera de validación"`
    (las mismas condiciones de `gestionarSolicitud`).
  - `estado` es el `estado_solicitud` actual (`Realizado`, `Rechazado`…), o `null` si no existe
    en el centro.

**`verificarCitaPendiente(idCita: string)`**
- Archivo: `src/modules/comunicador/actions/verificarCitaPendiente.action.ts`.
- Guard `requirePermiso("comunicador.llamar")`, el mismo que `registrarLlamada`.
- Busca la cita por `id_cita` y `centro_id` de la sesión. Devuelve
  `ResultadoAccion<{ pendiente: boolean; estado: string | null }>`:
  - `pendiente` es `esEstadoPendiente(estado_cita)` (sin estado cuenta como pendiente, igual que
    `registrarLlamada`, que lo trata como `Sin llamadas`).
  - `estado` es el `estado_cita` actual, o `null` si no existe en el centro.

Ninguna escribe ni audita: son lecturas de una fila que el funcionario ya ve en su tabla.

### 2. Uso en las vistas

**Gestionar solicitudes** (`RevisarSolicitudesView`): "Realizar solicitud" y "Rechazar solicitud"
pasan por `verificarAntesDeAbrir`:
- **`ok: true`, `pendiente: true`:** abre el modal como hoy.
- **`ok: true`, `pendiente: false`:** no abre; `toast.warning("Otro funcionario ya gestionó esta solicitud (<estado>)")`,
  o `"Esta solicitud ya no está disponible en tu centro"` si `estado` es `null`, y recarga la tabla.
- **`ok: false` o excepción:** abre el modal igual.
- "Otras solicitudes" y "Editar usuario" no se verifican: no gestionan la solicitud.

**Contactar pacientes** (`ComunicadorView`): "Llamar" verifica antes de abrir `RegistrarLlamadaModal`:
- No pendiente: `toast.warning("Esta cita ya fue cerrada (<estado>)")`, o el mismo texto de
  "ya no está disponible" si es `null`, y recarga la tabla.
- Error de verificación: abre igual.

**Al guardar:** si `gestionarSolicitud` o `registrarLlamada` devuelven `ok: false` porque la fila
dejó de estar pendiente ("La solicitud no esta pendiente de validacion…", "La cita ya está cerrada"),
se muestra el error, se cierra el modal y se recarga la tabla. Cualquier otro error de negocio
mantiene el modal abierto, como hoy.

### 3. Refresco automático

Hook compartido `src/shared/hooks/useRefrescoAutomatico.ts`:

```ts
useRefrescoAutomatico(recargar: () => void, opciones: { intervaloMs?: number; pausado?: boolean }): void
```

- `intervaloMs` por defecto: `60_000`.
- Llama a `recargar` cada `intervaloMs` solo si `document.visibilityState === "visible"` y no
  está `pausado`.
- Llama a `recargar` al volver la pestaña a visible (`visibilitychange`), si no está `pausado`.
- Limpia el intervalo y el listener al desmontar o cuando cambian las opciones.

Uso en las vistas:
- `pausado` es `true` cuando hay un modal de gestión abierto: realizar, rechazar, otras
  solicitudes, editar usuario, registrar llamada, historial u otras citas.
- `recargar` hace una **recarga silenciosa** con los filtros y la página aplicados:
  - sin skeleton y sin `opacity-60`;
  - sin toast de error ni alerta: si falla, conserva los datos y no cambia el estado de error visible;
  - si responde, reemplaza los datos (filas, total, páginas).
- **Gestionar solicitudes:** `loadSolicitudes` recibe una opción `{ silencioso: true }` para no tocar
  `loading` ni `solicitudesError`.
- **Contactar pacientes:** `cargar` recibe la misma opción y no toca `cargando` ni `errorCola`.

### 4. Archivos

| Archivo | Cambio |
| --- | --- |
| `src/modules/solicitudes/actions/verificarSolicitudPendiente.action.ts` (+ test) | nuevo |
| `src/modules/comunicador/actions/verificarCitaPendiente.action.ts` (+ test) | nuevo |
| `src/shared/hooks/useRefrescoAutomatico.ts` (+ test) | nuevo |
| `src/modules/permisos-por-action.test.ts` | dos filas nuevas (31 → 33) |
| `src/modules/solicitudes/components/RevisarSolicitudesView.tsx` (+ test) | verificar al abrir, recarga silenciosa, refresco, cierre al detectar gestión ajena |
| `src/modules/comunicador/components/ComunicadorView.tsx` (+ test) | ídem |

## Errores

| Caso | Resultado |
| --- | --- |
| Fila ya gestionada al abrir | No abre; toast de advertencia; recarga |
| Fila inexistente en el centro al abrir | No abre; "ya no está disponible en tu centro"; recarga |
| Verificación falla (red o BD) | Abre el modal; el backend valida al guardar |
| Al guardar, otro se adelantó | Toast con el error; cierra el modal; recarga |
| Recarga automática falla | Se conservan los datos; sin aviso; reintenta en el ciclo siguiente |
| Sin permiso | `requirePermiso` lanza (patrón existente) |

## Tests (Vitest)

- `verificarSolicitudPendiente`:
  - Pendiente (`En Curso` y `En espera de validación`) → `true`.
  - `Rechazado` o `Realizado` → `false` con su estado; inexistente → `false`, `null`.
  - Filtra por centro; error sin centro; exige el permiso.
- `verificarCitaPendiente`:
  - Pendiente → `true`; `null` → `true`; terminal → `false` con estado; inexistente → `false`, `null`.
  - Filtra por centro; exige el permiso.
- `useRefrescoAutomatico` (temporizadores simulados):
  - Recarga cada 60 s con la pestaña visible.
  - No recarga con la pestaña oculta; recarga al volver a visible.
  - No recarga si está pausado.
  - Limpia al desmontar.
- Vistas:
  - Gestión ajena: no abre el modal, muestra el aviso y recarga.
  - Abre si la verificación falla.
  - Cierra y recarga cuando el guardado choca con una gestión ajena.
  - La recarga silenciosa que falla no muestra error ni borra las filas.
- `permisos-por-action.test.ts`: las dos actions con su permiso.

## Fuera de alcance

- Aviso o bloqueo "En gestión por X" (llamadas simultáneas al mismo paciente).
- Actualización en tiempo real (websockets / server-sent events).
- Resaltar visualmente las filas que cambiaron tras una recarga.
