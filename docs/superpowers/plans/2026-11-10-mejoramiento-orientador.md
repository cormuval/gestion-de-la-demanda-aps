# Mejoramiento del orientador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir solicitudes activas multiples en los programas respiratorio y salud mental, y mostrar la edad o la falta de fecha de nacimiento en Crear Solicitud.

**Architecture:** Una funcion pura en la utilidad de duplicados identificara los dos tipos exceptuados por nombre normalizado y sera compartida por frontend y Server Action. El servidor seguira siendo la autoridad transaccional; la vista replicara la regla para feedback inmediato y reutilizara `calcularEdad` para presentar informacion derivada sin persistirla.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Prisma, Vitest y Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-mejoramiento-orientador-design.md`

## Global Constraints

- La excepcion se limita a `Control cronico respiratorio` y `Control de salud mental`, comparados por nombre completo normalizado.
- La normalizacion ignora mayusculas, minusculas, tildes y espacios laterales; no admite coincidencias parciales.
- La excepcion aplica a cualquier motivo y tambien permite repetir el mismo motivo.
- Los demas tipos conservan el bloqueo por paciente, tipo, motivo y `estado_solicitud = "En Curso"`.
- La Server Action conserva permiso, centro, catalogos activos, transaccion, bloqueo de paciente y auditoria.
- La edad se calcula solamente en el frontend desde `fecha_nacimiento`; no se persiste ni requiere cambios Prisma.
- Sin fecha valida se muestra exactamente `Falta fecha de nacimiento` y no se bloquea el ingreso.
- No agregar dependencias, permisos, migraciones ni cambios de catalogo.

## Review Focus

- Un nombre con tildes y capitalizacion distintas debe reconocer unicamente los dos programas autorizados; Task 1 lo fija con pruebas de normalizacion.
- Un nombre que solo contiene `respiratorio` o `salud mental` no debe quedar exceptuado; Task 1 prueba coincidencias parciales.
- Una invocacion directa a la Server Action no debe recuperar el bloqueo que la interfaz omite; Task 2 prueba que no se consulta el duplicado y que si se crea.
- Cambiar desde un programa exceptuado a otro no exceptuado debe restaurar inmediatamente la alerta; Task 3 prueba ambos estados en el mismo render.
- Una fecha invalida debe usar el mismo mensaje que una fecha ausente sin producir `NaN`; Task 4 prueba ambos casos.

---

### Task 1: Regla compartida de programas con solicitudes multiples

**Files:**
- Modify: `src/modules/solicitudes/utils/duplicados.ts`
- Test: `src/modules/solicitudes/utils/duplicados.test.ts`

**Interfaces:**
- Consumes: nombres de `TipoSolicitudCatalogo.nombre_tipo_solicitud` o de la consulta Prisma.
- Produces: `permiteSolicitudesActivasMultiples(nombreTipoSolicitud: string): boolean`.

- [ ] **Step 1: Escribir pruebas fallidas para los nombres autorizados**

Agregar un `describe("permiteSolicitudesActivasMultiples")` que afirme `true` para:

```ts
expect(permiteSolicitudesActivasMultiples("Control cronico respiratorio")).toBe(true);
expect(permiteSolicitudesActivasMultiples("CONTROL CRÓNICO RESPIRATORIO")).toBe(true);
expect(permiteSolicitudesActivasMultiples("  Control de salud mental  ")).toBe(true);
```

- [ ] **Step 2: Escribir pruebas fallidas para nombres no autorizados**

En el mismo bloque afirmar `false` para `Programa respiratorio`, `Control salud mental`, `Respiratorio` y cadena vacia. Conservar las pruebas actuales de coincidencia por tipo y motivo.

- [ ] **Step 3: Ejecutar la prueba y confirmar RED**

Run: `npm test -- src/modules/solicitudes/utils/duplicados.test.ts`  
Expected: FAIL porque `permiteSolicitudesActivasMultiples` no esta exportada.

- [ ] **Step 4: Implementar la funcion pura**

En `duplicados.ts`, exportar exactamente:

```ts
export function permiteSolicitudesActivasMultiples(nombreTipoSolicitud: string): boolean
```

Normalizar con `trim()`, `toLocaleLowerCase("es-CL")`, `normalize("NFD")` y eliminacion de marcas diacriticas. Comparar por igualdad contra un `Set` privado con los dos nombres normalizados; no modificar `buscarSolicitudDuplicada` ni `mensajeSolicitudDuplicada`.

- [ ] **Step 5: Ejecutar la prueba y confirmar GREEN**

Run: `npm test -- src/modules/solicitudes/utils/duplicados.test.ts`  
Expected: PASS en todos los casos nuevos y existentes.

- [ ] **Step 6: Commit**

```bash
git add src/modules/solicitudes/utils/duplicados.ts src/modules/solicitudes/utils/duplicados.test.ts
git commit -m "feat: definir programas con solicitudes multiples"
```

### Task 2: Autoridad del servidor para la excepcion de duplicados

**Files:**
- Modify: `src/modules/solicitudes/actions/crearSolicitud.action.ts:100-140`
- Test: `src/modules/solicitudes/actions/crearSolicitud.action.test.ts`

**Interfaces:**
- Consumes: `permiteSolicitudesActivasMultiples(nombreTipoSolicitud: string): boolean` de Task 1.
- Produces: `crearSolicitud` crea solicitudes repetidas solo para los dos tipos exceptuados y conserva el rechazo actual para el resto.

- [ ] **Step 1: Actualizar el dato base de las pruebas**

Hacer que el mock por defecto de `prisma.tipoSolicitud.findFirst` incluya `nombre_tipo_solicitud: "Atencion"`. Este ajuste pertenece al contrato que la accion necesitara y no cambia el comportamiento esperado existente.

- [ ] **Step 2: Escribir pruebas fallidas para ambos programas exceptuados**

Agregar casos parametrizados para `Control cronico respiratorio` y `Control de salud mental`. En cada caso:

- el tipo valido retorna `{ id_tipo_solicitud: 1, nombre_tipo_solicitud: nombre }`;
- el usuario y `tx.solicitud.create` retornan datos validos siguiendo los fixtures existentes;
- `tx.solicitud.findFirst` queda configurado con una solicitud coincidente, para demostrar que no debe consultarse;
- el resultado tiene `ok === true`;
- `tx.solicitud.findFirst` no fue llamado;
- `tx.solicitud.create` fue llamado una vez.

- [ ] **Step 3: Escribir la prueba de regresion para otro programa**

Extender el caso existente `rechaza duplicado en curso con mismo usuario, tipo y motivo` para usar `nombre_tipo_solicitud: "Control cronico cardiovascular"` y conservar estas afirmaciones: consulta exacta por RUT/tipo/motivo/estado, resultado `ok: false` y ausencia de `create`.

- [ ] **Step 4: Ejecutar las pruebas y confirmar RED**

Run: `npm test -- src/modules/solicitudes/actions/crearSolicitud.action.test.ts`  
Expected: FAIL en los tipos exceptuados porque la accion aun consulta y bloquea el duplicado.

- [ ] **Step 5: Implementar la seleccion y bifurcacion de servidor**

En `crearSolicitud.action.ts`:

- importar la funcion producida por Task 1;
- ampliar el `select` del tipo a `{ id_tipo_solicitud: true, nombre_tipo_solicitud: true }`;
- despues del bloqueo `FOR UPDATE`, asignar `duplicada` a `null` cuando el nombre permita multiples;
- en otro caso, ejecutar sin cambios el `tx.solicitud.findFirst` actual.

No mover la creacion fuera de la transaccion ni modificar los mensajes o la auditoria.

- [ ] **Step 6: Ejecutar pruebas de accion y utilidad**

Run: `npm test -- src/modules/solicitudes/actions/crearSolicitud.action.test.ts src/modules/solicitudes/utils/duplicados.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/solicitudes/actions/crearSolicitud.action.ts src/modules/solicitudes/actions/crearSolicitud.action.test.ts
git commit -m "feat: permitir solicitudes multiples por programa"
```

### Task 3: Feedback de duplicidad coherente en Crear Solicitud

**Files:**
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx:163-176`
- Test: `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx:439-462`

