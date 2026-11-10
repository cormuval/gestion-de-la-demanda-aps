# Requerimientos de bandeja y registro de llamadas del módulo Comunicador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ordenar las citaciones pendientes del módulo Comunicador por prioridad descendente, mostrar colores y simbología en la columna de prioridad, incluir el nombre del paciente y el encabezado `ID / Fecha Estimada` en la tabla, mostrar la fecha estimada en el modal de registro de llamadas y destacar/enfocar automáticamente la cita siguiente al registrar una llamada.

**Architecture:** `getCitasPendientes` expone `priorizacion_clinica` y ordena la cola por `c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC`. Una utilidad pura (`prioridadCita.ts`) resuelve el nivel, colores y etiqueta de prioridad junto con la simbología estática consumida por `CitasPendientesTabla`. `ComunicadorView` captura antes de recargar los IDs candidatos posteriores a la cita gestionada y entrega a `CitasPendientesTabla` el `citaSiguienteId` vigente tras la recarga para resaltarlo, desplazar la vista y enfocar su botón `Llamar`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Prisma/MySQL (`$queryRaw`), Server Actions, Tailwind CSS v3, shadcn/ui, Vitest y Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-comunicador-requerimientos-bandeja-design.md`

## Global Constraints

- Todo el texto visible, comentarios y commits se escriben en español; indentación de 4 espacios.
- El color de prioridad se aplica únicamente al badge dentro de la celda `Priorización / Disponibilidad`, sin alterar el fondo completo de la fila.
- La simbología de prioridad se muestra sobre la tabla con los 4 niveles: `Urgente (80–100)`, `Alta (60–79)`, `Media (40–59)` y `Baja (< 40)`.
- El ordenamiento de `getCitasPendientes` debe ser `ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC`.
- El primer encabezado de `CitasPendientesTabla` debe llamarse exactamente `ID / Fecha Estimada`.
- En `RegistrarLlamadaModal`, la etiqueta del campo agregado en `<dl>` debe ser `Fecha estimada de atención`.
- No se agregan migraciones Prisma, permisos nuevos ni dependencias externas.

## Review Focus

- Citas históricas o migradas con `priorizacion_clinica: null` pero con puntaje numérico `priorizacion` deben inferir su nivel y color por tramo (`>= 80`, `60–79`, `40–59`, `< 40`); lo cubre Task 1.
- Citas sin `priorizacion_clinica` ni `priorizacion` (`null` en ambos) deben mostrar `"—"` sin badge vacío ni texto `"null"`; lo cubren Tasks 1 y 3.
- Citas con `fecha_estimada_atencion: null` en `RegistrarLlamadaModal` deben mostrar `"—"` sin producir `"Invalid Date"`; lo cubre Task 2.
- En entornos JSDOM o navegadores donde `scrollIntoView` no esté definido o cuando la fila siguiente coincide con una fila que ya tiene `tiene_llamada_hoy`, el efecto de foco en el botón `"Llamar"` no debe lanzar excepción y el indicador `"Siguiente"` debe seguir visible; lo cubre Task 3.
- Si otro comunicador cierra en paralelo la cita inmediata (`i + 1`) mientras se registra la llamada actual, `ComunicadorView` debe seleccionar el siguiente candidato disponible (`i + 2`) o la fila anterior si era la última de la tabla, y limpiar la selección al cambiar de página o aplicar/limpiar filtros; lo cubre Task 4.

---

### Task 1: Utilidad de prioridad y ordenamiento por prioridad en `getCitasPendientes` (`REQ-30` y base de `REQ-3`)

**Files:**
- Create: `src/modules/comunicador/utils/prioridadCita.ts`
- Create: `src/modules/comunicador/utils/prioridadCita.test.ts`
- Modify: `src/modules/comunicador/actions/getCitasPendientes.action.ts`
- Modify: `src/modules/comunicador/actions/getCitasPendientes.action.test.ts`

**Interfaces:**
- Produces in `src/modules/comunicador/utils/prioridadCita.ts`:
  - `export type NivelPrioridadCita = "Urgente" | "Alta" | "Media" | "Baja";`
  - `export interface ItemSimbologiaPrioridad { nivel: NivelPrioridadCita; rango: string; textoSimbologia: string; badgeClassName: string; dotClassName: string; }`
  - `export interface PrioridadCitaResuelta { nivel: NivelPrioridadCita; etiqueta: string; badgeClassName: string; dotClassName: string; }`
  - `export const SIMBOLOGIA_PRIORIDAD: readonly ItemSimbologiaPrioridad[];`
  - `export function resolverPrioridadCita(priorizacionClinica: string | null | undefined, priorizacion: number | null | undefined): PrioridadCitaResuelta | null;`
- Produces in `src/modules/comunicador/actions/getCitasPendientes.action.ts`:
  - `CitaFila` incluye `priorizacion_clinica: string | null;`

- [ ] **Step 1: Escribir las pruebas fallidas de `prioridadCita` y del SQL de `getCitasPendientes`**

Crear `src/modules/comunicador/utils/prioridadCita.test.ts` verificando:
- `SIMBOLOGIA_PRIORIDAD` expone en orden `Urgente (80–100)`, `Alta (60–79)`, `Media (40–59)` y `Baja (< 40)`;
- `resolverPrioridadCita("Urgente", 85)` devuelve `{ nivel: "Urgente", etiqueta: "Urgente · 85", badgeClassName: expect.stringContaining("bg-red-100"), dotClassName: expect.stringContaining("bg-red-600") }`;
- `resolverPrioridadCita("Alta", null)` devuelve `etiqueta: "Alta"`;
- cuando `priorizacionClinica` es `null` o desconocida, infiere por puntaje: `80 -> "Urgente"`, `60 -> "Alta"`, `40 -> "Media"`, `20 -> "Baja"`;
- `resolverPrioridadCita(null, null)` devuelve `null`.

En `src/modules/comunicador/actions/getCitasPendientes.action.test.ts`, agregar una prueba que inspeccione el `Prisma.Sql` recibido por `prisma.$queryRaw` en la primera llamada y verifique:
- que el SQL contiene `c.priorizacion_clinica AS priorizacion_clinica`;
- que el SQL contiene `ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC` y no contiene `FIELD(c.estado_cita`.

- [ ] **Step 2: Ejecutar las pruebas para verificar que fallan**

Run: `npm test -- src/modules/comunicador/utils/prioridadCita.test.ts src/modules/comunicador/actions/getCitasPendientes.action.test.ts`
Expected: FAIL (`Cannot find module './prioridadCita'` y fallo en aserción de `ORDER BY`).

- [ ] **Step 3: Implementar `src/modules/comunicador/utils/prioridadCita.ts` y actualizar `getCitasPendientes.action.ts`**

En `src/modules/comunicador/utils/prioridadCita.ts`, definir `SIMBOLOGIA_PRIORIDAD` con las clases exactas del spec:
- `Urgente`: `rango: "80–100"`, `textoSimbologia: "Urgente (80–100)"`, `badgeClassName: "border-red-200 bg-red-100 text-red-800"`, `dotClassName: "bg-red-600"`
- `Alta`: `rango: "60–79"`, `textoSimbologia: "Alta (60–79)"`, `badgeClassName: "border-amber-200 bg-amber-100 text-amber-900"`, `dotClassName: "bg-amber-500"`
- `Media`: `rango: "40–59"`, `textoSimbologia: "Media (40–59)"`, `badgeClassName: "border-sky-200 bg-sky-100 text-sky-800"`, `dotClassName: "bg-sky-500"`
- `Baja`: `rango: "< 40"`, `textoSimbologia: "Baja (< 40)"`, `badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-800"`, `dotClassName: "bg-emerald-500"`

En `src/modules/comunicador/actions/getCitasPendientes.action.ts`:
- Añadir `priorizacion_clinica: string | null;` a `CitaFila`.
- Seleccionar `c.priorizacion_clinica AS priorizacion_clinica` en el `SELECT`.
- Reemplazar `orderBy` por `Prisma.sql\`ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC\`` (y limpiar el import `ORDEN_ESTADOS_PENDIENTES` si queda sin uso en ese archivo).

- [ ] **Step 4: Ejecutar las pruebas para verificar que pasan**

Run: `npm test -- src/modules/comunicador/utils/prioridadCita.test.ts src/modules/comunicador/actions/getCitasPendientes.action.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/utils/prioridadCita.ts src/modules/comunicador/utils/prioridadCita.test.ts src/modules/comunicador/actions/getCitasPendientes.action.ts src/modules/comunicador/actions/getCitasPendientes.action.test.ts
git commit -m "feat(comunicador): ordenar cola por prioridad y agregar utilidad de niveles"
```

---

### Task 2: Mostrar fecha estimada de atención en `RegistrarLlamadaModal` (`REQ-15` y `REQ-28`)

**Files:**
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`

**Interfaces:**
- Consumes: `CitaFila` (`fecha_estimada_atencion: Date | null`) en `RegistrarLlamadaModal`.
- Preserves: firma de props de `RegistrarLlamadaModal`.

- [ ] **Step 1: Escribir las pruebas fallidas en `RegistrarLlamadaModal.test.tsx`**

En `src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`:
- Actualizar el fixture `cita` base agregando `priorizacion_clinica: null`.
- En la prueba `"muestra el contexto de la cita..."`, pasar `fecha_estimada_atencion: new Date("2026-10-15T00:00:00")` y verificar que se renderiza el término `"Fecha estimada de atención"` y el valor `"15-10-2026"`.
- Agregar una prueba que verifique que cuando `fecha_estimada_atencion` es `null`, junto a `"Fecha estimada de atención"` su `<dd>` muestra `"—"`.

- [ ] **Step 2: Ejecutar la prueba para verificar que falla**

Run: `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`
Expected: FAIL (no se encuentra `"Fecha estimada de atención"`).

- [ ] **Step 3: Implementar el campo `Fecha estimada de atención` en `RegistrarLlamadaModal.tsx`**

En `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`, agregar una función auxiliar `formatearFechaEstimada(fecha: Date | null): string | null` que devuelva `fecha ? new Date(fecha).toLocaleDateString("es-CL") : null`, e incluir en el `<dl>`:
```tsx
<DatoCita etiqueta="Fecha estimada de atención" valor={formatearFechaEstimada(cita.fecha_estimada_atencion)} />
```

- [ ] **Step 4: Ejecutar la prueba para verificar que pasa**

Run: `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/components/RegistrarLlamadaModal.tsx src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx
git commit -m "feat(comunicador): mostrar fecha estimada de atencion al registrar llamada"
```

---

### Task 3: Columnas, colores/simbología de prioridad y fila siguiente en `CitasPendientesTabla` (`REQ-3`, `REQ-29` y UI de `REQ-19`)

**Files:**
- Modify: `src/modules/comunicador/components/CitasPendientesTabla.tsx`
- Modify: `src/modules/comunicador/components/CitasPendientesTabla.test.tsx`

**Interfaces:**
- Consumes: `SIMBOLOGIA_PRIORIDAD` y `resolverPrioridadCita` de `src/modules/comunicador/utils/prioridadCita.ts` (Task 1).
- Produces: prop opcional `citaSiguienteId?: string | null` en `CitasPendientesTabla`.

- [ ] **Step 1: Escribir las pruebas fallidas en `CitasPendientesTabla.test.tsx`**

Actualizar `src/modules/comunicador/components/CitasPendientesTabla.test.tsx` para verificar:
- Encabezado `"ID / Fecha Estimada"` presente (y ya no `"Cita"` aislado).
- Celda `Paciente` muestra tanto `"Paciente Demo"` (`nombre_usuario`) como `"22.222.222-2"` (`rut_usuario`).
- Barra de simbología visible con `"Simbología de prioridad:"` y los 4 textos `"Urgente (80–100)"`, `"Alta (60–79)"`, `"Media (40–59)"`, `"Baja (< 40)"`.
- Columna de prioridad muestra el badge `"Urgente · 85"` con clase `bg-red-100` cuando `priorizacion_clinica: "Urgente", priorizacion: 85`, y muestra `"—"` cuando ambos son `null`.
- Cuando se pasa `citaSiguienteId="cita-comunicador-2"`, la fila de esa cita tiene `data-cita-siguiente="true"`, muestra el badge `"Siguiente"`, invoca `scrollIntoView` (si existe en el elemento) y deja `document.activeElement` en el botón `"Llamar"` de esa segunda fila.

- [ ] **Step 2: Ejecutar la prueba para verificar que falla**

Run: `npm test -- src/modules/comunicador/components/CitasPendientesTabla.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar los cambios en `CitasPendientesTabla.tsx`**

En `src/modules/comunicador/components/CitasPendientesTabla.tsx`:
- Aceptar `citaSiguienteId?: string | null` en las props.
- Renderizar sobre el contenedor `.rounded-md.border` la barra de simbología usando `SIMBOLOGIA_PRIORIDAD` (`Simbología de prioridad:` + cada ítem con su punto `dotClassName` y `textoSimbologia`).
- Cambiar `<TableHead>Cita</TableHead>` a `<TableHead>ID / Fecha Estimada</TableHead>`.
- En la primera celda de cada fila, mostrar `<CodigoId id={c.id_cita} />` acompañado de `<Badge variant="default">Siguiente</Badge>` cuando `esSiguiente` sea verdadero.
- En la celda `Paciente`, mostrar `<div>{c.nombre_usuario || "—"}</div>` y `<div className="text-xs text-muted-foreground">{c.rut_usuario}</div>`.
- En la celda `Priorización / Disponibilidad`, usar `resolverPrioridadCita(c.priorizacion_clinica, c.priorizacion)` para renderizar el badge coloreado (`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium` + `prioridad.badgeClassName`, con el punto `h-2 w-2 rounded-full` + `prioridad.dotClassName` y `prioridad.etiqueta`), o `"—"` si es `null`.
- En `<TableRow>`, agregar `data-cita-siguiente={esSiguiente ? "true" : undefined}` y las clases `esSiguiente && "border-l-4 border-l-primary bg-primary/5 ring-1 ring-inset ring-primary/30"`.
- Con `useEffect` sobre `[citaSiguienteId, filas]`, cuando exista la fila marcada, invocar `filaEl.scrollIntoView?.({ behavior: "smooth", block: "nearest" })` y `botonLlamarEl.focus?.({ preventScroll: true })`.

- [ ] **Step 4: Ejecutar la prueba para verificar que pasa**

Run: `npm test -- src/modules/comunicador/components/CitasPendientesTabla.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/components/CitasPendientesTabla.tsx src/modules/comunicador/components/CitasPendientesTabla.test.tsx
git commit -m "feat(comunicador): agregar colores de prioridad, paciente e indicador de cita siguiente en tabla"
```

---

### Task 4: Seguimiento de cita siguiente en `ComunicadorView` (`REQ-19` y texto `REQ-30`)

**Files:**
- Modify: `src/modules/comunicador/components/ComunicadorView.tsx`
- Modify: `src/modules/comunicador/components/ComunicadorView.test.tsx`

**Interfaces:**
- Consumes: `citaSiguienteId?: string | null` de `CitasPendientesTabla` (Task 3).

- [ ] **Step 1: Escribir las pruebas fallidas en `ComunicadorView.test.tsx`**

En `src/modules/comunicador/components/ComunicadorView.test.tsx`:
- Actualizar el mock de `CitasPendientesTabla` para recibir `citaSiguienteId` y renderizar `<p>Cita siguiente: {citaSiguienteId ?? "ninguna"}</p>`, y actualizar el mock de `RegistrarLlamadaModal` para incluir un botón `"Simular llamada registrada"` que invoque `onRegistrado("Cita Aceptada.")`.
- Agregar pruebas en un nuevo bloque `describe("ComunicadorView cita siguiente tras gestionar", ...)`:
  1. Cuando la cola inicial tiene `["CITA-1", "CITA-2", "CITA-3"]`, se gestiona `"CITA-1"` y al recargar la cola devuelve `["CITA-2", "CITA-3"]`, se pasa `citaSiguienteId="CITA-2"`.
  2. Si otro funcionario cerró también `"CITA-2"` durante la gestión y la recarga devuelve `["CITA-3"]`, salta al siguiente candidato disponible y pasa `citaSiguienteId="CITA-3"`.
  3. Si se gestiona la última fila `"CITA-3"` y desaparece al recargar quedando `["CITA-1", "CITA-2"]`, toma como respaldo la fila anterior y pasa `citaSiguienteId="CITA-2"`.
  4. Al cambiar de página o aplicar/limpiar filtros, `citaSiguienteId` vuelve a `null` (`"Cita siguiente: ninguna"`).
- Verificar también que la descripción de la tarjeta es `"Ordenadas de mayor a menor prioridad."`.

- [ ] **Step 2: Ejecutar la prueba para verificar que falla**

Run: `npm test -- src/modules/comunicador/components/ComunicadorView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar el cálculo y estado de `citaSiguienteId` en `ComunicadorView.tsx`**

En `src/modules/comunicador/components/ComunicadorView.tsx`:
- Agregar `const [citaSiguienteId, setCitaSiguienteId] = useState<string | null>(null);` y `const candidatosSiguienteRef = useRef<string[] | null>(null);`.
- Definir `prepararCitaSiguiente(idCitaActual: string)` que busque `idx` en `data?.filas ?? []` y guarde en `candidatosSiguienteRef.current` los IDs posteriores `filas.slice(idx + 1).map((f) => f.id_cita)` más `filas[idx - 1].id_cita` al final si `idx > 0`.
- En `cargar()`, al recibir `r.data` en una carga no silenciosa (`!silencioso`): si `candidatosSiguienteRef.current` existe, buscar el primer ID presente en `r.data.filas`, actualizar `setCitaSiguienteId(encontrado ?? null)` y limpiar `candidatosSiguienteRef.current = null`.
- Invocar `prepararCitaSiguiente(citaSel.id_cita)` dentro de `onRegistrado` y `onCitaCerrada` de `RegistrarLlamadaModal` antes de `void cargar()`.
- Al cambiar de página (`onPagina`), aplicar filtros (`onAplicar`) o limpiar filtros (`onLimpiar`), hacer `candidatosSiguienteRef.current = null` y `setCitaSiguienteId(null)`.
- Actualizar `<CardDescription>` a `"Ordenadas de mayor a menor prioridad."` y pasar `citaSiguienteId={citaSiguienteId}` a `<CitasPendientesTabla />`.

- [ ] **Step 4: Ejecutar la suite de pruebas del módulo comunicador y verificación general**

Run: `npm test -- src/modules/comunicador`
Expected: PASS en todos los archivos de prueba del módulo comunicador.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/components/ComunicadorView.tsx src/modules/comunicador/components/ComunicadorView.test.tsx
git commit -m "feat(comunicador): conservar referencia de cita siguiente tras registrar llamada"
```
