# Mejoras transversales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar REQ-8, REQ-13, REQ-21 y REQ-25 para facilitar gestión, contacto e historial del paciente, conservando la privacidad del voucher.

**Architecture:** Extender las consultas, contratos y vistas de los módulos existentes. Compartir únicamente presentación de nombres, escape de texto y mecanismo de ordenamiento; conservar las reglas y comparadores propios de cada módulo. Búsqueda paginada en servidor y ordenamiento de la página en cliente son operaciones independientes.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Prisma 6/MySQL 8.4, Zod, Tailwind 3, shadcn/ui, Vitest y Testing Library; sin dependencias nuevas.

**Spec:** [2026-11-10-mejoras-transversales-design.md](../specs/2026-11-10-mejoras-transversales-design.md), incluida la exclusión de nombres del voucher aprobada por el usuario.

## Global Constraints

- «General» en el levantamiento significa alcance transversal; no se crea un módulo con ese nombre.
- El diseño conserva el flujo ingreso → gestión → contacto y la mirada integral del paciente.
- Se mantienen 100 filas por página, sin descargar el conjunto completo al cliente.
- No se crean permisos, tablas ni un módulo General.
- No se amplía la búsqueda a todo el histórico o a otros centros.
- No se modifica la prioridad clínica ni se incorpora ordenamiento global.
- Los vouchers quedan excluidos de la incorporación de nombres por privacidad, incluyendo su emisión y reimpresión.
- Español, indentación de 4 espacios, interfaces para objetos e imports agrupados; lo exclusivo permanece en su módulo.
- Server Actions con permisos existentes, validación Zod, `ResultadoAccion` y auditoría; no imprimir credenciales ni datos identificatorios en mediciones.
- Ejecutar SDD conforme a AGENTS.md: tareas secuenciales con revisión, porque varias modifican los mismos archivos. No iniciar ejecución hasta revisión del plan; usar el worktree existente tras comprobar aislamiento.
- Al ejecutar frontend, leer `shadcn` y `vercel-react-best-practices`; al implementar y cerrar, aplicar TDD y verification-before-completion. Este documento no implementa código.

## Review Focus

1. Respuesta vieja después de aplicar otro texto o cambiar de centro: nunca puede reponer resultados anteriores; prueba en tarea 5.
2. `%`, `_`, barra inversa, comillas y `!`: deben representar texto literal y no ampliar coincidencias; pruebas con MySQL en tareas 3 y 8.
3. Última aceptación sin agenda o sin fecha de llamada: no recuperar una cita anterior ni mostrar agenda en otro estado; pruebas en tarea 2.
4. Orden manual y cierre concurrente de la siguiente cita: mantener continuidad en la secuencia visible y no enfocar una fila inexistente; prueba en tarea 7.
5. Paciente con nombre social, pero sin solicitudes en el centro: no revelar su identidad ni propagar nombres al voucher; pruebas en tareas 1 y 8.

## Inventario y límites de archivos

Inventario comprobado de presentaciones del nombre del paciente: `IngresarSolicitudView`, tabla de `RevisarSolicitudesView`, `CitasPendientesTabla`, `RegistrarLlamadaModal` y cabecera de `HistorialPacienteView`. Los formularios `UsuarioEditModal` y de ingreso ya tienen campos separados para nombres: conservarlos. Los detalles de Gestor que actualmente solo muestran RUT no requieren inventar una nueva cabecera; si se muestra el nombre en un detalle, aplicar la misma presentación. SOME y Dashboard muestran agregados y nombres de funcionarios, no una identificación de paciente por nombre. Las integraciones reciben nombres, pero no son superficies de presentación.

No se encontró otro documento con nombres del paciente: el único comprobante identificado es `VoucherSolicitudModal`, excluido. Repetir el inventario antes de cerrar para detectar cualquier superficie omitida; no extender esta política a nombres de funcionarios, centros o catálogos.

