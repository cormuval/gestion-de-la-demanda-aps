# Módulo Comunicador — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo comunicador: cola paginada y filtrable de citaciones pendientes por centro, registro de llamadas con máquina de estados, autocierre por incontactabilidad, cierre en cascada de la solicitud y modal multi-cita.

**Architecture:** App Next.js (App Router) con Server Actions. La lógica central (máquina de estados, temporalidad, edad→fecha, contacto) vive en utils puros testeables. El registro de llamada es una Server Action transaccional que actualiza la cita y, si corresponde, cierra la solicitud. La cola se lista con una consulta SQL cruda (orden en cascada por estado + paginación). Se cambia la FK `Llamada.cita_id` de `Solicitud` a `Cita`.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Prisma + MySQL, Zod, Vitest + Testing Library, Tailwind + shadcn.

## Global Constraints

- **Idioma:** español (UI, comentarios, commits). Indentación: 4 espacios.
- **TypeScript strict**; tipos explícitos. `interface` para objetos, `type`/`as const` para uniones.
- **Server Actions** en `src/modules/comunicador/actions/*.action.ts` con `'use server'`; validar inputs con Zod; auditar con `AuditLogger` (`src/shared/lib/logger.ts`).
- **Multi-tenancy:** filtrar por `centro_id` de la sesión en el servidor (de `getSessionUser()`, campo `centro_id`).
- **Acceso al módulo (roles):** `Administrador`, `Comunicador`, `SOME`, `Orientador y Comunicador`, `Gestor y Comunicador`, `Full`.
- **Estados de cita — pendientes:** `Sin llamadas`, `No contesta (1)`, `No contesta (2)`, `Solo llamada de aviso`. **Terminales:** `Cita Aceptada`, `Cita Rechazada (No Necesaria)`, `Cita Rechazada (Solicitante)`, `Cita Rechazada (Número equivocado)`, `Cita Rechazada (Sin respuesta)`.
- **Respuestas de llamada:** `No contesta`, `Llamada de aviso`, `Cita Aceptada`, `Cita Rechazada (No Necesaria)`, `Cita Rechazada (Solicitante)`, `Cita Rechazada (Número equivocado)`.
- **Autocierre:** 3 "No contesta" acumulados → `Cita Rechazada (Sin respuesta)`.
- **Comodín aviso:** desde `Sin llamadas` → `Solo llamada de aviso`; desde otro estado → mantiene el estado; nunca incrementa intentos.
- **Cierre en cascada:** al cerrar la última citación pendiente de una solicitud → `Solicitud.estado_solicitud = "Realizado"`, atómico.
- **Contacto (literales exactos):** teléfonos separados por `" - "`, ambos nulos → `"Sin telefono(s) registrados"`; correo nulo → `"Correo electrónico de contacto no registrado"`.
- **Fallback de puerto BD local:** MySQL Docker en `3308`. Verificación de subagentes: `tsc`/`lint`/`vitest` + `prisma generate`/`db push` (BD local disponible). No `next build`.
- **Rama:** `feat/comunicador`. Commits en español.
- **Referencia de spec:** `docs/superpowers/specs/2026-07-09-comunicador-design.md`.

---

## Mapa de archivos

**Crear:**
- `src/modules/comunicador/types/comunicador.ts` — estados, respuestas, temporalidad (as const) + sets.
- `src/modules/comunicador/utils/estadoCita.ts` (+ `.test.ts`) — máquina de estados.
- `src/modules/comunicador/utils/contacto.ts` (+ `.test.ts`) — formateo teléfonos/correo.
- `src/modules/comunicador/utils/temporalidad.ts` (+ `.test.ts`) — rangos de fecha estimada.
- `src/modules/comunicador/utils/rangoEdadAFechaNacimiento.ts` (+ `.test.ts`) — edad→fecha_nacimiento.
- `src/modules/comunicador/schemas/llamada.schema.ts` (+ `.test.ts`) — Zod de registro y filtros.
- `src/modules/comunicador/actions/registrarLlamada.action.ts` (+ `.test.ts`).
- `src/modules/comunicador/actions/getCitasPendientes.action.ts`.
- `src/modules/comunicador/actions/getCitasPendientesPaciente.action.ts`.
- `src/modules/comunicador/actions/getFiltrosComunicador.action.ts`.
- `src/modules/comunicador/components/CitasFiltros.tsx`.
- `src/modules/comunicador/components/CitasPendientesTabla.tsx`.
- `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`.
- `src/modules/comunicador/components/MultiCitaPanel.tsx`.

**Modificar:**
- `prisma/schema.prisma` — FK `Llamada.cita_id → Cita`, índices de cola en `Cita`.
- `src/shared/lib/access.ts` — `ROLES_COMUNICADOR` + `puedeAccederComunicador`.
- `src/modules/solicitudes/actions/getPendientes.action.ts` — citasPendientes desde `Cita` (+ su test).
- `src/app/(app)/solicitudes/ingresar/page.tsx` — map de `citasPendientes` (id_cita/estado_cita).
- `src/app/(app)/solicitudes/revisar/page.tsx` — agregar opción de filtro `"Realizado"`.
- `src/app/(app)/comunicador/page.tsx` — reemplazar placeholder por la vista real.

---

## FASE 1 — Fundamentos

### Task 1: Cambio de schema (FK Llamada→Cita) + migración

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Llamada.cita → Cita` (FK formal), `Cita.llamadas Llamada[]`, índices `Cita(@@index([centro_id, estado_cita]))` y `Cita(@@index([rut_usuario, estado_cita]))`.

- [ ] **Step 1: Editar `model Llamada`** — cambiar la relación de `Solicitud` a `Cita` y hacer `cita_id` obligatorio. Reemplazar el bloque `model Llamada { ... }` por:

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

- [ ] **Step 2: En `model Solicitud`, eliminar la relación con `Llamada`** — quitar la línea `llamadas               Llamada[]` (Solicitud ya no se relaciona con Llamada).

- [ ] **Step 3: En `model Cita`, agregar la relación inversa y los índices** — añadir dentro del modelo, junto a las demás relaciones, la línea `llamadas Llamada[]`, y agregar los dos índices nuevos al bloque de índices:

```prisma
  llamadas                 Llamada[]

  @@index([solicitud_id])
  @@index([rut_usuario])
  @@index([rut_gestor])
  @@index([profesional_id])
  @@index([prestacion_id])
  @@index([centro_id, estado_cita])
  @@index([rut_usuario, estado_cita])
  @@map("citas")
```

- [ ] **Step 4: Limpiar datos huérfanos y aplicar el schema** — las `llamadas` existentes referencian ids de solicitud y violarían la nueva FK. Borrarlas y aplicar:

Run:
```bash
docker exec gestion-demanda-mysql mysql -ugestion -pgestion_password gestion_demanda -e "DELETE FROM llamadas;"
npm run db:generate && npm run db:push
```
Expected: `db push` sincroniza sin errores (crea la FK `llamadas.cita_id → citas.id_cita`).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: falla en `getPendientes.action.ts` e `ingresar/page.tsx` (esperado — se corrigen en Task 12). Para aislar este task, verificar solo que el cliente Prisma refleje el cambio:
Run: `node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log(typeof p.cita.findMany, typeof p.llamada.findMany)"`
Expected: `function function`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(comunicador): FK formal Llamada->Cita e indices de cola en Cita"
```

> Nota: la ruptura temporal de `tsc` en `getPendientes`/`ingresar` es esperada y se resuelve en Task 12 (ripple). Las tareas siguientes (2–11) no dependen de esos archivos.

---

### Task 2: Tipos y constantes del dominio

**Files:**
- Create: `src/modules/comunicador/types/comunicador.ts`

**Interfaces:**
- Produces: `ESTADO_CITA`, `RESPUESTA_LLAMADA`, `TEMPORALIDAD` (as const); arrays `ESTADOS_PENDIENTES`, `RESPUESTAS_LLAMADA`, `TEMPORALIDADES`; tipos `EstadoCita`, `RespuestaLlamada`, `Temporalidad`; helpers `esEstadoPendiente(e)`, `esEstadoTerminal(e)`.

- [ ] **Step 1: Crear el archivo**

```typescript
export const ESTADO_CITA = {
    SIN_LLAMADAS: "Sin llamadas",
    NO_CONTESTA_1: "No contesta (1)",
    NO_CONTESTA_2: "No contesta (2)",
    SOLO_AVISO: "Solo llamada de aviso",
    ACEPTADA: "Cita Aceptada",
    RECHAZADA_NO_NECESARIA: "Cita Rechazada (No Necesaria)",
    RECHAZADA_SOLICITANTE: "Cita Rechazada (Solicitante)",
    RECHAZADA_NUMERO_EQUIVOCADO: "Cita Rechazada (Número equivocado)",
    RECHAZADA_SIN_RESPUESTA: "Cita Rechazada (Sin respuesta)"
} as const;

export type EstadoCita = (typeof ESTADO_CITA)[keyof typeof ESTADO_CITA];

// Orden de prioridad para la cola (índice = orden ascendente).
export const ORDEN_ESTADOS_PENDIENTES = [
    ESTADO_CITA.NO_CONTESTA_2,
    ESTADO_CITA.NO_CONTESTA_1,
    ESTADO_CITA.SOLO_AVISO,
    ESTADO_CITA.SIN_LLAMADAS
] as const;

export const ESTADOS_PENDIENTES = [
    ESTADO_CITA.SIN_LLAMADAS,
    ESTADO_CITA.NO_CONTESTA_1,
    ESTADO_CITA.NO_CONTESTA_2,
    ESTADO_CITA.SOLO_AVISO
] as const;

