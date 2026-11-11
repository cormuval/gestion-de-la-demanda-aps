# Cierre administrativo y edicion separada de citas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renombrar el cierre administrativo de citas, darle jerarquia visual primaria y dividir la edicion de prioridad y fecha estimada en dos modales independientes.

**Architecture:** Mantener `registrarLlamada` y `editarCita` como contratos backend unicos. El modo Gestion de `RegistrarLlamadaModal` cambia solo su presentacion; la edicion se separa en dos componentes publicos que comparten una base interna de guardado y envian el valor vigente del campo no visible.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Zod, shadcn/ui, sonner, Vitest y Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-mejoramiento-gestor-solicitudes-design.md`

## Global Constraints

- Trabajar en la rama existente `mejoramiento_gestor_solicitudes`.
- El boton se llama exactamente **Cerrar cita** y usa la variante primaria de `Button`, igual a **Llamar**.
- El modal se llama exactamente **Cierre administrativo de cita**.
- El unico control editable del cierre es **Motivo del cierre**, opcional y con maximo 350 caracteres.
- El modo Comunicador conserva **Registrar llamada**, su selector y su comportamiento actual.
- Una cita editable muestra **Editar prioridad** y **Editar fecha estimada**; no muestra el boton generico **Editar**.
- Cada modal de edicion muestra exclusivamente el campo que modifica.
- Ambos modales conservan la elegibilidad actual: `Sin llamadas` y cero llamadas registradas.
- Se reutiliza `editarCita`; el campo no visible se envia con su valor vigente sin mostrarse.
- No hay cambios de schema, migraciones, permisos ni reglas de concurrencia.
- UI con componentes shadcn, `FieldGroup`/`Field`, `gap-*`, variantes existentes e iconos con `data-icon`.

## Review Focus

- El modo Comunicador no debe adoptar el copy de cierre administrativo; Task 1 agrega una prueba explicita por modo.
- El boton primario no debe depender de clases de color manuales; Task 1 comprueba la variante/render compartido con `Button` default.
- Editar prioridad no debe alterar una fecha vigente ni mostrarla; Task 2 verifica payload y DOM.
- Editar fecha no debe alterar prioridad ni mostrarla; Task 2 verifica payload y DOM.
- Una cita que deja de ser editable durante el modal debe conservar el error/recarga actual; Task 2 prueba el resultado `ok: false` en ambos dialogos.

---

### Task 1: Presentacion de cierre administrativo

**Files:**
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`
- Modify: `src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `RegistrarLlamadaModalProps.modo`, `ORIGEN_LLAMADA.GESTION_SOLICITUDES`, `puedeRegistrarRechazo`.
- Produces: presentacion condicional por modo; el contrato de props y la action permanecen sin cambios.

- [ ] **Step 1: Escribir pruebas fallidas del modal por modo**

Agregar casos que esperen en `gestion_solicitudes`: dialog `Cierre administrativo de cita`, campo `Motivo del cierre`, boton submit `Cerrar cita`, ausencia de `Registrar llamada` como titulo/submit y payload backend sin cambios. Mantener un caso que espere `Registrar llamada`, `Respuesta` y `Observacion` en modo Comunicador.

- [ ] **Step 2: Confirmar RED del modal**

Run: `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`

Expected: FAIL por los copys nuevos ausentes.

- [ ] **Step 3: Implementar copy condicional minimo**

Derivar titulo, etiqueta del textarea y texto del submit desde `modo`; no cambiar validacion, origen, respuesta, contador ni callbacks.

- [ ] **Step 4: Confirmar GREEN del modal**

Run: `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx`

Expected: PASS en ambos modos.

- [ ] **Step 5: Escribir pruebas fallidas del boton contextual**

En `RevisarSolicitudesView.test.tsx`, esperar boton `Cerrar cita`, ausencia de `Registrar llamada`, apertura del dialog `Cierre administrativo de cita` y las clases de la variante default (`bg-primary`, sin `border-input`). Preservar la ausencia de accion cuando `puedeRegistrarRechazo` es falso.

- [ ] **Step 6: Confirmar RED de la vista**

Run: `npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

Expected: FAIL por copy y variante actuales.

- [ ] **Step 7: Renombrar y aplicar variante primaria**

Cambiar el boton contextual a `Cerrar cita` y quitar `variant="outline"`; conservar `size="sm"`, icono y callback.

- [ ] **Step 8: Verificar componentes relacionados**

Run: `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/comunicador/components/CitasPendientesTabla.test.tsx`

Expected: PASS y **Llamar** permanece sin cambios.

- [ ] **Step 9: Commit**

```bash
git add src/modules/comunicador/components/RegistrarLlamadaModal.tsx src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
git commit -m "feat: presentar cierre administrativo de cita"
```

### Task 2: Modales independientes de prioridad y fecha

