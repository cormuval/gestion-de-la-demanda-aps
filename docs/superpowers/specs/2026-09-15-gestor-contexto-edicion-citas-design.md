# Gestor: contexto de solicitudes y citas del paciente, y edicion de citas sin contacto

Fecha: 2026-09-15
Rama: `feat/mejoras-minuta-2026-09-14`
Origen: minuta del 14-09-2026, punto 3 ("Visualizacion integrada" y "Edicion condicional de citas").
Captura: punto 4, modal "Otras solicitudes en curso" ("Apilar las citas dentro de las solicitudes
abiertas para que el gestor pueda tener mas contexto").
Depende de:
- `docs/superpowers/specs/2026-09-15-rbac-anti-escalada-design.md` (tipo `ResultadoAccion<T>`).
- `docs/superpowers/specs/2026-09-15-sidebar-colapsable-tabla-design.md` (`DropdownMenu` completo y
  menu "Gestionar" de la tabla). Implementar S3 antes que S4.

## Problema

1. **El gestor no ve las citas vigentes del paciente.** En Revisar solicitudes, "Gestionar -> Otras
   solicitudes" (`RevisarSolicitudesView.tsx:182-194`, modal `OtrasSolicitudesModal` :732) usa
   `getOtrasSolicitudes` (`src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts`), que solo trae
   solicitudes con `accion = "En espera de validacion"`. Las solicitudes ya validadas, que son justamente
   las que tienen citas vigentes, no aparecen, y las citas no se muestran. El gestor puede asignar una
   segunda cita al mismo estamento sin saberlo.
2. **Una cita mal priorizada o con fecha erronea no se puede corregir.** `priorizacion_clinica`,
   `priorizacion` y `fecha_estimada_atencion` de `Cita` solo se escriben al crearla
   (`gestionarSolicitud.action.ts:174-211`). No existe action de edicion.
3. **Carrera latente con el comunicador.** `registrarLlamada` lee la cita dentro de su transaccion sin
   bloquearla (`registrarLlamada.action.ts:21-24`). Una edicion condicionada a "sin llamadas" podria
   validar justo antes de que se inserte una llamada concurrente.

Ya existe una vista con la forma deseada: `PendientesCascada.tsx` en Ingresar solicitud (solicitudes En
Curso con sus citas pendientes anidadas, mas "Otras citas" huerfanas).

## Objetivo

Que el gestor, desde Revisar solicitudes, vea todas las solicitudes en curso del paciente en su centro con
las citas vigentes anidadas, y pueda corregir la priorizacion clinica y la fecha estimada de una cita
mientras el paciente no haya recibido ningun contacto por ella.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Alcance de centro | Solo el centro del gestor | Confirmado por el usuario; mantiene el filtro actual |
| Solicitudes mostradas | Todas las `En Curso` del RUT (validadas o no), excepto la actual | Las validadas son las que tienen citas vigentes |
| Citas mostradas | Estados pendientes (`ESTADOS_PENDIENTES`: Sin llamadas, No contesta (1), No contesta (2), Solo llamada de aviso) | Mismo criterio que la cola del comunicador y la cascada de Ingresar |
| Acciones sobre solicitudes | Realizar/Rechazar solo en `En espera de validacion`; Usuario en todas | Una validada ya no se gestiona |
| Condicion de edicion | `estado_cita = "Sin llamadas"` **y** 0 filas en `llamadas` | "Sin contacto": una llamada de aviso tambien es contacto |
| Campos editables | `priorizacion_clinica` y `fecha_estimada_atencion` (recalcula `priorizacion`) | Lo pedido en la minuta |
| Permiso | Reusar `solicitudes.gestionar` | Quien crea citas puede corregirlas; sin permiso nuevo ni asignacion en produccion |
| Concurrencia | `SELECT ... FOR UPDATE` sobre la cita en `editarCita` y en `registrarLlamada` | Serializa edicion y llamada sobre la misma cita |
| UI | Reutilizar la cascada de Ingresar con slots de acciones; `Dialog` de shadcn | Una sola representacion; composicion shadcn |

## Diseno

### 1. Tipos y reglas compartidas

**`src/modules/solicitudes/types/pendientes.ts` (nuevo).** Contrato estructural minimo de la cascada,
que cumplen los resultados de `getPendientes` y de `getOtrasSolicitudes`:

```ts
export interface SolicitudCascada {
    id_solicitud: string;
    fecha_inicio: Date | string;
    descripcion: string | null;
    estado_solicitud: string;
    accion: string | null;
    tipoSolicitud: { nombre_tipo_solicitud: string } | null;
    motivo: { nombre_motivo: string } | null;
}

export interface CitaCascada {
    id_cita: string;
    solicitud_id: string | null;
    estado_cita: string | null;
    observacion: string | null;
    priorizacion_clinica: string | null;
    fecha_estimada_atencion: Date | string | null;
    profesional: { nombre: string } | null;
    prestacion: { nombre_prestacion: string } | null;
}
```

**`src/modules/solicitudes/utils/citas.ts` (nuevo).** Funciones puras:

```ts
// Editable solo si nunca hubo contacto: estado inicial y ninguna llamada registrada.
export function esCitaEditable(cita: { estado_cita: string | null; cantidadLlamadas: number }): boolean;

// Movida desde gestionarSolicitud.action.ts sin cambio de reglas (>= hoy, <= hoy + 2 anos).
// Devuelve el error en vez de lanzar.
export function evaluarFechaEstimada(value: string): { ok: true; fecha: Date } | { ok: false; error: string };

// Movida desde gestionarSolicitud.action.ts sin cambios: min(100, clinica + administrativa).
export function calcularPriorizacionCita(priorizacionClinica: PrioridadClinica, priorizacionAdministrativa: number | null | undefined): number;
```

`esCitaEditable` usa `ESTADO_CITA.SIN_LLAMADAS` (`src/modules/comunicador/types/comunicador.ts`); un
`estado_cita` null **no** es editable (dato inconsistente). `gestionarSolicitud` pasa a usar estas
funciones y conserva su comportamiento: si `evaluarFechaEstimada` falla, sigue lanzando el mismo mensaje
(su migracion a `ResultadoAccion` esta en #22).

### 2. Action `getOtrasSolicitudes` (modificada)

Se conserva nombre, firma de entrada `(rutUsuario, solicitudActualId)` y permiso `solicitudes.gestionar`
(el inventario de permisos no cambia). Devuelve `{ solicitudes, citas }`, ambos del **centro del gestor**
y del RUT normalizado:

```ts
const [solicitudes, citas] = await Promise.all([
    prisma.solicitud.findMany({
        where: { rut_usuario: rut, id_solicitud: { not: solicitudActualId }, estado_solicitud: "En Curso", centro_id: centroId },
        include: { usuario: true, tipoSolicitud: true, motivo: true, orientador: true, gestor: true },
        orderBy: [{ priorizacion_admin: "desc" }, { fecha_inicio: "asc" }]
    }),
    prisma.cita.findMany({
        where: { rut_usuario: rut, centro_id: centroId, estado_cita: { in: [...ESTADOS_PENDIENTES] } },
        include: { profesional: true, prestacion: true, _count: { select: { llamadas: true } } },
        orderBy: [{ fecha_estimada_atencion: "asc" }, { fecha_creacion: "asc" }]
    })
]);
return {
    solicitudes,
    citas: citas.map(({ _count, ...cita }) => ({ ...cita, editable: esCitaEditable({ estado_cita: cita.estado_cita, cantidadLlamadas: _count.llamadas }) }))
};
```

Se quita el filtro `accion: ACCION_ESPERA_VALIDACION`. Indices existentes cubren las consultas
(`solicitudes[rut_usuario]`, `citas[rut_usuario, estado_cita]`); sin migracion.

### 3. Action `editarCita` (nueva)

`src/modules/solicitudes/actions/editarCita.action.ts`, schema en `revision.schema.ts`:

```ts
export const editarCitaSchema = z.object({
    id_cita: z.string().trim().min(1, "Cita requerida"),
    priorizacion_clinica: z.enum(PRIORIDADES_CLINICAS),
    fecha_estimada_atencion: z.string().trim().min(1, "Fecha estimada requerida")
});
```

Firma: `editarCita(input): Promise<ResultadoAccion<CitaEditada>>`, con
`CitaEditada = { id_cita; priorizacion_clinica; priorizacion; fecha_estimada_atencion }`.

Flujo:

1. `requirePermiso("solicitudes.gestionar")` (primera linea); `editarCitaSchema.parse`.
2. Centro del gestor (mismo helper que las demas actions del modulo; sin centro -> `{ ok: false }`).
3. `evaluarFechaEstimada`; si falla -> `{ ok: false, error }` sin abrir transaccion.
4. Transaccion:

```ts
await tx.$queryRaw`SELECT id_cita FROM citas WHERE id_cita = ${data.id_cita} FOR UPDATE`;
const cita = await tx.cita.findUnique({
    where: { id_cita: data.id_cita },
    select: {
        id_cita: true, centro_id: true, estado_cita: true,
        priorizacion_clinica: true, priorizacion: true, fecha_estimada_atencion: true,
        usuario: { select: { priorizacion_administrativa: true } },
        _count: { select: { llamadas: true } }
    }
});
```

| Condicion | Resultado |
| --- | --- |
| `!cita` o `cita.centro_id !== centroId` | `{ ok: false, error: "La cita no existe o no pertenece a tu centro" }` |
| `!esCitaEditable(...)` | `{ ok: false, error: "La cita ya tiene llamadas registradas y no se puede modificar" }` |
| Valida | `update` de `priorizacion_clinica`, `fecha_estimada_atencion` y `priorizacion = calcularPriorizacionCita(clinica, usuario.priorizacion_administrativa)` (administrativa **actual** del paciente) |

5. Auditoria de exito:
   `AuditLogger.logDataAccess("UPDATE", true, actor, id_cita, { details: "Cita editada: priorizacion_clinica Alta->Media, priorizacion 65->45, fecha_estimada 2026-10-01->2026-10-15" })`.
6. `return { ok: true, data }`.

**`registrarLlamada` (cambio minimo).** Primera instruccion de su transaccion:
`await tx.$queryRaw\`SELECT id_cita FROM citas WHERE id_cita = ${data.cita_id} FOR UPDATE\``, antes del
`findUnique`. Asi una llamada y una edicion concurrentes sobre la misma cita se procesan en serie: si la
llamada gana, la edicion ve la llamada y se bloquea; si la edicion gana, la llamada se registra despues
sobre los datos editados.

### 4. UI

**Cascada reutilizable** (`src/modules/solicitudes/components/PendientesCascada.tsx`):

- Extraer `ListaPendientes` (sin `Card`), tipado con `SolicitudCascada`/`CitaCascada` genericos:

```tsx
interface ListaPendientesProps<S extends SolicitudCascada, C extends CitaCascada> {
    solicitudes: S[];
    citas: C[];
    accionesSolicitud?: (solicitud: S) => ReactNode;
    accionesCita?: (cita: C) => ReactNode;
}
```

- Mantiene la logica actual de agrupacion (citas por `solicitud_id`; huerfanas en "Otras citas").
- `PendientesCascada` (Ingresar) queda como `Card` + `ListaPendientes` sin acciones: comportamiento visible
  igual, salvo la mejora de `CitaRow`.
- `CitaRow` agrega, junto a profesional y prestacion: `Badge` con `priorizacion_clinica` (si existe) y
  "Fecha estimada: dd-mm-aaaa" (si existe). Aplica tambien a Ingresar.
- Respetar reglas shadcn al tocar el archivo (`flex flex-col gap-*` en vez de `space-y-*`, iconos con
  `data-icon` en botones).

**Revisar solicitudes** (`RevisarSolicitudesView.tsx`):

- Opcion del `DropdownMenu` de S3: "Otras solicitudes" -> **"Otras solicitudes y citas"**.
- `OtrasSolicitudesModal` pasa a `Dialog` de shadcn (`npx shadcn@latest add dialog`), contenido con scroll:
  - `DialogTitle` "Solicitudes y citas en curso"; `DialogDescription` "RUT {rut} · solo tu centro".
  - Estado de carga y vacio ("No hay otras solicitudes ni citas en curso para este RUT en tu centro").
  - Cuerpo: `ListaPendientes` con:
    - `accionesSolicitud`: si `accion === ACCION_ESPERA_VALIDACION`, botones Realizar / Rechazar / Usuario
      (handlers actuales `onRealizar`, `onRechazar`, `onEditarUsuario`); si no, `Badge` "Validada" y boton
      Usuario.
    - `accionesCita`: si `cita.editable`, boton "Editar" que abre `EditarCitaDialog`; si no, nada.
- Estado del modal: `otrasSolicitudes` pasa a `{ solicitudes, citas }` (tipo derivado de la action).
  Extraer la carga a una funcion `cargarContexto(solicitudBase)` reutilizada al abrir y tras editar.

**`EditarCitaDialog`** (`src/modules/solicitudes/components/EditarCitaDialog.tsx`, nuevo):

- `Dialog` con `DialogTitle` "Editar cita {CodigoId}" y descripcion con profesional · prestacion.
- Formulario (`FieldGroup` + `Field` si estan disponibles en el proyecto; si no, el patron `Field` local):
  - Priorizacion clinica: `Select` con `PRIORIDADES_CLINICAS`, precargado.
  - Fecha estimada: `Input type="date"`, precargada, `min` = hoy y `max` = hoy + 2 anos (fecha local).
- Guardar: `editarCita(...)`; `ok` -> `toast.success("Cita actualizada")`, cerrar y `cargarContexto`;
  `!ok` -> `toast.error(res.error)` y `cargarContexto` (la cita pudo recibir una llamada entretanto).
- Boton deshabilitado mientras guarda.

### 5. Tests

TDD en cada tarea.

- **`utils/citas.test.ts` (nuevo)**
  - `esCitaEditable`: "Sin llamadas" + 0 -> true; "Sin llamadas" + 1 -> false; "Solo llamada de aviso" + 0
    -> false; "No contesta (1)" -> false; `null` -> false.
  - `evaluarFechaEstimada`: hoy ok; ayer error; hoy + 2 anos ok; + 2 anos + 1 dia error; texto invalido error.
  - `calcularPriorizacionCita`: suma y tope 100 (mover el caso de
    `gestionarSolicitud.action.test.ts:183`).
- **`getOtrasSolicitudes.action.test.ts`** (nuevo o ampliado): `where` de solicitudes sin filtro de
  `accion` y con centro; `where` de citas con `ESTADOS_PENDIENTES` y centro; `editable` calculado y
  `_count` fuera del resultado.
- **`editarCita.action.test.ts` (nuevo)**
  - Exito: `update` con clinica, fecha y `priorizacion` recalculada con la administrativa actual; auditoria
    con antes/despues; `{ ok: true }`.
  - Bloqueos sin `update`: cita inexistente, otro centro, con llamadas, estado distinto de "Sin llamadas",
    fecha anterior a hoy, fecha > 2 anos.
  - `FOR UPDATE` se ejecuta antes del `findUnique`.
  - Permiso faltante: `rejects.toThrow`.
- **`registrarLlamada.action.test.ts`**: `FOR UPDATE` antes del `findUnique`; casos existentes intactos.
- **`gestionarSolicitud.action.test.ts`**: sigue verde tras usar las funciones movidas.
- **`src/modules/permisos-por-action.test.ts`**: fila `editarCita` -> `solicitudes.gestionar` y conteo
  `29` -> `30` (assertion y comentario).
- **UI**
  - `PendientesCascada`/`ListaPendientes`: sin acciones renderiza igual; con acciones las invoca por
    solicitud y por cita; `CitaRow` muestra priorizacion y fecha estimada.
  - `RevisarSolicitudesView.test.tsx` (de S3): "Otras solicitudes y citas" abre el dialog; Realizar/Rechazar
    solo en solicitudes en espera; "Editar" solo en citas editables.
  - `EditarCitaDialog.test.tsx`: precarga, envia valores, toast y recarga en `ok` y en `!ok`.
- Verificacion final: `npm test`, `npx tsc --noEmit`, `npm run lint`; verificacion visual del dialog en
  Revisar solicitudes y de la cascada en Ingresar.

### 6. Despliegue

Sin cambios de esquema, migraciones, permisos nuevos ni seed. Componente shadcn nuevo: `dialog`.

## Fuera de alcance

- Contexto de otros centros.
- Editar profesional, prestacion, observacion o tipo de prestacion de una cita.
- Edicion de citas desde el comunicador.
- Notificaciones al paciente: la minuta confirmo que no se envian mensajes al agendar desde este modulo.
- Migrar `gestionarSolicitud` u otras actions a `ResultadoAccion` (#22).

## Criterios de aceptacion

- [ ] "Otras solicitudes y citas" muestra todas las solicitudes En Curso del paciente en el centro del
      gestor, validadas o no, con sus citas en estados pendientes anidadas y las huerfanas aparte.
- [ ] Cada cita muestra estamento, prestacion, estado, priorizacion clinica y fecha estimada.
- [ ] Realizar/Rechazar solo aparecen en solicitudes en espera de validacion.
- [ ] "Editar" solo aparece en citas sin llamadas; guardar actualiza priorizacion clinica, fecha y
      `priorizacion` recalculada, con auditoria.
- [ ] El servidor rechaza editar una cita con llamadas, de otro centro o con fecha fuera de rango, sin
      escribir.
- [ ] Una llamada y una edicion concurrentes sobre la misma cita no dejan una cita editada con contacto previo.
- [ ] La cascada de Ingresar solicitud sigue funcionando y muestra priorizacion y fecha estimada.
- [ ] `npm test`, `npx tsc --noEmit` y `npm run lint` en verde.
