# Tablas sin ancho minimo fijo

Fecha: 2026-10-06
Rama: `UI-TABLAS-ANCHO-MINIMO`
Origen: issue #23, "Deuda UI: tablas con ancho minimo fijo generan scroll horizontal".
Relacionado: S3 `docs/superpowers/specs/2026-09-15-sidebar-colapsable-tabla-design.md`.

## Problema

S3 resolvio el espacio de trabajo y la tabla principal de Revisar solicitudes, pero quedaron 11 tablas
con una combinacion de `min-w-[...]`, `table-fixed` y anchos fijos por columna. En pantallas de 1366px
con el sidebar expandido, estas tablas pueden forzar scroll horizontal aunque exista espacio suficiente
para presentar la informacion de forma mas compacta.

Tablas en alcance:

| Superficie | Archivo | Tabla |
| --- | --- | --- |
| Configuracion | `src/modules/configuracion/components/UsuariosRolesView.tsx` | Funcionarios |
| Configuracion | `src/modules/configuracion/components/UsuariosRolesView.tsx` | Tabla generica de mantenedores |
| Dashboard | `src/modules/dashboard/components/DashboardView.tsx` | Solicitudes ingresadas |
| Dashboard | `src/modules/dashboard/components/DashboardView.tsx` | Gestiones |
| Dashboard | `src/modules/dashboard/components/DashboardView.tsx` | Llamadas realizadas |
| Dashboard | `src/modules/dashboard/components/DashboardView.tsx` | Modal citas gestionadas |
| SOME | `src/modules/some/components/SomeView.tsx` | Productividad por funcionario |
| SOME | `src/modules/some/components/SomeView.tsx` | Demanda Clinica |
| SOME | `src/modules/some/components/SomeView.tsx` | Solicitudes Pendientes |
| Comunicador | `src/modules/comunicador/components/CitasPendientesTabla.tsx` | Citas pendientes |
| Solicitudes | `src/modules/solicitudes/components/RevisarSolicitudesView.tsx` | Modal resumen de citas |

## Objetivo

A 1366px, con el sidebar expandido, ninguna tabla del alcance debe mostrar scroll horizontal en su
estado normal. El scroll horizontal se conserva como respaldo para pantallas mas angostas o contenido
extraordinariamente largo, usando el contenedor que ya trae `Table` de shadcn.

## Principios de diseno

- Usar los componentes existentes de shadcn: `Table`, `TableHeader`, `TableBody`, `TableRow`,
  `TableHead`, `TableCell`, `Tooltip` y `DropdownMenu` cuando corresponda.
- Eliminar `min-w-[...]`, `table-fixed` y clases `w-[...]` en encabezados/celdas de estas tablas.
- Agrupar datos relacionados en una misma columna cuando eso reduzca columnas sin perder informacion.
- Mantener el dato principal visible y el secundario en `text-xs text-muted-foreground`.
- Para textos largos, usar `line-clamp-2` y tooltip con el texto completo cuando el texto sea relevante
  para la decision del usuario.
- Evitar acciones multiples en linea cuando presionen el ancho; moverlas a un `DropdownMenu` con portal.
- Mantener copys, permisos, filtros, paginacion, modales y acciones de negocio sin cambios.

## Diseno por superficie

### Configuracion

`UsuariosRolesView.tsx` tiene dos patrones.

La tabla generica `Table({ headers, children })` debe migrar a shadcn `Table` y dejar de imponer
`min-w-[780px] table-fixed`. Esta tabla sirve a tipos, motivos, profesionales, prestaciones y roles.
No se deben cambiar las filas salvo para ajustar padding a `TableCell` si hace falta. Como estas tablas
tienen pocas columnas, el cambio principal es quitar el ancho minimo y conservar el borde exterior.

La tabla de funcionarios debe compactarse de 8 columnas a 5:

| Columna | Contenido |
| --- | --- |
| Funcionario | Nombre; debajo RUT y email, con email acotado con `line-clamp-2` y tooltip |
| Rol / Centro | Rol; debajo centro |
| Programa | Programa asociado o "-" |
| Estado | `EstadoBadge` actual |
| Acciones | `RowActions` actual, preferentemente dentro de una celda de acciones compacta |

No se cambian las reglas anti-escalada: los estados `editDisabled`, `toggleDisabled` y `title` siguen
entrando a `RowActions`.

### Dashboard

Las tablas del dashboard son de detalle administrativo. Deben migrar a shadcn `Table` y reducir columnas
agrupando identificadores con contexto.

Solicitudes ingresadas:

| Columna | Contenido |
| --- | --- |
| Solicitud | `CodigoId`; debajo fecha |
| Paciente | RUT paciente |
| Tipo | Tipo de solicitud, `line-clamp-2` si es largo |
| Estado | `Badge` actual |

Gestiones:

