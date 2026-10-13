# Panel SOME: consultas acotadas para demanda clinica y solicitudes pendientes

Fecha: 2026-10-06
Rama: `Panel-SOME-ISSUES`
Origen: issue #15, detectado al revisar PR #14.

## Problema

`getSomePanel` ya acota por fecha las cuatro consultas de productividad, pero aun materializa dos
backlogs completos del centro:

- **Demanda clinica:** todas las citas pendientes del centro, con joins a profesional y prestacion.
- **Solicitudes pendientes:** todas las solicitudes en espera de validacion del centro, con joins a
  tipo y motivo.

Los indices existentes ayudan a encontrar las filas, pero el resultado que viaja a Node no tiene
techo. Como ambos paneles se consumen solo como conteos agrupados, traer fila por fila hace que el
coste de memoria, transferencia y post-procesamiento crezca con el historico pendiente.

## Objetivo

Que ambas secciones del Panel SOME sigan mostrando los mismos conteos y ordenamientos, pero que las
consultas devuelvan resultados agregados cuyo tamano dependa de combinaciones de catalogo:
profesional/prestacion/estado/temporalidad y tipo/motivo.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Alcance | Solo `src/modules/some/actions/getSomePanel.action.ts` y sus tests | El contrato de UI no cambia |
| Solicitudes pendientes | `solicitud.groupBy({ by: ["tipo_solicitud_id", "motivo_id"], _count })` + lookup de catalogos | Pasa de N solicitudes a combinaciones tipo/motivo |
| Demanda clinica | `cita.groupBy({ by: ["profesional_id", "prestacion_id", "estado_cita"], _count })` por rango de temporalidad | Mantiene la clasificacion actual sin traer citas individuales |
| Temporalidad | Reusar las mismas fronteras: atrasados `< hoy - 15 dias`, futuros `>= hoy + 31 dias`, proximos resto o fecha nula | Conserva comportamiento observable de `temporalidadCita` |
| Fecha actual | Centralizar en helpers puros para construir filtros de temporalidad | Permite tests deterministas y evita divergencia entre rangos y etiquetas |
| Catalogos | Resolver nombres con `profesional.findMany`, `prestacion.findMany`, `tipoSolicitud.findMany`, `motivo.findMany` sobre ids usados | Evita joins por fila y conserva fallback `"-"` / `"Sin motivo"` |
| Indices | Sin migracion obligatoria en este issue | El criterio pide analisis estatico; cualquier indice adicional debe validarse con `EXPLAIN` |

## Diseno

### 1. Helpers puros

En `getSomePanel.action.ts` se agregan helpers privados:

- `buildTemporalidadRangos(base?: Date)`: devuelve `hoy`, `atrasadosHasta` y `futurosDesde` con
  horas en cero.
- `buildTemporalidadWhere(temporalidad, rangos)`: devuelve el filtro Prisma para
  `fecha_estimada_atencion`:
  - atrasados: `{ lt: atrasadosHasta }`
  - futuros: `{ gte: futurosDesde }`
  - proximos: `OR [{ fecha_estimada_atencion: null }, { fecha_estimada_atencion: { gte: atrasadosHasta, lt: futurosDesde } }]`
- `mergeDemandaAgrupada(...)`: fusiona los grupos por temporalidad en el mismo
  `SomeDemandaProfesional[]` actual.
- `buildSolicitudesPendientesAgrupadas(...)`: arma `SomeSolicitudPendienteTipo[]` desde grupos y
  lookups.

`temporalidadCita` puede eliminarse si queda sin uso, siempre que los tests de temporalidad sigan
cubriendo los mismos bordes.

### 2. Demanda clinica

Reemplazar el `prisma.cita.findMany` sin limite por agregaciones:

- Si `demandaTemporalidad === TEMPORALIDAD.TODAS`, ejecutar tres `groupBy`, uno por cada rango:
  atrasados, proximos y futuros.