Archivos nuevos y responsabilidad única:

| Archivo | Responsabilidad |
| --- | --- |
| `src/shared/components/pacientes/nombre-paciente.tsx` | Nombre legal y línea opcional de nombre social, sin acceso a datos. |
| `src/modules/historial/utils/agendaCita.ts` | Selección de última aceptación y formato de agenda en Santiago. |
| `src/shared/lib/busquedaTexto.ts` | Schema de texto y escape literal de patrones LIKE. |
| `src/modules/solicitudes/schemas/solicitudFiltros.schema.ts` | Validar filtros de Gestor en la frontera servidor. |
| `src/modules/comunicador/utils/consultaCitas.ts` | Condiciones SQL y FROM compatibles de página y conteo. |
| `src/shared/lib/ordenPagina.ts` | Ciclo y orden estable con nulos al final, sin estado React. |
| `src/shared/components/tablas/encabezado-ordenable.tsx` | Control accesible para las columnas acordadas. |
| `src/modules/solicitudes/utils/ordenSolicitudes.ts` | Selectores y comparación de columnas de Gestor. |
| `src/modules/comunicador/utils/ordenCitas.ts` | Selectores y comparación de columnas de Comunicador. |
| `src/shared/lib/busquedaTexto.mysql.test.ts` | Contrato real de búsqueda paginada en MySQL local desechable. |
| `docs/superpowers/validaciones/2026-11-10-mejoras-transversales.md` | Evidencia final, límites de medición y revisión visual. |

Cada utilidad o componente nuevo tendrá un test contiguo `.test.ts` o `.test.tsx`. No extraer por completo `RevisarSolicitudesView`; las nuevas responsabilidades viven fuera y su integración es puntual.

## Orden y dependencias

`1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`. Cada tarea produce un commit independiente y se revisa antes de avanzar. Tareas 1–2 cubren contexto del paciente; 3–5, búsqueda; 6–7, ordenamiento; 8, validación integrada. No despachar implementadores simultáneos sobre las vistas compartidas.

### Tarea 1: Nombre social en las superficies del paciente — REQ-25

**Archivos:** Crear `src/shared/components/pacientes/nombre-paciente.tsx` y su test. Modificar `src/modules/comunicador/actions/getCitasPendientes.action.ts`, `src/modules/historial/actions/getHistorialPaciente.action.ts`, `src/modules/historial/types/historial.ts` y las cinco vistas del inventario. Ampliar sus tests existentes y `src/modules/solicitudes/actions/getVoucherSolicitud.action.test.ts`; no modificar el contrato ni el render del voucher.

**Interfaces:** `NombrePaciente({ nombreLegal, nombreSocial, className }: NombrePacienteProps): JSX.Element`, con `nombreLegal: string | null`, `nombreSocial?: string | null`, `className?: string`. Marcado con `span` y líneas de bloque, válido dentro de títulos y párrafos. `CitaFila.nombre_social: string | null`; `HistorialPaciente.paciente.nombre_social: string | null`. Solicitudes ya incluye el usuario completo.

- [ ] **1. Escribir pruebas que fallen.** Caso central:
  ```tsx
  render(<NombrePaciente nombreLegal="Nombre Legal" nombreSocial="Nombre Social" />);
  expect(screen.getByText("Nombre Legal")).toBeVisible();
  expect(screen.getByText("Nombre social: Nombre Social")).toBeVisible();
  ```
  Cubrir nombre social nulo, vacío, espacios y largo; fallback `—` para legal nulo. En cada vista, afirmar presencia de ambos nombres con el dato disponible. En acción de Historial sin solicitudes autorizadas, afirmar `paciente: null` aun existiendo nombre social. En reimpresión, afirmar que `data.usuario` no contiene claves `nombre`, `apellido` ni `nombre_social`.
