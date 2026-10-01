# Solicitud duplicada - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar al usuario, antes de guardar, que ya existe una solicitud En Curso para el mismo RUT, tipo y motivo; garantizar el bloqueo en servidor aun con envios simultaneos; y devolver errores de negocio legibles desde `crearSolicitud` en produccion.

**Architecture:** Implementacion por etapas. Primero se agregan utilidades puras para detectar y redactar duplicados. Luego `crearSolicitud` migra a `ResultadoAccion<T>` para errores de negocio esperados y usa una transaccion interactiva con `SELECT ... FOR UPDATE` sobre la fila de `usuarios` para cerrar la carrera entre validacion y creacion. Finalmente `IngresarSolicitudView` consume las solicitudes ya cargadas por `getPendientes` para mostrar un aviso inline y deshabilitar el guardado, conservando el servidor como autoridad.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript strict, Prisma + MySQL, Vitest + Testing Library, Tailwind v3 + shadcn/ui, sonner.

**Spec:** `docs/superpowers/specs/2026-09-15-solicitud-duplicada-design.md`

## Global Constraints

- Idioma espanol en UI, tests, comentarios y commits.
- Indentacion: 4 espacios. TypeScript strict; tipos explicitos.
- Alias `@/` -> `src/`. Imports categorizados con comentarios (`// lib`, `// components`, `// schemas`, `// types`, `// utils`).
- Server Actions con `"use server"` y guard `requirePermiso` como primera linea ejecutable.
- Reusar `src/shared/types/resultado.ts`; no crear otro tipo `ResultadoAccion`.
- No agregar migraciones, permisos ni seed.
- Criterio de duplicado: `rut_usuario + tipo_solicitud_id + motivo_id + estado_solicitud = "En Curso"`.
- `motivo_id: null` solo coincide con `null`.
- Concurrencia: serializar por paciente con `SELECT rut FROM usuarios WHERE rut = ... FOR UPDATE`.
- Errores de permiso y Zod siguen lanzando excepciones; errores de negocio de `crearSolicitud` vuelven como `{ ok: false, error }`.
- Verificacion final obligatoria: `npm test`, `npx tsc --noEmit`, `npm run lint`.

---

## Estrategia de Ejecucion por Etapas

Este plan conviene ejecutarlo por etapas porque mezcla contrato de action, concurrencia y UI:

1. **Etapa A - Regla compartida:** utilidades puras y tests para detectar duplicados y generar el mensaje.
2. **Etapa B - Servidor autoritativo:** `crearSolicitud` con `ResultadoAccion`, transaccion y bloqueo por paciente.
3. **Etapa C - UX anticipada:** aviso inline en `IngresarSolicitudView`, boton deshabilitado y manejo de `{ ok: false }`.
4. **Etapa D - Verificacion:** suite focalizada, TypeScript, lint y validacion manual de carrera.

---

### Task 1: Utilidades Compartidas de Duplicados

**Files:**
- Create: `src/modules/solicitudes/utils/duplicados.ts`
- Test: `src/modules/solicitudes/utils/duplicados.test.ts`

**Interfaces:**
- Produces: `interface SolicitudEnCurso`.
- Produces: `interface CriterioDuplicado`.
- Produces: `buscarSolicitudDuplicada<T extends SolicitudEnCurso>(solicitudesEnCurso: T[], criterio: CriterioDuplicado): T | null`.
- Produces: `mensajeSolicitudDuplicada(solicitud: Pick<SolicitudEnCurso, "id_solicitud" | "fecha_inicio">): string`.
- Consumes: `acortarId` from `src/shared/lib/acortarId.ts`.

- [ ] **Step 1: Escribir tests de regla pura**