- Si se selecciona una temporalidad concreta, ejecutar solo el `groupBy` del rango seleccionado.
- Cada `groupBy` usa:
  - `where`: `centro_id`, `estado_cita in ESTADOS_PENDIENTES`, y filtro temporal.
  - `by`: `["profesional_id", "prestacion_id", "estado_cita"]`.
  - `_count`: `{ _all: true }`.

Luego se obtienen nombres con dos lookups acotados:

- `prisma.profesional.findMany({ where: { id_profesional: { in: ids } } })`
- `prisma.prestacion.findMany({ where: { id_prestacion: { in: ids } } })`

Los `null` mantienen fallback:

- profesional: `"-"`
- prestacion: `"-"`
- estado: `"-"` si apareciera nulo, aunque el `where` normal lo evita.

El resultado conserva:

- totales por profesional y por prestacion;
- columnas de temporalidad;
- columnas por `ESTADOS_PENDIENTES`;
- orden descendente por `total` y luego alfabeto español.

### 3. Solicitudes pendientes

Reemplazar el `prisma.solicitud.findMany` sin limite por:

```ts
prisma.solicitud.groupBy({
    by: ["tipo_solicitud_id", "motivo_id"],
    where: { centro_id: centroSeleccionado, accion: ACCION_ESPERA_VALIDACION },
    _count: { _all: true }
})
```

Resolver nombres con:

- `prisma.tipoSolicitud.findMany({ where: { id_tipo_solicitud: { in: ids } } })`
- `prisma.motivo.findMany({ where: { id_motivo: { in: ids } } })`

Fallbacks:

- tipo solicitud: `"-"` si el catalogo no existe;
- motivo: `"Sin motivo"` para `motivo_id = null`, o `"-"` si el id existe pero no se encuentra en
  catalogo.

El resultado conserva orden descendente por total y luego nombre.

### 4. Pruebas

Actualizar `src/modules/some/actions/getSomePanel.action.test.ts`:

- El mock de Prisma debe incluir `solicitud.groupBy`, `cita.groupBy`, `profesional.findMany`,
  `prestacion.findMany`, `tipoSolicitud.findMany` y `motivo.findMany`.
- Las pruebas existentes de demanda clinica y solicitudes pendientes deben pasar a alimentar grupos
  agregados, no filas completas.
- Agregar una prueba estructural que confirme:
  - la consulta de demanda clinica no usa `cita.findMany` para el backlog;
  - la consulta de solicitudes pendientes no usa `solicitud.findMany` para el backlog;
  - ambas usan `groupBy` con los campos esperados.
- Agregar una prueba de temporalidad que cubra `Todas` con tres grupos y el filtro de temporalidad
  concreto con un solo grupo.
- Agregar una prueba de fallback para ids nulos o catalogos faltantes.

## Fuera de alcance

- Cambios de UI en `SomeView`.
- Migraciones o nuevos indices.
- Cambiar las cuatro consultas de productividad, aunque tambien materializan filas del rango.
- Cambiar RBAC del Panel SOME o el criterio de administrador por nombre.
- Medicion real con dataset sintetico; queda como verificacion recomendada posterior.

## Criterios de aceptacion

- [ ] Demanda clinica deja de traer citas individuales pendientes y usa agregaciones por
      profesional/prestacion/estado/temporalidad.
- [ ] Solicitudes pendientes deja de traer solicitudes individuales y usa agregacion por
      tipo/motivo.
- [ ] `SomePanelData` mantiene el mismo contrato consumido por `SomeView`.
- [ ] El tamano de resultados procesados en Node queda acotado por combinaciones de catalogos, no por
      cantidad historica de citas o solicitudes pendientes.
- [ ] Los filtros de centro y temporalidad conservan el comportamiento actual.
- [ ] `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`, `npx tsc --noEmit` y
      `npm run lint` quedan en verde.