- [ ] **2. Ejecutar y confirmar rojo:** `npm test -- src/shared/components/pacientes/nombre-paciente.test.tsx src/modules/historial src/modules/comunicador src/modules/solicitudes`. Esperar fallos por componente/campos nuevos ausentes, no por configuración.
- [ ] **3. Implementar los contratos y presentación.** Seleccionar `u.nombre_social AS nombre_social` en Comunicador y `nombre_social` en Historial. Mantener la regla de no devolver paciente fuera del centro. Integrar sin abrir formularios ni hacer consultas adicionales por fila. Evitar truncamiento que impida identificar el nombre social; conservar RUT, teléfono y contexto integral.
- [ ] **4. Ejecutar el mismo comando:** todos los tests afectados pasan; ajustar fixtures tipadas. Verificar semántica HTML del título del modal y cabecera de Historial.
- [ ] **5. Commit:** `feat: mostrar nombre social en gestión contacto e historial`.

### Tarea 2: Agenda visible solo en citas aceptadas — REQ-21

**Archivos:** Crear `src/modules/historial/utils/agendaCita.ts` y test. Modificar `src/modules/historial/types/historial.ts`, `actions/getHistorialPaciente.action.ts`, `components/HistorialPacienteView.tsx` y sus tests.

**Interfaces:** `resolverAgendaCita(estado: string | null, llamadas: readonly LlamadaHistorial[]): Date | null`; `formatearAgendaCita(fecha: Date): string`, locale `es-CL`, zona `America/Santiago`, fecha numérica y hora/minuto de 24 horas. Agregar `CitaHistorial.hora_agendada: Date | null`, resuelta en mapper; la UI comprueba además el estado antes de renderizar.

- [ ] **1. Escribir pruebas.** Con cita aceptada y aceptación de `2026-07-01T13:30:00Z`, comprobar `09:30` en Santiago; con `2026-01-15T13:30:00Z`, `10:30`. Probar estado no aceptado aunque haya aceptación previa; dos aceptaciones; empate de fecha resuelto por ID mayor; última aceptación sin agenda devuelve `null`. Fechas de llamada nulas se consideran anteriores a fechas válidas y empatan por ID. No mutar la lista. En vista: agenda visible con llamadas plegadas, mensaje `Fecha y hora no registradas` solo en aceptadas sin dato.
- [ ] **2. Confirmar rojo:** `npm test -- src/modules/historial`.
- [ ] **3. Implementar selección, mapper y resumen.** Orden lógico por `fecha_llamada` y luego ID; filtrar por respuesta `RESPUESTA_LLAMADA.ACEPTADA`. Usar `ESTADO_CITA.ACEPTADA` para el estado actual. Etiqueta exacta `Fecha y hora agendadas`. No tomar fecha estimada, llamada o cierre como agenda. Revisar `prisma/scripts/migracion-appsheet/reglas.test.ts` (conversión de hora chilena a instante) y el guardado en `registrarLlamada.action.ts`: formatear instantes sin sumar offsets manualmente, sin cambiar el registro de llamadas.
- [ ] **4. Confirmar verde:** mismo comando; actualizar fixtures con `hora_agendada`. Ejecutar adicionalmente `npm test -- prisma/scripts/migracion-appsheet/reglas.test.ts` para conservar la convención histórica.
- [ ] **5. Commit:** `feat: mostrar agenda de citas aceptadas en historial`.

### Tarea 3: Contrato de búsqueda literal y backend de Gestor — REQ-13

**Archivos:** Crear `src/shared/lib/busquedaTexto.ts` y test; `src/modules/solicitudes/schemas/solicitudFiltros.schema.ts` y test; `src/shared/lib/busquedaTexto.mysql.test.ts`. Modificar `src/modules/solicitudes/schemas/solicitud.schema.ts`, `actions/getSolicitudes.action.ts` y su test.

