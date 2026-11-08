# Reimpresion de voucher y mantener usuario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir reimprimir vouchers de solicitudes `En Curso` desde Pendientes e Historial, y conservar opcionalmente al paciente para ingresar varias solicitudes limpiando siempre los datos propios de cada solicitud.

**Architecture:** Un contrato y modal de voucher reutilizables seran consumidos por la creacion y por una nueva Server Action de lectura bajo demanda. La accion aplicara permisos OR, centro activo y estado vigente; las dos vistas administraran su carga localmente. `IngresarSolicitudView` separara la limpieza del formulario de solicitud del reinicio completo del paciente para implementar `Mantener usuario` sin alterar las validaciones de duplicidad.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Prisma/MySQL, Server Actions, Zod, shadcn/ui, sonner, Vitest y Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-reimpresion-voucher-mantener-usuario-design.md`

## Global Constraints

- Todo el texto visible, comentarios y commits se escriben en espanol.
- La UI reutiliza componentes shadcn existentes; revisar la skill `shadcn` antes de implementar frontend.
- El voucher conserva exactamente su formato, textos y campos actuales; no agrega el campo Profesional.
- Solo se reimprimen solicitudes cuyo estado vigente sea exactamente `En Curso`.
- La fecha y hora impresas provienen de `fecha_inicio`, nunca del momento de reimpresion.
- No se agregan permisos, migraciones, dependencias ni cambios al esquema Prisma.
- Las Server Actions validan inputs con Zod, devuelven `ResultadoAccion<T>` y auditan accesos a datos.
- `Mantener usuario` comienza desmarcado y nunca se persiste como preferencia.
- Una creacion exitosa siempre limpia Tipo de solicitud, Motivo, Disponibilidad de llamada y Descripcion.
- Las reglas transaccionales existentes para solicitudes duplicadas no se modifican.

## Review Focus

- La solicitud puede cerrarse despues de renderizar el boton: la accion debe rechazarla con el mensaje especifico y no abrir un voucher obsoleto; lo cubre Task 2.
- Un identificador valido de otro centro no debe revelar que la solicitud existe; debe recibir el mismo error generico que un ID inexistente; lo cubre Task 2.
- Dos clics rapidos no deben abrir solicitudes superpuestas ni dejar controles bloqueados; el boton activo se deshabilita durante la carga; lo cubren Tasks 3 y 5.
- La solicitud puede crearse aunque falle el refresco posterior de pendientes: se conserva el paciente, se limpia la nueva solicitud y se avisa con toast; lo cubre Task 4.
- Motivo, disponibilidad o telefonos pueden ser nulos: el voucher debe mantener los reemplazos y omisiones actuales sin mostrar `undefined`; lo cubre Task 1.

---

### Task 1: Contrato y modal reutilizable del voucher

**Files:**
- Create: `src/modules/solicitudes/types/voucher.ts`
- Create: `src/modules/solicitudes/components/VoucherSolicitudModal.tsx`
- Create: `src/modules/solicitudes/components/VoucherSolicitudModal.test.tsx`
- Modify: `src/modules/solicitudes/actions/crearSolicitud.action.ts`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

**Interfaces:**
- Produces: `export interface VoucherSolicitud` con `id_solicitud`, `fecha_inicio`, `rut`, `usuario`, `tipoSolicitud`, `motivo`, `centro` y `disponibilidad_llamada`, usando las nulabilidades del resultado actual de `crearSolicitud`.
- Produces: `export interface VoucherSolicitudModalProps { voucher: VoucherSolicitud; onClose: () => void }`.
- Produces: `export function VoucherSolicitudModal(props: VoucherSolicitudModalProps): JSX.Element`.
- Preserves: `crearSolicitud(input: CrearSolicitudInput): Promise<ResultadoAccion<{ solicitud: SolicitudCreada; voucher: VoucherSolicitud }>>`.

- [ ] **Step 1: Escribir las pruebas fallidas del componente reutilizable**

Crear `VoucherSolicitudModal.test.tsx` con pruebas que rendericen un `VoucherSolicitud` fijo y afirmen:

- los textos `COMPROBANTE DE SOLICITUD`, Solicitud, Fecha, Hora, RUT, Tipo, Motivo, Disponibilidad y Telefonos;
- ausencia de una etiqueta `Profesional:`;
- `Sin motivo` cuando `motivo` es `null`;
- ausencia de las filas Disponibilidad y Telefonos cuando sus valores son nulos o vacios;
- llamada a `onClose` desde **Cerrar**; y
- llamada a `window.print()` desde **Imprimir**.

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run: `npm test -- src/modules/solicitudes/components/VoucherSolicitudModal.test.tsx`

Expected: FAIL porque no existen `types/voucher.ts` ni `VoucherSolicitudModal.tsx`.

- [ ] **Step 3: Crear el contrato `VoucherSolicitud`**

Definir en `types/voucher.ts` el contrato exacto que hoy devuelve `crearSolicitud`, omitiendo el campo interno `profesional` porque no se presenta ni es requerido por el comprobante. Tipar `fecha_inicio` como `Date` y conservar los campos opcionales como `string | null`.

- [ ] **Step 4: Extraer `VoucherSolicitudModal` sin cambios visuales**

Mover desde `IngresarSolicitudView.tsx` el modal, `VoucherLine`, estilos de impresion y dependencias `Printer`/`X`. Mantener los textos, logo `/assets/CALUGA_LOGOS_2025.png`, formato `es-CL` y comportamiento actuales.

- [ ] **Step 5: Adaptar la creacion y la vista al contrato comun**

En `crearSolicitud.action.ts`, usar `VoucherSolicitud` en la salida y dejar de devolver `profesional`. En `IngresarSolicitudView.tsx`, importar el tipo y modal extraidos sin cambiar el flujo posterior a la creacion. Ajustar los fixtures existentes.

- [ ] **Step 6: Ejecutar las pruebas enfocadas**

Run: `npm test -- src/modules/solicitudes/components/VoucherSolicitudModal.test.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/actions/crearSolicitud.action.test.ts`

Expected: PASS en los tres archivos.

- [ ] **Step 7: Commit**

```bash
git add src/modules/solicitudes/types/voucher.ts src/modules/solicitudes/components/VoucherSolicitudModal.tsx src/modules/solicitudes/components/VoucherSolicitudModal.test.tsx src/modules/solicitudes/components/IngresarSolicitudView.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/actions/crearSolicitud.action.ts src/modules/solicitudes/actions/crearSolicitud.action.test.ts
git commit -m "refactor(solicitudes): reutilizar modal de voucher"
```

### Task 2: Server Action segura para reconstruir el voucher

**Files:**
- Create: `src/modules/solicitudes/actions/getVoucherSolicitud.action.ts`
- Create: `src/modules/solicitudes/actions/getVoucherSolicitud.action.test.ts`
- Modify: `src/modules/permisos-por-action.test.ts`

**Interfaces:**
- Consumes: `VoucherSolicitud` de Task 1.
- Produces: `export async function getVoucherSolicitud(idSolicitud: string): Promise<ResultadoAccion<VoucherSolicitud>>`.
- Uses: `requirePermiso("solicitudes.ver", "historial.ver")`, cuya semantica es OR.

- [ ] **Step 1: Escribir pruebas fallidas de permisos y validacion**

Crear `getVoucherSolicitud.action.test.ts` siguiendo el patron de mocks de las otras actions. Cubrir:

- `requirePermiso` recibe exactamente `"solicitudes.ver", "historial.ver"`;
- ID vacio o invalido devuelve error de validacion sin consultar Prisma;
- funcionario sin `centro_id` devuelve el mensaje estandar de centro no asignado; y
- la consulta principal filtra simultaneamente `id_solicitud`, `centro_id` y `estado_solicitud: "En Curso"`.

Agregar en `permisos-por-action.test.ts` la fila de `getVoucherSolicitud` con ambos permisos admitidos.

- [ ] **Step 2: Escribir pruebas fallidas de seguridad y mapeo**

Agregar casos que afirmen:

- solicitud `En Curso` devuelve `ok: true` con ID, fecha original, RUT, usuario, tipo, motivo, disponibilidad y centro;
- solicitud del mismo centro que existe pero ya no esta `En Curso` devuelve `Solo se pueden reimprimir vouchers de solicitudes En Curso`;
- ID inexistente devuelve `No fue posible obtener el voucher de la solicitud`;
- solicitud de otro centro produce el mismo mensaje generico y nunca devuelve sus datos; y
- una lectura exitosa invoca `AuditLogger.logDataAccess("SEARCH", true, ...)`.

- [ ] **Step 3: Ejecutar las pruebas y comprobar que fallan**

Run: `npm test -- src/modules/solicitudes/actions/getVoucherSolicitud.action.test.ts src/modules/permisos-por-action.test.ts`

Expected: FAIL porque la Server Action todavia no existe.

- [ ] **Step 4: Implementar `getVoucherSolicitud`**

Validar `idSolicitud` con un schema Zod no vacio. Consultar primero la solicitud imprimible por ID, centro y `En Curso`, seleccionando solo los campos del contrato. Si no aparece, consultar unicamente `id_solicitud`, `centro_id` y `estado_solicitud` por el mismo ID: emitir el mensaje especifico solo si pertenece al centro activo y esta cerrada; para inexistente u otro centro usar el mensaje generico. Resolver el nombre del centro en la misma seleccion o con el patron SQL existente de `crearSolicitud`.

- [ ] **Step 5: Ejecutar pruebas enfocadas y de permisos**

Run: `npm test -- src/modules/solicitudes/actions/getVoucherSolicitud.action.test.ts src/modules/permisos-por-action.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/solicitudes/actions/getVoucherSolicitud.action.ts src/modules/solicitudes/actions/getVoucherSolicitud.action.test.ts src/modules/permisos-por-action.test.ts
git commit -m "feat(solicitudes): obtener voucher para reimpresion"
```

### Task 3: Reimpresion desde Pendientes del paciente

**Files:**
- Modify: `src/modules/solicitudes/components/PendientesCascada.tsx`
- Modify: `src/modules/solicitudes/components/PendientesCascada.test.tsx`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

**Interfaces:**
- Consumes: `getVoucherSolicitud(idSolicitud: string)` de Task 2.
- Consumes: `VoucherSolicitudModal` y `VoucherSolicitud` de Task 1.
- Produces: `PendientesCascada` admite `onReimprimirVoucher: (idSolicitud: string) => void` e `idVoucherCargando: string | null`.

- [ ] **Step 1: Escribir pruebas fallidas de presentacion en Pendientes**

En `PendientesCascada.test.tsx`, renderizar dos solicitudes y afirmar que cada una tiene una accion accesible **Reimprimir voucher** asociada a su ID. Al pulsar una, debe llamar `onReimprimirVoucher` con ese ID; si coincide con `idVoucherCargando`, solo ese boton queda deshabilitado y muestra estado de carga.

- [ ] **Step 2: Escribir pruebas fallidas del flujo en Crear solicitud**

En `IngresarSolicitudView.test.tsx`, mockear `getVoucherSolicitud` y comprobar:

- el clic consulta el ID correcto y abre `VoucherSolicitudModal` con la respuesta;
- un segundo clic sobre el boton activo no dispara otra consulta;
- `ok: false` muestra `toast.error` y no abre el modal; y
- una excepcion muestra un error generico, conserva usuario y pendientes, y libera el estado de carga.

- [ ] **Step 3: Ejecutar las pruebas y comprobar que fallan**

Run: `npm test -- src/modules/solicitudes/components/PendientesCascada.test.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

