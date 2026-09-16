# Solicitud duplicada: aviso claro, bloqueo anticipado y cierre de la carrera

Fecha: 2026-09-15
Rama: `feat/mejoras-minuta-2026-09-14`
Origen: minuta del 14-09-2026, punto 2 ("Alertas de duplicados en solicitudes"). Captura: toast
"An error occurred in the Server Components render..." al guardar en Ingresar solicitud.
Depende de: `docs/superpowers/specs/2026-09-15-rbac-anti-escalada-design.md` (tipo `ResultadoAccion<T>`).
Relacionados: issue #22 (resto de actions).

## Problema

`crearSolicitud` (`src/modules/solicitudes/actions/crearSolicitud.action.ts`) bloquea un duplicado
(mismo RUT + tipo + motivo con `estado_solicitud = "En Curso"`, :90-99) con
`throw new Error("El usuario ya posee una solicitud en curso del mismo tipo y motivo.")`.

1. **Mensaje invisible en produccion.** Next.js omite el mensaje de errores lanzados en Server Actions.
   El `catch` de `IngresarSolicitudView.tsx:263-264` muestra el texto generico de Next.js. En desarrollo
   si se ve el mensaje real, por eso "funcionaba".
2. **Lo mismo para los otros 6 errores de negocio** de la action (funcionario sin centro, centro no
   validable, usuario no confirmado, tipo no habilitado, motivo invalido, motivo requerido).
3. **Carrera.** La verificacion (`findFirst`) y el `create` no son atomicos y `Solicitud` no tiene
   restriccion unica. Dos envios simultaneos del mismo paciente pueden crear dos solicitudes.
4. **Aviso tardio.** La pantalla ya carga las solicitudes en curso del RUT en la revision previa
   (`getPendientes`), pero no las usa para advertir antes de guardar.

## Objetivo

Que el usuario sepa **antes de guardar** que ya existe un tramite abierto para ese paciente, tipo y
motivo, con un mensaje que identifique la solicitud existente; que el servidor lo garantice incluso
con envios simultaneos; y que todos los errores de negocio de `crearSolicitud` se lean en produccion.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Criterio de duplicado | Se mantiene: RUT + tipo + motivo en curso | Confirmado por el usuario ("como lo hace el codigo hoy") |
| Alcance de `ResultadoAccion` | Solo `crearSolicitud` | Minimo pedido por la minuta; el resto queda en #22 |
| Concurrencia | Transaccion con `SELECT ... FOR UPDATE` sobre la fila del paciente | Serializa por paciente sin cambio de esquema ni migracion |
| UX | Aviso inline + boton deshabilitado; toast de respaldo | Anticipa con datos ya cargados; el servidor sigue siendo la autoridad |
| Texto | Una sola funcion para servidor y cliente | Mismo mensaje en ambos caminos |

## Diseno

### 1. Regla compartida: `src/modules/solicitudes/utils/duplicados.ts`

Funciones puras, sin Prisma, importables desde servidor y cliente.

```ts
export interface SolicitudEnCurso {
    id_solicitud: string;
    fecha_inicio: Date | string;
    tipo_solicitud_id: number;
    motivo_id: number | null;
}

export interface CriterioDuplicado {
    tipo_solicitud_id: number;
    motivo_id: number | null;
}

// Devuelve la primera solicitud en curso con el mismo tipo y motivo, o null.
// motivo_id null solo coincide con null.
export function buscarSolicitudDuplicada<T extends SolicitudEnCurso>(solicitudesEnCurso: T[], criterio: CriterioDuplicado): T | null;

// "Ya existe la solicitud SOL-68bb9 del 08-09-2026 en curso para este tipo y motivo.
//  Debe cerrarse antes de ingresar una nueva."
export function mensajeSolicitudDuplicada(solicitud: Pick<SolicitudEnCurso, "id_solicitud" | "fecha_inicio">): string;
```