**Evidencia de configuración:** inspección de solo lectura del 2026-11-10 confirmó `utf8mb4_unicode_ci` en ambas columnas; `sql_mode` no incluye `NO_BACKSLASH_ESCAPES`. MySQL reportó zona de sesión `+00:00` y sistema `-03`. No cambiar estas configuraciones.

**Interfaces:** Añadir `texto?: string` a `SolicitudFiltros`, conservando sus consumidores. Exportar `textoBusquedaSchema = z.string().trim().max(200).optional().default("")`. Exportar `escaparTextoLike(texto: string, escape: "!" | "\\"): string` (escapa el carácter elegido, `%` y `_`, sin agregar comodines). Nuevo `solicitudFiltrosSchema` acepta y valida los campos existentes, sin usar `centroId` como fuente de autorización; exporta `type SolicitudFiltrosValidados = z.output<typeof solicitudFiltrosSchema>`. `getSolicitudes(filtros: SolicitudFiltros = {})` conserva el contrato de retorno y agrega validación interna con `safeParse`.

- [ ] **1. Escribir pruebas.** `textoBusquedaSchema.parse("  control  ") === "control"`; 201 caracteres rechazan. Escape `"50%_!"` con `!` devuelve `"50!%!_!!"`. Prisma usa `contains: escaparTextoLike(texto, "\\")`; SQL usa `%${escaparTextoLike(texto, "!")}%` con `ESCAPE '!'`. Verificar parámetros separados del SQL para comillas/inyección. Acción con texto consulta descripción, conserva centro/estado/acción/filtros y aplica el mismo criterio a conteo y página; repetir con edad activando SQL numérico. Un error de validación devuelve `{ ok: false, error: … }` sin consultar BD.
- [ ] **2. Confirmar rojo:** `npm test -- src/shared/lib/busquedaTexto.test.ts src/modules/solicitudes/schemas/solicitudFiltros.schema.test.ts src/modules/solicitudes/actions/getSolicitudes.action.test.ts`.
- [ ] **3. Implementar schema, escape y ambas rutas.** Dejar `buildWhere` y `buildRawWhere` dentro de la acción, con los mismos filtros normalizados; sumar solo `descripcion`. Texto vacío no añade condición. Mantener take/skip, orden y permisos actuales; auditar filtros ya validados. Validar números y fechas existentes sin cambiar la semántica documentada de edad en `ultimo_control`.
- [ ] **4. Agregar contrato MySQL local.** Suite en entorno Node (`// @vitest-environment node`), con permisos/auditoría simulados y Prisma real de la BD de pruebas. Es opt-in con `RUN_MYSQL_SEARCH_TESTS=1` y URL de BD desechable exclusiva; omitirla explícitamente en CI normal. Nunca permitir ejecutarla contra el host de producción. Sembrar 101 pendientes sintéticos en el centro A, con una coincidencia que quede fuera de la primera página sin filtrar, otra en centro B y registros no pendientes. Afirmar búsqueda global, total y aislamiento; cubrir frase, `CONTROL`/`contról`, nulos y literales `%`, `_`, `!`, barra inversa y comillas en rutas con y sin edad. Limpiar fixtures al terminar.
- [ ] **5. Confirmar verde.** Repetir unitarios y ejecutar `RUN_MYSQL_SEARCH_TESTS=1 npm test -- src/shared/lib/busquedaTexto.mysql.test.ts` contra MySQL local preparado con schema del proyecto. La suite verifica que `utf8mb4_unicode_ci` o la intercalación local produzca el contrato; si no, configurar comparación explícita compatible, sin migrar columnas de producción.
- [ ] **6. Commit:** `feat: buscar descripciones en todas las páginas del gestor`.

### Tarea 4: Búsqueda y conteo coherentes en Comunicador — REQ-13