Expected: FAIL porque Pendientes no expone la accion y la vista no consulta el voucher.

- [ ] **Step 4: Incorporar la accion en `PendientesCascada`**

Reutilizar `ListaPendientes.accionesSolicitud` para renderizar el boton con icono de impresion, etiqueta accesible y estado deshabilitado. No duplicar el marcado de cada solicitud.

- [ ] **Step 5: Conectar carga y modal en `IngresarSolicitudView`**

Agregar `idVoucherCargando: string | null` y una funcion asincrona que llame `getVoucherSolicitud`, presente errores con sonner, actualice el voucher activo solo al tener `ok: true` y limpie la carga en `finally`.

- [ ] **Step 6: Ejecutar las pruebas enfocadas**

Run: `npm test -- src/modules/solicitudes/components/PendientesCascada.test.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/solicitudes/components/PendientesCascada.tsx src/modules/solicitudes/components/PendientesCascada.test.tsx src/modules/solicitudes/components/IngresarSolicitudView.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx
git commit -m "feat(solicitudes): reimprimir voucher desde pendientes"
```

### Task 4: Mantener al usuario entre solicitudes

**Files:**
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

**Interfaces:**
- Consumes: `getPendientes(rutUsuario: string): Promise<ResultadoAccion<PendientesPaciente>>` existente.
- Produces: estado local `mantenerUsuario: boolean`, inicialmente `false`.
- Produces: funciones separadas para limpiar `SolicitudFormState` y reiniciar el flujo completo.

