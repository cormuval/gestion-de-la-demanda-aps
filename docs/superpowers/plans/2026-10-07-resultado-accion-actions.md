# ResultadoAccion en Server Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar las 30 condiciones esperadas inventariadas a `ResultadoAccion<T>` y hacer que todos sus consumidores muestren el mensaje correcto sin ejecutar efectos de exito.

**Architecture:** Cada flujo cambia de extremo a extremo: la Server Action devuelve una union discriminada explicita, las transacciones usan una union interna sin capturar fallos tecnicos y la UI comprueba `res.ok` antes de consumir datos. El tipo compartido existente se reutiliza sin wrappers globales; las funciones auxiliares solo propagan resultados de negocio que pertenecen a su flujo.

**Tech Stack:** Next.js 15 Server Actions, React 19, TypeScript strict, Prisma/MySQL, Zod, Vitest, Testing Library y Sonner.

**Spec:** `docs/superpowers/specs/2026-10-07-resultado-accion-actions-design.md`

## Global Constraints

- Reutilizar exactamente `ResultadoAccion<T> = { ok: true; data: T } | { ok: false; error: string }` de `src/shared/types/resultado.ts`.
- Devolver `ok: false` solo para errores de negocio o configuracion esperados; `requirePermiso`, Zod y fallos inesperados de Prisma, auditoria o infraestructura siguen rechazando la promesa.
- No agregar un `try/catch` general, excepciones de dominio, codigos de error ni un wrapper global.
- Los resultados fallidos no escriben datos, no registran auditoria de exito y no ejecutan efectos de exito en el cliente.
- Mantener los textos actuales, salvo el mensaje estructural: `El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion.`
- Mantener la modularidad: lo propio de solicitudes, comunicador, configuracion o SOME permanece en su modulo.
- Escribir UI, comentarios y commits en espanol, con indentacion de cuatro espacios.
- No modificar esquema Prisma, migraciones, permisos, dependencias ni seeds.

## Review Focus

- Una action de lectura devuelve datos vacios validos: debe ser `{ ok: true, data }`, nunca confundirse con una falla de configuracion; cubrir en Tasks 2, 3, 4 y 7.
- Una mutacion devuelve `ok: false`: el formulario o modal conserva valores y no se cierra, recarga ni muestra exito; cubrir en Tasks 1, 3, 5 y 6.
- Un fallo de Prisma o auditoria: la promesa sigue rechazandose y no se transforma en `ok: false`; cubrir en Tasks 1, 3, 5, 6 y 7.
- Un recurso cambia entre la carga y el submit (solicitud/cita cerrada o ajena): mostrar el mensaje de negocio y no escribir; cubrir en Tasks 3 y 5.
- Un consumidor basado en `.then(...)` recibe `ok: false`: debe inspeccionarlo y no ejecutar `loadData`; cubrir en Tasks 4 y 6.

---

### Task 1: Nucleo compartido y escritura de pacientes

**Files:**
- Modify: `src/modules/solicitudes/actions/usuarioUpdate.ts:1-75`
- Modify: `src/modules/solicitudes/actions/guardarUsuario.action.ts:1-39`
- Modify: `src/modules/comunicador/actions/actualizarUsuarioComunicador.action.ts:1-13`
- Modify: `src/modules/solicitudes/actions/guardarUsuario.action.test.ts`
- Modify: `src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`
- Modify: `src/modules/comunicador/hooks/useUsuarioEdit.ts`
- Create: `src/modules/comunicador/hooks/useUsuarioEdit.test.tsx`

**Interfaces:**
- Consumes: `ResultadoAccion<T>` de `@/shared/types/resultado` y `UsuarioSolicitudInput` actual.
- Produces: `export type UsuarioGuardado = Prisma.UsuarioGetPayload<{ select: typeof USUARIO_SELECT }>`; `validarCentro(centroId: string): Promise<ResultadoAccion<null>>`; `persistirActualizacionUsuario(actor: ActorAuditoria, input: UsuarioSolicitudInput, origen: string): Promise<ResultadoAccion<{ usuario: UsuarioGuardado }>>`; `crearUsuario`, `actualizarUsuario` y `actualizarUsuarioComunicador` exponen el mismo resultado.

- [ ] **Step 1: Escribir pruebas fallidas de las actions y el nucleo compartido**

Agregar casos con estas aserciones:

