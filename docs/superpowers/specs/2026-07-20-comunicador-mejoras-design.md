# Mejoras del módulo Comunicador — Diseño

Fecha: 2026-07-20
Rama: `feat/comunicador-mejoras`
Estado: aprobado (diseño), pendiente de plan de implementación

## Objetivo

Mejorar el módulo comunicador para que el usuario pueda: buscar citaciones por RUT y
sector, consultar el historial de llamadas de una cita, ver las demás citas próximas
del paciente, identificar de un vistazo las filas ya gestionadas hoy, y editar los datos
del paciente sin salir del comunicador. Adicionalmente, mostrar en cascada la relación
Solicitud → Citas en `/solicitudes/ingresar`.

## Alcance

Incluye 6 cambios (detallados abajo). **Fuera de alcance:** la normalización del campo
`Usuario.sector` a un catálogo (se posterga a un trabajo aparte). En esta entrega el
sector se filtra como texto libre, compatible con normalizar después.

## Contexto técnico (estado actual)

- Cola de citaciones: componente `src/modules/comunicador/components/CitasPendientesTabla.tsx`
  (tabla HTML propia, no shadcn DataTable). Filas keyed por `id_cita`. Columnas actuales:
  Código, Priorización, Disponibilidad, RUT, Profesión, Prestación, Fecha estimada, Estado,
  y botón "Llamar".
- Datos de la cola: `src/modules/comunicador/actions/getCitasPendientes.action.ts` vía
  `$queryRaw`. Ya hace `JOIN usuarios u ON u.rut = c.rut_usuario` y
  `JOIN solicitudes s`, `LEFT JOIN profesionales p`, `LEFT JOIN prestaciones pr`.
  Por tanto `u.sector` y `u.rut` ya están disponibles sin joins nuevos.
- Filtros: `CitasFiltros.tsx` (UI) + `citasFiltrosSchema` en `schemas/llamada.schema.ts`.
  Implementados con estado local de React (`filtrosUI` / `aplicados`) + server action;
  **no** usan searchParams en URL. Se aplican al presionar "Aplicar filtros".
- Modales: patrón "casero" (div `fixed inset-0` + panel), como `RegistrarLlamadaModal.tsx`.
  El proyecto solo tiene estos componentes shadcn: badge, button, card, input, label,
  select, textarea. No existe `dialog` ni `dropdown-menu`.
- Temporalidad: cálculo por rango de fechas sobre `Cita.fecha_estimada_atencion`
  (`utils/temporalidad.ts`). "Agendamientos próximos" = `fecha_estimada` entre hoy−15 y hoy+30.
- Modelo de datos (Prisma):
  - `Usuario` (paciente, tabla `usuarios`): PK `rut`; campos `nombre`, `apellido`,
    `sector` (VarChar 50, texto libre), `telefono`, etc.
  - `Solicitud` (tabla `solicitudes`): PK `id_solicitud`; `rut_usuario`,
    `estado_solicitud` (pendiente = "En Curso"); relación `citas Cita[]`.
  - `Cita` (tabla `citas`): PK `id_cita`; `solicitud_id` → Solicitud; `rut_usuario` → Usuario;
    `fecha_estimada_atencion`, `estado_cita`, `priorizacion`, `centro_id`.
  - `Llamada` (tabla `llamadas`): PK `id_llamada`; `cita_id` → `Cita.id_cita`;
    `rut_comunicador`, `respuesta_usuario`, `observacion`, `hora_agendada`,
    `fecha_llamada` (DateTime), `centro_id`.
  - Jerarquía real: `Solicitud (1) —< Cita (N) —< Llamada (N)`.
- Estados pendientes de cita: `Sin llamadas`, `No contesta (1)`, `No contesta (2)`,
  `Solo aviso` (`ESTADOS_PENDIENTES` en `types/comunicador.ts`).
- Roles con acceso al comunicador (`src/shared/lib/access.ts`): `Administrador`,
  `Comunicador`, `SOME`, `Orientador y Comunicador`, `Gestor y Comunicador`, `Full`.

## Decisión de UI transversal: menú kebab por fila

Los cambios #2, #3 y #5 agregan cada uno un punto de entrada por fila; la fila ya tiene
"Llamar". Para no saturar, se mantiene el botón "Llamar" y se agrega un menú **kebab (⋮)**
al final de la fila con tres opciones: "Ver historial de llamadas", "Otras citas del
paciente", "Editar paciente".

- Se agregará el componente shadcn `dropdown-menu` (Radix) por accesibilidad y navegación
  con teclado. Alternativa descartada salvo objeción: dropdown propio con click-outside.

## Cambios

### #1 — Filtros por RUT y sector

- **UI:** dos campos nuevos en `CitasFiltros.tsx`: "RUT" (texto) y "Sector" (texto), dentro
  del panel de filtros existente. Se aplican al presionar "Aplicar filtros".
- **Schema:** `citasFiltrosSchema` suma `rut?: string` y `sector?: string` (trim, opcionales).
- **Backend:** `getCitasPendientes` agrega condiciones opcionales al WHERE:
  - RUT: coincidencia parcial → `c.rut_usuario LIKE CONCAT('%', <rut>, '%')`.
  - Sector: coincidencia parcial → `u.sector LIKE CONCAT('%', <sector>, '%')`.
- **Fuera de alcance:** normalización de sector a catálogo (trabajo aparte).