- [ ] **Step 1: Escribir pruebas fallidas del checkbox y reinicio completo**

Agregar pruebas que confirmen:

- **Mantener usuario** aparece solo con usuario confirmado y comienza desmarcado;
- con el checkbox desmarcado, una creacion exitosa abre el voucher y limpia RUT, usuario, pendientes, Tipo, Motivo, Disponibilidad y Descripcion; y
- buscar un RUT distinto devuelve el checkbox a desmarcado.

- [ ] **Step 2: Escribir pruebas fallidas del camino que conserva al paciente**

Completar todos los campos, marcar el checkbox y simular una creacion exitosa. Afirmar que:

- conserva RUT y datos del usuario;
- mantiene marcado el checkbox;
- limpia Tipo, Motivo, Disponibilidad y Descripcion;
- vuelve a llamar `getPendientes` con el RUT confirmado; y
- muestra la solicitud recien creada cuando el refresco la devuelve.

- [ ] **Step 3: Escribir pruebas fallidas de errores**

Cubrir que un error de `crearSolicitud` conserva checkbox, paciente y todos los campos. Cubrir tambien que, si la creacion resulta exitosa pero el segundo `getPendientes` falla o lanza, el voucher se abre, el paciente permanece, los cuatro campos quedan limpios y aparece un toast de advertencia.

