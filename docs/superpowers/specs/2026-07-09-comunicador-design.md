# Módulo Comunicador — Diseño (Spec)

- **Fecha:** 2026-07-09
- **Autor:** Renzo Vergara (con asistencia de Claude)
- **Estado:** Aprobado para planificación
- **Rama:** `feat/comunicador`
- **Fuentes:** documento técnico `docs/Especificación Técnica para la Reescritura del Módulo del Comunicador_ Gestor CESFAM 7.1.1.md` (derivado del sistema AppSheet en producción) + validación del dueño de producto.

## 1. Objetivo

Implementar el **Módulo del Comunicador**: donde un funcionario con rol de comunicador gestiona las **citas** generadas por la validación de solicitudes (`gestionarSolicitud`), contactando telefónicamente al paciente para **aceptar, rechazar o reintentar** la hora, registrando cada **llamada** y actualizando el estado de la cita según el resultado. Reemplaza la pantalla placeholder actual (`/comunicador`).

## 2. Alcance

**Dentro de alcance:**
- Cola de citas pendientes por centro, priorizada.
- Registro de llamadas con máquina de estados de la cita.
- Autocierre por incontactabilidad (3 "No contesta").
- **Cierre en cascada de la solicitud:** cuando se gestiona la última citación pendiente de una solicitud, la solicitud se cierra (`estado_solicitud` → `Realizado`).
- Modal multi-cita: gestionar en un mismo llamado las demás citas pendientes del paciente.
- Reglas de presentación de contacto (teléfonos/correo) portadas del documento.

**Fuera de alcance (anotado explícitamente, NO se migra en este módulo):**
- Generación automática de "cita de rechazo" por sobredemanda (documento §5.1).
- Detección de policonsultantes (documento §5.2).
- Matriz de permisos completa a nivel de campo y rol **Super Admin** / eliminación del backdoor (documento §4): se tratan como tarea transversal de RBAC, fuera de este módulo (falta la matriz de las imágenes fuente). Este módulo solo define el control de acceso por rol necesario para operar.

## 3. Modelo de datos y cambios de schema

### 3.1. Relación Llamada ↔ Cita (cambio principal)

Hoy `Llamada.cita_id` tiene una relación Prisma hacia `Solicitud`. Se cambia a una **FK formal hacia `Cita`**:

- `Llamada.cita_id` pasa a **obligatorio** (`String @db.VarChar(50)`) y referencia `Cita.id_cita`.
- Se agrega en `Cita`: `llamadas Llamada[]`.
- Se elimina de `Solicitud` la relación `llamadas Llamada[]` (Solicitud ya no se relaciona con Llamada).
- Se conserva `Llamada.rut_usuario`, `rut_comunicador`, `respuesta_usuario`, `observacion`, `hora_agendada`, `fecha_llamada`, `centro_id`.

```prisma
model Llamada {
  id_llamada        String       @id @db.VarChar(50)
  cita_id           String       @db.VarChar(50)
  rut_usuario       String       @db.VarChar(50)
  rut_comunicador   String?      @db.VarChar(50)
  respuesta_usuario String       @default("Sin llamadas") @db.VarChar(50)
  observacion       String?      @db.VarChar(350)
  hora_agendada     DateTime?
  fecha_llamada     DateTime?
  centro_id         String?      @db.VarChar(50)
  cita              Cita         @relation(fields: [cita_id], references: [id_cita])
  comunicador       Funcionario? @relation("LlamadasComunicador", fields: [rut_comunicador], references: [rut])

  @@index([cita_id])
  @@index([rut_usuario])
  @@index([rut_comunicador])
  @@index([respuesta_usuario])
  @@map("llamadas")
}
```

### 3.2. Índices de cola en `Cita`

Se agregan a `Cita`:
```prisma
  @@index([centro_id, estado_cita])
  @@index([rut_usuario, estado_cita])
```

### 3.3. Migración de datos