- El ID se muestra con `acortarId` (`src/shared/lib/acortarId.ts`).
- La fecha se formatea `dd-mm-aaaa` con `timeZone: "America/Santiago"` **explicito**: el servidor puede
  correr en UTC y, sin zona, una solicitud ingresada de noche mostraria el dia siguiente.
- `buscarSolicitudDuplicada` asume que la lista ya contiene solo solicitudes en curso del mismo RUT
  (asi la entregan `getPendientes` y la consulta de la action).

### 2. Action `crearSolicitud`

Firma: `crearSolicitud(input): Promise<ResultadoAccion<{ solicitud; voucher }>>` (mismo `data` que hoy).

**Errores.** Los 7 `throw new Error` de negocio pasan a `return { ok: false, error }` con el mismo texto,
salvo el duplicado, que usa `mensajeSolicitudDuplicada`. `getCentroFuncionario` deja de lanzar y
devuelve `string | null`; la action convierte `null` en `{ ok: false, error: "El funcionario activo no
tiene centro asignado" }`.

Siguen lanzando: `requirePermiso`, `crearSolicitudSchema.parse` (el RUT viene del usuario ya confirmado;
un fallo indica input manipulado) y fallos de BD.

**Flujo.**

1. `requirePermiso("solicitudes.crear")`, `parse`, centro, usuario, tipo, motivo: igual que hoy (lecturas
   fuera de la transaccion), devolviendo `{ ok: false }` en cada validacion.
2. Transaccion interactiva:

```ts
const resultado = await prisma.$transaction(async (tx) => {
    // Serializa los ingresos concurrentes del mismo paciente hasta el commit.
    await tx.$queryRaw`SELECT rut FROM usuarios WHERE rut = ${usuario.rut} FOR UPDATE`;

    const duplicada = await tx.solicitud.findFirst({
        where: { rut_usuario: usuario.rut, tipo_solicitud_id, motivo_id, estado_solicitud: "En Curso" },
        select: { id_solicitud: true, fecha_inicio: true }
    });
    if (duplicada) return { duplicada } as const;

    const solicitud = await tx.solicitud.create({ /* data y select actuales */ });
    return { solicitud } as const;
});
```

3. Si `duplicada`:
   `AuditLogger.logDataAccess("CREATE", false, actor, duplicada.id_solicitud, { details: "Solicitud duplicada bloqueada para RUT {rut}" })`
   y `return { ok: false, error: mensajeSolicitudDuplicada(duplicada) }`.
4. Si `solicitud`: auditoria de exito actual y `return { ok: true, data: { solicitud, voucher } }`.

El bloqueo es por fila de `usuarios` (PK `rut`), vigente solo durante la transaccion: no afecta
ingresos de otros pacientes. InnoDB (MySQL 8.4) libera el lock en commit/rollback.

### 3. UI: `src/modules/solicitudes/components/IngresarSolicitudView.tsx`

**Aviso anticipado.**

```ts
const solicitudDuplicada = useMemo(() => {
    if (!pendientes || !usuarioConfirmado || !solicitudForm.tipo_solicitud_id) return null;
    if (requiereMotivo && !solicitudForm.motivo_id) return null;
    return buscarSolicitudDuplicada(pendientes.solicitudesPendientes, {
        tipo_solicitud_id: Number(solicitudForm.tipo_solicitud_id),
        motivo_id: requiereMotivo ? Number(solicitudForm.motivo_id) : null
    });
}, [pendientes, usuarioConfirmado, solicitudForm.tipo_solicitud_id, solicitudForm.motivo_id, requiereMotivo]);
```

- Si hay coincidencia: `Alert` de shadcn (variante destructiva, icono `AlertTriangle`) en `lg:col-span-2`
  justo antes del boton, con `mensajeSolicitudDuplicada(solicitudDuplicada)`.
- Boton "Guardar solicitud": `disabled={submittingSolicitud || Boolean(solicitudDuplicada)}`.
- Componente nuevo: `npx shadcn@latest add alert` (queda en `src/shared/components/ui/alert.tsx` segun
  `components.json`). Usar la skill `shadcn` al agregarlo.

