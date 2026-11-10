# Requerimientos de bandeja y registro de llamadas del módulo Comunicador

Fecha: 2026-11-09  
Módulo: `comunicador`  
Requerimientos cubiertos: `REQ-3`, `REQ-15`, `REQ-19`, `REQ-28`, `REQ-29`, `REQ-30`

## Problema

Durante la operación diaria de la bandeja de llamadas del módulo Comunicador (`/contactar`), se identificaron cinco brechas de usabilidad y priorización (seis ítems en planilla, donde `REQ-15` y `REQ-28` describen la misma necesidad):

1. **Falta de jerarquía visual en la prioridad (`REQ-3`):** La columna `Priorización / Disponibilidad` muestra únicamente el puntaje numérico en texto plano, dificultando distinguir de un vistazo las citaciones urgentes o de alta prioridad y careciendo de una simbología de referencia.
2. **Ausencia de la fecha estimada en el modal de registro de llamadas (`REQ-15` y `REQ-28`):** Al abrir la ventana `Registrar llamada`, el comunicador no visualiza la `fecha_estimada_atencion` de la cita dentro del resumen de datos clínicos.
3. **Pérdida de referencia de posición tras registrar una llamada (`REQ-19`):** Al registrar una llamada y recargar la bandeja principal, la tabla se actualiza sin indicar ni enfocar cuál es la siguiente cita que corresponde gestionar, haciendo que el comunicador pierda la referencia de en qué fila iba.
4. **Identificación incompleta en la tabla de citas (`REQ-29`):** La columna `Paciente` muestra solo el RUT sin el nombre del paciente, y el encabezado `Cita` no explicita que agrupa el identificador corto y la fecha estimada (`ID / Fecha Estimada`).
5. **Ordenamiento subordinado al estado en lugar de la prioridad (`REQ-30`):** La bandeja ordena primero por `estado_cita` (`FIELD(...)`) y recién después por `priorizacion DESC`, postergando citas de mayor prioridad clínica/administrativa que aún están en estado `Sin llamadas`.

## Objetivo

1. Ordenar las citaciones pendientes principalmente por prioridad descendente (`c.priorizacion DESC`), con desempate determinista por fecha estimada ascendente e identificador de cita (`REQ-30`).
2. Incorporar colores semánticos **únicamente en la columna de prioridad** mostrando tanto el nivel (`Urgente`, `Alta`, `Media`, `Baja`) como el puntaje numérico, junto con una barra de simbología visible sobre la tabla (`REQ-3`).
3. Renombrar la primera columna de la tabla a **`ID / Fecha Estimada`** y mostrar en la columna **`Paciente`** el nombre completo del paciente junto a su RUT (`REQ-29`).
4. Mostrar la **Fecha estimada de atención** dentro del bloque de datos de la cita en `RegistrarLlamadaModal` (`REQ-15`, `REQ-28`).
5. Al cerrar una gestión de llamada y refrescar la tabla, destacar visualmente la **cita siguiente**, desplazar suavemente la vista hacia ella (`scrollIntoView`) y enfocar su botón **`Llamar`** (`REQ-19`).

## Decisiones de diseño

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Criterio de ordenamiento (`REQ-30`) | `ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC` | Las citaciones de mayor prioridad deben atenderse primero sin quedar relegadas por su estado de llamada; el desempate por fecha estimada e ID garantiza estabilidad entre recargas. |
| Alcance del color de prioridad (`REQ-3`) | Badge coloreado solo dentro de la celda `Priorización / Disponibilidad` | Cumple la observación de `REQ-3` y evita colisionar con el fondo de fila de `tiene_llamada_hoy` (`bg-primary/15`) y con el resaltado de cita siguiente (`REQ-19`). |
| Formato del badge de prioridad (`REQ-3`) | Nivel + puntaje (`Urgente · 85`, `Alta · 62`, etc.) y barra de simbología sobre la tabla | Permite identificar tanto la categoría clínica/tramo como el valor exacto, con referencia permanente de los 4 niveles en pantalla. |
| Resolución del nivel de prioridad | Usar `priorizacion_clinica` si está presente (`Urgente`, `Alta`, `Media`, `Baja`); si es `null`, inferir por tramo de `priorizacion` (`>= 80`, `60–79`, `40–59`, `< 40`) | Asegura consistencia con `PRIORIZACION_CLINICA_NUMERICA` (`src/modules/solicitudes/schemas/revision.schema.ts`) y compatibilidad con datos históricos/migrados. |
| Seguimiento de cita siguiente (`REQ-19`) | Capturar en cliente la lista ordenada de IDs posteriores (`filas.slice(idx + 1)`) antes de recargar, y al recibir la cola fresca seleccionar el primer ID vigente | No depende de estado en servidor, respeta los filtros activos del comunicador y tolera que otro funcionario cierre una cita intermedia en paralelo. |
| Comportamiento de cita siguiente (`REQ-19`) | Borde izquierdo acentuado + badge `"Siguiente"` + `scrollIntoView` suave + `.focus()` en el botón `"Llamar"` | Brinda continuidad visual y de teclado inmediata tras cerrar el modal de registro de llamada. |