**Archivos:** Modificar `src/modules/comunicador/schemas/llamada.schema.ts` y su test; `actions/getCitasPendientes.action.ts` y su test. Crear `src/modules/comunicador/utils/consultaCitas.ts` y test. Ampliar `src/shared/lib/busquedaTexto.mysql.test.ts` para ejercitar la segunda acción con el mismo conjunto local; es una prueba transversal, por eso vive en shared.

**Interfaces:** `CitasFiltros.texto: string` por `textoBusquedaSchema` de tarea 3. `construirConsultaCitas(filtros: CitasFiltros, centroId: string, ahora: Date): ConsultaCitas`, con `interface ConsultaCitas { where: Prisma.Sql; fromPagina: Prisma.Sql; fromConteo: Prisma.Sql }`. El `where` incluye `WHERE`; los FROM incluyen tablas y alias compatibles. La acción mantiene `ResultadoAccion<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number }>`.

- [ ] **1. Escribir pruebas.** Texto se aplica solo a `c.observacion`, con parámetro escapado y `ESCAPE '!'`, en ambas consultas. Sector/edad conservan filtro de usuario; disponibilidad/nombre social y subconsultas de llamadas se mantienen en página. Los filtros vacíos no cambian el resultado ni el orden predeterminado. Conteo no usa joins de presentación cuando no los requiere un filtro. Si sector/edad requieren usuario, incluirlo; no quitar ámbito por centro, estados o temporalidad. Entrada inválida produce `ResultadoAccion` sin consultar BD; permisos siguen propagándose conforme a los tests actuales.
- [ ] **2. Confirmar rojo:** `npm test -- src/modules/comunicador/schemas/llamada.schema.test.ts src/modules/comunicador/utils/consultaCitas.test.ts src/modules/comunicador/actions/getCitasPendientes.action.test.ts`.
- [ ] **3. Implementar constructor y acción.** Extraer las condiciones existentes, sin cambiar temporalidad ni edad. Página conserva joins de presentación. Conteo parte de citas y añade usuario solo si sector/edad lo necesitan; elimina solicitud únicamente tras comprobar relaciones obligatorias/FK y equivalencia. Prestación conserva la subconsulta existente; no requiere join de presentación para contar. Usar `safeParse` para validación; mantener el manejo de permisos y no capturar indiscriminadamente errores. No convertir esta tarea en optimización de las subconsultas de llamadas.
- [ ] **4. Probar equivalencia en MySQL local.** Citas sintéticas en estados pendientes y terminales, dos centros, pacientes de sectores/edades distintos y varias solicitudes por paciente. Comparar total optimizado con conteo con joins usando los mismos predicados, para cada filtro y combinaciones; comprobar coincidencia fuera de primera página y ausencia de búsqueda en observaciones de llamadas. El helper común evita duplicación de escape.
- [ ] **5. Confirmar verde:** unitarios anteriores y suite MySQL opt-in de tarea 3. En producción, cualquier lectura posterior es agregada y acotada; no ejecutar fixtures allí.
- [ ] **6. Commit:** `feat: buscar observaciones y optimizar conteo del comunicador`.

### Tarea 5: Filtros de texto y ciclo de búsqueda en ambas vistas — REQ-13

**Archivos:** Modificar `src/modules/solicitudes/components/RevisarSolicitudesView.tsx` y test; `src/modules/comunicador/components/CitasFiltros.tsx`, `ComunicadorView.tsx` y sus tests. Modificar `src/shared/components/filtros/panel-filtros.tsx` y su test únicamente para etiqueta de envío configurable.

**Interfaces:** `CitasFiltrosUI.texto: string`, `FILTROS_INICIALES.texto = ""`, `FILTROS_VACIOS.texto = ""` en Gestor. `PanelFiltrosProps.etiquetaAplicar?: string`, default `Aplicar filtros`; ambas bandejas pasan `Buscar`. `detalleFiltrosActivos` añade chip `Observación clínica` con texto aplicado en Comunicador. No introducir un segundo formulario ni un segundo estado de consulta.