export const RESPUESTA_LLAMADA = {
    NO_CONTESTA: "No contesta",
    LLAMADA_AVISO: "Llamada de aviso",
    ACEPTADA: "Cita Aceptada",
    RECHAZADA_NO_NECESARIA: "Cita Rechazada (No Necesaria)",
    RECHAZADA_SOLICITANTE: "Cita Rechazada (Solicitante)",
    RECHAZADA_NUMERO_EQUIVOCADO: "Cita Rechazada (Número equivocado)"
} as const;

export type RespuestaLlamada = (typeof RESPUESTA_LLAMADA)[keyof typeof RESPUESTA_LLAMADA];

export const RESPUESTAS_LLAMADA = Object.values(RESPUESTA_LLAMADA);

export const TEMPORALIDAD = {
    TODAS: "Todas",
    PROXIMOS: "Agendamientos próximos",
    FUTUROS: "Agendamientos futuros",
    ATRASADOS: "Agendamientos atrasados"
} as const;

export type Temporalidad = (typeof TEMPORALIDAD)[keyof typeof TEMPORALIDAD];

export const TEMPORALIDADES = Object.values(TEMPORALIDAD);

export function esEstadoPendiente(estado: string | null | undefined): boolean {
    return !!estado && (ESTADOS_PENDIENTES as readonly string[]).includes(estado);
}

export function esEstadoTerminal(estado: string | null | undefined): boolean {
    return !!estado && !esEstadoPendiente(estado);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en este archivo (la ruptura de Task 1 en getPendientes sigue presente hasta Task 12).

- [ ] **Step 3: Commit**

```bash
git add src/modules/comunicador/types/comunicador.ts
git commit -m "feat(comunicador): tipos y constantes de estados/respuestas/temporalidad"
```

---

### Task 3: Máquina de estados `computeEstadoCita` (TDD)

**Files:**
- Create: `src/modules/comunicador/utils/estadoCita.ts`
- Test: `src/modules/comunicador/utils/estadoCita.test.ts`

**Interfaces:**
- Consumes: `ESTADO_CITA`, `RESPUESTA_LLAMADA`, `RespuestaLlamada` de `../types/comunicador`.
- Produces: `computeEstadoCita(estadoActual: string, intentosNoContestaPrevios: number, respuesta: RespuestaLlamada): string`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { computeEstadoCita } from "./estadoCita";
import { ESTADO_CITA, RESPUESTA_LLAMADA } from "../types/comunicador";

describe("computeEstadoCita", () => {
    it("No contesta: 1er intento -> No contesta (1)", () => {
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.NO_CONTESTA)).toBe(ESTADO_CITA.NO_CONTESTA_1);
    });
    it("No contesta: 2do intento -> No contesta (2)", () => {
        expect(computeEstadoCita(ESTADO_CITA.NO_CONTESTA_1, 1, RESPUESTA_LLAMADA.NO_CONTESTA)).toBe(ESTADO_CITA.NO_CONTESTA_2);
    });
    it("No contesta: 3er intento -> Rechazada (Sin respuesta) [autocierre]", () => {
        expect(computeEstadoCita(ESTADO_CITA.NO_CONTESTA_2, 2, RESPUESTA_LLAMADA.NO_CONTESTA)).toBe(ESTADO_CITA.RECHAZADA_SIN_RESPUESTA);
    });
    it("Aviso desde Sin llamadas -> Solo llamada de aviso", () => {
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.LLAMADA_AVISO)).toBe(ESTADO_CITA.SOLO_AVISO);
    });
    it("Aviso desde No contesta (1) -> mantiene No contesta (1)", () => {
        expect(computeEstadoCita(ESTADO_CITA.NO_CONTESTA_1, 1, RESPUESTA_LLAMADA.LLAMADA_AVISO)).toBe(ESTADO_CITA.NO_CONTESTA_1);
    });
    it("Aviso desde Solo llamada de aviso -> se mantiene", () => {
        expect(computeEstadoCita(ESTADO_CITA.SOLO_AVISO, 0, RESPUESTA_LLAMADA.LLAMADA_AVISO)).toBe(ESTADO_CITA.SOLO_AVISO);
    });
    it("Aceptada -> Cita Aceptada", () => {
        expect(computeEstadoCita(ESTADO_CITA.NO_CONTESTA_2, 2, RESPUESTA_LLAMADA.ACEPTADA)).toBe(ESTADO_CITA.ACEPTADA);
    });
    it("Rechazos directos fijan su estado", () => {
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA)).toBe(ESTADO_CITA.RECHAZADA_NO_NECESARIA);
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE)).toBe(ESTADO_CITA.RECHAZADA_SOLICITANTE);
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.RECHAZADA_NUMERO_EQUIVOCADO)).toBe(ESTADO_CITA.RECHAZADA_NUMERO_EQUIVOCADO);
    });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `npm test -- estadoCita`
Expected: FALLA (`computeEstadoCita` no existe).

- [ ] **Step 3: Implementar `estadoCita.ts`**

```typescript
// types
import { ESTADO_CITA, RESPUESTA_LLAMADA, RespuestaLlamada } from "../types/comunicador";

/**
 * Deriva el nuevo estado de una cita a partir del estado actual, la cantidad de
 * intentos "No contesta" previos y la respuesta registrada en el nuevo llamado.
 */
export function computeEstadoCita(estadoActual: string, intentosNoContestaPrevios: number, respuesta: RespuestaLlamada): string {
    switch (respuesta) {
        case RESPUESTA_LLAMADA.NO_CONTESTA: {
            const n = intentosNoContestaPrevios + 1;
            if (n >= 3) return ESTADO_CITA.RECHAZADA_SIN_RESPUESTA;
            if (n === 2) return ESTADO_CITA.NO_CONTESTA_2;
            return ESTADO_CITA.NO_CONTESTA_1;
        }
        case RESPUESTA_LLAMADA.LLAMADA_AVISO:
            return estadoActual === ESTADO_CITA.SIN_LLAMADAS ? ESTADO_CITA.SOLO_AVISO : estadoActual;
        case RESPUESTA_LLAMADA.ACEPTADA:
            return ESTADO_CITA.ACEPTADA;
        case RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA:
            return ESTADO_CITA.RECHAZADA_NO_NECESARIA;
        case RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE:
            return ESTADO_CITA.RECHAZADA_SOLICITANTE;
        case RESPUESTA_LLAMADA.RECHAZADA_NUMERO_EQUIVOCADO:
            return ESTADO_CITA.RECHAZADA_NUMERO_EQUIVOCADO;
        default:
            return estadoActual;
    }
}
```

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `npm test -- estadoCita`
Expected: PASS (todos verdes).

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/utils/estadoCita.ts src/modules/comunicador/utils/estadoCita.test.ts
git commit -m "feat(comunicador): maquina de estados de la cita (computeEstadoCita)"
```

---

### Task 4: Util de contacto (TDD)

**Files:**
- Create: `src/modules/comunicador/utils/contacto.ts`
- Test: `src/modules/comunicador/utils/contacto.test.ts`

**Interfaces:**
- Produces: `formatearTelefonos(t1?: string|null, t2?: string|null): string`, `formatearCorreo(correo?: string|null): string`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { formatearTelefonos, formatearCorreo } from "./contacto";

describe("formatearTelefonos", () => {
    it("ambos -> separados por ' - '", () => {
        expect(formatearTelefonos("111", "222")).toBe("111 - 222");
    });
    it("solo uno -> ese", () => {
        expect(formatearTelefonos("111", null)).toBe("111");
        expect(formatearTelefonos("", "222")).toBe("222");
    });
    it("ninguno -> literal", () => {
        expect(formatearTelefonos(null, null)).toBe("Sin telefono(s) registrados");
        expect(formatearTelefonos("", "  ")).toBe("Sin telefono(s) registrados");
    });
});

describe("formatearCorreo", () => {
    it("con correo -> ese", () => {
        expect(formatearCorreo("a@b.cl")).toBe("a@b.cl");
    });
    it("sin correo -> literal exacto", () => {
        expect(formatearCorreo(null)).toBe("Correo electrónico de contacto no registrado");
        expect(formatearCorreo("   ")).toBe("Correo electrónico de contacto no registrado");
    });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `npm test -- contacto`
Expected: FALLA.

- [ ] **Step 3: Implementar `contacto.ts`**

```typescript
function limpiar(valor?: string | null): string {
    return (valor ?? "").trim();
}

export function formatearTelefonos(telefono?: string | null, telefonoAlternativo?: string | null): string {
    const t1 = limpiar(telefono);
    const t2 = limpiar(telefonoAlternativo);
    if (t1 && t2) return `${t1} - ${t2}`;
    if (t1) return t1;
    if (t2) return t2;
    return "Sin telefono(s) registrados";
}

export function formatearCorreo(correoContacto?: string | null): string {
    const correo = limpiar(correoContacto);
    return correo || "Correo electrónico de contacto no registrado";
}
```

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `npm test -- contacto`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/utils/contacto.ts src/modules/comunicador/utils/contacto.test.ts
git commit -m "feat(comunicador): utilidades de formato de contacto (telefonos/correo)"
```

---

### Task 5: Util de temporalidad (TDD)

**Files:**
- Create: `src/modules/comunicador/utils/temporalidad.ts`
- Test: `src/modules/comunicador/utils/temporalidad.test.ts`

**Interfaces:**
- Consumes: `TEMPORALIDAD` de `../types/comunicador`.
- Produces: `interface RangoFechas { gte?: Date; lte?: Date; lt?: Date }`, `addDays(fecha: Date, dias: number): Date`, `rangoTemporalidad(opcion: string, hoy: Date): RangoFechas | null` (null = sin filtro / "Todas").

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { rangoTemporalidad, addDays } from "./temporalidad";
import { TEMPORALIDAD } from "../types/comunicador";

const HOY = new Date(2026, 6, 10); // 2026-07-10, hora 00:00 local