## Alcance funcional

### 1. Ordenamiento de la bandeja por prioridad (`REQ-30`)

- En `src/modules/comunicador/actions/getCitasPendientes.action.ts`, la cláusula `ORDER BY` reemplaza el orden en cascada por estado (`FIELD(c.estado_cita, ...)`) por:
  ```sql
  ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC
  ```
- La descripción de la tarjeta principal en `src/modules/comunicador/components/ComunicadorView.tsx` se actualiza a:
  > `"Ordenadas de mayor a menor prioridad."`

### 2. Colores y simbología por prioridad (`REQ-3`)

- Se crea la utilidad pura `src/modules/comunicador/utils/prioridadCita.ts` que exporta:
  - El catálogo `SIMBOLOGIA_PRIORIDAD` con los 4 niveles en orden descendente:
    1. **Urgente** (`80–100`): contenedor `bg-red-100 text-red-800 border-red-200`, indicador `bg-red-600`.
    2. **Alta** (`60–79`): contenedor `bg-amber-100 text-amber-900 border-amber-200`, indicador `bg-amber-500`.
    3. **Media** (`40–59`): contenedor `bg-sky-100 text-sky-800 border-sky-200`, indicador `bg-sky-500`.
    4. **Baja** (`< 40`): contenedor `bg-emerald-100 text-emerald-800 border-emerald-200`, indicador `bg-emerald-500`.
  - La función `resolverPrioridadCita(priorizacionClinica: string | null | undefined, priorizacion: number | null | undefined)`:
    - Si `priorizacionClinica` coincide con `"Urgente" | "Alta" | "Media" | "Baja"`, utiliza ese nivel.
    - En caso contrario, si `priorizacion` es un número válido, infiere el nivel por su tramo (`>= 80` → `Urgente`, `>= 60` → `Alta`, `>= 40` → `Media`, `< 40` → `Baja`).
    - Si ambos son nulos o vacíos, devuelve `null` (la celda muestra `"—"` sin color).
    - Construye la etiqueta visible:
      - Si existen nivel y puntaje numérico: `${nivel} · ${priorizacion}` (ej. `"Urgente · 85"`).
      - Si solo existe nivel: `${nivel}`.
- **Simbología en `CitasPendientesTabla.tsx`:**
  - Sobre el contenedor de la tabla se renderiza una barra de leyenda compacta con la etiqueta `"Simbología de prioridad:"` seguida de los 4 niveles con su punto de color, nombre y rango de puntaje (`Urgente (80–100)`, `Alta (60–79)`, `Media (40–59)`, `Baja (< 40)`).
- **Celda `Priorización / Disponibilidad`:**
  - En la primera línea se renderiza el badge coloreado con el punto indicador y la etiqueta (`Urgente · 85`), o `"—"` si no tiene prioridad asignada.
  - En la segunda línea se mantiene la disponibilidad de llamada (`text-xs text-muted-foreground`).

### 3. Columnas `ID / Fecha Estimada` y `Paciente` (`REQ-29`)

En `src/modules/comunicador/components/CitasPendientesTabla.tsx`:

- El primer encabezado `<TableHead>` cambia de `Cita` a **`ID / Fecha Estimada`**.
- La celda de la columna **`Paciente`** muestra:
  - Primera línea (`font-medium` o texto principal): `{c.nombre_usuario || "—"}`.
  - Segunda línea (`text-xs text-muted-foreground`): `{c.rut_usuario}`.