**Respuesta del servidor.** `onCrearSolicitud`:

```ts
const res = await crearSolicitud({ ... });
if (!res.ok) {
    toast.error(res.error);
    // Otro envio pudo crear la solicitud entre la revision previa y el guardado:
    // refrescar pendientes para mostrar el aviso y la cascada actualizados, sin limpiar el formulario.
    const actualizados = await getPendientes(usuarioConfirmado.rut);
    setPendientes(actualizados);
    return;
}
const { solicitud, voucher } = res.data;
```

El refresco se hace ante cualquier `ok: false` (simple y barato) y **no** llama a `buscarPendientes`, que
limpia el formulario. Un fallo del refresco no debe ocultar el toast original (su propio `try/catch`
silencioso o dentro del `catch` existente).

### 4. Tests

TDD en cada tarea.

- **`src/modules/solicitudes/utils/duplicados.test.ts` (nuevo)**
  - Mismo tipo y motivo: coincide. Motivo `null` vs `null`: coincide.
  - Motivo distinto, o tipo distinto: no coincide. `null` vs numero: no coincide. Lista vacia: `null`.
  - Mensaje: ID acortado y fecha `dd-mm-aaaa`; una `fecha_inicio` `2026-09-09T02:30:00Z` se muestra como
    `08-09-2026` (hora de Santiago).
- **`crearSolicitud.action.test.ts`**
  - Mock `prisma.$transaction` como `vi.fn(async (cb) => cb(tx))`, con `tx` exponiendo `$queryRaw`,
    `solicitud.findFirst` y `solicitud.create`.
  - Duplicado: `{ ok: false, error }` con el mensaje de `mensajeSolicitudDuplicada`, `create` no llamado,
    `logDataAccess` con `success=false`.
  - El `FOR UPDATE` se ejecuta antes del `findFirst` (orden de llamadas).
  - Exito: `{ ok: true, data: { solicitud, voucher } }` con los mismos datos que hoy.
  - Pasan de `rejects.toThrow` a `{ ok: false }`: motivo requerido, tipo no habilitado para el centro y
    demas errores de negocio existentes.
  - Siguen con `rejects.toThrow`: permiso faltante y RUT invalido (Zod).
- **`IngresarSolicitudView.test.tsx` (nuevo)**, con actions mockeadas:
  - Tras la revision previa con una solicitud en curso de tipo X / motivo Y, al elegir X / Y se muestra
    el aviso y "Guardar solicitud" queda deshabilitado; al elegir otro motivo desaparece.
  - Si `crearSolicitud` devuelve `ok: false`: `toast.error` con el mensaje y `getPendientes` se vuelve a
    llamar con el RUT confirmado; el formulario conserva sus valores.
- Verificacion final: `npm test`, `npx tsc --noEmit`, `npm run lint`.

### 5. Despliegue

Sin cambios de esquema, migraciones ni permisos. No toca el seed.

## Fuera de alcance

- Migrar las demas actions a `ResultadoAccion` (issue #22).
- Indice unico o restriccion en BD para duplicados.
- Detectar o limpiar duplicados ya existentes en produccion.
- Cambiar el criterio de duplicado o filtrarlo por centro (hoy no filtra por centro; se mantiene).
- `ZodError` por input real del usuario en esta action (el RUT llega ya confirmado).

## Criterios de aceptacion

- [ ] En produccion, intentar un duplicado muestra el mensaje con ID corto y fecha, no el error generico.
- [ ] Con la revision previa hecha, elegir tipo y motivo de una solicitud en curso muestra el aviso y
      deshabilita "Guardar solicitud" antes de enviar.
- [ ] Dos envios simultaneos para el mismo paciente, tipo y motivo crean una sola solicitud.
- [ ] Los demas errores de negocio de `crearSolicitud` se muestran con su texto en produccion.
- [ ] `npm test`, `npx tsc --noEmit` y `npm run lint` en verde.
