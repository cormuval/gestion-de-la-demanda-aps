# Historial del paciente

Fecha: 2026-10-15
Rama: `feat/historial-paciente`
Origen: requerimiento del equipo (14/10/2026).

## Problema

Hoy no hay una vista para revisar la historia de un paciente. La bandeja, el Comunicador y
"Solicitudes y citas en curso" muestran solo lo pendiente. Lo cerrado (solicitudes realizadas o
rechazadas, citas aceptadas o rechazadas, y las llamadas que las cerraron) no se puede consultar
desde la app. Eso impide revisar atenciones anteriores y reconstruir qué pasó con un caso.

## Objetivo

Un módulo de solo lectura, en el menú y disponible para todos los roles, donde se busca un paciente
por RUT. Muestra **todas** sus solicitudes en el centro del funcionario, abiertas y cerradas y sin
límite de antigüedad, cada una con sus citas y las llamadas de cada cita. Incluye el estado y la
fecha de cierre de cada solicitud y cada cita.

Responde a la premisa de integralidad del proyecto: mirar al paciente completo, no solo la gestión
en curso.

## Decisiones

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Alcance por centro | Solo solicitudes con `centro_id` = centro del funcionario en sesión | Es la regla del resto del sistema; no se cruzan centros. |
| Antigüedad | Sin límite: todas las solicitudes, abiertas y cerradas | Decisión del 15/10/2026. Reemplaza el límite de un año del requerimiento original. |
| Detalle | Solicitud → citas → llamadas | Trazabilidad completa del caso. |
| Acceso | Permiso nuevo `historial.ver`, asignado a todos los roles | Sigue el modelo RBAC; un administrador puede quitarlo después desde Configuración. |
| Carga | Una Server Action con todo anidado | El volumen por paciente es acotado (decenas de registros) y la búsqueda se audita una sola vez. |
| Edición | Ninguna; solo lectura | El módulo es de consulta. |
| Auditoría | `AuditLogger.logDataAccess("SEARCH", …, "HISTORIAL_PACIENTE")` | Es acceso a datos de un paciente. |

## Cómo se cierra cada cosa (base para las fechas de cierre)

- **Cita:** se cierra solo con una llamada cuya respuesta deja un estado terminal (Cita Aceptada o
  alguna Cita Rechazada). La fecha de cierre es la `fecha_llamada` más reciente de la cita.
  Excepción: los avisos de rechazo migrados desde AppSheet se cerraron sin llamada.
- **Solicitud `Realizado`:** pasa a ese estado cuando se cierra su última cita pendiente, así que su
  fecha de cierre es la mayor fecha de cierre de sus citas.
- **Solicitud `Rechazado`:** el gestor la rechaza sin llamada. Su fecha de cierre es
  `fecha_validacion`.

## Diseño

### 1. Permiso y menú

Sigue el procedimiento §7 de `docs/rbac-permisos.md`:

- `src/config/permisos.ts`: `"historial.ver": { modulo: "Historial", etiqueta: "Ver historial del paciente" }`.
- `src/config/navegacion.ts`: item `{ label: "Historial del paciente", href: "/historial", icon: History, permiso: "historial.ver" }`,
  después de "Llamadas".
- `prisma/seed.ts`: `historial.ver` en `rolePermisos` de todos los roles.
- **Migración de datos** `prisma/migrations/<timestamp>_permiso_historial_ver/migration.sql`:
  `INSERT IGNORE INTO roles_permisos (rol_id, permiso) SELECT id_rol, 'historial.ver' FROM roles;`.
  - Producción la aplica con `prisma migrate deploy` en el deploy.
  - En local y en `gestion_demanda_ensayo` (que usan `db push`) se ejecuta el mismo SQL a mano; queda
    documentado en el PR.
- `src/modules/permisos-por-action.test.ts`: fila de `getHistorialPaciente` con `["historial.ver"]`.

### 2. Server Action `getHistorialPaciente(rut: string)`

Archivo: `src/modules/historial/actions/getHistorialPaciente.action.ts`. Devuelve
`ResultadoAccion<HistorialPaciente>`.

1. `requirePermiso("historial.ver")`.
2. Valida el RUT con `esRutChilenoValido` y lo normaliza con `normalizarRut`
   (`src/modules/solicitudes/utils/rut`). Si es inválido → `{ ok: false, error: "RUT invalido" }`.
3. Centro del funcionario desde la sesión; si no tiene → el error estándar
   `"El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."`.
4. Paciente: `usuario.findUnique` (rut, nombre, apellido). Si no existe → `ok: true` con
   `paciente: null` y `solicitudes: []`.
5. `solicitud.findMany({ where: { rut_usuario, centro_id }, orderBy: { fecha_inicio: "desc" } })`,
   con tipo, motivo, orientador y gestor. Sus citas van con profesional y prestación, ordenadas por
   `fecha_creacion` ascendente. Las llamadas de cada cita van ordenadas por `fecha_llamada`
   ascendente, con el comunicador (nombre).
