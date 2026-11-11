# Mejoramiento del gestor de solicitudes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar desde Otras solicitudes y citas una llamada restringida a Cita Rechazada (No Necesaria), ampliar a 350 caracteres la observacion de rechazo de solicitudes y mostrar el orientador en los modales de gestion.

**Architecture:** Extender el contrato y el modal existentes de llamadas con un origen discriminado, manteniendo una unica action transaccional para permisos, concurrencia y cierres. Calcular en el servidor la elegibilidad de las citas del contexto y componer la accion en RevisarSolicitudesView. Resolver las dos mejoras restantes en el schema y los modales existentes, sin migraciones ni permisos nuevos.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Prisma/MySQL, Zod, shadcn/ui, sonner, Vitest y Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-mejoramiento-gestor-solicitudes-design.md`

## Global Constraints

- La rama de trabajo es `mejoramiento_gestor_solicitudes`.
- El registro desde Gestion exige `comunicador.llamar`; no se crea ni se relaja ningun permiso.
- La respuesta del modo Gestion es exactamente `Cita Rechazada (No Necesaria)`.
- El unico dato editable del modo Gestion es `llamadas.observacion`, opcional y con maximo 350 caracteres.
- El flujo no escribe `citas.razon_rechazo` ni duplica la observacion en otra tabla.
- Solo son elegibles citas en `ESTADOS_PENDIENTES` de otra solicitud `En Curso` del paciente y centro activos.
- La solicitud asociada pasa a `Realizado` solo cuando no quedan citas pendientes.
- El flujo normal de Comunicador conserva todas sus respuestas y comportamiento.
- `observacion_rechazo` de solicitudes admite 350 caracteres en cliente y servidor.
- La UI usa componentes shadcn instalados, `FieldGroup`/`Field`, espaciado `gap-*`, colores semanticos y `data-icon` en iconos de botones.
- No se requiere migracion de base de datos ni dependencia nueva.

## Review Focus

- Una peticion manipulada con origen Gestion y otra respuesta debe fallar antes de abrir la transaccion; Task 1 agrega la prueba de schema y action.
- Una cita que se cierra entre cargar el contexto y confirmar debe devolver `ERROR_CITA_CERRADA` y recargar el contexto; Tasks 1 y 3 fijan ambos extremos.
- Una cita pendiente no asociada a una solicitud `En Curso` visible no debe ofrecer la accion; Task 2 prueba el filtro relacional y la bandera.
- Una observacion compuesta solo por espacios debe normalizarse a vacio sin superar ni eludir el limite; Tasks 1 y 4 agregan casos de `trim`.
- Los modales abiertos desde Otras solicitudes deben mostrar el orientador de esa solicitud, no el de la solicitud base; Task 4 agrega la prueba contextual.

---

### Task 1: Contrato y persistencia de la llamada restringida

**Files:**
- Modify: `src/modules/comunicador/schemas/llamada.schema.ts`
- Modify: `src/modules/comunicador/schemas/llamada.schema.test.ts`
- Modify: `src/modules/comunicador/actions/registrarLlamada.action.ts`
- Modify: `src/modules/comunicador/actions/registrarLlamada.action.test.ts`

**Interfaces:**
- Consumes: `RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA`, `registrarLlamada`, `computeEstadoCita`, `ESTADOS_PENDIENTES`.
- Produces: `ORIGEN_LLAMADA = { COMUNICADOR: "comunicador", GESTION_SOLICITUDES: "gestion_solicitudes" } as const`; `RegistrarLlamadaInput` con `origen` opcional y default `comunicador`; validacion restringida para `gestion_solicitudes`; resultado existente `{ estadoCita: string; solicitudRealizada: boolean }` sin cambios.

- [ ] **Step 1: Escribir pruebas fallidas del schema discriminado**

Agregar casos con nombres y aserciones exactas:

- `mantiene comunicador como origen por defecto` espera `origen === "comunicador"`.
- `acepta gestion con rechazo no necesario y observacion de 350 caracteres` espera `success === true`.
- `acepta observacion vacia y recorta espacios en gestion` espera `observacion === ""`.
- `rechaza 351 caracteres en gestion` espera `success === false`.
- `rechaza otra respuesta y hora agendada en gestion` prueba ambos inputs con `success === false`.

- [ ] **Step 2: Ejecutar el schema test para confirmar rojo**

Run: `npm test -- src/modules/comunicador/schemas/llamada.schema.test.ts`

Expected: FAIL porque `origen` no existe y el modo Gestion aun no restringe respuesta ni hora.

- [ ] **Step 3: Implementar el contrato Zod minimo**

Definir y exportar `ORIGEN_LLAMADA`. Agregar `origen` con default `COMUNICADOR`; mantener la regla de hora para Comunicador; en `superRefine`, para Gestion exigir la respuesta fija, `hora_agendada === ""` y observacion opcional `trim().max(350)`.

- [ ] **Step 4: Ejecutar el schema test para confirmar verde**

Run: `npm test -- src/modules/comunicador/schemas/llamada.schema.test.ts`

Expected: PASS en todos los casos del archivo.

- [ ] **Step 5: Escribir pruebas fallidas de la action**

En `registrarLlamada.action.test.ts`, agregar:

- `exige comunicador.llamar al registrar desde gestion` espera `requirePermiso("comunicador.llamar")`.
- `registra rechazo no necesario guardando solo llamadas.observacion` espera `llamada.create.data.observacion` con el texto, `cita.update.data` igual a `{ estado_cita: "Cita Rechazada (No Necesaria)" }` y ausencia de `razon_rechazo`.
- `cierra solicitud sin citas pendientes` espera update a `{ estado_solicitud: "Realizado" }` y `solicitudRealizada === true`.
- `mantiene solicitud en curso si queda otra cita pendiente` espera que no se llame `solicitud.update`.
- `rechaza cita cerrada concurrentemente sin escribir` espera `ERROR_CITA_CERRADA` y ninguna creacion/actualizacion.
- `rechaza origen gestion manipulado antes de transaccion` envia otra respuesta y espera rechazo Zod sin llamada a `prisma.$transaction`.

- [ ] **Step 6: Ejecutar la action test para confirmar rojo**

Run: `npm test -- src/modules/comunicador/actions/registrarLlamada.action.test.ts`

Expected: FAIL en los nuevos casos de origen y persistencia restringida.

- [ ] **Step 7: Adaptar `registrarLlamada` sin bifurcar el flujo transaccional**

Consumir el output validado del schema y conservar el orden actual: permiso, parseo, `FOR UPDATE`, lectura, validacion de centro/estado, `llamada.create`, calculo de estado, `cita.update`, conteo de pendientes, cierre condicional y auditoria. No agregar `razon_rechazo` al update de cita.

- [ ] **Step 8: Ejecutar pruebas focalizadas de backend**

Run: `npm test -- src/modules/comunicador/schemas/llamada.schema.test.ts src/modules/comunicador/actions/registrarLlamada.action.test.ts src/modules/comunicador/utils/estadoCita.test.ts`

Expected: PASS en los tres archivos y sin regresion del modo Comunicador.

- [ ] **Step 9: Commit**

```bash
git add src/modules/comunicador/schemas/llamada.schema.ts src/modules/comunicador/schemas/llamada.schema.test.ts src/modules/comunicador/actions/registrarLlamada.action.ts src/modules/comunicador/actions/registrarLlamada.action.test.ts
git commit -m "feat: agregar llamada restringida desde gestion"
```

### Task 2: Elegibilidad de citas en Otras solicitudes y citas

**Files:**
- Modify: `src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts`
- Modify: `src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts`
- Modify: `src/modules/solicitudes/types/pendientes.ts`

**Interfaces:**
- Consumes: `ESTADOS_PENDIENTES`, `SolicitudCascada`, `CitaCascadaConEdicion`.
- Produces: `CitaCascadaContexto extends CitaCascadaConEdicion { puedeRegistrarRechazo: boolean }`; payload de `getOtrasSolicitudes` cuyas citas traen `puedeRegistrarRechazo` calculado en servidor.

- [ ] **Step 1: Escribir pruebas fallidas de consulta y bandera**

Actualizar el caso principal para esperar en `cita.findMany.where`:

```ts
solicitud: {
    is: {
        id_solicitud: { not: "SOL-1" },
        estado_solicitud: "En Curso",
        centro_id: "650"
    }
}
```

Agregar `puedeRegistrarRechazo: true` para cada cita devuelta por esa consulta. Agregar el caso `no devuelve como accionable una cita fuera de otra solicitud en curso` verificando que el filtro relacional siempre se envia y que una respuesta vacia produce listas vacias.

- [ ] **Step 2: Ejecutar el test para confirmar rojo**

Run: `npm test -- src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts`

Expected: FAIL porque falta el filtro `solicitud.is` y la bandera.

- [ ] **Step 3: Implementar el tipo y filtro relacional**

Crear `CitaCascadaContexto` en `pendientes.ts`. En `getOtrasSolicitudes`, filtrar las citas por solicitud asociada distinta de la base, `En Curso` y del mismo centro; mapear `editable` con la regla actual y `puedeRegistrarRechazo: true`. Mantener `_count` fuera del payload.

- [ ] **Step 4: Ejecutar pruebas focalizadas para confirmar verde**

Run: `npm test -- src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts src/modules/solicitudes/components/PendientesCascada.test.tsx`

Expected: PASS y contratos de cascada compatibles.

- [ ] **Step 5: Commit**

```bash
git add src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts src/modules/solicitudes/types/pendientes.ts
git commit -m "feat: delimitar citas accionables en gestion"
```

### Task 3: Modal restringido e integracion en Revisar solicitudes

**Files:**
- Create: `src/shared/components/ui/field.tsx` mediante `npx shadcn@latest add field`
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `ORIGEN_LLAMADA.GESTION_SOLICITUDES`, `CitaCascadaContexto`, `RegistrarLlamadaModal`, `getOtrasSolicitudes`.
- Produces: `CitaParaLlamada` con `id_cita`, `rut_usuario`, `estado_cita`, `nombre_usuario`, `nombre_social`, `profesion`, `prestacion`, `fecha_estimada_atencion` y `observacion`; `RegistrarLlamadaModalProps` con `cita: CitaParaLlamada` y `modo?: "comunicador" | "gestion_solicitudes"`, default `comunicador`; callback existente `onRegistrado(mensaje)`; estado local de cita en llamada dentro de `RevisarSolicitudesView`.

- [ ] **Step 1: Escribir pruebas fallidas del modal restringido**

En `RegistrarLlamadaModal.test.tsx`, agregar:

- `en modo gestion muestra respuesta fija y solo observacion editable`: encuentra el texto fijo, un `textbox` Observacion, y no encuentra `combobox` ni input de hora.
- `envia origen gestion, respuesta fija y observacion recortada`: espera `registrarLlamada` con `origen: "gestion_solicitudes"`, respuesta fija, observacion y hora vacia.
- `limita observacion a 350 y muestra contador`: espera `maxLength === 350` y texto `350/350` tras escribir.
- `conserva modo comunicador por defecto`: mantiene selector y respuestas actuales.

- [ ] **Step 2: Ejecutar el test del modal para confirmar rojo**

Run: `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`

Expected: FAIL porque no existe `modo` ni render restringido.

- [ ] **Step 3: Implementar el modo restringido con shadcn/ui**

Ejecutar primero `npx shadcn@latest add field` y revisar el archivo agregado. Extraer y exportar `CitaParaLlamada` y `RegistrarLlamadaModalProps`; `CitaFila` satisface el nuevo contrato por estructura. Convertir la superficie a `Dialog` accesible y componer el formulario con `FieldGroup`/`Field`. En modo Gestion fijar estado inicial y envio a `RECHAZADA_NO_NECESARIA`, ocultar selector/hora y mostrar solo `Textarea` con contador. No alterar el modo por defecto.

- [ ] **Step 4: Ejecutar el test del modal para confirmar verde**

Run: `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`

Expected: PASS en modo Gestion y Comunicador.

- [ ] **Step 5: Escribir pruebas fallidas de integracion en la vista**

En el bloque `RevisarSolicitudesView contexto de citas`, agregar:

- `muestra Registrar llamada solo cuando puedeRegistrarRechazo` con dos citas y una sola accion.
- `abre RegistrarLlamadaModal en modo gestion con la cita seleccionada` usando mock del modal y asercion de props.
- `al registrar recarga Otras solicitudes y citas y cierra la llamada` espera una nueva invocacion de `getOtrasSolicitudes`.
- `al recibir ERROR_CITA_CERRADA cierra la llamada y recarga contexto` simula `onCitaCerrada`.
- `no ofrece llamada a citas sin bandera aunque sean editables`.

- [ ] **Step 6: Ejecutar el test de vista para confirmar rojo**

Run: `npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

