# IDs cortos en el front — Diseño

**Fecha:** 2026-07-26
**Rama:** `feat/ids-cortos-front`

## Problema

Los IDs de solicitudes, citas y llamadas se generan como un prefijo mas un UUID
completo:

- `id_solicitud` → `SOL-<uuid>` (p. ej. `SOL-550e8400-e29b-41d4-a716-446655440000`)
- `id_cita` → `CITA-<uuid>`
- `id_llamada` → `LLAM-<uuid>`

Son ~41 caracteres y se muestran en muchas partes del front (tablas de Revisar
Solicitudes, Citas Pendientes, Dashboard, modales de detalle/historial, la
cascada de pendientes, el toast y el voucher de creacion). Ocupan mucho espacio
y generan ruido visual.

Hoy solo `CitasPendientesTabla.tsx` los acorta, con un helper local `abreviar()`
que corta a los **primeros** 12 caracteres — inconsistente con el resto y no es
la forma que queremos.

## Objetivo

Acortar la visualizacion de los IDs en el front sin cambiar nada en la BD. Los
IDs completos deben seguir siendo recuperables porque los usuarios del sistema
los reportan para trazabilidad.

## Decisiones tomadas

1. **Formato visible:** prefijo + ultimos 5 caracteres del ID completo.
   - `SOL-550e8400-…-446655440000` → `SOL-40000`
   - `CITA-…` → `CITA-40000`, `LLAM-…` → `LLAM-40000`
2. **Trazabilidad:** copiar el ID completo con un clic (no se agrega buscador).
   Los ultimos 5 caracteres de un UUID **no son unicos**; por eso lo visible es
   solo una pista legible y el ID canonico se obtiene copiando el completo.
3. **Alcance:** todo acortado **excepto el voucher/comprobante** de creacion de
   solicitud, que conserva el ID completo visible por ser el respaldo oficial.
4. La generacion de IDs y el esquema de BD **no cambian**.

## Arquitectura

Dos piezas, siguiendo los patrones del codebase (funciones puras testeadas en
`shared/utils`; componentes en `shared/components/ui`; feedback con `sonner`;
tooltip con el atributo `title=` porque no existe componente Tooltip).

### 1. Util pura `acortarId(id: string): string`

Ubicacion: `src/shared/lib/acortarId.ts` (+ `acortarId.test.ts`). Los helpers
puros compartidos viven en `src/shared/lib/` (junto a `permisos.ts`, `access.ts`,
`utils.ts`); no existe `src/shared/utils/`.

Comportamiento:

- Separa el prefijo (texto antes del primer `-`) y toma los **ultimos 5**
  caracteres del ID completo; devuelve `` `${prefijo}-${ultimos5}` ``.
- **Guarda:** si el ID no contiene `-`, o su longitud es `<= prefijo.length + 6`
  (acortarlo no reduciria nada), se devuelve **tal cual** (robustez ante datos
  raros o vacios).
- Es la unica fuente de verdad del formato. Todo lo demas la usa (directamente o
  a traves del componente).

Referencia de implementacion:

```ts
export function acortarId(id: string): string {
    const guion = id.indexOf("-");
    if (guion === -1) return id;                     // sin prefijo → tal cual
    const prefijo = id.slice(0, guion);
    if (id.length <= prefijo.length + 6) return id;  // ya es corto
    return `${prefijo}-${id.slice(-5)}`;
}
```

Ejemplos:

| Entrada | Salida |
|---|---|
| `SOL-550e8400-e29b-41d4-a716-446655440000` | `SOL-40000` |
| `CITA-550e8400-e29b-41d4-a716-446655440000` | `CITA-40000` |
| `LLAM-550e8400-e29b-41d4-a716-446655440000` | `LLAM-40000` |
| `SOL-DEMO-001` (12 chars, demo) | `SOL-O-001` (se acorta; solo dev, aceptable) |
| `12345` (sin prefijo) | `12345` (sin cambios) |
| `""` (vacio) | `""` (sin cambios) |

### 2. Componente compartido `<CodigoId id={idCompleto} />`

Ubicacion: `src/shared/components/ui/codigo-id.tsx` (client component).

- Renderiza `acortarId(id)`.
- `title={idCompleto}` → tooltip con el ID completo.
- Al hacer click: `navigator.clipboard.writeText(idCompleto)` y luego
  `toast.success("Codigo copiado")`.
- `aria-label="Copiar codigo completo"`; el elemento es un `<button>` con estilo
  inline (hereda `font-medium`), con un icono de copiar sutil visible al
  pasar el mouse.
- Acepta `className` opcional para adaptarse al contexto (celda de tabla, linea
  de detalle).

### 3. Regla de uso

- **`<CodigoId>`** donde el ID es un elemento independiente y clickeable: celdas
  de tabla, filas de la cascada, lineas de detalle (`<p>`).
- **`acortarId()` (texto plano, sin copiar)** donde el ID va incrustado en una
  cadena de texto: descripciones de modal (`Solicitud SOL-40000 · RUT…`), toast
  de creacion, lineas tipo `Cita {id} · Nombre`. Ahi el copiar no aplica; la
  trazabilidad con copiar vive en la tabla de esa fila.

## Mapa de cambios (call sites)

| Archivo | Cambio |
|---|---|
| `src/modules/comunicador/components/CitasPendientesTabla.tsx` | Reemplaza `abreviar` local + `title` por `<CodigoId>`; **elimina** la funcion `abreviar` |
| `src/modules/solicitudes/components/RevisarSolicitudesView.tsx` | Celdas de tabla (`id_solicitud`) y `<p>` de detalle → `<CodigoId>` |
| `src/modules/dashboard/components/DashboardView.tsx` | Celdas de tabla → `<CodigoId>`; descripciones de modal (strings) → `acortarId()` |
| `src/modules/solicitudes/components/PendientesCascada.tsx` | `<p>{id_cita}</p>` y `<p>{id_solicitud}</p>` → `<CodigoId>` |
| `src/modules/comunicador/components/OtrasCitasPacienteModal.tsx` | `Cita {id_cita} · …` → `acortarId()` |
| `src/modules/comunicador/components/RegistrarLlamadaModal.tsx` | `Cita {id_cita} · …` → `acortarId()` |
| `src/modules/solicitudes/components/IngresarSolicitudView.tsx` | Toast de creacion → `acortarId()`; **el voucher conserva el ID completo** |

## Testing

- **`acortarId()`** (unit): UUID normal con cada prefijo (SOL/CITA/LLAM) → prefijo
  + ultimos 5; ID demo (`SOL-DEMO-001` → `SOL-O-001`); ID sin prefijo (`12345` →
  sin cambios); ID por debajo del umbral; ID vacio.
- **`<CodigoId>`** (Testing Library): renderiza el corto; expone el completo en
  `title`; al hacer click copia el completo (mock de `navigator.clipboard.writeText`)
  y dispara el toast.

## Fuera de alcance (YAGNI)

- No se agrega buscador por codigo corto (se eligio copiar-completo).
- No se cambia la generacion de IDs ni el esquema/datos de BD.
- No se toca el voucher salvo para confirmar que muestra el ID completo.