describe("rangoTemporalidad", () => {
    it("Todas -> null (sin filtro)", () => {
        expect(rangoTemporalidad(TEMPORALIDAD.TODAS, HOY)).toBeNull();
    });
    it("Proximos -> [hoy-15, hoy+30]", () => {
        const r = rangoTemporalidad(TEMPORALIDAD.PROXIMOS, HOY)!;
        expect(r.gte).toEqual(addDays(HOY, -15));
        expect(r.lte).toEqual(addDays(HOY, 30));
    });
    it("Futuros -> >= hoy+31", () => {
        const r = rangoTemporalidad(TEMPORALIDAD.FUTUROS, HOY)!;
        expect(r.gte).toEqual(addDays(HOY, 31));
        expect(r.lte).toBeUndefined();
    });
    it("Atrasados -> < hoy-15", () => {
        const r = rangoTemporalidad(TEMPORALIDAD.ATRASADOS, HOY)!;
        expect(r.lt).toEqual(addDays(HOY, -15));
        expect(r.gte).toBeUndefined();
    });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `npm test -- temporalidad`
Expected: FALLA.

- [ ] **Step 3: Implementar `temporalidad.ts`**

```typescript
// types
import { TEMPORALIDAD } from "../types/comunicador";

export interface RangoFechas {
    gte?: Date;
    lte?: Date;
    lt?: Date;
}

export function addDays(fecha: Date, dias: number): Date {
    const resultado = new Date(fecha);
    resultado.setDate(resultado.getDate() + dias);
    return resultado;
}

/**
 * Traduce la opción de temporalidad a un rango sobre `fecha_estimada_atencion`.
 * Devuelve null para "Todas" (sin filtro de fecha).
 * Particiones contiguas: atrasados < hoy-15 <= proximos <= hoy+30 < futuros >= hoy+31.
 */
export function rangoTemporalidad(opcion: string, hoy: Date): RangoFechas | null {
    switch (opcion) {
        case TEMPORALIDAD.PROXIMOS:
            return { gte: addDays(hoy, -15), lte: addDays(hoy, 30) };
        case TEMPORALIDAD.FUTUROS:
            return { gte: addDays(hoy, 31) };
        case TEMPORALIDAD.ATRASADOS:
            return { lt: addDays(hoy, -15) };
        case TEMPORALIDAD.TODAS:
        default:
            return null;
    }
}
```

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `npm test -- temporalidad`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/utils/temporalidad.ts src/modules/comunicador/utils/temporalidad.test.ts
git commit -m "feat(comunicador): util de temporalidad de citas (rangoTemporalidad)"
```

---

### Task 6: Util edad→fecha_nacimiento (TDD)

**Files:**
- Create: `src/modules/comunicador/utils/rangoEdadAFechaNacimiento.ts`
- Test: `src/modules/comunicador/utils/rangoEdadAFechaNacimiento.test.ts`

**Interfaces:**
- Produces: `interface RangoFechaNac { gte?: Date; lte?: Date }`, `rangoEdadAFechaNacimiento(edadMin: number | null, edadMax: number | null, hoy: Date): RangoFechaNac`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { rangoEdadAFechaNacimiento } from "./rangoEdadAFechaNacimiento";

const HOY = new Date(2026, 6, 10); // 2026-07-10

describe("rangoEdadAFechaNacimiento", () => {
    it("sin límites -> objeto vacío", () => {
        expect(rangoEdadAFechaNacimiento(null, null, HOY)).toEqual({});
    });
    it("edad mínima N -> nacido a más tardar hoy - N años (lte)", () => {
        // edad >= 30  =>  fecha_nac <= 1996-07-10
        const r = rangoEdadAFechaNacimiento(30, null, HOY);
        expect(r.lte).toEqual(new Date(1996, 6, 10));
        expect(r.gte).toBeUndefined();
    });
    it("edad máxima M -> nacido después de hoy - (M+1) años (gte, +1 día)", () => {
        // edad <= 30  =>  fecha_nac >= 1995-07-11
        const r = rangoEdadAFechaNacimiento(null, 30, HOY);
        expect(r.gte).toEqual(new Date(1995, 6, 11));
        expect(r.lte).toBeUndefined();
    });
    it("rango [20,30]", () => {
        const r = rangoEdadAFechaNacimiento(20, 30, HOY);
        expect(r.lte).toEqual(new Date(2006, 6, 10)); // >=20
        expect(r.gte).toEqual(new Date(1995, 6, 11)); // <=30
    });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `npm test -- rangoEdadAFechaNacimiento`
Expected: FALLA.

- [ ] **Step 3: Implementar**

```typescript
export interface RangoFechaNac {
    gte?: Date;
    lte?: Date;
}

function restarAnios(fecha: Date, anios: number): Date {
    return new Date(fecha.getFullYear() - anios, fecha.getMonth(), fecha.getDate());
}

/**
 * Traduce un rango de edad [edadMin, edadMax] a límites de fecha_nacimiento.
 * - edad >= edadMin  <=>  fecha_nac <= hoy - edadMin años   (lte)
 * - edad <= edadMax  <=>  fecha_nac >= hoy - (edadMax+1) años + 1 día  (gte)
 */
export function rangoEdadAFechaNacimiento(edadMin: number | null, edadMax: number | null, hoy: Date): RangoFechaNac {
    const rango: RangoFechaNac = {};
    if (edadMin !== null && edadMin !== undefined) {
        rango.lte = restarAnios(hoy, edadMin);
    }
    if (edadMax !== null && edadMax !== undefined) {
        const base = restarAnios(hoy, edadMax + 1);
        base.setDate(base.getDate() + 1);
        rango.gte = base;
    }
    return rango;
}
```

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `npm test -- rangoEdadAFechaNacimiento`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/utils/rangoEdadAFechaNacimiento.ts src/modules/comunicador/utils/rangoEdadAFechaNacimiento.test.ts
git commit -m "feat(comunicador): util edad->fecha_nacimiento para filtro de edad"
```

---

### Task 7: Control de acceso del módulo (TDD)

**Files:**
- Modify: `src/shared/lib/access.ts`
- Test: `src/shared/lib/access.test.ts`

**Interfaces:**
- Produces: `ROLES_COMUNICADOR` (as const), `puedeAccederComunicador(rol: string): boolean`.

- [ ] **Step 1: Escribir el test que falla** (crear `src/shared/lib/access.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { puedeAccederComunicador } from "./access";

describe("puedeAccederComunicador", () => {
    it("permite roles con menú comunicador", () => {
        for (const rol of ["Administrador", "Comunicador", "SOME", "Orientador y Comunicador", "Gestor y Comunicador", "Full"]) {
            expect(puedeAccederComunicador(rol)).toBe(true);
        }
    });
    it("rechaza roles sin acceso", () => {
        expect(puedeAccederComunicador("Orientador")).toBe(false);
        expect(puedeAccederComunicador("")).toBe(false);
    });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `npm test -- access`
Expected: FALLA (`puedeAccederComunicador` no existe).

- [ ] **Step 3: Agregar a `src/shared/lib/access.ts`** (al final del archivo, sin tocar lo existente):

```typescript
export const ROLES_COMUNICADOR = ["Administrador", "Comunicador", "SOME", "Orientador y Comunicador", "Gestor y Comunicador", "Full"] as const;

export function puedeAccederComunicador(rol: string): boolean {
    return (ROLES_COMUNICADOR as readonly string[]).includes(rol);
}
```

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `npm test -- access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/access.ts src/shared/lib/access.test.ts
git commit -m "feat(comunicador): control de acceso puedeAccederComunicador"
```

---

## FASE 2 — Backend (schemas + actions)

### Task 8: Schemas Zod (registro + filtros) (TDD)

**Files:**
- Create: `src/modules/comunicador/schemas/llamada.schema.ts`
- Test: `src/modules/comunicador/schemas/llamada.schema.test.ts`

**Interfaces:**
- Consumes: `RESPUESTAS_LLAMADA`, `RESPUESTA_LLAMADA`, `TEMPORALIDADES` de `../types/comunicador`.
- Produces:
  - `registrarLlamadaSchema` (Zod) y `type RegistrarLlamadaInput = z.input<...>`.
  - `citasFiltrosSchema` (Zod) y `type CitasFiltros = z.infer<...>` con campos `temporalidad?`, `estado?`, `profesional_id?`, `prestacion_id?`, `edadMin?`, `edadMax?`, `fechaDesde?`, `fechaHasta?`, `pagina`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { registrarLlamadaSchema, citasFiltrosSchema } from "./llamada.schema";
import { RESPUESTA_LLAMADA } from "../types/comunicador";

describe("registrarLlamadaSchema", () => {
    it("hora_agendada obligatoria en 'Cita Aceptada'", () => {
        const r = registrarLlamadaSchema.safeParse({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.ACEPTADA });
        expect(r.success).toBe(false);
    });
    it("acepta 'Cita Aceptada' con hora_agendada", () => {
        const r = registrarLlamadaSchema.safeParse({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.ACEPTADA, hora_agendada: "2026-08-01T10:00" });
        expect(r.success).toBe(true);
    });
    it("no exige hora_agendada en otras respuestas", () => {
        const r = registrarLlamadaSchema.safeParse({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA });
        expect(r.success).toBe(true);
    });
    it("rechaza respuesta inválida", () => {
        const r = registrarLlamadaSchema.safeParse({ cita_id: "CITA-1", respuesta: "otra" });
        expect(r.success).toBe(false);
    });
});

describe("citasFiltrosSchema", () => {
    it("aplica pagina=1 por defecto y coacciona números", () => {
        const r = citasFiltrosSchema.parse({ profesional_id: "3", edadMin: "20" });
        expect(r.pagina).toBe(1);
        expect(r.profesional_id).toBe(3);
        expect(r.edadMin).toBe(20);
    });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `npm test -- llamada.schema`
Expected: FALLA.

- [ ] **Step 3: Implementar `llamada.schema.ts`**

```typescript
import { z } from "zod";
// types
import { RESPUESTAS_LLAMADA, RESPUESTA_LLAMADA } from "../types/comunicador";

export const registrarLlamadaSchema = z
    .object({
        cita_id: z.string().trim().min(1, "Cita requerida"),
        respuesta: z.enum(RESPUESTAS_LLAMADA as [string, ...string[]]),
        observacion: z.string().trim().max(350, "Observacion maximo 350 caracteres").optional().default(""),
        hora_agendada: z.string().trim().optional().default("")
    })
    .superRefine((data, ctx) => {
        if (data.respuesta === RESPUESTA_LLAMADA.ACEPTADA && !data.hora_agendada) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La hora agendada es obligatoria al aceptar la cita", path: ["hora_agendada"] });
        }
    });

export type RegistrarLlamadaInput = z.input<typeof registrarLlamadaSchema>;
export type RegistrarLlamadaData = z.output<typeof registrarLlamadaSchema>;

export const citasFiltrosSchema = z.object({
    temporalidad: z.string().trim().optional(),
    estado: z.string().trim().optional(),
    profesional_id: z.coerce.number().int().positive().optional(),
    prestacion_id: z.coerce.number().int().positive().optional(),
    edadMin: z.coerce.number().int().min(0).max(150).optional(),
    edadMax: z.coerce.number().int().min(0).max(150).optional(),
    fechaDesde: z.string().trim().optional(),
    fechaHasta: z.string().trim().optional(),
    pagina: z.coerce.number().int().min(1).default(1)
});

export type CitasFiltros = z.infer<typeof citasFiltrosSchema>;
```

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `npm test -- llamada.schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comunicador/schemas/llamada.schema.ts src/modules/comunicador/schemas/llamada.schema.test.ts
git commit -m "feat(comunicador): schemas Zod de registro de llamada y filtros"
```

---

### Task 9: `registrarLlamada` action (TDD)

**Files:**
- Create: `src/modules/comunicador/actions/registrarLlamada.action.ts`
- Test: `src/modules/comunicador/actions/registrarLlamada.action.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireSessionUser`, `puedeAccederComunicador`, `AuditLogger`, `computeEstadoCita`, `esEstadoTerminal`, `ESTADO_CITA`, `ESTADOS_PENDIENTES`, `RESPUESTA_LLAMADA`, `registrarLlamadaSchema`.
- Produces: `registrarLlamada(input: RegistrarLlamadaInput): Promise<{ estadoCita: string; solicitudRealizada: boolean }>`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
    cita: { findUnique: vi.fn(), update: vi.fn() },
    llamada: { count: vi.fn(), create: vi.fn() },
    solicitud: { update: vi.fn() }
};
vi.mock("@/shared/lib/prisma", () => ({
    prisma: { $transaction: vi.fn(async (cb: any) => cb(tx)) }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { registrarLlamada } from "./registrarLlamada.action";
import { requireSessionUser } from "@/shared/lib/auth";
import { RESPUESTA_LLAMADA } from "../types/comunicador";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
    tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", estado_cita: "Sin llamadas", centro_id: "501" });
    tx.llamada.count.mockResolvedValue(0);
    tx.cita.update.mockResolvedValue({});
    tx.llamada.create.mockResolvedValue({});
});

describe("registrarLlamada", () => {
    it("rechaza rol sin acceso", async () => {
        (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
        await expect(registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).rejects.toThrow("No tienes permiso");
    });

    it("primer No contesta -> estado 'No contesta (1)', no cierra solicitud", async () => {
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any);
        expect(r.estadoCita).toBe("No contesta (1)");
        expect(r.solicitudRealizada).toBe(false);
        expect(tx.solicitud.update).not.toHaveBeenCalled();
        const updateArg = tx.cita.update.mock.calls[0][0];
        expect(updateArg.data.estado_cita).toBe("No contesta (1)");
    });

    it("respuesta terminal que deja 0 citas pendientes -> cierra solicitud como Realizado", async () => {
        tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", estado_cita: "No contesta (2)", centro_id: "501" });
        tx.llamada.count.mockResolvedValue(0); // intentos previos
        (tx.cita as any).count = vi.fn().mockResolvedValue(0); // citas pendientes restantes de la solicitud
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.ACEPTADA, hora_agendada: "2026-08-01T10:00" } as any);
        expect(r.estadoCita).toBe("Cita Aceptada");
        expect(r.solicitudRealizada).toBe(true);
        expect(tx.solicitud.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado_solicitud: "Realizado" } }));
    });

    it("respuesta terminal con citas pendientes restantes -> NO cierra solicitud", async () => {
        (tx.cita as any).count = vi.fn().mockResolvedValue(2);
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE } as any);
        expect(r.solicitudRealizada).toBe(false);
        expect(tx.solicitud.update).not.toHaveBeenCalled();
    });

    it("rechaza cita inexistente", async () => {
        tx.cita.findUnique.mockResolvedValue(null);
        await expect(registrarLlamada({ cita_id: "X", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).rejects.toThrow();
    });

    it("rechaza cita en estado terminal", async () => {
        tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", estado_cita: "Cita Aceptada", centro_id: "501" });
        await expect(registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).rejects.toThrow();
    });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `npm test -- registrarLlamada`
Expected: FALLA.

- [ ] **Step 3: Implementar `registrarLlamada.action.ts`**

```typescript
"use server";

import crypto from "node:crypto";
// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { registrarLlamadaSchema, RegistrarLlamadaInput } from "../schemas/llamada.schema";
// utils
import { computeEstadoCita } from "../utils/estadoCita";
// types
import { ESTADO_CITA, ESTADOS_PENDIENTES, RESPUESTA_LLAMADA, RespuestaLlamada, esEstadoTerminal } from "../types/comunicador";

export async function registrarLlamada(input: RegistrarLlamadaInput): Promise<{ estadoCita: string; solicitudRealizada: boolean }> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");

    const data = registrarLlamadaSchema.parse(input);

    const resultado = await prisma.$transaction(async (tx) => {
        const cita = await tx.cita.findUnique({
            where: { id_cita: data.cita_id },
            select: { id_cita: true, solicitud_id: true, estado_cita: true, centro_id: true }
        });
        if (!cita) throw new Error("La cita no existe");
        if (cita.centro_id !== user.centro_id) throw new Error("La cita no pertenece a tu centro");

        const estadoActual = cita.estado_cita ?? ESTADO_CITA.SIN_LLAMADAS;
        if (esEstadoTerminal(estadoActual)) throw new Error("La cita ya está cerrada");

        const intentosNoContestaPrevios = await tx.llamada.count({
            where: { cita_id: cita.id_cita, respuesta_usuario: RESPUESTA_LLAMADA.NO_CONTESTA }
        });

        const nuevoEstado = computeEstadoCita(estadoActual, intentosNoContestaPrevios, data.respuesta as RespuestaLlamada);

        await tx.llamada.create({
            data: {
                id_llamada: `LLAM-${crypto.randomUUID()}`,
                cita_id: cita.id_cita,
                rut_usuario: cita.id_cita ? undefined : undefined, // reemplazado abajo
                rut_comunicador: user.rut,
                respuesta_usuario: data.respuesta,
                observacion: data.observacion || null,
                hora_agendada: data.respuesta === RESPUESTA_LLAMADA.ACEPTADA && data.hora_agendada ? new Date(data.hora_agendada) : null,
                fecha_llamada: new Date(),
                centro_id: cita.centro_id
            } as any
        });

        await tx.cita.update({ where: { id_cita: cita.id_cita }, data: { estado_cita: nuevoEstado } });

        let solicitudRealizada = false;
        if (esEstadoTerminal(nuevoEstado)) {
            const pendientesRestantes = await tx.cita.count({
                where: { solicitud_id: cita.solicitud_id, estado_cita: { in: [...ESTADOS_PENDIENTES] } }
            });
            if (pendientesRestantes === 0) {
                await tx.solicitud.update({ where: { id_solicitud: cita.solicitud_id }, data: { estado_solicitud: "Realizado" } });
                solicitudRealizada = true;
            }
        }

        return { estadoCita: nuevoEstado, solicitudRealizada };
    });

    await AuditLogger.logDataAccess("UPDATE", true, { id: user.email, name: user.nombre, rut: user.rut }, data.cita_id, {
        details: `Llamada registrada (${data.respuesta}) -> estado ${resultado.estadoCita}${resultado.solicitudRealizada ? "; solicitud Realizada" : ""}`
    });

    return resultado;
}
```

> **Nota de implementación:** `Llamada.rut_usuario` es obligatorio; obtenerlo de la cita. Corregir el `select` de `tx.cita.findUnique` para incluir `rut_usuario: true` y usar `rut_usuario: cita.rut_usuario` en el `create` (eliminar la línea placeholder `rut_usuario: cita.id_cita ? undefined : undefined`). Es decir: agregar `rut_usuario: true` al select y en el `data` del `create` poner `rut_usuario: cita.rut_usuario`.

- [ ] **Step 4: Corregir el `rut_usuario`** — en el `select` de `findUnique` añadir `rut_usuario: true`; en el `data` del `llamada.create` usar `rut_usuario: cita.rut_usuario` (y borrar la línea placeholder). El objeto `create` queda:

```typescript
        await tx.llamada.create({
            data: {
                id_llamada: `LLAM-${crypto.randomUUID()}`,
                cita_id: cita.id_cita,
                rut_usuario: cita.rut_usuario,
                rut_comunicador: user.rut,
                respuesta_usuario: data.respuesta,
                observacion: data.observacion || null,
                hora_agendada: data.respuesta === RESPUESTA_LLAMADA.ACEPTADA && data.hora_agendada ? new Date(data.hora_agendada) : null,
                fecha_llamada: new Date(),
                centro_id: cita.centro_id
            }
        });
```

Y el `select`: `{ id_cita: true, solicitud_id: true, rut_usuario: true, estado_cita: true, centro_id: true }`.

- [ ] **Step 5: Ejecutar el test (debe pasar)**

Run: `npm test -- registrarLlamada`
Expected: PASS (6/6).

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en el módulo comunicador (la ruptura de getPendientes sigue hasta Task 12).

- [ ] **Step 7: Commit**

```bash
git add src/modules/comunicador/actions/registrarLlamada.action.ts src/modules/comunicador/actions/registrarLlamada.action.test.ts
git commit -m "feat(comunicador): action registrarLlamada (transaccion + cierre en cascada)"
```

---

### Task 10: `getCitasPendientes` action (cola con filtros, orden y paginación)

**Files:**
- Create: `src/modules/comunicador/actions/getCitasPendientes.action.ts`

**Interfaces:**
- Consumes: `prisma` (`$queryRaw`, `Prisma.sql`, `Prisma.join`, `Prisma.empty`), `requireSessionUser`, `puedeAccederComunicador`, `AuditLogger`, `citasFiltrosSchema`, `rangoTemporalidad`, `rangoEdadAFechaNacimiento`, `ORDEN_ESTADOS_PENDIENTES`, `ESTADOS_PENDIENTES`.
- Produces: `getCitasPendientes(filtros: unknown): Promise<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number }>` con `interface CitaFila { id_cita: string; priorizacion: number | null; disponibilidad: string | null; rut_usuario: string; nombre_usuario: string | null; profesion: string | null; prestacion: string | null; fecha_estimada_atencion: Date | null; estado_cita: string | null; intentos: number }`.

- [ ] **Step 1: Implementar el action** (consulta cruda con orden en cascada + paginación; sin TDD unitario — se valida por tipos y prueba manual/integración, ya que arma SQL)

```typescript
"use server";