- [ ] **1. Escribir pruebas de interacción.** Campos con labels asociados: `Buscar en descripción` y `Buscar en observación clínica`, `maxLength={200}`. Editar no invoca acción; Buscar o Enter aplica filtros y página 1; paginar y recargar conserva texto aplicado aunque se edite otro. Limpiar elimina texto. Una consulta A resuelta tras B no cambia filas ni chips. Cambio de centro desmonta/reinicia consulta y no revela resultados viejos. Falla conserva última tabla y feedback existentes. Panel conserva default para otros módulos.
- [ ] **2. Confirmar rojo:** `npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/comunicador/components src/shared/components/filtros`.
- [ ] **3. Implementar campos e integración.** Reutilizar Input/Label y formulario del PanelFiltros; sumar texto a estado aplicado, consultaRef, auditoría y chips/contador. Actualizar descripciones y ayuda `Busca en todas las páginas con los filtros actuales`. Preservar guardas de respuesta vigente y refresco automático. Revisar `src/shared/components/layout/selector-centro-activo.tsx` y rutas: probar el reinicio que ya exista; si no desmonta al cambiar centro, invalidar la petición y los datos ante cambio de centro en ambas vistas.
- [ ] **4. Confirmar verde:** mismo comando. En mocks de acciones devolver datos cuyo total y página difieran de los iniciales para comprobar que la UI usa el resultado del servidor y no un filtro local.
- [ ] **5. Commit:** `feat: integrar búsqueda global en filtros de las bandejas`.

### Tarea 6: Ordenamiento local compartido e integración en Gestor — REQ-8

**Archivos:** Crear `src/shared/lib/ordenPagina.ts`, `src/shared/components/tablas/encabezado-ordenable.tsx`, `src/modules/solicitudes/utils/ordenSolicitudes.ts` y tests contiguos. Modificar `src/modules/solicitudes/components/RevisarSolicitudesView.tsx` y test.

**Interfaces:** `type DireccionOrden = "asc" | "desc"`; `interface OrdenPagina<K extends string> { columna: K; direccion: DireccionOrden }`; `siguienteOrden<K extends string>(actual: OrdenPagina<K> | null, columna: K): OrdenPagina<K> | null`. Ciclo columna nueva → asc → desc → null. `ordenarPagina<T>(filas: readonly T[], valor: (fila: T) => string | number | null, direccion: DireccionOrden): T[]`: números para fechas, strings con `Intl.Collator("es")`, nulos al final y empates por posición original. `EncabezadoOrdenable<K>` recibe `columna`, `orden`, `onOrden`, `children` y `className?`; devuelve TableHead con botón e indicador. `type ColumnaSolicitud = "fecha" | "tipo"`; `ordenarSolicitudes<T extends SolicitudOrdenable>(filas: readonly T[], orden: OrdenPagina<ColumnaSolicitud> | null): T[]` conserva el tipo concreto; interface mínima con `fecha_inicio: Date | string`, `tipoSolicitud: { nombre_tipo_solicitud: string } | null`.

- [ ] **1. Escribir pruebas.** Fechas con cambio de mes/año comparan instantes; tipos en español; empates conservan prioridad recibida; nulos al final asc/desc; arrays y filas no mutados. Tercer clic devuelve orden servidor. Interacción de vista ordena solo filas presentes, conserva total, no llama acción y conserva criterio en página nueva/refresco. Limpiar restaura null. Encabezado tiene `aria-sort` e indicador; Tab + Enter/Espacio operan el botón.
- [ ] **2. Confirmar rojo:** `npm test -- src/shared/lib/ordenPagina.test.ts src/shared/components/tablas/encabezado-ordenable.test.tsx src/modules/solicitudes/utils/ordenSolicitudes.test.ts src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`.
- [ ] **3. Implementar utilidades y vista.** Estado de orden en la vista, inicial null; `useMemo` para copia ordenada. El algoritmo maneja nulos antes de invertir comparación; nunca invertir el array completo porque rompería empates/nulos. Solo los encabezados fecha y tipo habilitan botón. Mostrar `Ordena esta página`. Evitar refactor de otras columnas y no modificar ORDER BY de servidor.
- [ ] **4. Confirmar verde:** mismo comando, incluidos los tests de búsqueda de tarea 5.
- [ ] **5. Commit:** `feat: ordenar fecha y tipo en la página del gestor`.