### #2 — Historial de llamadas (modal)

- **Entrada:** opción "Ver historial de llamadas" en el kebab de la fila.
- **Backend:** nueva action `getHistorialLlamadas(citaId: string)` en
  `src/modules/comunicador/actions/`. Control de acceso vía `puedeAccederComunicador` +
  verificación de centro. Retorna las `Llamada` de esa cita ordenadas por `fecha_llamada`
  desc, cada una con: `fecha_llamada` (fecha y hora), `respuesta_usuario`, `observacion`,
  y nombre del comunicador (join a `funcionarios` por `rut_comunicador`).
- **UI:** modal casero de solo lectura que lista los intentos. Estado vacío:
  "Sin llamadas registradas".

### #3 — Otras citas pendientes del paciente (modal)

- **Entrada:** opción "Otras citas del paciente" en el kebab.
- **Backend:** reutilizar `getCitasPendientesPaciente(rutUsuario, citaActualId)`, añadiendo
  el filtro de temporalidad **"Agendamientos próximos"** (fecha estimada entre hoy−15 y
  hoy+30) además de excluir la cita actual y filtrar por estado pendiente y centro.
- **UI:** modal que lista las citas próximas del paciente (código, prestación, fecha
  estimada, estado). Reutiliza/monta el componente `MultiCitaPanel.tsx` (hoy huérfano) o
  su lógica dentro de un modal. Estado vacío: "Sin otras citas próximas".

### #4 — Resaltar filas con llamada registrada hoy

- **Backend:** `getCitasPendientes` suma al SELECT un flag `tiene_llamada_hoy` (0/1) vía
  subconsulta: existe una `Llamada` de esa cita con `fecha_llamada` dentro del día actual
  (cualquier comunicador, cualquier respuesta).
- **UI:** las filas con `tiene_llamada_hoy = 1` reciben un fondo **sutil** acorde a la
  paleta del proyecto (a afinar visualmente, p. ej. tono suave `bg-primary/5` o ámbar
  suave), sin romper contraste ni el badge de estado.

### #5 — Editar paciente desde el comunicador

- **Entrada:** opción "Editar paciente" en el kebab.
- **UI:** reutilizar el componente `UsuarioEditModal.tsx`
  (`src/modules/solicitudes/components/`). Extraer la capa de estado/handlers hoy duplicada
  entre `/ingresar` y `/revisar` en un hook reutilizable `useUsuarioEdit`
  (form + `toUsuarioForm` + `updateUsuarioField` + submit) para no volver a duplicarla en
  el comunicador. La lista de `centros` se obtiene con la action existente.
- **Acceso:** la action actual `actualizarUsuario` exige `puedeAccederSolicitudes`. Para
  permitir edición desde el comunicador:
  - Extraer el núcleo de actualización (parse Zod con `usuarioSolicitudSchema` +
    `toUsuarioData` + `prisma.usuario.update` + `AuditLogger`) a una función compartida
    reutilizable.
  - Exponer una action de comunicador (p. ej. `actualizarUsuarioComunicador`) con guard
    `puedeAccederComunicador`, que reutiliza esa función. Así no se acoplan los permisos
    entre módulos. `actualizarUsuario` (solicitudes) sigue igual apuntando al mismo núcleo.

### #6 — Cascada Solicitud → Citas en /solicitudes/ingresar

- **UI:** reemplazar las dos Cards separadas ("Solicitudes pendientes" / "Citas pendientes")
  en `src/app/(app)/solicitudes/ingresar/page.tsx` por una vista en **cascada**: cada
  solicitud pendiente es una tarjeta contenedora con sus citas anidadas.
- **Datos:** `getPendientes` ya incluye `cita.solicitud` (con `tipoSolicitud` y `motivo`).
  Agrupar `citasPendientes` por `solicitud_id` bajo cada solicitud pendiente.
- **Huérfanas:** las citas pendientes cuya solicitud padre no esté en la lista de
  solicitudes pendientes se muestran en un grupo aparte "Otras citas".
- **Solicitudes sin citas:** se muestran igualmente como tarjeta (con indicación de que no
  tienen citas pendientes).

## Testing (Vitest)

- Filtros #1: `citasFiltrosSchema` acepta/normaliza `rut` y `sector`; construcción del
  WHERE con las nuevas condiciones LIKE.
- #2: `getHistorialLlamadas` retorna los campos esperados, orden desc, y estado vacío.
- #3: temporalidad "Agendamientos próximos" aplicada en las otras citas del paciente.
- #4: flag `tiene_llamada_hoy` (verdadero cuando hay llamada hoy, falso si no).
- #5: función compartida de update de usuario (validación + update) y guard de la action de
  comunicador.

## Riesgos / consideraciones

- El query de la cola crece (nuevas condiciones LIKE + subconsulta del flag). Vigilar
  rendimiento; los índices existentes en `citas` y `llamadas(cita_id)` ayudan.
- `dropdown-menu` de shadcn introduce dependencia Radix; aceptado por accesibilidad.
- Reutilizar `UsuarioEditModal` desde comunicador exige que los roles de comunicador tengan
  autorización para editar (resuelto con la action y guard propios del módulo).
- La cascada (#6) es un cambio de layout en una página grande (~735 líneas); mantener los
  subcomponentes locales existentes (`PendingRow`, etc.) y no introducir regresiones en el
  flujo de crear solicitud.