import { Prisma } from "@prisma/client";
// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { citasFiltrosSchema } from "../schemas/llamada.schema";
// utils
import { rangoTemporalidad } from "../utils/temporalidad";
import { rangoEdadAFechaNacimiento } from "../utils/rangoEdadAFechaNacimiento";
// types
import { ESTADO_CITA, ESTADOS_PENDIENTES, ORDEN_ESTADOS_PENDIENTES } from "../types/comunicador";

const POR_PAGINA = 100;

export interface CitaFila {
    id_cita: string;
    priorizacion: number | null;
    disponibilidad: string | null;
    rut_usuario: string;
    nombre_usuario: string | null;
    profesion: string | null;
    prestacion: string | null;
    fecha_estimada_atencion: Date | null;
    estado_cita: string | null;
    intentos: number;
}

export async function getCitasPendientes(filtros: unknown): Promise<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number }> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");
    if (!user.centro_id) throw new Error("El funcionario no tiene centro asignado");

    const f = citasFiltrosSchema.parse(filtros ?? {});
    const hoy = new Date();

    // Estado: si viene un estado pendiente puntual, filtrar por él; si no, por todos los pendientes.
    const estadosFiltro =
        f.estado && (ESTADOS_PENDIENTES as readonly string[]).includes(f.estado) ? [f.estado] : [...ESTADOS_PENDIENTES];

    const condiciones: Prisma.Sql[] = [
        Prisma.sql`c.centro_id = ${user.centro_id}`,
        Prisma.sql`c.estado_cita IN (${Prisma.join(estadosFiltro)})`
    ];

    if (f.profesional_id) condiciones.push(Prisma.sql`c.profesional_id = ${f.profesional_id}`);
    if (f.prestacion_id) condiciones.push(Prisma.sql`c.prestacion_id = ${f.prestacion_id}`);

    // Temporalidad (sobre fecha_estimada_atencion)
    const rt = rangoTemporalidad(f.temporalidad ?? "", hoy);
    if (rt?.gte) condiciones.push(Prisma.sql`c.fecha_estimada_atencion >= ${rt.gte}`);
    if (rt?.lte) condiciones.push(Prisma.sql`c.fecha_estimada_atencion <= ${rt.lte}`);
    if (rt?.lt) condiciones.push(Prisma.sql`c.fecha_estimada_atencion < ${rt.lt}`);

    // Rango de fecha estimada explícito (AND con temporalidad)
    if (f.fechaDesde) condiciones.push(Prisma.sql`c.fecha_estimada_atencion >= ${new Date(`${f.fechaDesde}T00:00:00`)}`);
    if (f.fechaHasta) condiciones.push(Prisma.sql`c.fecha_estimada_atencion <= ${new Date(`${f.fechaHasta}T23:59:59`)}`);

    // Edad -> fecha_nacimiento
    const rEdad = rangoEdadAFechaNacimiento(f.edadMin ?? null, f.edadMax ?? null, hoy);
    if (rEdad.gte) condiciones.push(Prisma.sql`u.fecha_nacimiento >= ${rEdad.gte}`);
    if (rEdad.lte) condiciones.push(Prisma.sql`u.fecha_nacimiento <= ${rEdad.lte}`);

    const where = Prisma.sql`WHERE ${Prisma.join(condiciones, " AND ")}`;

    // Orden en cascada por estado (FIELD) + priorizacion desc
    const ordenEstados = Prisma.join(ORDEN_ESTADOS_PENDIENTES.map((e) => Prisma.sql`${e}`));
    const orderBy = Prisma.sql`ORDER BY FIELD(c.estado_cita, ${ordenEstados}) ASC, c.priorizacion DESC`;

    const offset = (f.pagina - 1) * POR_PAGINA;

    const filas = await prisma.$queryRaw<CitaFila[]>`
        SELECT
            c.id_cita AS id_cita,
            c.priorizacion AS priorizacion,
            s.disponibilidad_llamada AS disponibilidad,
            c.rut_usuario AS rut_usuario,
            TRIM(CONCAT(COALESCE(u.nombre, ''), ' ', COALESCE(u.apellido, ''))) AS nombre_usuario,
            p.nombre AS profesion,
            pr.nombre_prestacion AS prestacion,
            c.fecha_estimada_atencion AS fecha_estimada_atencion,
            c.estado_cita AS estado_cita,
            (SELECT COUNT(*) FROM llamadas ll WHERE ll.cita_id = c.id_cita AND ll.respuesta_usuario = 'No contesta') AS intentos
        FROM citas c
        JOIN usuarios u ON u.rut = c.rut_usuario
        JOIN solicitudes s ON s.id_solicitud = c.solicitud_id
        LEFT JOIN profesionales p ON p.id_profesional = c.profesional_id
        LEFT JOIN prestaciones pr ON pr.id_prestacion = c.prestacion_id
        ${where}
        ${orderBy}
        LIMIT ${POR_PAGINA} OFFSET ${offset}
    `;

    const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total
        FROM citas c
        JOIN usuarios u ON u.rut = c.rut_usuario
        JOIN solicitudes s ON s.id_solicitud = c.solicitud_id
        ${where}
    `;
    const total = Number(totalRows[0]?.total ?? 0);

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "COLA_COMUNICADOR", {
        details: `Filtros: ${JSON.stringify(f)}`
    });

    // `intentos` puede venir como bigint desde MySQL; normalizar a number.
    const filasNorm = filas.map((r) => ({ ...r, intentos: Number(r.intentos as unknown as bigint) }));
    return { filas: filasNorm, total, pagina: f.pagina, porPagina: POR_PAGINA };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en `getCitasPendientes.action.ts`.

- [ ] **Step 3: Prueba manual contra la BD local** (hay datos reales sembrados)

Run:
```bash
npx tsx -e "import('./src/modules/comunicador/actions/getCitasPendientes.action.ts')" 2>/dev/null || echo "revisión por integración en Task 17"
```
Expected: la validación real ocurre al integrar la página (Task 17). Aquí basta `tsc` verde.

- [ ] **Step 4: Commit**

```bash
git add src/modules/comunicador/actions/getCitasPendientes.action.ts
git commit -m "feat(comunicador): getCitasPendientes (cola con filtros, orden en cascada y paginacion)"
```

---

### Task 11: `getCitasPendientesPaciente` y `getFiltrosComunicador`

**Files:**
- Create: `src/modules/comunicador/actions/getCitasPendientesPaciente.action.ts`
- Create: `src/modules/comunicador/actions/getFiltrosComunicador.action.ts`

**Interfaces:**
- Produces:
  - `getCitasPendientesPaciente(rutUsuario: string, citaActualId: string): Promise<CitaPacienteFila[]>` con `interface CitaPacienteFila { id_cita: string; estado_cita: string | null; priorizacion: number | null; profesion: string | null; prestacion: string | null; fecha_estimada_atencion: Date | null; intentos: number }`.
  - `getFiltrosComunicador(): Promise<{ profesionales: { id: number; nombre: string }[]; prestaciones: { id: number; nombre: string; profesional_id: number }[] }>`.

- [ ] **Step 1: Implementar `getCitasPendientesPaciente.action.ts`**

```typescript
"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
// utils
import { normalizarRut } from "@/modules/solicitudes/utils/rut";
// types
import { ESTADOS_PENDIENTES } from "../types/comunicador";