- [ ] **Step 4: Ejecutar las pruebas y comprobar que fallan**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

Expected: FAIL porque no existe el checkbox ni la limpieza condicional.

- [ ] **Step 5: Implementar el estado y la UI**

Tras consultar la skill `shadcn`, usar un `input type="checkbox"` nativo con el patron visual y accesible ya empleado por `PermisosRolModal`, porque el proyecto no tiene `Checkbox` compartido y el alcance prohibe agregar la dependencia `@radix-ui/react-checkbox`. Ubicarlo cerca de **Guardar solicitud**, con `id` y `Label` asociado.

- [ ] **Step 6: Separar las operaciones de limpieza**

Crear una funcion que solo ejecute `setSolicitudForm(emptySolicitudForm)` y mantener otra para reiniciar RUT, revision, pendientes, usuario, formulario de usuario, modal y `mantenerUsuario`. Invocar una u otra exclusivamente despues de `crearSolicitud` exitoso.

- [ ] **Step 7: Refrescar pendientes sin revertir la creacion**

Cuando `mantenerUsuario` sea `true`, volver a consultar `getPendientes(rutRevisado)` despues de limpiar los campos. Actualizar la cascada en `ok: true`; para `ok: false` o excepcion, mostrar advertencia sin limpiar paciente ni cerrar el voucher.