```ts
expect(await crearUsuario(inputValido)).toEqual({ ok: false, error: "Centro no encontrado" });
expect(await crearUsuario(inputValido)).toEqual({ ok: false, error: "El usuario ya existe" });
expect(await actualizarUsuario(inputValido)).toEqual({ ok: false, error: "Centro no encontrado" });
expect(await actualizarUsuarioComunicador(inputValido)).toEqual({ ok: false, error: "Centro no encontrado" });
```

Para cada rechazo, afirmar que `prisma.usuario.create/update` y `AuditLogger.logDataAccess` no fueron llamados. Actualizar los casos exitosos para esperar `{ ok: true, data: { usuario } }`. Mantener casos donde permiso, Zod y Prisma usan `rejects`.

- [ ] **Step 2: Ejecutar las pruebas de actions y comprobar el fallo esperado**

Run: `npm test -- src/modules/solicitudes/actions/guardarUsuario.action.test.ts src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts`

Expected: FAIL porque las funciones aun devuelven el payload desnudo o lanzan `Error`.

- [ ] **Step 3: Implementar el contrato del nucleo y las tres actions publicas**

En `usuarioUpdate.ts`, exportar un alias `UsuarioGuardado` basado en el select actual y hacer que `validarCentro` devuelva `{ ok: true, data: null }` o `{ ok: false, error: "Centro no encontrado" }`. `persistirActualizacionUsuario` hace parse Zod, inspecciona el resultado del centro y solo entonces actualiza/audita.

En `guardarUsuario.action.ts`, envolver creacion y actualizacion en `ResultadoAccion<{ usuario: UsuarioGuardado }>`; el duplicado devuelve el texto existente. En comunicador, declarar el mismo tipo de retorno y devolver directamente el resultado compartido.

- [ ] **Step 4: Ejecutar las pruebas de actions y comprobar que pasan**

Run: `npm test -- src/modules/solicitudes/actions/guardarUsuario.action.test.ts src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts`

Expected: PASS.

- [ ] **Step 5: Escribir pruebas fallidas de los tres consumidores**

En ingreso y revision, mockear `actualizarUsuario`/`crearUsuario` con `{ ok: false, error: "Centro no encontrado" }`; afirmar toast de error, modal/formulario abierto, valores conservados y ausencia de toast de exito o recarga. En `useUsuarioEdit.test.tsx`, probar tanto `getUsuarioParaEdicion` exitoso segun su contrato actual como `actualizarUsuarioComunicador` fallido, con las mismas aserciones de no cierre/no callback.

- [ ] **Step 6: Ejecutar las pruebas de UI y comprobar el fallo esperado**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/comunicador/hooks/useUsuarioEdit.test.tsx`

Expected: FAIL porque los consumidores no discriminan `res.ok`.

- [ ] **Step 7: Adaptar consumidores sin cambiar su UX exitosa**

Inspeccionar el resultado antes de toast, cierre, callback o recarga. Los `catch` muestran el copy tecnico existente o uno generico estable, no `err.message` como canal de negocio.

- [ ] **Step 8: Ejecutar la verificacion enfocada de la tarea**

Run: `npm test -- src/modules/solicitudes/actions/guardarUsuario.action.test.ts src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/comunicador/hooks/useUsuarioEdit.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/solicitudes/actions/usuarioUpdate.ts src/modules/solicitudes/actions/guardarUsuario.action.ts src/modules/comunicador/actions/actualizarUsuarioComunicador.action.ts src/modules/solicitudes/actions/guardarUsuario.action.test.ts src/modules/comunicador/actions/actualizarUsuarioComunicador.action.test.ts src/modules/solicitudes/components/IngresarSolicitudView.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/comunicador/hooks/useUsuarioEdit.ts src/modules/comunicador/hooks/useUsuarioEdit.test.tsx
git commit -m "refactor: devolver resultados al guardar pacientes"
```

### Task 2: Lecturas del flujo de ingreso de solicitudes

**Files:**
- Modify: `src/modules/solicitudes/actions/getUsuarioPorRut.action.ts`
- Modify: `src/modules/solicitudes/actions/getPendientes.action.ts`
- Create: `src/modules/solicitudes/actions/getUsuarioPorRut.action.test.ts`
- Modify: `src/modules/solicitudes/actions/getPendientes.action.test.ts`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx`
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