export interface CitaPacienteFila {
    id_cita: string;
    estado_cita: string | null;
    priorizacion: number | null;
    profesion: string | null;
    prestacion: string | null;
    fecha_estimada_atencion: Date | null;
    intentos: number;
}

export async function getCitasPendientesPaciente(rutUsuario: string, citaActualId: string): Promise<CitaPacienteFila[]> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");
    if (!user.centro_id) throw new Error("El funcionario no tiene centro asignado");

    const citas = await prisma.cita.findMany({
        where: {
            rut_usuario: normalizarRut(rutUsuario),
            centro_id: user.centro_id,
            id_cita: { not: citaActualId },
            estado_cita: { in: [...ESTADOS_PENDIENTES] }
        },
        include: { profesional: true, prestacion: true },
        orderBy: { priorizacion: "desc" }
    });

    const filas: CitaPacienteFila[] = [];
    for (const c of citas) {
        const intentos = await prisma.llamada.count({ where: { cita_id: c.id_cita, respuesta_usuario: "No contesta" } });
        filas.push({
            id_cita: c.id_cita,
            estado_cita: c.estado_cita,
            priorizacion: c.priorizacion,
            profesion: c.profesional?.nombre ?? null,
            prestacion: c.prestacion?.nombre_prestacion ?? null,
            fecha_estimada_atencion: c.fecha_estimada_atencion,
            intentos
        });
    }
    return filas;
}
```

- [ ] **Step 2: Implementar `getFiltrosComunicador.action.ts`**

```typescript
"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
import { esEstadoActivo } from "@/shared/lib/access";