Los `llamadas` existentes referencian ids de solicitud (p.ej. demo `LLAM-DEMO-001 → SOL-DEMO-001`) y violarían la nueva FK. Al ser datos de prueba, la migración los **elimina** antes de aplicar la FK (`DELETE FROM llamadas` de las filas huérfanas). `id_llamada` nuevo = `LLAM-<uuid>`.

## 4. Máquina de estados de la Cita (núcleo)

Función pura `computeEstadoCita(estadoActual, intentosNoContestaPrevios, respuesta)` en `src/modules/comunicador/utils/estadoCita.ts`. Es la lógica central y debe estar cubierta por tests unitarios.

### 4.1. Respuestas posibles de una llamada (enum)

```
"No contesta"
"Llamada de aviso"
"Cita Aceptada"
"Cita Rechazada (No Necesaria)"
"Cita Rechazada (Solicitante)"
"Cita Rechazada (Número equivocado)"
```

### 4.2. Estados posibles de la cita

```
"Sin llamadas"                       (inicial, al generar la cita)
"No contesta (1)"
"No contesta (2)"
"Solo llamada de aviso"
"Cita Aceptada"
"Cita Rechazada (No Necesaria)"
"Cita Rechazada (Solicitante)"
"Cita Rechazada (Número equivocado)"
"Cita Rechazada (Sin respuesta)"     (autocierre por incontactabilidad)
```

### 4.3. Reglas de transición

- `intentosNoContestaPrevios` = cantidad de llamadas previas de la cita con `respuesta_usuario == "No contesta"`.
- **"No contesta":** `n = intentosNoContestaPrevios + 1`.
  - `n == 1` → `"No contesta (1)"`
  - `n == 2` → `"No contesta (2)"`
  - `n >= 3` → `"Cita Rechazada (Sin respuesta)"` (cierre automático)
- **"Llamada de aviso"** (comodín): si `estadoActual == "Sin llamadas"` → `"Solo llamada de aviso"`; en cualquier otro caso → **mantiene** `estadoActual` (no cambia el estado ni cuenta como intento fallido).
- **"Cita Aceptada"** → `"Cita Aceptada"`.
- **"Cita Rechazada (No Necesaria)" / "(Solicitante)" / "(Número equivocado)"** → ese mismo estado.

### 4.4. Clasificación de estados

- **Pendientes (siguen en la cola):** `Sin llamadas`, `No contesta (1)`, `No contesta (2)`, `Solo llamada de aviso`.
- **Terminales (cerradas, no admiten más llamadas):** `Cita Aceptada`, `Cita Rechazada (No Necesaria)`, `Cita Rechazada (Solicitante)`, `Cita Rechazada (Número equivocado)`, `Cita Rechazada (Sin respuesta)`.

Registrar una llamada sobre una cita ya terminal debe rechazarse con error de negocio.

### 4.5. Ciclo de vida de la Solicitud (cierre en cascada)

Una solicitud aceptada (`accion = "Realizar solicitud"`) genera 1+ citaciones (`Cita`) y **permanece `estado_solicitud = "En Curso"` mientras tenga al menos una citación en estado pendiente** (§4.4).

- Cada vez que una citación transiciona a un estado **terminal**, se evalúa la solicitud a la que pertenece (`Cita.solicitud_id`): se cuentan sus citaciones aún en estados pendientes.
- Si el conteo llega a **0** (todas terminales), la solicitud se cierra: `estado_solicitud = "Realizado"`, **sin importar el desenlace** de cada citación (aceptadas y/o rechazadas).
- Este cierre ocurre de forma **atómica** dentro de la misma transacción que registra la llamada y actualiza la citación (§6).
- No afecta el camino de rechazo de la solicitud completa (`gestionarSolicitud` con `accion = "Rechazar solicitud"` → `estado_solicitud = "Rechazado"`, sin citaciones), que es previo a este módulo.

## 5. Flujo / UX (`/comunicador`)