**Interfaces:**
- Consumes: `ResultadoAccion<T>` y los tipos de paciente/pendientes inferidos de los selects actuales.
- Produces: `getUsuarioPorRut(rut): Promise<ResultadoAccion<{ usuario: UsuarioEncontrado | null }>>`; `getPendientes(rut): Promise<ResultadoAccion<PendientesPaciente>>`, donde `PendientesPaciente` conserva `solicitudesPendientes` y `citasPendientes`.

- [ ] **Step 1: Escribir pruebas fallidas de lectura**

Cubrir RUT requerido e invalido en `getUsuarioPorRut`, RUT requerido en `getPendientes`, paciente inexistente exitoso y pendientes vacios exitosos. Afirmar objetos discriminados exactos y mantener `rejects` para permiso y Prisma.

- [ ] **Step 2: Ejecutar pruebas y comprobar el fallo esperado**

Run: `npm test -- src/modules/solicitudes/actions/getUsuarioPorRut.action.test.ts src/modules/solicitudes/actions/getPendientes.action.test.ts`

Expected: FAIL por los contratos actuales.

- [ ] **Step 3: Implementar ambos resultados de lectura**

Agregar tipos de payload exportados solo donde los consumidores los necesiten. Envolver exitos en `{ ok: true, data }` y convertir unicamente las validaciones manuales inventariadas.

- [ ] **Step 4: Ejecutar pruebas de actions y comprobar que pasan**

Run: `npm test -- src/modules/solicitudes/actions/getUsuarioPorRut.action.test.ts src/modules/solicitudes/actions/getPendientes.action.test.ts`

Expected: PASS.

- [ ] **Step 5: Escribir pruebas fallidas de la carga paralela**

En `IngresarSolicitudView.test.tsx`, cubrir fallo de cada action por separado: un solo toast con su mensaje, ningun paciente confirmado y ningun estado parcial. Actualizar mocks exitosos al nuevo contrato.

- [ ] **Step 6: Adaptar `IngresarSolicitudView`**

Esperar ambos resultados, validar primero `ok`, y solo despues asignar usuario y pendientes. En el refresco posterior a `crearSolicitud`, actualizar pendientes solo si `actualizados.ok`; un fallo de refresco no reemplaza el mensaje original de creacion.

- [ ] **Step 7: Ejecutar verificacion enfocada**

Run: `npm test -- src/modules/solicitudes/actions/getUsuarioPorRut.action.test.ts src/modules/solicitudes/actions/getPendientes.action.test.ts src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/solicitudes/actions/getUsuarioPorRut.action.ts src/modules/solicitudes/actions/getUsuarioPorRut.action.test.ts src/modules/solicitudes/actions/getPendientes.action.ts src/modules/solicitudes/actions/getPendientes.action.test.ts src/modules/solicitudes/components/IngresarSolicitudView.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx
git commit -m "refactor: devolver resultados al buscar pacientes"
```

### Task 3: Gestion integral de solicitudes

