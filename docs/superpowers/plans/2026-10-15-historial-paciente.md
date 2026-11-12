# Historial del paciente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de solo lectura "Historial del paciente" que, buscando por RUT, muestra todas las solicitudes del paciente en el centro del funcionario, con sus citas y llamadas, y el estado y la fecha de cierre de cada una.

**Architecture:** Un permiso nuevo `historial.ver`, asignado a todos los roles (seed + migración SQL), habilita la ruta `/historial` y su item del menú. Una Server Action del módulo `historial` hace una sola consulta anidada (solicitudes → citas → llamadas) filtrada por el centro de la sesión. Las fechas de cierre las calculan funciones puras, y una vista cliente muestra la cascada.

**Tech Stack:** Next.js 15 (App Router, Server Actions), React 19, Prisma 6 / MySQL 8.4, Zod, shadcn/ui, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-historial-paciente-design.md`

## Global Constraints

- Permiso: clave `"historial.ver"`, entrada `{ modulo: "Historial", etiqueta: "Ver historial del paciente" }`.
- Menú: `{ label: "Historial del paciente", href: "/historial", icon: History, permiso: "historial.ver" }`, inmediatamente después de "Llamadas".
- Alcance: solo solicitudes con `centro_id` = centro del funcionario en sesión. Sin límite de antigüedad. Solo lectura.
- La action devuelve `ResultadoAccion<T>` y nunca usa `throw new Error`; un guard de tests lo prohíbe en `*.action.ts`.
- Textos exactos:
  - `"RUT invalido"`
  - `"El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."`
  - `"Sin solicitudes en tu centro para este RUT"`
  - `"No fue posible cargar el historial"`
  - `"Buscando..."`
  - `` `Ver llamadas (${n})` ``
- Auditoría: `AuditLogger.logDataAccess("SEARCH", true, { rut, name }, "HISTORIAL_PACIENTE", { details: "rut=<rut>" })`.
- Convenciones: español, 4 espacios, imports categorizados (`// lib`, `// components`…), alias `@/`, componentes de `src/shared/components/ui`.

## Review Focus

1. **RUT con formato distinto** (puntos, sin guion, `k` minúscula): debe encontrar al mismo paciente. Test en la Task 3: `"12.345.678-5"` consulta por `"12345678-5"`.
2. **Paciente con solicitudes solo en otro centro:** se trata como vacío, sin filtrar datos de otro centro. Test en la Task 3: el `where` de `solicitud.findMany` lleva el `centro_id` de la sesión.
3. **Cita cerrada sin llamadas** (avisos de rechazo migrados): muestra "—" sin romper. Test en la Task 2 (`null`) y en la Task 4 (renderiza "—").
4. **Búsqueda repetida o un RUT nuevo tras un error:** no deben quedar datos del paciente anterior en pantalla. Test en la Task 4.
5. **Solicitud `Realizado` cuyas citas no tienen fecha de cierre:** fecha de cierre `null`, se muestra "—". Test en la Task 2.

---

### Task 1: Permiso `historial.ver` asignado a todos los roles

**Files:**
- Modify: `src/config/permisos.ts`: agregar la clave según Global Constraints.
- Modify: `src/config/permisos.test.ts`: `expect(CLAVES_PERMISOS).toContain("historial.ver")`.
- Modify: `prisma/seed.ts`: agregar `"historial.ver"` a **cada** rol de `rolePermisos`.
- Create: `prisma/migrations/20261015120000_permiso_historial_ver/migration.sql`

**Interfaces:**
- Produces: `Permiso` incluye `"historial.ver"`.