Expected: FAIL porque falta la accion y el estado del modal de llamada.

- [ ] **Step 7: Integrar la accion y el ciclo de recarga**

Agregar estado `citaLlamando: { cita: CitaParaLlamada; telefonos: string; correo: string } | null`, incluirlo en `hayModalAbierto`, pasar `onRegistrarLlamada` a `OtrasSolicitudesModal` y renderizar el boton solo con `puedeRegistrarRechazo`. El adaptador de la cita debe mapear `profesional?.nombre` a `profesion`, `prestacion?.nombre_prestacion` a `prestacion` y los datos de la solicitud asociada a `nombre_usuario`, `nombre_social`, telefonos y correo, sin `as` forzado. Abrir `RegistrarLlamadaModal` con `modo="gestion_solicitudes"`; tras exito o cierre concurrente, cerrar la llamada y ejecutar la funcion existente que recarga el contexto.

- [ ] **Step 8: Ejecutar pruebas de componentes relacionadas**

Run: `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/solicitudes/components/PendientesCascada.test.tsx`

Expected: PASS sin regresiones en editar cita, otras solicitudes ni Comunicador.

- [ ] **Step 9: Commit**

```bash
git add src/shared/components/ui/field.tsx src/modules/comunicador/components/RegistrarLlamadaModal.tsx src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
git commit -m "feat: registrar rechazo de cita desde solicitudes"
```