### Tarea 7: Ordenamiento de Comunicador y continuidad de llamada — REQ-8

**Archivos:** Crear `src/modules/comunicador/utils/ordenCitas.ts` y test. Modificar `components/ComunicadorView.tsx`, `CitasPendientesTabla.tsx` y tests correspondientes.

**Interfaces:** `type ColumnaCita = "fecha" | "estado"`; `ordenarCitas(filas: readonly CitaFila[], orden: OrdenPagina<ColumnaCita> | null): CitaFila[]`, usando tarea 6. Añadir props controladas `orden: OrdenPagina<ColumnaCita> | null`, `onOrden: (orden: OrdenPagina<ColumnaCita> | null) => void` a la tabla. La vista posee el estado y calcula `filasVisibles`; tabla recibe las filas ya ordenadas. `prepararCitaSiguiente(idCitaActual: string)` consume esas mismas filas visibles.

- [ ] **1. Escribir pruebas.** Fecha estimada por valor temporal, estado alfabético, nulos al final, ciclo de tres clics, conservación al paginar/refrescar, reset al limpiar y cero consultas al ordenar. Secuencia de servidor A-B-C que se ve C-A-B: al gestionar A, el siguiente candidato es B; si B desaparece concurrentemente, usar el respaldo anterior C según regla vigente. Sin candidatos vigentes no resaltar ni enfocar una fila ajena. Mantener foco, scroll, color de llamada de hoy y acciones por fila.
- [ ] **2. Confirmar rojo:** `npm test -- src/modules/comunicador/utils/ordenCitas.test.ts src/modules/comunicador/components/CitasPendientesTabla.test.tsx src/modules/comunicador/components/ComunicadorView.test.tsx`.
- [ ] **3. Implementar y conectar.** Orden manual en vista; tabla sin segundo sort interno. Encabezados habilitados `ID / Fecha Estimada` (ordena solo fecha) y `Estado`. Con orden manual, descripción `Orden manual de esta página`; sin él, conservar `Ordenadas de mayor a menor prioridad.`. Limpiar candidatos al cambiar criterio, página o filtros. En recarga tras llamada, elegir primer candidato vigente conservando la lista capturada en orden visible.
- [ ] **4. Confirmar verde:** mismo comando y suites de búsqueda/filtros de Comunicador. Verificar que prioridad del servidor, temporalidad predeterminada y nombres de tarea 1 permanecen.
- [ ] **5. Commit:** `feat: ordenar página del comunicador y conservar siguiente llamada`.

### Tarea 8: Verificación integrada y evidencia de rendimiento

**Archivos:** Crear `docs/superpowers/validaciones/2026-11-10-mejoras-transversales.md`; actualizar únicamente tests anteriores si la verificación descubre un caso real omitido. Sin funcionalidades adicionales.

**Interfaces:** Consume los contratos de tareas 1–7. Produce evidencia reproducible de comandos, resultados, matriz de superficies y mediciones; no promete latencias a partir de la muestra inicial.