**Files:**
- Create: `src/modules/solicitudes/components/EditarPrioridadCitaDialog.tsx`
- Create: `src/modules/solicitudes/components/EditarPrioridadCitaDialog.test.tsx`
- Create: `src/modules/solicitudes/components/EditarFechaEstimadaCitaDialog.tsx`
- Create: `src/modules/solicitudes/components/EditarFechaEstimadaCitaDialog.test.tsx`
- Modify or replace: `src/modules/solicitudes/components/EditarCitaDialog.tsx`
- Remove after replacement: `src/modules/solicitudes/components/EditarCitaDialog.test.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `editarCita(input)`, `CitaCascadaConEdicion`, `PRIORIDADES_CLINICAS`.
- Produces: `EditarPrioridadCitaDialogProps` y `EditarFechaEstimadaCitaDialogProps`, ambos con `{ cita; open; onOpenChange; onActualizada }`; base interna no exportada para ejecutar guardado/error/recarga sin duplicacion.

- [ ] **Step 1: Escribir pruebas fallidas de prioridad**

Probar que `EditarPrioridadCitaDialog` muestra solo `Prioridad clinica`, no muestra `Fecha estimada`, precarga el valor, y envia `{ id_cita, priorizacion_clinica: valorNuevo, fecha_estimada_atencion: fechaVigente }`. En `ok: false`, muestra error, mantiene abierto y llama `onActualizada`.

- [ ] **Step 2: Confirmar RED de prioridad**

Run: `npm test -- src/modules/solicitudes/components/EditarPrioridadCitaDialog.test.tsx`

Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Implementar dialog de prioridad y base compartida minima**

Crear el componente con `Dialog`, `FieldGroup`/`Field`, `Select`, botones Cancelar/Guardar e icono con `data-icon`. Validar prioridad; tomar la fecha vigente con la misma conversion local del componente actual. La base interna concentra llamada, toast, cierre y recarga.

- [ ] **Step 4: Confirmar GREEN de prioridad**

Run: `npm test -- src/modules/solicitudes/components/EditarPrioridadCitaDialog.test.tsx`

Expected: PASS.

- [ ] **Step 5: Escribir pruebas fallidas de fecha**

Probar que `EditarFechaEstimadaCitaDialog` muestra solo `Fecha estimada`, no muestra `Prioridad clinica`, precarga fecha, conserva min hoy/max dos anos y envia `{ id_cita, priorizacion_clinica: prioridadVigente, fecha_estimada_atencion: valorNuevo }`. En `ok: false`, muestra error, mantiene abierto y llama `onActualizada`.

- [ ] **Step 6: Confirmar RED de fecha**

Run: `npm test -- src/modules/solicitudes/components/EditarFechaEstimadaCitaDialog.test.tsx`

Expected: FAIL porque el componente no existe.

- [ ] **Step 7: Implementar dialog de fecha reutilizando la base**

Crear el componente con `Input type="date"` y limites actuales. Validar que la prioridad vigente pertenece a `PRIORIDADES_CLINICAS` antes de enviar; si el dato vigente es invalido, mostrar error y no llamar la action.

- [ ] **Step 8: Confirmar GREEN de ambos dialogos**

Run: `npm test -- src/modules/solicitudes/components/EditarPrioridadCitaDialog.test.tsx src/modules/solicitudes/components/EditarFechaEstimadaCitaDialog.test.tsx`

Expected: PASS.

- [ ] **Step 9: Escribir pruebas fallidas de integracion**

En `RevisarSolicitudesView.test.tsx`, esperar dos botones solo para `cita.editable`: `Editar prioridad` y `Editar fecha estimada`; ausencia del boton accesible exacto `Editar`; cada boton abre su dialog correspondiente; guardar o conflicto recarga el contexto y cierra/mantiene segun el contrato actual.

- [ ] **Step 10: Confirmar RED de integracion**

Run: `npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

Expected: FAIL porque aun existe un unico boton/modal.

- [ ] **Step 11: Integrar estados y eliminar el modal conjunto**

Reemplazar `citaEditando` por `citaEditandoPrioridad` y `citaEditandoFecha`; incluir ambos en `hayModalAbierto`; pasar callbacks separados al modal contextual y renderizar los dos dialogos. Retirar imports/usos y test del modal conjunto; conservar una base interna enfocada, ya sea en `EditarCitaDialog.tsx` renombrada conceptualmente o en un archivo auxiliar del modulo.

- [ ] **Step 12: Verificar integracion y tipos**

Run: `npm test -- src/modules/solicitudes/components/EditarPrioridadCitaDialog.test.tsx src/modules/solicitudes/components/EditarFechaEstimadaCitaDialog.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/solicitudes/actions/editarCita.action.test.ts`

Run: `npx tsc --noEmit`

Expected: PASS y cero errores TypeScript.

- [ ] **Step 13: Commit**

```bash
git add src/modules/solicitudes/components
git commit -m "feat: separar edicion de prioridad y fecha"
```

### Task 3: Verificacion integral y revision

**Files:**
- Modify only if verification exposes a defect in files already listed by Tasks 1-2.

**Interfaces:**
- Consumes: todos los contratos producidos por Tasks 1-2.
- Produces: rama verificada contra el spec actualizado.

- [ ] **Step 1: Ejecutar suite activa completa**

Run: `npx vitest run --exclude ".worktrees/**"`

Expected: exit code 0.

- [ ] **Step 2: Verificar TypeScript y lint del arbol activo**

Run: `npx tsc --noEmit`

Run: `npx eslint src prisma/scripts`

Expected: cero errores.

- [ ] **Step 3: Ejecutar build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Auditar alcance**

Confirmar con `git diff` que no hay cambios backend, schema, permisos o migraciones; que Comunicador conserva su copy; y que cada modal de edicion contiene un solo control editable.

- [ ] **Step 5: Solicitar revision de codigo de rama completa**

Usar `superpowers:requesting-code-review` contra el commit anterior al plan incremental. Resolver hallazgos Critical/Important con una unica ola de fix y re-review acotada.