Crear `src/modules/solicitudes/utils/duplicados.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// utils
import { buscarSolicitudDuplicada, mensajeSolicitudDuplicada } from "./duplicados";

const solicitudes = [
    { id_solicitud: "SOL-11111111-1111-1111-1111-111111111111", fecha_inicio: "2026-09-08T03:00:00Z", tipo_solicitud_id: 1, motivo_id: 10 },
    { id_solicitud: "SOL-22222222-2222-2222-2222-222222222222", fecha_inicio: "2026-09-09T12:00:00Z", tipo_solicitud_id: 1, motivo_id: null },
    { id_solicitud: "SOL-33333333-3333-3333-3333-333333333333", fecha_inicio: "2026-09-10T12:00:00Z", tipo_solicitud_id: 2, motivo_id: 10 }
];

describe("buscarSolicitudDuplicada", () => {
    it("coincide por mismo tipo y motivo", () => {
        expect(buscarSolicitudDuplicada(solicitudes, { tipo_solicitud_id: 1, motivo_id: 10 })?.id_solicitud).toBe(solicitudes[0].id_solicitud);
    });

    it("coincide null solo con null", () => {
        expect(buscarSolicitudDuplicada(solicitudes, { tipo_solicitud_id: 1, motivo_id: null })?.id_solicitud).toBe(solicitudes[1].id_solicitud);
        expect(buscarSolicitudDuplicada(solicitudes, { tipo_solicitud_id: 2, motivo_id: null })).toBeNull();
    });

    it("no coincide si cambia tipo o motivo", () => {
        expect(buscarSolicitudDuplicada(solicitudes, { tipo_solicitud_id: 1, motivo_id: 99 })).toBeNull();
        expect(buscarSolicitudDuplicada([], { tipo_solicitud_id: 1, motivo_id: 10 })).toBeNull();
    });
});

describe("mensajeSolicitudDuplicada", () => {
    it("incluye ID corto y fecha en zona America/Santiago", () => {
        expect(
            mensajeSolicitudDuplicada({
                id_solicitud: "SOL-68bb9abc-def0-1234-5678-abcdefabcdef",
                fecha_inicio: "2026-09-09T02:30:00Z"
            })
        ).toBe("Ya existe la solicitud SOL-68bb9 del 08-09-2026 en curso para este tipo y motivo. Debe cerrarse antes de ingresar una nueva.");
    });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test -- src/modules/solicitudes/utils/duplicados.test.ts`

Expected: FAIL porque `duplicados.ts` no existe.

- [ ] **Step 3: Crear utilidades**

Crear `src/modules/solicitudes/utils/duplicados.ts`:

```ts
// lib
import { acortarId } from "@/shared/lib/acortarId";

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

export function buscarSolicitudDuplicada<T extends SolicitudEnCurso>(solicitudesEnCurso: T[], criterio: CriterioDuplicado): T | null {
    return solicitudesEnCurso.find((solicitud) => solicitud.tipo_solicitud_id === criterio.tipo_solicitud_id && solicitud.motivo_id === criterio.motivo_id) ?? null;
}

export function mensajeSolicitudDuplicada(solicitud: Pick<SolicitudEnCurso, "id_solicitud" | "fecha_inicio">): string {
    const fecha = new Date(solicitud.fecha_inicio).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Santiago"
    });

    return `Ya existe la solicitud ${acortarId(solicitud.id_solicitud)} del ${fecha.replaceAll("/", "-")} en curso para este tipo y motivo. Debe cerrarse antes de ingresar una nueva.`;
}
```

- [ ] **Step 4: Ejecutar tests**

Run: `npm test -- src/modules/solicitudes/utils/duplicados.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/solicitudes/utils/duplicados.ts src/modules/solicitudes/utils/duplicados.test.ts
git commit -m "feat(solicitudes): regla compartida para duplicados"
```

---

### Task 2: Migrar `crearSolicitud` a `ResultadoAccion`

**Files:**
- Modify: `src/modules/solicitudes/actions/crearSolicitud.action.ts`
- Test: `src/modules/solicitudes/actions/crearSolicitud.action.test.ts`

**Interfaces:**
- Consumes: `ResultadoAccion` from `src/shared/types/resultado.ts`.
- Consumes: `buscarSolicitudDuplicada`, `mensajeSolicitudDuplicada`.
- Produces: `crearSolicitud(input): Promise<ResultadoAccion<{ solicitud; voucher }>>`.
- Produces: errores de negocio con `{ ok: false, error }`.