- [ ] **1. Preparar entorno local aislado.** Usar base desechable, nunca credenciales/BD de producción para fixtures. `npm run services:up`, `npm run db:generate`, `npm run db:push` con URL local verificada; datos sintéticos. Generar centros de 3.655 solicitudes y 15.125 citas pendientes para medir el orden de magnitud real, con textos cortos y distribución de coincidencias variada.
- [ ] **2. Ejecutar contrato MySQL:** `RUN_MYSQL_SEARCH_TESTS=1 npm test -- src/shared/lib/busquedaTexto.mysql.test.ts`. Esperar ambas rutas de Gestor y Comunicador verdes, con literales, tildes, 101 filas, estados y centros. Los mocks unitarios por sí solos no prueban semántica SQL.
- [ ] **3. Medir acciones completas.** Comparar sin texto, `control`, `dental`, término sin resultados y filtros de sector/edad/fechas, primera y última página. Registrar primera ejecución y cinco repeticiones, mediana/máximo, conteo/página y latencia completa (incluidos campos/subconsultas/auditoría). Usar `EXPLAIN` sin ANALYZE si se inspecciona producción; consultas agregadas con límite de tiempo, sin pruebas de carga allí. Comparar conteo original/optimizado con las mismas condiciones. Si hay regresión reproducible o timeout de 5 s, resolver antes de cerrar o documentar bloqueo; no agregar FULLTEXT o infraestructura sin nueva evidencia/diseño.
- [ ] **4. Verificar experiencia con datos sintéticos.** Tabla → detalle/llamada → historial del mismo paciente, con/sin nombre social y nombres extensos. Cita aceptada muestra agenda plegada; otros estados no muestran ni etiqueta. Búsqueda encuentra fuera de la página y ordenamiento solo afecta la página. Cambiar centro no conserva identidad. Emitir y reimprimir voucher: ni nombre legal ni social aparecen en el área impresa; nombres visibles detrás del modal tampoco se imprimen por CSS. Confirmar esto con vista previa de impresión y los tests existentes del voucher; no modificarlo para añadir contenido.
- [ ] **5. Ejecutar checks finales:** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`. Deben finalizar con código 0. Si faltan variables para build, usar las ficticias documentadas en `.github/workflows/ci.yml`, no exponer `.env`. Ejecutar el conjunto completo una vez tras los cambios; repetir solo si aparecen fallos o nuevas modificaciones.
- [ ] **6. Documentar resultados y revisar cobertura.** Matriz REQ-8 → tareas 6–7; REQ-13 → 3–5; REQ-21 → 2; REQ-25 → 1, con validación transversal en 8. Registrar límites de las mediciones, sin datos personales ni credenciales. Revisar `git diff --check`, estado y diff para confirmar ausencia de migraciones, cambios RBAC o nombres en contrato voucher.
- [ ] **7. Commit y revisión de rama:** `docs: registrar validación de mejoras transversales`. Aplicar requesting-code-review antes de integración; usar finishing-a-development-branch solo tras checks y revisión. Este plan no autoriza un despliegue automático desde la sesión ni cambios de datos en producción.

## Autorrevisión del plan

- Cobertura: los cuatro requerimientos tienen tareas de implementación y criterios verificables; voucher excluido en datos, render y vista previa.
- Contratos: `texto` es el mismo campo de acciones/UI; `nombre_social` viaja en Comunicador/Historial; sort compartido produce copias y la vista controla el estado.
- Dependencias: no hay dos implementadores tocando las mismas vistas en paralelo; cada tarea tiene un entregable verificable y commit.
- Riesgos cubiertos: SQL real y no solo mocks, respuestas obsoletas, centro, nulos históricos, horario estacional y continuidad de llamada.
- Alcance: sin módulo nuevo, sin cambios a prioridad o registro de llamadas, sin búsqueda semántica ni descarga masiva. No se implementó código al escribir este plan.

## Revisión y ejecución

Plan listo para revisión del usuario. AGENTS.md establece SDD para este trabajo: se recomienda ejecutar con subagente implementador y revisión por tarea, usando contexto acotado y secuencia de dependencias. La ejecución comenzará después de revisar este documento. Si el usuario prefiere ejecución directa en esta sesión, aplicar `executing-plans` y conservar el mismo orden y validaciones.