### 4. Fecha estimada de atención en `RegistrarLlamadaModal` (`REQ-15` y `REQ-28`)

En `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`:

- Dentro de la lista de definiciones (`<dl>`) con los antecedentes de la cita, se incorpora un elemento `<DatoCita>`:
  - Etiqueta: **`Fecha estimada de atención`**
  - Valor: fecha formateada con `new Date(cita.fecha_estimada_atencion).toLocaleDateString("es-CL")` cuando `cita.fecha_estimada_atencion` esté presente, o `"—"` cuando sea `null`.

### 5. Destacar y enfocar la cita siguiente tras registrar llamada (`REQ-19`)

- **Cálculo de candidatos siguientes en `ComunicadorView.tsx`:**
  - Se agrega el estado `citaSiguienteId: string | null` (inicialmente `null`) y la referencia `candidatosSiguienteRef = useRef<string[] | null>(null)`.
  - Cuando finaliza una gestión en `RegistrarLlamadaModal` (`onRegistrado` o `onCitaCerrada`), antes de invocar `cargar()`:
    1. Se localiza el índice `idx` de `citaSel.id_cita` dentro de `data?.filas ?? []`.
    2. Si `idx >= 0`, se construye la lista de candidatos:
       - Primero todas las citas posteriores en la página actual: `filas.slice(idx + 1).map((f) => f.id_cita)`.
       - Como respaldo si era la última fila de la página y hubiera una fila previa: se añade `filas[idx - 1].id_cita` al final de la lista de candidatos.
    3. Se almacena esa lista en `candidatosSiguienteRef.current`.
  - Al resolverse exitosamente una llamada normal (`!silencioso`) en `cargar()`:
    - Si `candidatosSiguienteRef.current` no es `null`, se busca el primer `id_cita` de `candidatosSiguienteRef.current` que esté presente en `r.data.filas`.
    - Se actualiza `setCitaSiguienteId(encontrado ?? null)` y se limpia `candidatosSiguienteRef.current = null`.
  - Al cambiar de página (`setPagina`), aplicar filtros (`onAplicar`) o limpiarlos (`onLimpiar`), se limpia `setCitaSiguienteId(null)` y `candidatosSiguienteRef.current = null`.
- **Renderizado, scroll y foco en `CitasPendientesTabla.tsx`:**
  - `CitasPendientesTabla` acepta la prop opcional `citaSiguienteId?: string | null`.
  - Para la fila donde `c.id_cita === citaSiguienteId`:
    - Se añade el atributo `data-cita-siguiente="true"`.
    - Se aplica el estilo `border-l-4 border-l-primary bg-primary/5 ring-1 ring-inset ring-primary/30` (si la fila además tiene `tiene_llamada_hoy`, el borde izquierdo y el anillo más el badge `"Siguiente"` mantienen clara la distinción).
    - Junto al `<CodigoId id={c.id_cita} />` en la primera celda, se muestra `<Badge variant="default">Siguiente</Badge>`.
  - Mediante un `useEffect` sincronizado con `citaSiguienteId` y `filas`:
    - Se invoca `filaElemento.scrollIntoView?.({ behavior: "smooth", block: "nearest" })`.
    - Se invoca `botonLlamar.focus?.({ preventScroll: true })` sobre el botón `"Llamar"` de esa fila.

## Diseño técnico y archivos impactados

1. **`src/modules/comunicador/actions/getCitasPendientes.action.ts`**
   - Ampliar `CitaFila` con `priorizacion_clinica: string | null`.
   - Incluir `c.priorizacion_clinica AS priorizacion_clinica` en el `SELECT` de `getCitasPendientes`.
   - Cambiar `orderBy` a `Prisma.sql\`ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC\``.
2. **`src/modules/comunicador/utils/prioridadCita.ts` (nuevo)**
   - Implementar `SIMBOLOGIA_PRIORIDAD`, tipos `NivelPrioridadCita` y `PrioridadCitaResuelta`, y función `resolverPrioridadCita`.