6. Mapea a los tipos de salida y calcula las fechas de cierre con funciones puras (§3).
7. `AuditLogger.logDataAccess("SEARCH", true, actor, "HISTORIAL_PACIENTE", { details: "rut=<rut>" })`.

Tipos (`src/modules/historial/types/historial.ts`):

```ts
interface LlamadaHistorial { id_llamada; fecha_llamada: Date | null; respuesta_usuario; comunicador: string | null; observacion: string | null; hora_agendada: Date | null }
interface CitaHistorial { id_cita; estamento: string | null; prestacion: string | null; estado_cita: string | null; cerrada: boolean; fecha_cierre: Date | null; fecha_estimada_atencion: Date | null; observacion: string | null; llamadas: LlamadaHistorial[] }
interface SolicitudHistorial { id_solicitud; fecha_inicio: Date; tipo: string | null; motivo: string | null; descripcion: string | null; estado_solicitud; accion: string | null; razon_rechazo: string | null; fecha_cierre: Date | null; orientador: string | null; gestor: string | null; citas: CitaHistorial[] }
interface HistorialPaciente { paciente: { rut: string; nombre: string } | null; solicitudes: SolicitudHistorial[] }
```

### 3. Reglas de cierre (puras, `src/modules/historial/utils/cierre.ts`)

- `fechaCierreCita(estado_cita, llamadas)`:
  - Si el estado no es terminal (`esEstadoTerminal` del Comunicador) → `null`.
  - Si es terminal → la mayor `fecha_llamada`, o `null` si no hay llamadas.
- `fechaCierreSolicitud(solicitud, fechasCierreCitas)`:
  - `Rechazado` → `fecha_validacion`.
  - `Realizado` → la mayor fecha de cierre de sus citas, o `null`.
  - Cualquier otro estado → `null`.

### 4. Pantalla

- `src/app/(app)/historial/page.tsx` con `requirePermisoPagina("historial.ver")`, que renderiza
  `HistorialPacienteView`.
- `src/modules/historial/components/HistorialPacienteView.tsx` (cliente):
  - **Buscador:** formulario con input RUT y botón "Buscar".
  - **Resultado:** nombre y RUT del paciente, más un resumen "N solicitudes · X en curso ·
    Y realizadas · Z rechazadas".
  - **Una tarjeta por solicitud:**
    - ID, tipo · motivo, descripción, fecha de inicio, orientador y gestor.
    - Badge de estado y fecha de cierre; si es rechazada, también la razón.
    - Citas anidadas con estamento · prestación, badge de estado y fecha de cierre (o "—").
  - **Llamadas:** cada cita tiene un botón "Ver llamadas (N)" que despliega su lista con fecha,
    respuesta, comunicador y observación.
  - **Estados de la pantalla:**
    - Cargando: "Buscando...".
    - Error: `Alert` con el mensaje.
    - RUT sin datos: "Sin solicitudes en tu centro para este RUT".
- Componentes shadcn existentes (`Card`, `Badge`, `Button`, `Input`, `Alert`). Sin acciones de
  edición.

## Errores

| Caso | Resultado |
| --- | --- |
| Sin permiso | `requirePermiso` lanza (patrón existente; la página redirige a `/sin-acceso`) |
| RUT inválido | `ok: false`, "RUT invalido", mostrado en la pantalla |
| Funcionario sin centro | `ok: false` con el error estándar |
| RUT sin paciente o sin solicitudes en el centro | `ok: true` vacío → "Sin solicitudes en tu centro para este RUT" |
| Falla de BD o de red | Excepción → la pantalla muestra "No fue posible cargar el historial" |

## Tests (Vitest)

- `cierre.test.ts`:
  - Cita terminal con llamadas (toma la última) y cita terminal sin llamadas (`null`).
  - Cita pendiente (`null`).
  - Solicitud realizada (mayor de sus citas), rechazada (`fecha_validacion`) y en curso (`null`).
- `getHistorialPaciente.action.test.ts`:
  - RUT inválido, sin centro y paciente inexistente.
  - Filtra por el centro de la sesión y ordena por fecha de inicio descendente.
  - Mapea citas y llamadas con las fechas de cierre.
  - Audita la búsqueda.
- `HistorialPacienteView.test.tsx`:
  - Búsqueda, resumen, estado vacío, estado de error.
  - Muestra la fecha de cierre y la razón de rechazo.
  - Despliega las llamadas de una cita.
- `permisos-por-action.test.ts` y `navegacion` (si tiene test): el item aparece con `historial.ver`.

## Fuera de alcance

- Historial de otros centros.
- Filtros por fecha, estado o tipo dentro del historial.
- Exportar o imprimir.
- Editar o gestionar desde el historial.