**Files:**
- Modify: `src/modules/solicitudes/actions/getSolicitudes.action.ts`
- Modify: `src/modules/solicitudes/actions/getOtrasSolicitudes.action.ts`
- Modify: `src/modules/solicitudes/actions/getRevisionCatalogos.action.ts`
- Modify: `src/modules/solicitudes/actions/gestionarSolicitud.action.ts`
- Modify: `src/modules/solicitudes/actions/getSolicitudes.action.test.ts`
- Modify: `src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts`
- Create: `src/modules/solicitudes/actions/getRevisionCatalogos.action.test.ts`
- Modify: `src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `ResultadoAccion<T>`, `GestionSolicitudResumen` y los filtros/esquemas actuales.
- Produces: las tres lecturas envuelven sin alterar sus payloads actuales; `gestionarSolicitud(input): Promise<ResultadoAccion<{ solicitud; citasCreadas: number; resumen: GestionSolicitudResumen }>>`.

- [ ] **Step 1: Escribir pruebas fallidas para las lecturas**

Para las tres actions, cubrir funcionario sin centro con el mensaje accionable. En `getOtrasSolicitudes`, cubrir tambien RUT requerido. Mantener casos de listas vacias como `{ ok: true, data }` y fallos Prisma como `rejects`.

- [ ] **Step 2: Escribir pruebas fallidas para `gestionarSolicitud`**

Convertir los casos existentes y agregar los faltantes: fecha invalida/fuera de rango, solicitud no pendiente o ajena, prestacion invalida y profesional de examenes inactivo. En cada uno afirmar `{ ok: false, error }`, cero `solicitud.update`, cero `cita.createMany` y cero auditoria exitosa. Agregar fallo Prisma que siga rechazando.

- [ ] **Step 3: Ejecutar pruebas de actions y comprobar el fallo esperado**

Run: `npm test -- src/modules/solicitudes/actions/getSolicitudes.action.test.ts src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts src/modules/solicitudes/actions/getRevisionCatalogos.action.test.ts src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts`

Expected: FAIL por lanzamientos y payloads desnudos.

- [ ] **Step 4: Implementar las lecturas con `ResultadoAccion`**

Cambiar los helpers locales de centro a `string | null`; la action convierte `null` al mensaje de soporte. Envolver los payloads actuales sin cambiar filtros, selects ni paginacion.

- [ ] **Step 5: Implementar la union transaccional de gestion**

Hacer que la validacion de fecha produzca un resultado explicito. El callback de `$transaction` retorna la primera falla antes de cualquier escritura de su rama o el payload exitoso; fuera de la transaccion, retornar la falla inmediatamente y auditar/envolver solo el exito.

- [ ] **Step 6: Ejecutar pruebas de actions y comprobar que pasan**

Run: `npm test -- src/modules/solicitudes/actions/getSolicitudes.action.test.ts src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts src/modules/solicitudes/actions/getRevisionCatalogos.action.test.ts src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts`

Expected: PASS.

- [ ] **Step 7: Escribir pruebas fallidas del consumidor**

Actualizar mocks exitosos y cubrir `ok: false` en carga de catalogos, listado, solicitudes relacionadas, rechazo y realizacion. Afirmar mensaje visible/toast, ausencia de actualizacion local o recarga y conservacion del modal/formulario en mutaciones.

- [ ] **Step 8: Adaptar `RevisarSolicitudesView`**

Reemplazar `.then(setCatalogos)` y todos los accesos directos por discriminacion explicita. No cerrar dialogos ni recargar ante resultados fallidos; mantener el flujo exitoso actual.

- [ ] **Step 9: Ejecutar verificacion enfocada**

Run: `npm test -- src/modules/solicitudes/actions/getSolicitudes.action.test.ts src/modules/solicitudes/actions/getOtrasSolicitudes.action.test.ts src/modules/solicitudes/actions/getRevisionCatalogos.action.test.ts src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/modules/solicitudes/actions src/modules/solicitudes/components/RevisarSolicitudesView.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
git commit -m "refactor: devolver resultados al gestionar solicitudes"
```

### Task 4: Lecturas y edicion en el comunicador

**Files:**
- Modify: `src/modules/comunicador/actions/getCitasPendientes.action.ts`
- Modify: `src/modules/comunicador/actions/getCitasPendientesPaciente.action.ts`
- Modify: `src/modules/comunicador/actions/getHistorialLlamadas.action.ts`
- Modify: `src/modules/comunicador/actions/getUsuarioParaEdicion.action.ts`
- Create: `src/modules/comunicador/actions/getCitasPendientes.action.test.ts`
- Modify: `src/modules/comunicador/actions/getCitasPendientesPaciente.action.test.ts`
- Modify: `src/modules/comunicador/actions/getHistorialLlamadas.action.test.ts`
- Create: `src/modules/comunicador/actions/getUsuarioParaEdicion.action.test.ts`
- Modify: `src/modules/comunicador/components/ComunicadorView.tsx`
- Modify: `src/modules/comunicador/components/OtrasCitasPacienteModal.tsx`
- Modify: `src/modules/comunicador/components/HistorialLlamadasModal.tsx`
- Modify: `src/modules/comunicador/hooks/useUsuarioEdit.ts`
- Create: `src/modules/comunicador/components/ComunicadorView.test.tsx`
- Create: `src/modules/comunicador/components/OtrasCitasPacienteModal.test.tsx`
- Create: `src/modules/comunicador/components/HistorialLlamadasModal.test.tsx`
- Modify: `src/modules/comunicador/hooks/useUsuarioEdit.test.tsx`

**Interfaces:**
- Consumes: `ResultadoAccion<T>` y los tipos `CitaFila`, `CitaPacienteFila`, `HistorialLlamada`, `UsuarioEditable` actuales.
- Produces: cada action envuelve exactamente su payload actual en `ResultadoAccion`; `getUsuarioParaEdicion` conserva `usuario: null` como exito.

- [ ] **Step 1: Escribir pruebas fallidas de las cuatro lecturas**

Cubrir falta de centro en las tres actions que lo requieren, cita inexistente/ajena en historial y RUT requerido/invalido en edicion. Cubrir listas vacias y paciente inexistente como exitos, ademas de permiso/Prisma con `rejects`.

- [ ] **Step 2: Ejecutar pruebas de actions y comprobar el fallo esperado**

Run: `npm test -- src/modules/comunicador/actions/getCitasPendientes.action.test.ts src/modules/comunicador/actions/getCitasPendientesPaciente.action.test.ts src/modules/comunicador/actions/getHistorialLlamadas.action.test.ts src/modules/comunicador/actions/getUsuarioParaEdicion.action.test.ts`

Expected: FAIL por los contratos actuales.

- [ ] **Step 3: Implementar los cuatro contratos**

Usar el mensaje de soporte para falta de centro, preservar los mensajes de cita/RUT y envolver todos los exitos. No capturar consultas fallidas.

- [ ] **Step 4: Ejecutar pruebas de actions y comprobar que pasan**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Escribir pruebas fallidas de consumidores**

En `ComunicadorView`, probar error de listado sin reemplazar la tabla por un exito vacio. En ambos modales, mockear `ok: false`, afirmar toast y ausencia de render de datos. En `useUsuarioEdit`, actualizar el mock de apertura al nuevo contrato y cubrir error sin abrir el modal.

- [ ] **Step 6: Adaptar consumidores de lectura**

Inspeccionar `res.ok` en cada carga. Reemplazar `.then(setCitas)` y `.then(setLlamadas)` por handlers que desempaquetan `data`; mantener cancelacion por desmontaje y estados de carga actuales.

- [ ] **Step 7: Ejecutar verificacion enfocada**

Run: `npm test -- src/modules/comunicador/actions/getCitasPendientes.action.test.ts src/modules/comunicador/actions/getCitasPendientesPaciente.action.test.ts src/modules/comunicador/actions/getHistorialLlamadas.action.test.ts src/modules/comunicador/actions/getUsuarioParaEdicion.action.test.ts src/modules/comunicador/components/ComunicadorView.test.tsx src/modules/comunicador/components/OtrasCitasPacienteModal.test.tsx src/modules/comunicador/components/HistorialLlamadasModal.test.tsx src/modules/comunicador/hooks/useUsuarioEdit.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/comunicador/actions src/modules/comunicador/components src/modules/comunicador/hooks
git commit -m "refactor: devolver resultados en lecturas del comunicador"
```

### Task 5: Registro transaccional de llamadas

**Files:**
- Modify: `src/modules/comunicador/actions/registrarLlamada.action.ts`
- Modify: `src/modules/comunicador/actions/registrarLlamada.action.test.ts`
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`
- Create: `src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`