1. **Cola de citas pendientes** — Server Component; filtra por `centro_id` de la sesión; ordena por `priorizacion` desc y luego `fecha_estimada_atencion` asc. Cada fila muestra: nombre y RUT del paciente, **teléfonos** y **correo** (con fallbacks §7), prestación/profesional, fecha estimada, prioridad, `estado_cita` y número de intentos "No contesta".
2. **Registrar llamada** (modal/panel): el comunicador selecciona la **respuesta** (§4.1), `observacion` opcional (máx 350) y `hora_agendada` opcional. `hora_agendada` se captura en `"Cita Aceptada"` (fecha/hora acordada de atención). Al guardar → Server Action transaccional (§6) y refresco de la cola.
3. **Modal multi-cita:** al gestionar una cita, muestra las **demás citas pendientes del mismo paciente** (mismo centro), permitiendo registrar llamadas sobre ellas sin salir del flujo (patrón análogo a `getOtrasSolicitudes` + modal ya existentes en el módulo de revisión).

## 6. Server Actions (`src/modules/comunicador/actions/`)

Todas con `'use server'`, validación Zod, control de acceso por rol (`puedeAccederComunicador`) y `AuditLogger`.

- **`getCitasPendientes()`** — citas del `centro_id` de la sesión con `estado_cita` en el conjunto de pendientes; incluye `usuario`, `profesional`, `prestacion`; ordenadas por `priorizacion` desc, `fecha_estimada_atencion` asc. Devuelve además el conteo de intentos por cita.
- **`getCitasPendientesPaciente(rutUsuario, citaActualId)`** — citas pendientes del paciente en el centro, excluyendo `citaActualId` (para el modal multi-cita).
- **`registrarLlamada(input)`** — dentro de `prisma.$transaction`:
  1. Carga la cita (debe existir, pertenecer al centro de la sesión y **no** estar en estado terminal).
  2. Cuenta `intentosNoContestaPrevios` (`llamadas` de la cita con `respuesta_usuario == "No contesta"`).
  3. Crea la `Llamada` (`id_llamada = LLAM-<uuid>`, `rut_comunicador = sesión`, `centro_id = cita.centro_id`, `fecha_llamada = now`, `hora_agendada` si aplica).
  4. Calcula el nuevo estado con `computeEstadoCita(...)` y actualiza `Cita.estado_cita`.
  5. **Cierre en cascada (§4.5):** si el nuevo `estado_cita` es terminal, cuenta las citaciones de la misma `solicitud_id` que sigan en estados pendientes; si el conteo es 0, actualiza `Solicitud.estado_solicitud = "Realizado"`.
  6. `AuditLogger.logDataAccess("UPDATE", ...)`.
  - `input` (Zod): `cita_id`, `respuesta` (enum §4.1), `observacion?`, `hora_agendada?`.
  - Devuelve el nuevo `estado_cita` y si la solicitud fue cerrada (`solicitudRealizada: boolean`) para el feedback de UI.

## 7. Reglas de negocio portadas (documento, bloque A validado)

- **Contacto (utils):**
  - `formatearTelefonos(t1, t2)`: si ambos existen → `` `${t1} - ${t2}` ``; si solo uno → ese; si ambos nulos → `"Sin telefono(s) registrados"`.
  - `formatearCorreo(correoContacto)`: si existe → ese; si nulo → literal exacto `"Correo electrónico de contacto no registrado"`.
- **Priorización / edad:** se reutiliza `src/modules/solicitudes/utils/priorizacion.ts` (validado). La `priorizacion` de la cita ya viene calculada desde `gestionarSolicitud`; el comunicador solo la muestra/ordena.
- **RUT:** `normalizarRut` (util existente) para búsquedas por paciente.
- **Multi-tenancy:** todo el filtrado por `centro_id` ocurre en el servidor (Server Components / Server Actions) antes de enviar datos al cliente. El `centro_id` proviene de la sesión.
- **Agregados dinámicos:** los conteos (intentos, citas pendientes) se calculan con queries (`count`/`groupBy`), no columnas materializadas.