| Columna | Contenido |
| --- | --- |
| Solicitud | `CodigoId`; debajo fecha de validacion |
| Paciente / Accion | RUT paciente; debajo accion |
| Citas | Total de citas; si existen, boton "Visualizar" |
| Rechazo | Razon de rechazo o "-", con `line-clamp-2` y tooltip |

Llamadas realizadas:

| Columna | Contenido |
| --- | --- |
| Llamada | `CodigoId`; debajo fecha y hora |
| Paciente / Cita | RUT paciente; debajo `CodigoId` de cita |
| Prestacion | Prestacion o tipo prestacion; debajo estamento |
| Respuesta | Respuesta usuario |
| Detalle | Boton "Ver" |

Modal citas gestionadas:

| Columna | Contenido |
| --- | --- |
| Cita | `CodigoId`; debajo fecha estimada |
| Prestacion | Tipo; debajo prestacion si difiere |
| Estamento / Prioridad | Estamento; debajo prioridad |
| Estado | `Badge` actual |

### SOME

Productividad por funcionario ya agrupa nombre y RUT. Debe migrar a shadcn `Table` y quitar anchos
fijos. Las metricas numericas se mantienen en columnas separadas porque son compactas y escaneables.
La verificacion visual final debe confirmar que esa decision no genera scroll a 1366px.

Demanda Clinica tiene muchas columnas porque cruza temporalidad y estados. Para que quepa a 1366px,
debe cambiar a columnas por grupos:

| Columna | Contenido |
| --- | --- |
| Profesional / Prestacion | Fila padre con boton expandible; filas hijas con indentacion |
| Total | Total |
| Temporalidad | Atrasados, Proximos, Futuros en una mini-lista vertical |
| Estados | Conteos de `ESTADOS_PENDIENTES` en una mini-lista vertical |

Solicitudes Pendientes debe migrar a shadcn `Table`, eliminar `min-w-[620px] table-fixed` y mantener
sus 2 columnas actuales.

### Comunicador

`CitasPendientesTabla.tsx` debe compactarse de 9 columnas a 6:

| Columna | Contenido |
| --- | --- |
| Cita | `CodigoId`; debajo fecha estimada |
| Paciente | RUT usuario |
| Prestacion | Prestacion; debajo profesion |
| Priorizacion / Disponibilidad | Priorizacion; debajo disponibilidad |
| Estado | `Badge` actual |
| Acciones | Boton "Llamar" y `renderAcciones` en un contenedor compacto con `flex flex-wrap gap-2`, sin ancho minimo |

Se conserva el resaltado `tiene_llamada_hoy`.

### Solicitudes

El modal de resumen de gestion en `RevisarSolicitudesView.tsx` tiene una tabla secundaria de citas.
Debe migrar a shadcn `Table`, quitar `min-w-[640px]` y agrupar:

| Columna | Contenido |
| --- | --- |
| Cita | Profesional; debajo fecha estimada |
| Prestacion | Prestacion |

## Tests y verificacion

### Pruebas automatizadas

- Actualizar o agregar tests de render para cada superficie modificada.
- En tests, verificar ausencia de clases `min-w-[...]`, `table-fixed` y `w-[...]` en las tablas del
  alcance cuando sea practico desde DOM.
- Verificar que las agrupaciones muestran dato principal y secundario.
- Verificar que las acciones existentes siguen disponibles.

### Verificacion visual

- Levantar la app y revisar a 1366px con sidebar expandido:
  Configuracion > Funcionarios y al menos una tabla generica; Dashboard; SOME; Comunicador; modal de
  resumen en Revisar solicitudes.
- Confirmar que no aparece scroll horizontal en las tablas del alcance.
- Revisar a 390px que el scroll horizontal siga existiendo como respaldo si el contenido no cabe, sin
  cortar menus de acciones.

### Verificacion final

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`

## Fuera de alcance

- Cambiar reglas de negocio, permisos, queries, seeds o schema Prisma.
- Redisenar tarjetas, filtros, graficos o navegacion.
- Crear una abstraccion global nueva para todas las tablas.
- Eliminar el scroll horizontal como fallback para pantallas angostas.

## Criterios de aceptacion

- [ ] Las 11 tablas del alcance no tienen `min-w-[...]`, `table-fixed` ni anchos fijos por columna.
- [ ] A 1366px con sidebar expandido, ninguna tabla del alcance muestra scroll horizontal en estado normal.
- [ ] Los datos relevantes siguen visibles mediante agrupacion, texto secundario y tooltips para textos largos.
- [ ] Las acciones de fila siguen disponibles y no quedan cortadas por contenedores con overflow.
- [ ] Las pruebas automatizadas cubren las agrupaciones y acciones principales.
- [ ] `npm test`, `npx tsc --noEmit` y `npm run lint` pasan.