**Interfaces:**
- Consumes: `ResultadoAccion<T>` y `RegistrarLlamadaInput` actual.
- Produces: `registrarLlamada(input): Promise<ResultadoAccion<{ estadoCita: string; solicitudRealizada: boolean }>>`.

- [ ] **Step 1: Escribir pruebas fallidas de la transaccion**

Convertir los tests de cita inexistente/ajena y agregar cita cerrada. Afirmar `{ ok: false, error }`, `llamada.create` no llamado, `cita.update` no llamado, `solicitud.update` no llamado y auditoria exitosa no llamada. Actualizar exitos y mantener permiso, Zod y Prisma como `rejects`.

- [ ] **Step 2: Ejecutar la prueba y comprobar el fallo esperado**

Run: `npm test -- src/modules/comunicador/actions/registrarLlamada.action.test.ts`

Expected: FAIL porque la transaccion lanza errores de negocio.

- [ ] **Step 3: Implementar la union transaccional**

Mantener `SELECT ... FOR UPDATE`. Hacer que el callback retorne la primera falla antes de cualquier escritura o `{ ok: true, data }`; fuera de la transaccion, auditar solo el exito y retornar el resultado discriminado.

- [ ] **Step 4: Ejecutar la prueba de action y comprobar que pasa**

Run: `npm test -- src/modules/comunicador/actions/registrarLlamada.action.test.ts`

Expected: PASS.

- [ ] **Step 5: Escribir prueba fallida del modal**

Mockear `{ ok: false, error: "La cita ya está cerrada" }`; afirmar toast, modal visible y `onRegistrado` no llamado. Actualizar el caso exitoso para leer `res.data`.