## 8. Permisos (RBAC de este módulo)

- Acceso al módulo y a sus actions: `puedeAccederComunicador(rol)` con roles `Administrador`, `Comunicador`, `SOME`, `Orientador y Comunicador`, `Gestor y Comunicador`, `Full` (los que hoy tienen el menú comunicador en el seed). Nuevo helper en `src/shared/lib/access.ts`.
- La seguridad a nivel de campo por rol, el rol Super Admin y la eliminación del backdoor quedan **fuera de este módulo** (§2).

## 9. Impacto / ripple

- **`getPendientes` (módulo solicitudes/ingreso):** hoy arma "citas pendientes" leyendo `llamadas → solicitud`. Al repuntar la FK a `Cita`, se **reescribe** para leer las `Cita` pendientes del paciente (`estado_cita` en el conjunto de pendientes) en vez de `llamadas`. Su test se actualiza en consecuencia.
- Cualquier `include`/relación que asumiera `Llamada ↔ Solicitud` se ajusta a `Llamada ↔ Cita`.
- **Nuevo valor `estado_solicitud = "Realizado"`:** al cerrar la última citación. Las solicitudes `Realizado` dejan de aparecer como pendientes en el ingreso (que filtra `En Curso`), comportamiento correcto. La pantalla de revisión (`/solicitudes/revisar`) hoy ofrece el filtro `"Finalizada"`; se debe **añadir/alinear** la opción `"Realizado"` en ese selector para que las solicitudes cerradas por el comunicador sean filtrables.

## 10. Estructura de carpetas

```
src/modules/comunicador/
  actions/    getCitasPendientes.action.ts · getCitasPendientesPaciente.action.ts · registrarLlamada.action.ts (+ tests)
  components/ CitasPendientesTabla.tsx · RegistrarLlamadaModal.tsx · MultiCitaPanel.tsx
  schemas/    llamada.schema.ts
  types/      comunicador.ts (estados, respuestas as const)
  utils/      estadoCita.ts (+ test) · contacto.ts (+ test)
src/app/(app)/comunicador/page.tsx   (Server Component: cola)
```

## 11. Testing

- **`estadoCita.ts`** — unit tests de todas las transiciones: No contesta 1/2/3 (autocierre), comodín aviso (desde `Sin llamadas` y desde `No contesta`), aceptada, cada rechazo; y que un estado terminal se rechaza.
- **`contacto.ts`** — casos de teléfonos (ambos/uno/ninguno) y correo (con/sin).
- **`registrarLlamada.action`** — Prisma mockeado: acceso por rol, cita inexistente/terminal, transición correcta, conteo de intentos, y **cierre en cascada** de la solicitud (cierra `Realizado` cuando era la última citación pendiente; permanece `En Curso` si quedan otras).
- **`getCitasPendientes` / `getCitasPendientesPaciente`** — filtro por centro y estados pendientes.

## 12. Criterios de aceptación

- `npm run lint`, `npx tsc --noEmit`, `npm test` en verde.
- Un comunicador ve la cola priorizada de su centro y registra llamadas que transicionan el `estado_cita` según §4.
- Tres "No contesta" cierran la cita como `Cita Rechazada (Sin respuesta)`.
- Una "Llamada de aviso" no altera un estado `No contesta (1/2)` ni cuenta como intento; desde `Sin llamadas` deja `Solo llamada de aviso`.
- El modal muestra las demás citas pendientes del paciente y permite gestionarlas.
- Al cerrar la **última** citación pendiente de una solicitud, `estado_solicitud` pasa a `Realizado`; mientras queden citaciones pendientes, permanece `En Curso`. El cambio es atómico con el registro de la llamada.
- Teléfonos y correo se muestran con los fallbacks exactos del documento.
- No quedan referencias a la relación `Llamada ↔ Solicitud`.