export async function getFiltrosComunicador(): Promise<{
    profesionales: { id: number; nombre: string }[];
    prestaciones: { id: number; nombre: string; profesional_id: number }[];
}> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");

    const [profesionales, prestaciones] = await Promise.all([
        prisma.profesional.findMany({ orderBy: { nombre: "asc" }, select: { id_profesional: true, nombre: true, estado: true } }),
        prisma.prestacion.findMany({ orderBy: { nombre_prestacion: "asc" }, select: { id_prestacion: true, nombre_prestacion: true, profesional_id: true, estado: true } })
    ]);

    return {
        profesionales: profesionales
            .filter((p) => esEstadoActivo(p.estado))
            .map((p) => ({ id: p.id_profesional, nombre: p.nombre })),
        prestaciones: prestaciones
            .filter((p) => esEstadoActivo(p.estado))
            .map((p) => ({ id: p.id_prestacion, nombre: p.nombre_prestacion, profesional_id: p.profesional_id }))
    };
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en ambos actions.

- [ ] **Step 4: Commit**

```bash
git add src/modules/comunicador/actions/getCitasPendientesPaciente.action.ts src/modules/comunicador/actions/getFiltrosComunicador.action.ts
git commit -m "feat(comunicador): actions de citas del paciente (modal) y opciones de filtros"
```

---

### Task 12: Ripple — reescribir `getPendientes` (Llamada→Cita) + página ingresar

**Files:**
- Modify: `src/modules/solicitudes/actions/getPendientes.action.ts`
- Modify: `src/modules/solicitudes/actions/getPendientes.action.test.ts` (si existe; si no, crear)
- Modify: `src/app/(app)/solicitudes/ingresar/page.tsx` (línea del map de `citasPendientes`)

**Interfaces:**
- Produces: `getPendientes(rutUsuario)` ahora devuelve `citasPendientes` como registros de `Cita` (con `include: { solicitud, profesional, prestacion }`), no de `Llamada`.

- [ ] **Step 1: Reescribir el cuerpo de `getPendientes.action.ts`** — reemplazar la consulta de `citasPendientes` (que usaba `prisma.llamada`) por una sobre `prisma.cita`:

```typescript
"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// utils
import { normalizarRut } from "../utils/rut";
// types
import { ESTADOS_PENDIENTES } from "@/modules/comunicador/types/comunicador";

export async function getPendientes(rutUsuario: string) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const rut = normalizarRut(rutUsuario);
    if (!rut) throw new Error("rutUsuario es requerido");

    const [solicitudesPendientes, citasPendientes] = await Promise.all([
        prisma.solicitud.findMany({
            where: { rut_usuario: rut, estado_solicitud: "En Curso" },
            include: { tipoSolicitud: true, motivo: true },
            orderBy: { fecha_inicio: "desc" }
        }),
        prisma.cita.findMany({
            where: { rut_usuario: rut, estado_cita: { in: [...ESTADOS_PENDIENTES] } },
            include: { solicitud: { include: { tipoSolicitud: true, motivo: true } }, profesional: true, prestacion: true },
            orderBy: [{ priorizacion: "desc" }, { fecha_creacion: "desc" }]
        })
    ]);

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `PENDIENTES_${rut}`, {
        details: `Consulta de pendientes para RUT ${rut}`
    });

    return { solicitudesPendientes, citasPendientes };
}
```

- [ ] **Step 2: Actualizar el map de `citasPendientes` en `ingresar/page.tsx`** — reemplazar la línea (≈335):

```tsx
                                pendientes.citasPendientes.map((l) => (
                                    <PendingRow key={l.id_llamada} title={l.id_llamada} badge={l.respuesta_usuario} description={l.observacion || l.solicitud?.descripcion} />
```
por:
```tsx
                                pendientes.citasPendientes.map((c) => (
                                    <PendingRow key={c.id_cita} title={c.id_cita} badge={c.estado_cita ?? "Sin estado"} description={c.observacion || c.solicitud?.descripcion} />
```

- [ ] **Step 3: Actualizar/crear el test de `getPendientes`** — si `getPendientes.action.test.ts` existe y mockea `prisma.llamada` para `citasPendientes`, cambiarlo para mockear `prisma.cita.findMany`. Contenido de referencia:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: { solicitud: { findMany: vi.fn() }, cita: { findMany: vi.fn() } }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getPendientes } from "./getPendientes.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
    (prisma.cita.findMany as any).mockResolvedValue([{ id_cita: "CITA-1", estado_cita: "Sin llamadas" }]);
});

describe("getPendientes", () => {
    it("consulta citas pendientes desde Cita con estados pendientes", async () => {
        const r = await getPendientes("12.345.678-9");
        expect(r.citasPendientes).toHaveLength(1);
        const arg = (prisma.cita.findMany as any).mock.calls[0][0];
        expect(arg.where.estado_cita.in).toContain("Sin llamadas");
    });
});
```

- [ ] **Step 4: Ejecutar tests + tipos**

Run: `npm test -- getPendientes && npx tsc --noEmit`
Expected: PASS y **tsc ahora limpio en todo el proyecto** (se cierra la ruptura de Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/modules/solicitudes/actions/getPendientes.action.ts src/modules/solicitudes/actions/getPendientes.action.test.ts "src/app/(app)/solicitudes/ingresar/page.tsx"
git commit -m "refactor(solicitudes): getPendientes lee citas desde Cita (ripple FK Llamada->Cita)"
```

---

## FASE 3 — Frontend

### Task 13: Componente `CitasFiltros`

**Files:**
- Create: `src/modules/comunicador/components/CitasFiltros.tsx`

**Interfaces:**
- Consumes: `getFiltrosComunicador` (tipos), `TEMPORALIDADES`, `ESTADOS_PENDIENTES`, componentes UI (`Input`, `Label`, `Select`, `Button`).
- Produces: componente client `CitasFiltros` con props `{ opciones: Awaited<ReturnType<typeof getFiltrosComunicador>>; valor: CitasFiltrosUI; onAplicar: (f: CitasFiltrosUI) => void }` y `interface CitasFiltrosUI { temporalidad: string; estado: string; profesional_id: string; prestacion_id: string; edadMin: string; edadMax: string; fechaDesde: string; fechaHasta: string }`.

- [ ] **Step 1: Crear el componente** (barra de filtros al estilo de `revisar/page.tsx`; prestación depende de profesión seleccionada)

```tsx
"use client";

import { useMemo } from "react";
import { Filter } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
// types
import { TEMPORALIDADES, ESTADOS_PENDIENTES } from "../types/comunicador";
import type { getFiltrosComunicador } from "../actions/getFiltrosComunicador.action";

export interface CitasFiltrosUI {
    temporalidad: string;
    estado: string;
    profesional_id: string;
    prestacion_id: string;
    edadMin: string;
    edadMax: string;
    fechaDesde: string;
    fechaHasta: string;
}

export const FILTROS_INICIALES: CitasFiltrosUI = {
    temporalidad: "Todas",
    estado: "",
    profesional_id: "",
    prestacion_id: "",
    edadMin: "",
    edadMax: "",
    fechaDesde: "",
    fechaHasta: ""
};

type Opciones = Awaited<ReturnType<typeof getFiltrosComunicador>>;

export function CitasFiltros({ opciones, valor, onCambio, onAplicar }: {
    opciones: Opciones;
    valor: CitasFiltrosUI;
    onCambio: (f: CitasFiltrosUI) => void;
    onAplicar: () => void;
}) {
    const prestacionesFiltradas = useMemo(() => {
        if (!valor.profesional_id) return opciones.prestaciones;
        return opciones.prestaciones.filter((p) => String(p.profesional_id) === String(valor.profesional_id));
    }, [opciones.prestaciones, valor.profesional_id]);

    function set(campo: keyof CitasFiltrosUI, v: string) {
        onCambio({ ...valor, [campo]: v, ...(campo === "profesional_id" ? { prestacion_id: "" } : {}) });
    }

    return (
        <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(e) => {
                e.preventDefault();
                onAplicar();
            }}
        >
            <Field label="Temporalidad">
                <Select value={valor.temporalidad} onChange={(e) => set("temporalidad", e.target.value)}>
                    {TEMPORALIDADES.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Estado">
                <Select value={valor.estado} onChange={(e) => set("estado", e.target.value)}>
                    <option value="">Todas</option>
                    {ESTADOS_PENDIENTES.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Profesión">
                <Select value={valor.profesional_id} onChange={(e) => set("profesional_id", e.target.value)}>
                    <option value="">Todas</option>
                    {opciones.profesionales.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.nombre}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Prestación">
                <Select value={valor.prestacion_id} onChange={(e) => set("prestacion_id", e.target.value)}>
                    <option value="">Todas</option>
                    {prestacionesFiltradas.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.nombre}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Edad mínima">
                <Input type="number" min="0" value={valor.edadMin} onChange={(e) => set("edadMin", e.target.value)} />
            </Field>
            <Field label="Edad máxima">
                <Input type="number" min="0" value={valor.edadMax} onChange={(e) => set("edadMax", e.target.value)} />
            </Field>
            <Field label="Fecha desde">
                <Input type="date" value={valor.fechaDesde} onChange={(e) => set("fechaDesde", e.target.value)} />
            </Field>
            <Field label="Fecha hasta">
                <Input type="date" value={valor.fechaHasta} onChange={(e) => set("fechaHasta", e.target.value)} />
            </Field>
            <div className="md:col-span-4">
                <Button type="submit">
                    <Filter size={16} />
                    Aplicar filtros
                </Button>
            </div>
        </form>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/comunicador/components/CitasFiltros.tsx
git commit -m "feat(comunicador): barra de filtros de citas"
```