- [ ] **Step 6: Adaptar `RegistrarLlamadaModal`**

Retornar temprano ante `!res.ok`; solo construir el mensaje y llamar `onRegistrado` con `res.data`.

- [ ] **Step 7: Ejecutar verificacion enfocada**

Run: `npm test -- src/modules/comunicador/actions/registrarLlamada.action.test.ts src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/comunicador/actions/registrarLlamada.action.ts src/modules/comunicador/actions/registrarLlamada.action.test.ts src/modules/comunicador/components/RegistrarLlamadaModal.tsx src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx
git commit -m "refactor: devolver resultados al registrar llamadas"
```

### Task 6: Catalogos de configuracion

**Files:**
- Modify: `src/modules/configuracion/actions/mantenedores.action.ts:140-186,237-275`
- Modify: `src/modules/configuracion/actions/mantenedores.action.test.ts`
- Modify: `src/modules/configuracion/components/UsuariosRolesView.tsx`
- Modify: `src/modules/configuracion/components/UsuariosRolesView.test.tsx`

**Interfaces:**
- Consumes: `ResultadoAccion<T>` y schemas/entidades Prisma actuales.
- Produces: `guardarTipoSolicitud`, `guardarMotivo`, `guardarProfesional` y `guardarPrestacion` devuelven `Promise<ResultadoAccion<EntidadGuardada>>`.

- [ ] **Step 1: Escribir pruebas fallidas de las cuatro actions**

Convertir y completar los seis errores inventariados: tipo duplicado; tipo padre inexistente; motivo duplicado; profesional duplicado; profesional padre inexistente; prestacion duplicada. Afirmar resultado exacto, cero escritura y cero auditoria exitosa. Actualizar exitos y mantener Zod/Prisma con `rejects`.

- [ ] **Step 2: Ejecutar pruebas de action y comprobar el fallo esperado**

Run: `npm test -- src/modules/configuracion/actions/mantenedores.action.test.ts`

Expected: FAIL por lanzamientos y payloads desnudos.

- [ ] **Step 3: Implementar los contratos de catalogos**

Agregar tipos de retorno explicitos, reemplazar los seis lanzamientos por retornos fallidos y envolver las entidades guardadas en exito. No modificar las tres actions RBAC ya migradas.

- [ ] **Step 4: Ejecutar pruebas de action y comprobar que pasan**

Run: `npm test -- src/modules/configuracion/actions/mantenedores.action.test.ts`

Expected: PASS.

- [ ] **Step 5: Escribir pruebas fallidas de formularios y toggles**

Ampliar `UsuariosRolesView.test.tsx` para un submit y un toggle de cada familia. Ante `ok: false`, afirmar toast exacto, formulario abierto, ausencia de toast de exito y que `getMantenedoresConfig` no se vuelve a llamar. Actualizar mocks exitosos al contrato discriminado.

- [ ] **Step 6: Adaptar todos los puntos de llamada**

Crear handlers asincronos claros para los cuatro toggles en vez de `.then(() => loadData())`. En submits y toggles, retornar ante error y ejecutar cierre/limpieza/recarga solo con exito.

- [ ] **Step 7: Ejecutar verificacion enfocada**

Run: `npm test -- src/modules/configuracion/actions/mantenedores.action.test.ts src/modules/configuracion/components/UsuariosRolesView.test.tsx src/modules/configuracion/components/PermisosRolModal.test.tsx`

Expected: PASS, incluida la regresion de actions RBAC.

- [ ] **Step 8: Commit**

```bash
git add src/modules/configuracion/actions/mantenedores.action.ts src/modules/configuracion/actions/mantenedores.action.test.ts src/modules/configuracion/components/UsuariosRolesView.tsx src/modules/configuracion/components/UsuariosRolesView.test.tsx
git commit -m "refactor: devolver resultados al guardar catalogos"
```

### Task 7: Panel SOME

**Files:**
- Modify: `src/modules/some/actions/getSomePanel.action.ts`
- Modify: `src/modules/some/actions/getSomePanel.action.test.ts`
- Modify: `src/modules/some/components/SomeView.tsx`
- Create: `src/modules/some/components/SomeView.test.tsx`

**Interfaces:**
- Consumes: `ResultadoAccion<T>` y `SomePanelData` actual.
- Produces: `getSomePanel(input?): Promise<ResultadoAccion<SomePanelData>>`.

- [ ] **Step 1: Escribir pruebas fallidas de la action**