**Interfaces:**
- Consumes: `permiteSolicitudesActivasMultiples(nombreTipoSolicitud: string): boolean` de Task 1 y `Catalogos.tiposSolicitud` ya cargado.
- Produces: `solicitudDuplicada` es `null` para los dos programas y conserva la busqueda exacta para los demas.

- [ ] **Step 1: Escribir prueba fallida para Control cronico respiratorio**

Configurar `getCatalogos` con tipo `1` llamado `Control cronico respiratorio`, mantener el pendiente coincidente de tipo `1` y motivo `10`, buscar al paciente y completar el formulario. Afirmar que no aparece `Solicitud duplicada` y que **Guardar solicitud** esta habilitado.

- [ ] **Step 2: Escribir prueba fallida para Control de salud mental**

Repetir el caso con nombre `Control de salud mental` y un pendiente coincidente. Afirmar ausencia de alerta y boton habilitado, demostrando que el motivo no altera la excepcion.

- [ ] **Step 3: Escribir prueba de cambio hacia un programa no exceptuado**

En un solo render, cargar un tipo respiratorio y otro `Atencion`, ambos con pendientes coincidentes. Seleccionar respiratorio y confirmar boton habilitado; luego seleccionar `Atencion`, elegir su motivo y confirmar alerta visible y boton deshabilitado.