### Task 4: Limite de rechazo y orientador en modales

**Files:**
- Modify: `src/modules/solicitudes/schemas/revision.schema.ts`
- Modify: `src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `gestionarSolicitudSchema`, `SolicitudRow["orientador"]`, `RechazoModal`, `RealizarModal`.
- Produces: `observacion_rechazo` opcional con `trim().max(350)`; presentacion `Orientador: <nombre | Sin registro>` bajo la descripcion de ambos modales.

- [ ] **Step 1: Escribir pruebas fallidas del limite de rechazo**

En `gestionarSolicitud.action.test.ts`, agregar:

- `acepta observacion de rechazo de 350 caracteres` y espera persistencia completa.
- `rechaza observacion de 351 caracteres antes de la transaccion` y espera que `$transaction` no se invoque.
- `recorta una observacion compuesta solo por espacios a vacio` y espera persistencia `null`.

- [ ] **Step 2: Ejecutar el test de action para confirmar rojo**

Run: `npm test -- src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts`

Expected: FAIL porque el schema actual limita a 200.

- [ ] **Step 3: Cambiar el limite autoritativo a 350**

En la rama de rechazo de `gestionarSolicitudSchema`, cambiar solo `observacion_rechazo` a `z.string().trim().max(350, "Observacion maximo 350 caracteres").optional().default("")`.

- [ ] **Step 4: Ejecutar el test de action para confirmar verde**

Run: `npm test -- src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts`

Expected: PASS, incluidos 350, 351 y espacios.

- [ ] **Step 5: Escribir pruebas fallidas de UI y orientador**

En `RevisarSolicitudesView.test.tsx`, agregar:

- `rechazo limita observacion a 350 y muestra contador` espera `maxLength === 350`, `0/350` y `350/350`.
- `Realizar muestra el orientador bajo la descripcion` espera `Orientador: Orientadora Uno` dentro del dialog.
- `Rechazar muestra Sin registro cuando no hay orientador`.
- `modal contextual muestra el orientador de la otra solicitud` abre Realizar/Rechazar desde Otras solicitudes y espera el nombre de esa fila, no el de la base.

- [ ] **Step 6: Ejecutar el test de vista para confirmar rojo**

Run: `npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