Agregar ausencia de centro como `{ ok: false, error: "No hay centro disponible para consultar productividad SOME" }`; actualizar todos los casos exitosos a `result.ok === true` y `result.data`. Mantener permiso, Zod y Prisma como `rejects`, y cubrir panel valido sin actividad como exito.

- [ ] **Step 2: Ejecutar prueba de action y comprobar el fallo esperado**

Run: `npm test -- src/modules/some/actions/getSomePanel.action.test.ts`

Expected: FAIL por el lanzamiento y payload desnudo.

- [ ] **Step 3: Implementar el contrato del panel**

Retornar la falla antes de consultas dependientes del centro y envolver el payload final sin cambiar calculos, filtros ni metricas.

- [ ] **Step 4: Escribir prueba fallida del consumidor**

En `SomeView.test.tsx`, mockear el resultado fallido y afirmar mensaje visible/toast y ausencia de datos presentados como si fueran un panel vacio. Agregar caso exitoso con `data`.

- [ ] **Step 5: Adaptar `SomeView`**

Inspeccionar `res.ok` antes de actualizar el panel; conservar filtros y datos previos ante falla y mostrar el mensaje.

- [ ] **Step 6: Ejecutar verificacion enfocada**

Run: `npm test -- src/modules/some/actions/getSomePanel.action.test.ts src/modules/some/components/SomeView.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/some/actions/getSomePanel.action.ts src/modules/some/actions/getSomePanel.action.test.ts src/modules/some/components/SomeView.tsx src/modules/some/components/SomeView.test.tsx
git commit -m "refactor: devolver resultados al cargar panel SOME"
```

### Task 8: Salvaguarda estructural y verificacion integral

**Files:**
- Create: `src/modules/resultado-accion-por-action.test.ts`

**Interfaces:**
- Consumes: todos los contratos producidos en Tasks 1-7.
- Produces: una prueba estructural que impide reintroducir `throw new Error` en `src/modules/**/actions/*.action.ts`.

- [ ] **Step 1: Escribir la salvaguarda estructural**

Recorrer los archivos `*.action.ts` bajo `src/modules`, leerlos como texto y afirmar que ninguno contiene `throw new Error`. El mensaje de fallo debe listar rutas coincidentes para facilitar la correccion.

- [ ] **Step 2: Ejecutar la salvaguarda**

Run: `npm test -- src/modules/resultado-accion-por-action.test.ts`

Expected: PASS. Si falla, corregir el action propietario mediante el mismo limite negocio/sistema del spec y agregar su prueba de comportamiento antes de continuar.

- [ ] **Step 3: Auditar consumidores y contratos por busqueda**

Run: `rg -n "getUsuarioPorRut|getPendientes|getSolicitudes|getOtrasSolicitudes|getRevisionCatalogos|gestionarSolicitud|getCitasPendientes|getCitasPendientesPaciente|getHistorialLlamadas|getUsuarioParaEdicion|registrarLlamada|actualizarUsuarioComunicador|guardarTipoSolicitud|guardarMotivo|guardarProfesional|guardarPrestacion|getSomePanel" src -g "*.ts" -g "*.tsx"`

Expected: cada consumidor de ejecucion inspecciona `res.ok`; los usos solo de tipos y las pruebas estructurales quedan justificados por contexto.

- [ ] **Step 4: Ejecutar toda la suite**

Run: `npm test`

Expected: PASS, 0 tests fallidos.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`

Expected: exit 0, sin accesos directos a payloads ahora envueltos.

- [ ] **Step 6: Ejecutar lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 7: Confirmar ausencia de lanzamientos explicitos**

Run: `rg -n "throw new Error" src/modules -g "*.action.ts"`

Expected: sin coincidencias (exit 1 de `rg` por conjunto vacio).

- [ ] **Step 8: Revisar el diff final y el alcance**

Run: `git diff --check && git status --short`

Expected: sin errores de whitespace; solo archivos del plan y cualquier archivo local preexistente sin seguimiento permanece fuera de commits.

- [ ] **Step 9: Commit**

```bash
git add src/modules/resultado-accion-por-action.test.ts
git commit -m "test: impedir errores explicitos en server actions"
```

- [ ] **Step 10: Solicitar revision final de la rama**

Usar `superpowers:requesting-code-review` para verificar criterios del spec, contratos, consumidores omitidos y separacion entre errores de negocio y tecnicos antes de integrar.