- [ ] **Step 4: Ejecutar la prueba y confirmar RED**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`  
Expected: FAIL porque la vista aun aplica `buscarSolicitudDuplicada` a los tipos exceptuados.

- [ ] **Step 5: Implementar la bifurcacion en el `useMemo`**

Importar la funcion de Task 1. Dentro de `solicitudDuplicada`, resolver el tipo seleccionado desde `catalogos.tiposSolicitud`; si su nombre permite multiples, retornar `null` antes de buscar el pendiente. Agregar `catalogos.tiposSolicitud` a las dependencias del `useMemo` y conservar las condiciones actuales de tipo/motivo incompletos.

- [ ] **Step 6: Ejecutar la prueba del componente y confirmar GREEN**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`  
Expected: PASS, incluidos los casos previos de duplicados.

- [ ] **Step 7: Commit**

```bash
git add src/modules/solicitudes/components/IngresarSolicitudView.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx
git commit -m "feat: habilitar programas exceptuados en crear solicitud"
```

### Task 4: Edad en el resumen del paciente

**Files:**
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx:540-590`
- Test: `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

**Interfaces:**
- Consumes: `calcularEdad(fechaNacimiento: Date | string | null, fechaReferencia?: Date): number | null` de `src/modules/solicitudes/utils/priorizacion.ts`.
- Produces: `UsuarioStatus` muestra `Edad: N años` o exactamente `Falta fecha de nacimiento`.

- [ ] **Step 1: Escribir prueba fallida para edad cumplida**

Usar `vi.useFakeTimers()` y `vi.setSystemTime(new Date("2026-11-10T12:00:00"))`; devolver un usuario nacido el `1990-01-01` y afirmar que el resumen contiene `Edad:` y `36 años`. Restaurar temporizadores reales al finalizar para no contaminar otras pruebas.

- [ ] **Step 2: Escribir prueba fallida para cumpleaños pendiente**

Con la misma fecha del sistema, devolver nacimiento `1990-12-01` y afirmar `35 años`.

- [ ] **Step 3: Escribir pruebas fallidas para fecha ausente e invalida**

Probar separadamente `fecha_nacimiento: null` y `fecha_nacimiento: "fecha-invalida"`. En ambos casos afirmar el texto exacto `Falta fecha de nacimiento`, ausencia de un valor `NaN años` y disponibilidad del boton **Editar usuario**.

- [ ] **Step 4: Ejecutar la prueba y confirmar RED**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`  
Expected: FAIL porque `UsuarioStatus` aun no renderiza edad ni el mensaje de ausencia.

- [ ] **Step 5: Implementar la edad en `UsuarioStatus`**

Importar `calcularEdad`, calcularla desde `usuario.fecha_nacimiento` despues de confirmar que existe usuario y agregar un elemento al grid del resumen:

- edad no nula: etiqueta `Edad:` seguida por `${edad} años`;
- edad nula: texto exacto `Falta fecha de nacimiento`.

No agregar estado, efectos, consultas ni persistencia.

- [ ] **Step 6: Ejecutar pruebas focalizadas y confirmar GREEN**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/utils/priorizacion.test.ts`  
Expected: PASS.

- [ ] **Step 7: Ejecutar verificacion completa**

Run: `npm test`  
Expected: toda la suite PASS.

Run: `npm run lint`  
Expected: exit code 0 sin errores.

Run: `npm run build`  
Expected: compilacion de produccion exit code 0.

- [ ] **Step 8: Commit**

```bash
git add src/modules/solicitudes/components/IngresarSolicitudView.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx
git commit -m "feat: mostrar edad al crear solicitudes"
```