- [ ] **Step 1: Actualizar tests existentes a contrato `{ ok, data/error }`**

En `src/modules/solicitudes/actions/crearSolicitud.action.test.ts`:

- Mantener `rejects.toThrow` para permiso faltante y RUT invalido.
- Cambiar los casos de negocio desde `rejects.toThrow(...)` a `resolves.toEqual({ ok: false, error: expect.stringContaining(...) })`.
- Cambiar los casos exitosos para leer `const result = await crearSolicitud(...)` y esperar:

```ts
expect(result.ok).toBe(true);
if (result.ok) {
    expect(result.data.solicitud.id_solicitud).toBe("SOL-x");
    expect(result.data.voucher.id_solicitud).toBe("SOL-x");
}
```

- Agregar cobertura para:
  - funcionario sin centro cuando la sesion no trae `centro_id`;
  - centro no validable (`getColumnaTipoSolicitudPorCentro` devuelve `null`);
  - usuario no confirmado;
  - motivo invalido;
  - motivo requerido;
  - tipo no habilitado.

- [ ] **Step 2: Ejecutar tests y verificar que fallan**

Run: `npm test -- src/modules/solicitudes/actions/crearSolicitud.action.test.ts`

Expected: FAIL porque la action todavia lanza errores y devuelve `{ solicitud, voucher }`.

- [ ] **Step 3: Ajustar imports y tipos de retorno**

En `crearSolicitud.action.ts` agregar:

```ts
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
// utils
import { buscarSolicitudDuplicada, mensajeSolicitudDuplicada, type SolicitudEnCurso } from "../utils/duplicados";
```

Crear interfaces locales para no depender de `ReturnType` complejo:

```ts
interface SolicitudCreada {
    id_solicitud: string;
    estado_solicitud: string;
    fecha_inicio: Date;
    centro_id: string | null;
    descripcion: string | null;
    disponibilidad_llamada: string | null;
    priorizacion_admin: number | null;
    ultimo_control: string | null;
    accion: string | null;
    usuario: {
        rut: string;
        nombre: string;
        apellido: string;
        nombre_social: string | null;
        telefono: string | null;
        telefono_alternativo: string | null;
    };
    tipoSolicitud: { id_tipo_solicitud: number; nombre_tipo_solicitud: string };
    motivo: { id_motivo: number; nombre_motivo: string } | null;
}

interface CrearSolicitudOk {
    solicitud: SolicitudCreada;
    voucher: {
        id_solicitud: string;
        fecha_inicio: Date;
        rut: string;
        usuario: {
            rut: string;
            nombre: string;
            apellido: string;
            nombre_social: string | null;
            telefono: string | null;
            telefono_alternativo: string | null;
        };
        tipoSolicitud: { id_tipo_solicitud: number; nombre_tipo_solicitud: string };
        motivo: { id_motivo: number; nombre_motivo: string } | null;
        profesional: string;
        centro: string;
        disponibilidad_llamada: string | null;
    };
}
```

- [ ] **Step 4: Convertir `getCentroFuncionario` en retorno nullable**

Cambiar:

```ts
async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string>
```

por:

```ts
async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string | null>
```

Y reemplazar el `throw` final por `return funcionario?.centro_id ?? null`.

- [ ] **Step 5: Convertir validaciones de negocio a `{ ok: false }`**

Dentro de `crearSolicitud`, despues de `requirePermiso` y `crearSolicitudSchema.parse`, reemplazar los `throw new Error(...)` de negocio por retornos:

```ts
if (!centroId) return { ok: false, error: "El funcionario activo no tiene centro asignado" };
if (!centroColumna) return { ok: false, error: "No se pudo validar el centro del funcionario para el tipo de solicitud" };
if (!usuario) return { ok: false, error: "Debes crear o confirmar el usuario antes de ingresar la solicitud" };
if (!tipoSolicitud) return { ok: false, error: "Tipo de solicitud inactivo, no encontrado o no habilitado para el centro del funcionario" };
if (data.motivo_id && !motivo) return { ok: false, error: "Motivo inactivo, no encontrado o no asociado al tipo de solicitud" };
if (!data.motivo_id && motivosActivos > 0) return { ok: false, error: "Motivo requerido para el tipo de solicitud seleccionado" };
```