- [ ] **Step 1: Escribir el test que falla**: en `permisos.test.ts`, `expect(CLAVES_PERMISOS).toContain("historial.ver")`.
- [ ] **Step 2: Correrlo** con `npx vitest run src/config/permisos.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar**:
  - Agregar la clave al catálogo.
  - Agregar el permiso a todos los roles del seed.
  - Escribir la migración, con un comentario de una línea que explique que otorga el permiso a los roles existentes, seguido del SQL:
    ```sql
    INSERT IGNORE INTO `roles_permisos` (`rol_id`, `permiso`) SELECT `id_rol`, 'historial.ver' FROM `roles`;
    ```
- [ ] **Step 4: Verificar** con `npx vitest run src/config && npx tsc --noEmit`. Expected: PASS. La matriz de permisos agrupa el módulo "Historial" sin cambios extra (`agruparPermisos`).
- [ ] **Step 5: Commit** con el mensaje `feat(permisos): permiso historial.ver para todos los roles`.

### Task 2: Tipos y reglas de cierre

**Files:**
- Create: `src/modules/historial/types/historial.ts`: `LlamadaHistorial`, `CitaHistorial`, `SolicitudHistorial`, `HistorialPaciente`, exactamente como en la spec §2.
- Create: `src/modules/historial/utils/cierre.ts`
- Test: `src/modules/historial/utils/cierre.test.ts`

**Interfaces:**
- Consumes: `esEstadoTerminal(estado: string | null | undefined): boolean` de `@/modules/comunicador/types/comunicador`.
- Produces:
  - `fechaCierreCita(estadoCita: string | null, fechasLlamadas: (Date | null)[]): Date | null`
  - `fechaCierreSolicitud(estadoSolicitud: string, fechaValidacion: Date | null, fechasCierreCitas: (Date | null)[]): Date | null`
  - Los tipos de `historial.ts`.

- [ ] **Step 1: Escribir los tests que fallan**:
  - `"cita terminal toma la ultima llamada"`: con `"Cita Aceptada"` y `[d1, null, d3]` (d3 > d1) devuelve `d3`.
  - `"cita terminal sin llamadas no tiene fecha"`: con `"Cita Rechazada (Gestor)"` y `[]` devuelve `null`.
  - `"cita pendiente no tiene fecha de cierre"`: con `"No contesta (1)"` y `[d1]` devuelve `null`.
  - `"solicitud rechazada usa fecha_validacion"`: `fechaCierreSolicitud("Rechazado", v, [d1])` devuelve `v`.
  - `"solicitud realizada usa el ultimo cierre de sus citas"`: con `[d1, d3, null]` devuelve `d3`; con `[null]` devuelve `null`.
  - `"solicitud en curso no tiene fecha"`: `fechaCierreSolicitud("En Curso", v, [d1])` devuelve `null`.
- [ ] **Step 2: Correrlos** con `npx vitest run src/modules/historial/utils`. Expected: FAIL.
- [ ] **Step 3: Implementar** las dos funciones puras. Para "la mayor fecha", ignorar los `null` y comparar con `getTime()`.
- [ ] **Step 4: Verificar** que `npx vitest run src/modules/historial/utils` pasa.
- [ ] **Step 5: Commit** con el mensaje `feat(historial): tipos y reglas de fecha de cierre`.

### Task 3: Server Action `getHistorialPaciente`

**Files:**
- Create: `src/modules/historial/actions/getHistorialPaciente.action.ts`
- Test: `src/modules/historial/actions/getHistorialPaciente.action.test.ts`
- Modify: `src/modules/permisos-por-action.test.ts`: importar la action, agregar la fila `{ nombre: "getHistorialPaciente", invocar: () => getHistorialPaciente("11111111-1"), permisos: ["historial.ver"] }` y subir el conteo de 30 a 31 (texto del `it` y `toBe`).

**Interfaces:**
- Consumes: Task 1 (`"historial.ver"`); Task 2 (`fechaCierreCita`, `fechaCierreSolicitud`, tipos); `requirePermiso` de `@/shared/lib/permisos`; `esRutChilenoValido` y `normalizarRut` de `@/modules/solicitudes/utils/rut`; `AuditLogger` de `@/shared/lib/logger`.
- Produces: `getHistorialPaciente(rut: string): Promise<ResultadoAccion<HistorialPaciente>>`

- [ ] **Step 1: Escribir los tests que fallan.** Mockear prisma (`usuario.findUnique`, `solicitud.findMany`), `requirePermiso` con la sesión `{ rut: "9-9", nombre: "Func", centro_id: "655" }` y `AuditLogger`:
  - `"exige historial.ver"`: `requirePermiso` se llama con `"historial.ver"`.
  - `"rechaza un RUT invalido sin consultar"`: `"123"` devuelve `{ ok: false, error: "RUT invalido" }` y `findMany` no se llama.
  - `"informa cuando el funcionario no tiene centro"`: con `centro_id: null` devuelve el error estándar.
  - `"paciente inexistente devuelve historial vacio"`: con `findUnique` en `null` devuelve `{ ok: true, data: { paciente: null, solicitudes: [] } }`.
  - `"normaliza el RUT y filtra por el centro de la sesion"`: con `"12.345.678-5"`, el `where` de `solicitud.findMany` es `{ rut_usuario: "12345678-5", centro_id: "655" }` y el `orderBy` es `{ fecha_inicio: "desc" }`.
  - `"mapea citas y llamadas con fechas de cierre"`: con una solicitud `Realizado` cuya cita `"Cita Aceptada"` tiene llamadas en d1 y d2 (comunicador `{ nombre: "Ana" }`), la cita trae `cerrada: true`, `fecha_cierre: d2`, `llamadas[1].comunicador: "Ana"`, y la solicitud trae `fecha_cierre: d2`. El paciente es `{ rut: "12345678-5", nombre: "<nombre> <apellido>" }`.
  - `"audita la busqueda"`: `logDataAccess` se llama con `"SEARCH"`, `true`, `"HISTORIAL_PACIENTE"` y `details` que contiene `"rut=12345678-5"`.
- [ ] **Step 2: Correrlos** con `npx vitest run src/modules/historial/actions`. Expected: FAIL.
- [ ] **Step 3: Implementar la action.**
  - Archivo con `"use server"`; el orden de pasos es el de la spec §2.
  - Usar `include` anidado:
    - solicitud: `tipoSolicitud`, `motivo`, `orientador`, `gestor`, `citas`;
    - cita: `profesional`, `prestacion`, `llamadas`, ordenadas por `fecha_creacion: "asc"`;
    - llamada: `comunicador`, ordenadas por `fecha_llamada: "asc"`.
  - `cerrada` = `esEstadoTerminal(estado_cita)`.
  - La validación del RUT fallida devuelve `ok: false`, sin lanzar.
  - Agregar la fila en `permisos-por-action.test.ts`.
- [ ] **Step 4: Verificar** con `npx vitest run src/modules/historial src/modules/permisos-por-action.test.ts src/modules/resultado-accion-por-action.test.ts && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** con el mensaje `feat(historial): action getHistorialPaciente`.