Expected: FAIL porque falta `maxLength`, contador y presentacion del orientador.

- [ ] **Step 7: Implementar contador y metadato del orientador**

Agregar `maxLength={350}` y contador semantico al `Textarea` de `RechazoModal`. Extender `SolicitudMeta` o agregar un bloque compartido usado por `RealizarModal` y `RechazoModal` para mostrar debajo de la descripcion `Orientador: ${solicitud.orientador?.nombre ?? "Sin registro"}`. Asegurar que cada modal reciba la solicitud seleccionada, incluida la contextual.

- [ ] **Step 8: Ejecutar pruebas focalizadas de la tarea**

Run: `npm test -- src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/solicitudes/actions/getSolicitudes.action.test.ts`

Expected: PASS y las consultas existentes siguen incluyendo `orientador`.

- [ ] **Step 9: Commit**

```bash
git add src/modules/solicitudes/schemas/revision.schema.ts src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts src/modules/solicitudes/components/RevisarSolicitudesView.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
git commit -m "fix: alinear rechazo y mostrar orientador"
```

### Task 5: Verificacion integral y revision de alcance

**Files:**
- Modify only if verification exposes a defect in files already listed by Tasks 1-4.

**Interfaces:**
- Consumes: todos los contratos producidos por Tasks 1-4.
- Produces: rama verificada contra el spec, sin cambios de alcance.

- [ ] **Step 1: Ejecutar todas las pruebas**

Run: `npm test`

Expected: exit code 0 y cero pruebas fallidas.

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`

Expected: exit code 0 y cero errores.

- [ ] **Step 3: Ejecutar lint**

Run: `npm run lint`

Expected: exit code 0 y cero errores.

- [ ] **Step 4: Ejecutar build de produccion**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 5: Auditar el diff contra restricciones criticas**

Run: `git diff main...HEAD -- src/modules prisma/schema.prisma src/config/permisos.ts`

Expected: ningun cambio en `prisma/schema.prisma` ni `src/config/permisos.ts`; ninguna escritura de `citas.razon_rechazo`; solo los archivos previstos.

- [ ] **Step 6: Ejecutar revision de codigo de rama completa**

Usar `superpowers:requesting-code-review` con base `main`, atender hallazgos verificables y repetir los comandos afectados.

- [ ] **Step 7: Commit de correcciones de verificacion, solo si fueron necesarias**

Agregar unicamente los archivos corregidos que ya pertenezcan al alcance de Tasks 1-4 y ejecutar `git commit -m "fix: resolver hallazgos de verificacion"`. Si no hubo correcciones, omitir este paso sin crear un commit vacio.