`requirePermiso` y `crearSolicitudSchema.parse` siguen lanzando.

- [ ] **Step 6: Mantener duplicado temporal sin transaccion**

En esta tarea, antes de mover a transaccion en Task 3, cambiar la consulta de duplicado para seleccionar `fecha_inicio`, usar `mensajeSolicitudDuplicada`, y devolver:

```ts
if (solicitudDuplicada) return { ok: false, error: mensajeSolicitudDuplicada(solicitudDuplicada) };
```

- [ ] **Step 7: Envolver exito en `{ ok: true, data }`**

Cambiar el retorno final por:

```ts
return {
    ok: true,
    data: {
        solicitud,
        voucher: {
            id_solicitud: solicitud.id_solicitud,
            fecha_inicio: solicitud.fecha_inicio,
            rut: solicitud.usuario.rut,
            usuario: solicitud.usuario,
            tipoSolicitud: solicitud.tipoSolicitud,
            motivo: solicitud.motivo,
            profesional: user.nombre,
            centro: nombreCentro ?? centroId,
            disponibilidad_llamada: solicitud.disponibilidad_llamada
        }
    }
};
```

- [ ] **Step 8: Ejecutar tests**

Run: `npm test -- src/modules/solicitudes/actions/crearSolicitud.action.test.ts src/modules/solicitudes/utils/duplicados.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/solicitudes/actions/crearSolicitud.action.ts src/modules/solicitudes/actions/crearSolicitud.action.test.ts
git commit -m "feat(solicitudes): errores de negocio legibles al crear solicitud"
```

---

### Task 3: Cerrar Carrera con Transaccion y `FOR UPDATE`

**Files:**
- Modify: `src/modules/solicitudes/actions/crearSolicitud.action.ts`
- Test: `src/modules/solicitudes/actions/crearSolicitud.action.test.ts`

**Interfaces:**
- Consumes: `prisma.$transaction`.
- Produces: bloqueo por fila de usuario antes de revisar duplicado.

- [ ] **Step 1: Ajustar mock de Prisma**

En `crearSolicitud.action.test.ts`, crear un `tx` para la transaccion:

```ts
const tx = {
    $queryRaw: vi.fn(),
    solicitud: {
        findFirst: vi.fn(),
        create: vi.fn()
    }
};
```

Y mockear:

```ts
prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (callback: any) => callback(tx)),
    // ...
}
```

Actualizar los tests para que duplicado y create ocurran en `tx.solicitud.*`, mientras `getNombreCentro` sigue usando `prisma.$queryRaw`.

- [ ] **Step 2: Agregar test de orden y bloqueo**

Agregar caso:

```ts
it("bloquea la fila del usuario antes de revisar duplicado", async () => {
    // arrange usuario valido y tx.solicitud.findFirst null
    await crearSolicitud(baseInput as any);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.solicitud.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.solicitud.create).toHaveBeenCalledTimes(1);

    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    const findOrder = tx.solicitud.findFirst.mock.invocationCallOrder[0];
    const createOrder = tx.solicitud.create.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(findOrder);
    expect(findOrder).toBeLessThan(createOrder);
});
```

- [ ] **Step 3: Agregar test de auditoria en duplicado bloqueado**

Esperar que:

```ts
expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
    "CREATE",
    false,
    { id: "o@demo.local", name: "Orientador", rut: "22.222.222-2" },
    "SOL-duplicada",
    { details: expect.stringContaining("Solicitud duplicada bloqueada") }
);
```

- [ ] **Step 4: Ejecutar tests y verificar que fallan**

Run: `npm test -- src/modules/solicitudes/actions/crearSolicitud.action.test.ts`