### Task 4: Pantalla, ruta y menú

**Files:**
- Create: `src/modules/historial/components/HistorialPacienteView.tsx`
- Test: `src/modules/historial/components/HistorialPacienteView.test.tsx`
- Create: `src/app/(app)/historial/page.tsx`: `requirePermisoPagina("historial.ver")` y renderiza la vista, con el mismo patrón que `src/app/(app)/comunicador/page.tsx`.
- Modify: `src/config/navegacion.ts`: el item según Global Constraints.
- Modify: `src/config/navegacion.test.ts`: `navVisible(["historial.ver"])` devuelve `["/historial"]`.
- Modify: `AGENTS.md`: agregar `historial` a la lista de módulos. `docs/rbac-permisos.md`: si tiene una tabla de permisos o módulos, agregar la fila.

**Interfaces:**
- Consumes: `getHistorialPaciente` (Task 3), tipos de la Task 2.
- Produces: `HistorialPacienteView()` (sin props).

- [ ] **Step 1: Escribir los tests que fallan** (mockear la action y `sonner` si se usa):
  - `"busca por RUT y muestra paciente y resumen"`: al escribir `"12345678-5"` y pulsar "Buscar", la action recibe `"12345678-5"`. Se ven el nombre y el resumen `"3 solicitudes · 1 en curso · 1 realizadas · 1 rechazadas"`.
  - `"muestra estado, fecha de cierre y razon de rechazo"`: la solicitud `Rechazado` muestra su `razon_rechazo` y la fecha de cierre formateada `es-CL`. Una cita cerrada sin llamadas muestra `"—"`.
  - `"despliega las llamadas de una cita"`: el botón `"Ver llamadas (2)"` muestra respuesta, comunicador y observación de cada llamada.
  - `"muestra el vacio solo con exito"`: `{ ok: true, data: { paciente: null, solicitudes: [] } }` muestra `"Sin solicitudes en tu centro para este RUT"`.
  - `"muestra el error de negocio"`: `{ ok: false, error: "RUT invalido" }` muestra `"RUT invalido"` en un `Alert`.
  - `"muestra un error generico ante una excepcion"`: si la action rechaza, se ve `"No fue posible cargar el historial"` sin el detalle.
  - `"no conserva el paciente anterior tras una busqueda fallida"`: una búsqueda exitosa seguida de una con `ok: false` deja de mostrar el nombre del primer paciente.
  - `"indica la carga"`: mientras la promesa está pendiente se ve `"Buscando..."` y el botón queda deshabilitado.
- [ ] **Step 2: Correrlos** con `npx vitest run src/modules/historial/components src/config`. Expected: FAIL.
- [ ] **Step 3: Implementar la vista, la página, el item del menú y la documentación.**
  - Layout con `Card`; una tarjeta por solicitud y citas anidadas con borde izquierdo, como `PendientesCascada.tsx`.
  - El estado de las llamadas desplegadas es local, por cita.
  - Fechas con `toLocaleDateString("es-CL")`; las llamadas también muestran la hora.
- [ ] **Step 4: Verificar** con `npx tsc --noEmit && npm run lint && npx vitest run`. Expected: todo en verde.
- [ ] **Step 5: Commit** con el mensaje `feat(historial): pantalla de historial del paciente en el menu`.

### Task 5: Verificación en local con datos reales (controller)

- [ ] **Step 1:** Contra la base de ensayo, ejecutar el SQL de la migración de la Task 1 y verificar que cada rol tiene `historial.ver`.
- [ ] **Step 2:** Con `npm run dev`, verificar:
  - el item del menú aparece;
  - buscar `10000005-9` muestra las solicitudes del paciente de prueba;
  - las rechazadas aparecen con su fecha de validación y las citas con sus llamadas.

  El login con Google lo hace el usuario.