---

### Task 14: Componentes `RegistrarLlamadaModal` y `MultiCitaPanel`

**Files:**
- Create: `src/modules/comunicador/components/MultiCitaPanel.tsx`
- Create: `src/modules/comunicador/components/RegistrarLlamadaModal.tsx`

**Interfaces:**
- Consumes: `registrarLlamada`, `getCitasPendientesPaciente`, `RESPUESTAS_LLAMADA`, `RESPUESTA_LLAMADA`, `formatearTelefonos`, `formatearCorreo`, componentes UI, `toast`.
- Produces:
  - `MultiCitaPanel` con props `{ rutUsuario: string; citaActualId: string; onGestionar: (citaId: string) => void }` — lista las demás citas pendientes del paciente.
  - `RegistrarLlamadaModal` con props `{ cita: CitaFila; telefonos: string; correo: string; onCerrar: () => void; onRegistrado: () => void }`.

- [ ] **Step 1: Crear `MultiCitaPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
// actions
import { getCitasPendientesPaciente, CitaPacienteFila } from "../actions/getCitasPendientesPaciente.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

export function MultiCitaPanel({ rutUsuario, citaActualId, onGestionar }: { rutUsuario: string; citaActualId: string; onGestionar: (citaId: string) => void }) {
    const [citas, setCitas] = useState<CitaPacienteFila[]>([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        getCitasPendientesPaciente(rutUsuario, citaActualId)
            .then(setCitas)
            .catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar otras citas"))
            .finally(() => setCargando(false));
    }, [rutUsuario, citaActualId]);

    if (cargando) return <p className="text-sm text-muted-foreground">Cargando otras citas...</p>;
    if (citas.length === 0) return <p className="text-sm text-muted-foreground">El paciente no tiene otras citas pendientes.</p>;

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">Otras citas pendientes del paciente</p>
            {citas.map((c) => (
                <div key={c.id_cita} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                        <p className="font-medium">{c.profesion || "—"} · {c.prestacion || "—"}</p>
                        <p className="text-muted-foreground">
                            <Badge variant="warning">{c.estado_cita}</Badge> · Prioridad {c.priorizacion ?? "—"}
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onGestionar(c.id_cita)}>
                        Gestionar
                    </Button>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Crear `RegistrarLlamadaModal.tsx`**

```tsx
"use client";

import { useState } from "react";
// actions
import { registrarLlamada } from "../actions/registrarLlamada.action";
import type { CitaFila } from "../actions/getCitasPendientes.action";
// components
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
// types
import { RESPUESTAS_LLAMADA, RESPUESTA_LLAMADA } from "../types/comunicador";
import { toast } from "sonner";