Expected: FAIL porque aun no existe la transaccion.

- [ ] **Step 5: Mover duplicado y creacion a transaccion interactiva**

En `crearSolicitud.action.ts`, reemplazar la consulta de duplicado y el `create` directo por:

```ts
const resultado = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT rut FROM usuarios WHERE rut = ${usuario.rut} FOR UPDATE`;

    const duplicada = await tx.solicitud.findFirst({
        where: {
            rut_usuario: usuario.rut,
            tipo_solicitud_id: data.tipo_solicitud_id,
            motivo_id: data.motivo_id,
            estado_solicitud: "En Curso"
        },
        select: { id_solicitud: true, fecha_inicio: true, tipo_solicitud_id: true, motivo_id: true }
    });

    if (duplicada) return { duplicada } as const;

    const fechaIngreso = new Date();
    const edadIngreso = calcularEdad(usuario.fecha_nacimiento, fechaIngreso);
    const solicitud = await tx.solicitud.create({
        data: {
            id_solicitud: `SOL-${crypto.randomUUID()}`,
            rut_orientador: user.rut,
            rut_usuario: usuario.rut,
            tipo_solicitud_id: data.tipo_solicitud_id,
            motivo_id: data.motivo_id,
            descripcion: data.descripcion || null,
            disponibilidad_llamada: data.disponibilidad_llamada || null,
            priorizacion_admin: usuario.priorizacion_administrativa,
            ultimo_control: edadIngreso === null ? null : String(edadIngreso),
            accion: "En espera de validación",
            estado_solicitud: "En Curso",
            fecha_inicio: fechaIngreso,
            centro_id: centroId
        },
        select: {
            id_solicitud: true,
            estado_solicitud: true,
            fecha_inicio: true,
            centro_id: true,
            descripcion: true,
            disponibilidad_llamada: true,
            priorizacion_admin: true,
            ultimo_control: true,
            accion: true,
            usuario: {
                select: {
                    rut: true,
                    nombre: true,
                    apellido: true,
                    nombre_social: true,
                    telefono: true,
                    telefono_alternativo: true
                }
            },
            tipoSolicitud: { select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true } },
            motivo: { select: { id_motivo: true, nombre_motivo: true } }
        }
    });

    return { solicitud } as const;
});
```

Notas:
- `fechaIngreso` y `edadIngreso` deben calcularse dentro de la transaccion para que solo se usen en el camino de creacion.
- Mantener el mismo `select` del `create` actual.
- El `FOR UPDATE` debe usar la tabla real `usuarios` y el RUT normalizado del usuario confirmado.

- [ ] **Step 6: Manejar resultado de transaccion**

Despues de la transaccion:

```ts
if ("duplicada" in resultado) {
    await AuditLogger.logDataAccess("CREATE", false, { id: user.email, name: user.nombre, rut: user.rut }, resultado.duplicada.id_solicitud, {
        details: `Solicitud duplicada bloqueada para RUT ${usuario.rut}`
    });
    return { ok: false, error: mensajeSolicitudDuplicada(resultado.duplicada) };
}