3. **`src/modules/comunicador/components/CitasPendientesTabla.tsx`**
   - Renderizar la barra de simbología de prioridad sobre la tabla.
   - Renombrar encabezado `Cita` a `ID / Fecha Estimada`.
   - Mostrar `nombre_usuario` y `rut_usuario` en la columna `Paciente`.
   - Renderizar el badge coloreado en la columna `Priorización / Disponibilidad`.
   - Soportar `citaSiguienteId` con resaltado visual, badge `"Siguiente"`, `scrollIntoView` y foco en el botón `"Llamar"`.
4. **`src/modules/comunicador/components/RegistrarLlamadaModal.tsx`**
   - Agregar `DatoCita` para `Fecha estimada de atención` en el bloque `<dl>`.
5. **`src/modules/comunicador/components/ComunicadorView.tsx`**
   - Actualizar `CardDescription` del listado.
   - Calcular candidatos siguientes al cerrar por registro/cierre externo de cita y pasar `citaSiguienteId` a `CitasPendientesTabla`.

## Seguridad, permisos y base de datos

- No requiere migraciones Prisma ni cambios en el esquema de base de datos (`citas.priorizacion_clinica`, `citas.priorizacion`, `citas.fecha_estimada_atencion` y `usuarios.nombre`/`apellido` ya existen en el esquema actual).
- No modifica permisos RBAC (`comunicador.ver` y `comunicador.editar` se mantienen intactos).
- No altera las reglas de auditoría (`AuditLogger`) ni la verificación de concurrencia (`verificarCitaPendiente`).

## Plan de pruebas (Vitest + Testing Library)

1. **`src/modules/comunicador/utils/prioridadCita.test.ts` (nuevo):**
   - Resuelve correctamente los 4 niveles cuando viene `priorizacion_clinica`.
   - Infiere el nivel por tramo (`>= 80`, `60–79`, `40–59`, `< 40`) cuando `priorizacion_clinica` es `null`.
   - Formatea la etiqueta `${nivel} · ${priorizacion}` o devuelve `null` si ambos valores son nulos.
2. **`src/modules/comunicador/actions/getCitasPendientes.action.test.ts`:**
   - Verifica que el SQL selecciona `c.priorizacion_clinica` y ordena con `ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC`.
3. **`src/modules/comunicador/components/CitasPendientesTabla.test.tsx`:**
   - Verifica el encabezado `ID / Fecha Estimada`.
   - Verifica que la celda `Paciente` muestra `nombre_usuario` y `rut_usuario`.
   - Verifica la barra de simbología y los badges coloreados en la columna de prioridad.
   - Verifica que al pasar `citaSiguienteId` la fila correspondiente recibe `data-cita-siguiente="true"`, muestra el badge `"Siguiente"` y enfoca su botón `"Llamar"`.
4. **`src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`:**
   - Verifica que se muestra `Fecha estimada de atención` con la fecha en formato `es-CL` y `"—"` cuando es `null`.
5. **`src/modules/comunicador/components/ComunicadorView.test.tsx`:**
   - Verifica que después de registrar una llamada para una cita, al recargar la cola se marca como `"Siguiente"` la cita inmediata en la lista y su botón `"Llamar"` queda enfocado.

## Criterios de aceptación

1. La bandeja de citaciones pendientes se ordena de mayor a menor `priorizacion` (`REQ-30`).
2. La columna de prioridad muestra un badge con color según nivel (`Urgente`, `Alta`, `Media`, `Baja`) y el puntaje numérico, sin colorear el resto de las celdas de la fila, acompañado de una simbología visible sobre la tabla (`REQ-3`).
3. El encabezado de la primera columna dice `ID / Fecha Estimada` y la columna `Paciente` muestra nombre completo y RUT (`REQ-29`).
4. El modal `Registrar llamada` muestra el campo `Fecha estimada de atención` dentro de los datos de la cita (`REQ-15`, `REQ-28`).
5. Tras registrar una llamada y volver a la bandeja, la cita siguiente aparece destacada con el indicador `"Siguiente"`, visible en pantalla y con el foco en su botón `"Llamar"` (`REQ-19`).

## Fuera de alcance

- Modificar la fórmula de cálculo de `priorizacion` o `priorizacion_clinica` al crear o editar citas.
- Cambiar colores de otras columnas o de los badges de `Estado` de la cita.
- Abrir automáticamente el modal de la cita siguiente sin acción del comunicador.