export function RegistrarLlamadaModal({ cita, telefonos, correo, onCerrar, onRegistrado }: {
    cita: CitaFila;
    telefonos: string;
    correo: string;
    onCerrar: () => void;
    onRegistrado: (mensaje: string) => void;
}) {
    const [respuesta, setRespuesta] = useState<string>(RESPUESTA_LLAMADA.NO_CONTESTA);
    const [observacion, setObservacion] = useState("");
    const [horaAgendada, setHoraAgendada] = useState("");
    const [enviando, setEnviando] = useState(false);

    const requiereHora = respuesta === RESPUESTA_LLAMADA.ACEPTADA;

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setEnviando(true);
        try {
            const r = await registrarLlamada({
                cita_id: cita.id_cita,
                respuesta,
                observacion,
                hora_agendada: requiereHora ? horaAgendada : ""
            });
            onRegistrado(r.solicitudRealizada ? `Cita ${r.estadoCita}. Solicitud cerrada (Realizado).` : `Cita ${r.estadoCita}.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al registrar la llamada");
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-5">
                <div>
                    <h2 className="text-lg font-semibold">Registrar llamada</h2>
                    <p className="text-sm text-muted-foreground">Cita {cita.id_cita} · {cita.nombre_usuario}</p>
                    <p className="mt-1 text-sm">Teléfonos: {telefonos}</p>
                    <p className="text-sm">Correo: {correo}</p>
                </div>
                <form className="space-y-4" onSubmit={onSubmit}>
                    <div className="space-y-2">
                        <Label>Respuesta</Label>
                        <Select value={respuesta} onChange={(e) => setRespuesta(e.target.value)} required>
                            {RESPUESTAS_LLAMADA.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </Select>
                    </div>
                    {requiereHora && (
                        <div className="space-y-2">
                            <Label>Hora agendada</Label>
                            <Input type="datetime-local" value={horaAgendada} onChange={(e) => setHoraAgendada(e.target.value)} required />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Observación</Label>
                        <Textarea maxLength={350} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onCerrar}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={enviando}>
                            {enviando ? "Registrando..." : "Registrar"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/comunicador/components/MultiCitaPanel.tsx src/modules/comunicador/components/RegistrarLlamadaModal.tsx
git commit -m "feat(comunicador): modal de registro de llamada y panel multi-cita"
```

---

### Task 15: Tabla + página del comunicador

**Files:**
- Create: `src/modules/comunicador/components/CitasPendientesTabla.tsx`
- Modify: `src/app/(app)/comunicador/page.tsx`

**Interfaces:**
- Consumes: `getCitasPendientes`, `getFiltrosComunicador`, `CitasFiltros`, `RegistrarLlamadaModal`, `MultiCitaPanel`, `formatearTelefonos`, `formatearCorreo`.
- Produces: la página `/comunicador` (client component contenedor que orquesta filtros + tabla + modal). Nota: para contacto en el modal se necesita teléfono/correo del paciente; se obtienen vía `getUsuarioPorRut` existente (`@/modules/solicitudes/actions/getUsuarioPorRut.action`).

- [ ] **Step 1: Crear `CitasPendientesTabla.tsx`** (tabla presentacional con paginación, estilo de la tabla de `revisar/page.tsx`)

```tsx
"use client";

import { AlertTriangle } from "lucide-react";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type { CitaFila } from "../actions/getCitasPendientes.action";

function abreviar(codigo: string): string {
    return codigo.length > 14 ? `${codigo.slice(0, 12)}…` : codigo;
}

export function CitasPendientesTabla({ filas, total, pagina, porPagina, onPagina, onGestionar }: {
    filas: CitaFila[];
    total: number;
    pagina: number;
    porPagina: number;
    onPagina: (p: number) => void;
    onGestionar: (cita: CitaFila) => void;
}) {
    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    return (
        <div className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 font-medium">Código</th>
                            <th className="px-3 py-2 font-medium">Priorización</th>
                            <th className="px-3 py-2 font-medium">Disponibilidad</th>
                            <th className="px-3 py-2 font-medium">RUT</th>
                            <th className="px-3 py-2 font-medium">Profesión</th>
                            <th className="px-3 py-2 font-medium">Prestación</th>
                            <th className="px-3 py-2 font-medium">Fecha estimada</th>
                            <th className="px-3 py-2 font-medium">Estado</th>
                            <th className="px-3 py-2 font-medium"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.length === 0 ? (
                            <tr>
                                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={9}>
                                    No hay citas pendientes para los filtros actuales.
                                </td>
                            </tr>
                        ) : (
                            filas.map((c) => (
                                <tr key={c.id_cita} className="border-t">
                                    <td className="px-3 py-3 font-medium" title={c.id_cita}>{abreviar(c.id_cita)}</td>
                                    <td className="px-3 py-3">{c.priorizacion ?? "—"}</td>
                                    <td className="px-3 py-3">{c.disponibilidad || "—"}</td>
                                    <td className="px-3 py-3">{c.rut_usuario}</td>
                                    <td className="px-3 py-3">{c.profesion || "—"}</td>
                                    <td className="px-3 py-3">{c.prestacion || "—"}</td>
                                    <td className="px-3 py-3">{c.fecha_estimada_atencion ? new Date(c.fecha_estimada_atencion).toLocaleDateString("es-CL") : "—"}</td>
                                    <td className="px-3 py-3">
                                        <Badge variant="warning">
                                            <AlertTriangle size={12} />
                                            {c.estado_cita}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-3">
                                        <Button size="sm" onClick={() => onGestionar(c)}>
                                            Llamar
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{total} citas · página {pagina} de {totalPaginas}</span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
                        Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>
                        Siguiente
                    </Button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Reemplazar `src/app/(app)/comunicador/page.tsx`** (client component contenedor)

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
// actions
import { getCitasPendientes, CitaFila } from "@/modules/comunicador/actions/getCitasPendientes.action";
import { getFiltrosComunicador } from "@/modules/comunicador/actions/getFiltrosComunicador.action";
import { getUsuarioPorRut } from "@/modules/solicitudes/actions/getUsuarioPorRut.action";
// components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CitasFiltros, CitasFiltrosUI, FILTROS_INICIALES } from "@/modules/comunicador/components/CitasFiltros";
import { CitasPendientesTabla } from "@/modules/comunicador/components/CitasPendientesTabla";
import { RegistrarLlamadaModal } from "@/modules/comunicador/components/RegistrarLlamadaModal";
import { MultiCitaPanel } from "@/modules/comunicador/components/MultiCitaPanel";
// utils
import { formatearTelefonos, formatearCorreo } from "@/modules/comunicador/utils/contacto";

type Opciones = Awaited<ReturnType<typeof getFiltrosComunicador>>;

export default function ComunicadorPage() {
    const [opciones, setOpciones] = useState<Opciones>({ profesionales: [], prestaciones: [] });
    const [filtrosUI, setFiltrosUI] = useState<CitasFiltrosUI>(FILTROS_INICIALES);
    const [aplicados, setAplicados] = useState<CitasFiltrosUI>(FILTROS_INICIALES);
    const [pagina, setPagina] = useState(1);
    const [data, setData] = useState<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number }>({ filas: [], total: 0, pagina: 1, porPagina: 100 });
    const [citaSel, setCitaSel] = useState<CitaFila | null>(null);
    const [contacto, setContacto] = useState<{ telefonos: string; correo: string }>({ telefonos: "", correo: "" });

    useEffect(() => {
        getFiltrosComunicador().then(setOpciones).catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar filtros"));
    }, []);

    const cargar = useCallback(async () => {
        try {
            const r = await getCitasPendientes({
                temporalidad: aplicados.temporalidad,
                estado: aplicados.estado,
                profesional_id: aplicados.profesional_id || undefined,
                prestacion_id: aplicados.prestacion_id || undefined,
                edadMin: aplicados.edadMin || undefined,
                edadMax: aplicados.edadMax || undefined,
                fechaDesde: aplicados.fechaDesde || undefined,
                fechaHasta: aplicados.fechaHasta || undefined,
                pagina
            });
            setData(r);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al cargar la cola");
        }
    }, [aplicados, pagina]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function abrirGestion(cita: CitaFila) {
        setCitaSel(cita);
        try {
            const u = await getUsuarioPorRut(cita.rut_usuario);
            setContacto({
                telefonos: formatearTelefonos(u?.telefono, u?.telefono_alternativo),
                correo: formatearCorreo(u?.correo_contacto)
            });
        } catch {
            setContacto({ telefonos: formatearTelefonos(null, null), correo: formatearCorreo(null) });
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Comunicador</h1>
                <p className="mt-1 text-sm text-muted-foreground">Gestión de citaciones pendientes: registra llamadas y cierra citas.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Filtra por temporalidad, estado, profesión, prestación, edad y fecha estimada.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CitasFiltros
                        opciones={opciones}
                        valor={filtrosUI}
                        onCambio={setFiltrosUI}
                        onAplicar={() => {
                            setPagina(1);
                            setAplicados(filtrosUI);
                        }}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Citaciones pendientes</CardTitle>
                    <CardDescription>Ordenadas por estado (No contesta 2 → 1 → aviso → sin llamadas) y prioridad.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CitasPendientesTabla
                        filas={data.filas}
                        total={data.total}
                        pagina={data.pagina}
                        porPagina={data.porPagina}
                        onPagina={setPagina}
                        onGestionar={abrirGestion}
                    />
                </CardContent>
            </Card>

            {citaSel && (
                <RegistrarLlamadaModal
                    cita={citaSel}
                    telefonos={contacto.telefonos}
                    correo={contacto.correo}
                    onCerrar={() => setCitaSel(null)}
                    onRegistrado={(mensaje) => {
                        toast.success(mensaje);
                        setCitaSel(null);
                        cargar();
                    }}
                />
            )}
            {citaSel && (
                <div className="fixed bottom-4 right-4 z-20 w-80 rounded-lg border bg-card p-3 shadow-lg">
                    <MultiCitaPanel
                        rutUsuario={citaSel.rut_usuario}
                        citaActualId={citaSel.id_cita}
                        onGestionar={(id) => {
                            const otra = data.filas.find((f) => f.id_cita === id);
                            if (otra) abrirGestion(otra);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
```

> **Nota:** confirmar los nombres de campos que devuelve `getUsuarioPorRut` (`telefono`, `telefono_alternativo`, `correo_contacto`). Si difieren, ajustar el mapeo en `abrirGestion`. Son campos del modelo `Usuario` (Prisma): `telefono`, `telefono_alternativo`, `correo_contacto`.

- [ ] **Step 3: Verificar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/comunicador/components/CitasPendientesTabla.tsx "src/app/(app)/comunicador/page.tsx"
git commit -m "feat(comunicador): tabla de citas pendientes y pagina del modulo"
```

---

### Task 16: Ripple — filtro "Realizado" en revisar

**Files:**
- Modify: `src/app/(app)/solicitudes/revisar/page.tsx`

**Interfaces:** N/A (cambio de opciones de un `<Select>` de estado).

- [ ] **Step 1: Localizar el arreglo de estados del filtro** — buscar en `revisar/page.tsx` el arreglo/opciones del filtro de `estado` (p. ej. una constante `const estados = [...]` o las `<option>` del select de estado).

Run: `grep -n "estado" "src/app/(app)/solicitudes/revisar/page.tsx" | grep -iE "const .*estados|option value|\"En Curso\"|Realizado|Finalizada|Rechaz"`

- [ ] **Step 2: Agregar la opción `"Realizado"`** al conjunto de estados del filtro (junto a `"En Curso"`/`"Rechazado"`), de modo que las solicitudes cerradas por el comunicador sean filtrables. Si el filtro se arma desde una constante local, añadir `"Realizado"` a esa lista; si son `<option>` literales, agregar `<option value="Realizado">Realizado</option>`.

- [ ] **Step 3: Verificar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/solicitudes/revisar/page.tsx"
git commit -m "feat(solicitudes): opcion de filtro 'Realizado' en revisar"
```

---

## FASE 4 — Cierre

### Task 17: Verificación integral + prueba manual

**Files:** N/A (verificación).

- [ ] **Step 1: Suite completa**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: los tres en verde. Los tests nuevos (`estadoCita`, `contacto`, `temporalidad`, `rangoEdadAFechaNacimiento`, `access`, `llamada.schema`, `registrarLlamada`, `getPendientes`) pasan.

- [ ] **Step 2: Regenerar datos de prueba de citas** — para probar la cola se necesitan citas. Generar algunas validando una solicitud desde la UI de revisión, o sembrar manualmente. Confirmar que existan filas en `citas` con estados pendientes:

Run: `docker exec gestion-demanda-mysql mysql -ugestion -pgestion_password gestion_demanda -e "SELECT estado_cita, COUNT(*) FROM citas GROUP BY estado_cita;"`
Expected: al menos algunas citas en estados pendientes (si no hay, generarlas desde `/solicitudes/revisar`).

- [ ] **Step 3: Smoke manual** (lo ejecuta el humano)

1. `npm run dev`, login como comunicador (rvergara, centro 501).
2. Ir a `/comunicador`: se ve la tabla paginada, ordenada por estado en cascada y prioridad.
3. Aplicar filtros (temporalidad, estado, profesión→prestación, edad, fechas) y verificar que filtran.
4. "Llamar" en una cita → modal muestra teléfonos/correo (con fallbacks), registrar "No contesta" → estado pasa a "No contesta (1)"; repetir hasta autocierre "Sin respuesta" al 3º.
5. Registrar "Cita Aceptada" (con hora) en la última cita pendiente de una solicitud → verificar en BD que `solicitudes.estado_solicitud = 'Realizado'`.
6. Verificar el panel multi-cita con un paciente que tenga varias citas.

- [ ] **Step 4: Commit** (si hubo ajustes menores durante verificación)

```bash
git add -A
git commit -m "chore(comunicador): ajustes de verificacion final"
```

---

## Self-Review (cobertura del spec)

- **§2 Alcance** (cola, registro, autocierre, cierre en cascada, modal, contacto): Tasks 3–15. Fuera de alcance (cita de rechazo automática, policonsultantes, RBAC completo) no se implementa. ✔
- **§3 Schema** (FK Llamada→Cita, índices, migración): Task 1. ✔
- **§4 Máquina de estados** (transiciones, autocierre, comodín): Task 3 (+ tipos Task 2). ✔
- **§4.5 Cierre en cascada** (`estado_solicitud="Realizado"` atómico): Task 9. ✔
- **§5.1 Tabla** (columnas, paginación 100, orden en cascada): Tasks 10, 15. ✔
- **§5.2 Filtros** (temporalidad, estado, profesión, prestación, edad, rango fecha): Tasks 5, 6, 8, 10, 13. ✔
- **§5.3 Registro** (observacion siempre, hora_agendada solo Aceptada; contacto en modal): Tasks 8, 14. ✔
- **§5.4 Modal multi-cita:** Tasks 11, 14, 15. ✔
- **§6 Actions:** Tasks 9, 10, 11. ✔
- **§7 Reglas portadas** (contacto, priorización existente, RUT, multi-tenancy, agregados): Tasks 4, 10, 11. ✔
- **§8 RBAC del módulo:** Task 7. ✔
- **§9 Ripple** (getPendientes, ingresar, revisar "Realizado"): Tasks 12, 16. ✔
- **§11 Testing:** cada util/action con su test (Tasks 3–9, 12); Task 17 integral. ✔
- **§12 Aceptación:** Task 17. ✔

**Placeholder scan:** El único punto que requiere localización en código ajeno es el arreglo de estados del filtro en `revisar/page.tsx` (Task 16), con comando `grep` para ubicarlo — no es un placeholder de lógica. En Task 9 se corrige explícitamente el `rut_usuario` (Steps 3–4). Sin TBD/TODO de lógica.

**Type consistency:** `CitaFila`, `CitaPacienteFila`, `CitasFiltros`/`CitasFiltrosUI`, `RegistrarLlamadaInput`, `EstadoCita`/`RespuestaLlamada`, `computeEstadoCita`, `rangoTemporalidad`/`RangoFechas`, `rangoEdadAFechaNacimiento`/`RangoFechaNac`, `puedeAccederComunicador`, `ESTADOS_PENDIENTES`/`ORDEN_ESTADOS_PENDIENTES` se definen y consumen con las mismas firmas entre tareas.

**Nota de dependencia entre tareas:** Task 1 rompe `tsc` global temporalmente (getPendientes/ingresar) hasta Task 12; las tareas intermedias verifican con `npm test -- <archivo>` (que no compila todo el proyecto) y con `tsc` acotado a sus archivos. El árbol vuelve a `tsc` verde al completar Task 12.