- [ ] **Step 8: Ejecutar las pruebas enfocadas**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/components/PendientesCascada.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/solicitudes/components/IngresarSolicitudView.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx
git commit -m "feat(solicitudes): mantener usuario entre ingresos"
```

### Task 5: Reimpresion desde Historial y verificacion integral

**Files:**
- Modify: `src/modules/historial/components/HistorialPacienteView.tsx`
- Modify: `src/modules/historial/components/HistorialPacienteView.test.tsx`

**Interfaces:**
- Consumes: `getVoucherSolicitud(idSolicitud: string)` de Task 2.
- Consumes: `VoucherSolicitudModal` y `VoucherSolicitud` de Task 1.
- Preserves: las solicitudes con estado distinto de `En Curso` permanecen solo de lectura y sin accion de voucher.

- [ ] **Step 1: Escribir pruebas fallidas de visibilidad por estado**

En `HistorialPacienteView.test.tsx`, usar solicitudes `En Curso`, `Realizado` y `Rechazado`. Afirmar que solo la tarjeta `En Curso` contiene **Reimprimir voucher** y que el boton invoca la accion con su ID.

- [ ] **Step 2: Escribir pruebas fallidas de carga, exito y error**

Cubrir:

- boton deshabilitado y sin segundo request mientras su promesa esta pendiente;
- respuesta exitosa abre el modal reutilizable con la fecha original;
- `ok: false` y excepcion muestran toast, no abren modal y conservan el historial visible; y
- al terminar, el boton vuelve a habilitarse.

- [ ] **Step 3: Ejecutar la prueba y comprobar que falla**

Run: `npm test -- src/modules/historial/components/HistorialPacienteView.test.tsx`

Expected: FAIL porque Historial no integra la accion ni el modal.

- [ ] **Step 4: Implementar la integracion en Historial**

Pasar a `SolicitudItem` el callback y el ID en carga. Renderizar el boton solo con igualdad estricta a `En Curso`. Administrar en `HistorialPacienteView` el voucher activo, `idVoucherCargando`, errores sonner y limpieza en `finally`, siguiendo la misma semantica de Pendientes sin copiar el componente visual.

- [ ] **Step 5: Ejecutar las pruebas enfocadas de Historial y voucher**

Run: `npm test -- src/modules/historial/components/HistorialPacienteView.test.tsx src/modules/solicitudes/components/VoucherSolicitudModal.test.tsx src/modules/solicitudes/actions/getVoucherSolicitud.action.test.ts`

Expected: PASS.

- [ ] **Step 6: Ejecutar validacion completa del repositorio**

Run: `npm test`

Expected: todas las suites PASS.

Run: `npm run lint`

Expected: exit code 0, sin errores nuevos.

Run: `npm run build`

Expected: compilacion de produccion exitosa, sin errores TypeScript ni de Next.js.

- [ ] **Step 7: Revisar el diff contra el spec**

Run: `git diff --check && git status --short`

Expected: `git diff --check` sin salida; `git status` muestra solo los archivos previstos para Task 5.

- [ ] **Step 8: Commit**

```bash
git add src/modules/historial/components/HistorialPacienteView.tsx src/modules/historial/components/HistorialPacienteView.test.tsx
git commit -m "feat(historial): reimprimir vouchers en curso"
```

- [ ] **Step 9: Verificar la rama despues del commit**

Run: `git status --short --branch`

Expected: rama `reimpresion_de_voucher_y_Mantener_usuario` sin cambios pendientes.