const { solicitud } = resultado;
```

Luego conservar auditoria de exito actual y el retorno `{ ok: true, data }`.

- [ ] **Step 7: Ejecutar tests**

Run: `npm test -- src/modules/solicitudes/actions/crearSolicitud.action.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/solicitudes/actions/crearSolicitud.action.ts src/modules/solicitudes/actions/crearSolicitud.action.test.ts
git commit -m "feat(solicitudes): serializar creacion duplicada por paciente"
```

---

### Task 4: Aviso Anticipado en `IngresarSolicitudView`

**Files:**
- Modify: `src/modules/solicitudes/components/IngresarSolicitudView.tsx`
- Test: `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`
- Create if absent: `src/shared/components/ui/alert.tsx`

**Interfaces:**
- Consumes: `buscarSolicitudDuplicada`, `mensajeSolicitudDuplicada`.
- Consumes: `crearSolicitud` returning `ResultadoAccion`.
- Produces: aviso inline antes del boton de guardar.
- Produces: boton "Guardar solicitud" deshabilitado cuando hay duplicado.

- [ ] **Step 1: Agregar componente Alert si no existe**

Revisar `src/shared/components/ui/alert.tsx`.

Si no existe, agregarlo con el patron shadcn/ui local y `class-variance-authority`. Debe exportar:

```ts
export { Alert, AlertTitle, AlertDescription };
```

Usar variante `destructive`.

- [ ] **Step 2: Crear o ampliar tests de UI**

Si `src/modules/solicitudes/components/IngresarSolicitudView.test.tsx` no existe, crearlo con mocks para:

- `getCatalogos`
- `getCentros`
- `getPendientes`
- `getUsuarioPorRut`
- `crearSolicitud`
- `guardarUsuario.action`
- `sonner`

Casos minimos:

1. Tras buscar RUT con una solicitud En Curso tipo 1 / motivo 10, al elegir tipo 1 y motivo 10 se muestra el aviso y "Guardar solicitud" queda deshabilitado.
2. Al cambiar a otro motivo, desaparece el aviso y el boton vuelve a habilitarse.
3. Si `crearSolicitud` devuelve `{ ok: false, error }`, se muestra `toast.error`, se llama `getPendientes` de nuevo con el RUT confirmado y el formulario conserva tipo/motivo/disponibilidad.
4. Si `crearSolicitud` devuelve `{ ok: true, data }`, se muestra exito y voucher como hoy.

- [ ] **Step 3: Ejecutar tests y verificar que fallan**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx`

Expected: FAIL porque la UI todavia no usa duplicados ni `ResultadoAccion`.

- [ ] **Step 4: Ajustar tipos derivados de `crearSolicitud`**

En `IngresarSolicitudView.tsx`, reemplazar:

```ts
type VoucherSolicitud = Awaited<ReturnType<typeof crearSolicitud>>["voucher"];
```

por un tipo que desempaque solo el camino exitoso:

```ts
type CrearSolicitudResult = Awaited<ReturnType<typeof crearSolicitud>>;
type VoucherSolicitud = Extract<CrearSolicitudResult, { ok: true }>["data"]["voucher"];
```

- [ ] **Step 5: Calcular duplicado en cliente**

Agregar imports:

```tsx
import { AlertTriangle } from "lucide-react";
// components
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
// utils
import { buscarSolicitudDuplicada, mensajeSolicitudDuplicada } from "@/modules/solicitudes/utils/duplicados";
```

Agregar memo:

```tsx
const solicitudDuplicada = useMemo(() => {
    if (!pendientes || !usuarioConfirmado || !solicitudForm.tipo_solicitud_id) return null;
    if (requiereMotivo && !solicitudForm.motivo_id) return null;

    return buscarSolicitudDuplicada(pendientes.solicitudesPendientes, {
        tipo_solicitud_id: Number(solicitudForm.tipo_solicitud_id),
        motivo_id: requiereMotivo ? Number(solicitudForm.motivo_id) : null
    });
}, [pendientes, usuarioConfirmado, solicitudForm.tipo_solicitud_id, solicitudForm.motivo_id, requiereMotivo]);
```

- [ ] **Step 6: Mostrar aviso antes del boton**

Antes del contenedor del boton de guardar:

```tsx
{solicitudDuplicada && (
    <div className="lg:col-span-2">
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Solicitud duplicada</AlertTitle>
            <AlertDescription>{mensajeSolicitudDuplicada(solicitudDuplicada)}</AlertDescription>
        </Alert>
    </div>
)}
```

Cambiar el boton:

```tsx
<Button disabled={submittingSolicitud || Boolean(solicitudDuplicada)}>
```

- [ ] **Step 7: Consumir `ResultadoAccion` en `onCrearSolicitud`**

Reemplazar:

```ts
const { solicitud, voucher } = await crearSolicitud(...)
```

por:

```ts
const result = await crearSolicitud(...);
if (!result.ok) {
    toast.error(result.error);
    try {
        const actualizados = await getPendientes(usuarioConfirmado.rut);
        setPendientes(actualizados);
    } catch {
        // El toast original es el mensaje importante para el usuario.
    }
    return;
}

const { solicitud, voucher } = result.data;
```

No llamar `buscarPendientes`, porque limpia el formulario.

- [ ] **Step 8: Ejecutar tests**

Run: `npm test -- src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/utils/duplicados.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/solicitudes/components/IngresarSolicitudView.tsx src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/shared/components/ui/alert.tsx
git commit -m "feat(solicitudes): aviso anticipado de solicitud duplicada"
```

---

### Task 5: Verificacion de Integracion

**Files:**
- Modify only files from previous tasks if verification finds issues.

**Interfaces:**
- Produces: validacion completa de action, UI y contrato de tipos.

- [ ] **Step 1: Ejecutar suite focalizada**

Run:

```bash
npm test -- src/modules/solicitudes/actions/crearSolicitud.action.test.ts src/modules/solicitudes/components/IngresarSolicitudView.test.tsx src/modules/solicitudes/utils/duplicados.test.ts src/modules/solicitudes/actions/getPendientes.action.test.ts src/modules/solicitudes/components/PendientesCascada.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Ejecutar TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: sin errores. Prestar atencion especial a `VoucherSolicitud`, al retorno de `crearSolicitud`, y al tipo de `pendientes.solicitudesPendientes`.

- [ ] **Step 3: Ejecutar lint**

Run:

```bash
npm run lint
```

Expected: sin errores.

- [ ] **Step 4: Ejecutar suite completa**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Validacion manual**

Run: `npm run dev`

Verificar `/solicitudes/ingresar`:

1. Buscar un RUT que ya tenga una solicitud En Curso.
2. Elegir el mismo tipo y motivo: aparece aviso "Solicitud duplicada" con ID corto y fecha; el boton "Guardar solicitud" queda deshabilitado.
3. Elegir otro motivo o tipo: el aviso desaparece y se puede guardar.
4. Simular que otro usuario crea la solicitud despues de la revision previa: el servidor devuelve `{ ok: false }`, se muestra toast con el mismo mensaje, se refrescan pendientes y el formulario conserva sus valores.
5. Validar en produccion/local production build que ya no aparece el error generico de Server Components para duplicados.

- [ ] **Step 6: Validacion de concurrencia**

Con la app apuntando a MySQL local:

1. Preparar un RUT confirmado, tipo y motivo sin duplicado.
2. Disparar dos llamadas simultaneas a `crearSolicitud` con el mismo payload desde un test de integracion o script temporal local.
3. Confirmar que solo se crea una fila `solicitudes` En Curso con ese RUT/tipo/motivo.
4. Confirmar que la segunda respuesta es `{ ok: false, error: mensajeSolicitudDuplicada(...) }`.

- [ ] **Step 7: Commit de ajustes si existieron**

Si la verificacion requirio correcciones:

```bash
git add src/modules/solicitudes src/shared/components/ui
git commit -m "fix(solicitudes): ajustes de integracion de duplicados"
```

Si no hubo correcciones, no crear commit vacio.

---

## Cierre

- [ ] `npm test` en verde.
- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run lint` sin errores.
- [ ] Duplicado en UI muestra aviso inline y bloquea el boton antes de enviar.
- [ ] Duplicado detectado por servidor muestra toast legible en produccion.
- [ ] Dos envios simultaneos para el mismo RUT/tipo/motivo crean una sola solicitud.
- [ ] Errores de negocio restantes de `crearSolicitud` vuelven como `{ ok: false, error }`.
- [ ] Permiso faltante y Zod siguen lanzando excepciones.
- [ ] No hay migraciones, cambios de permisos ni cambios de seed.

## Handoff de Ejecucion Recomendado

Ejecutar este plan con `subagent-driven-development`, una tarea por subagente y revision entre tareas. Si se ejecuta inline, usar `executing-plans` y cerrar cada etapa A-D con los tests de esa etapa antes de avanzar.
