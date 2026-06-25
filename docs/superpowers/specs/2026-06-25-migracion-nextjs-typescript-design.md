# Migración a Next.js + TypeScript (app única) — Diseño

- **Fecha:** 2026-06-25
- **Autor:** Renzo Vergara (con asistencia de Claude)
- **Estado:** Aprobado para planificación
- **Proyecto de referencia:** `C:\Users\Master\Documents\Proyectos\gestion-informacion-das`

## 1. Objetivo

Migrar el proyecto `gestion-de-la-demanda-aps` de un **monorepo en JavaScript** (Next.js + 2 microservicios Express + paquete Prisma) a una **aplicación única Next.js en TypeScript**, donde Next.js actúa como **frontend y backend** (Server Actions), replicando la arquitectura del proyecto de referencia `gestion-informacion-das`. Dejar el proyecto listo para trabajar con **Tailwind + shadcn**.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Lenguaje | TypeScript con `strict: true` |
| Arquitectura | App Next.js única (App Router); se eliminan los workspaces `apps/`, `services/`, `packages/` |
| Backend | **Server Actions** (`*.action.ts`, `'use server'`); API Routes solo para integraciones externas/webhooks |
| Capa de datos | **Prisma + MySQL** (se conserva el schema actual; el cliente se mueve a la raíz) |
| Autenticación | **NextAuth v5 (Auth.js) con Google OAuth** — todo el login es vía Google |
| Estructura | Por dominios: `src/modules/[modulo]` + `src/shared` + `src/config` (igual que la referencia) |
| Validación / Forms | **Zod + react-hook-form** (`@hookform/resolvers`) |
| Tests | **Vitest + Testing Library + jsdom** |
| Toasts | **sonner** |
| Auditoría | **AuditLogger** adaptado a Prisma (misma interfaz pública que la referencia) |
| Estilos | **Tailwind v3** + `tailwindcss-animate` |
| shadcn | Re-inicializado con `tsx: true`, estilo **new-york**, baseColor **gray**, alias `@/shared/components/ui` |
| Convenciones | Español; indentación 4 espacios; `eslint-config-next` |

## 3. Estructura de carpetas objetivo

```text
prisma/
├── schema.prisma            # schema actual + modelo AuditLog
└── seed.ts                  # seed migrado a TS
src/
├── app/
│   ├── (app)/               # rutas protegidas + layout con AppShell
│   │   ├── solicitudes/     # ingresar, revisar
│   │   ├── comunicador/     # gestión de citas + llamadas
│   │   ├── dashboard/
│   │   └── configuracion/usuarios-roles/
│   ├── auth/                # login + página de error de NextAuth
│   ├── api/auth/[...nextauth]/route.ts
│   ├── layout.tsx
│   ├── Providers.tsx        # SessionProvider + Toaster (sonner)
│   └── globals.css
├── modules/                 # cada uno: actions/, components/, hooks/, schemas/, types/, utils/
│   ├── solicitudes/
│   ├── comunicador/
│   ├── dashboard/
│   ├── usuarios-roles/
│   └── catalogos/
├── shared/
│   ├── components/
│   │   ├── ui/              # shadcn (.tsx)
│   │   └── layout/          # Sidebar/Navbar (desde el AppShell actual)
│   ├── lib/                 # prisma.ts, logger.ts (AuditLogger), utils.ts
│   ├── types/
│   ├── interfaces/
│   ├── utils/
│   └── hooks/
├── config/constants/
├── auth.ts                  # configuración NextAuth v5
└── middleware.ts            # protección de rutas del grupo (app)
```

## 4. Capa de datos (Prisma + MySQL)

- **Cliente singleton** en `src/shared/lib/prisma.ts` usando el patrón de variable global anti-HMR (equivalente al `database.ts` de la referencia para Mongo).
- El `schema.prisma` actual se conserva con dos cambios:
  - `Funcionario.password_hash` pasa a **opcional** (`String?`). El login es 100% Google OAuth, por lo que la columna queda sin uso pero se mantiene por compatibilidad.
  - **Nuevo modelo `AuditLog`** (tabla `logs`) para soportar el AuditLogger sobre MySQL:

    ```prisma
    model AuditLog {
      id         Int      @id @default(autoincrement())
      timestamp  DateTime @default(now())
      category   String   @db.VarChar(50)
      action     String   @db.VarChar(50)
      success    Boolean
      user_id    String?  @db.VarChar(150)
      user_name  String?  @db.VarChar(150)
      user_rut   String?  @db.VarChar(50)
      resource_id String? @db.VarChar(150)
      details    String?  @db.Text
      error      String?  @db.Text

      @@index([category])
      @@index([action])
      @@index([timestamp])
      @@map("logs")
    }
    ```
- Scripts `db:generate`, `db:push`, `db:seed`, `db:studio` se mueven al `package.json` raíz.

## 5. Autenticación (NextAuth v5 + Google OAuth)

- `src/auth.ts` con provider Google, replicando los callbacks de la referencia pero contra **Prisma**:
  - **`signIn` callback:** busca `funcionario` por `email`. Si no existe o `estado !== 'Activo'` → retorna `false` (acceso denegado). Registra el intento con AuditLogger.
  - **`jwt` callback:** al iniciar sesión, carga el funcionario con su `role` + `menus` y los guarda en el token (`rut`, `rol`, `menu`).
  - **`session` callback:** expone en `session.user` los campos `rut`, `rol` (`{ id, nombre }`) y `menu` (array de items), reproduciendo lo que hoy entrega `auth-service` → `toSession()`.
  - **`events.signIn` / `events.signOut`:** AuditLogger (`logAuth`).
- **Tipado de sesión** en `src/shared/types/next-auth.d.ts` (extiende `Session`, `User`, `JWT` con `rut`, `rol`, `menu`).
- **`middleware.ts`** protege las rutas del grupo `(app)`; redirige a `/auth` (o página de login) si no hay sesión.
- El `AppShell` (cliente) filtra el menú por rol usando `useSession`, igual que hoy con `auth-context`.
- **Implicación operativa:** los usuarios de prueba con dominio `@demo.local` no funcionan con Google real. En desarrollo se debe usar cuentas Google reales cuyos emails existan en `funcionarios`. El seed se ajusta para documentar/parametrizar emails reales.

## 6. Reemplazo de microservicios por Server Actions

Los microservicios `auth-service` y `solicitudes-service` se eliminan. Cada endpoint se convierte en Server Action (con validación Zod y AuditLogger):

| Endpoint actual (Express) | Server Action |
|---|---|
| `POST /auth/login`, `GET /auth/me` | NextAuth (Google OAuth) |
| `GET /solicitudes/pendientes` | `modules/solicitudes/actions/getPendientes.action.ts` |
| `GET /solicitudes` | `modules/solicitudes/actions/getSolicitudes.action.ts` |
| `POST /solicitudes` | `modules/solicitudes/actions/crearSolicitud.action.ts` |
| `GET /catalogos` | `modules/catalogos/actions/getCatalogos.action.ts` |

- `src/lib/api.js` (cliente fetch al backend) **se elimina**; los componentes invocan las actions directamente.
- Reglas de negocio preservadas:
  - Solicitudes pendientes: `estado_solicitud = 'En Curso'`.
  - Citas/gestiones pendientes: `respuesta_usuario` en `Sin llamadas`, `No contesta (1)`, `No contesta (2)`.
  - Control de acceso por rol equivalente al `requireSolicitudesAccess` actual, ahora validado dentro de la action a partir de la sesión.

## 7. Módulos de dominio

- **`solicitudes`** — ingresar, revisar, listar y crear solicitudes.
- **`comunicador`** — **unifica citas y llamados**. Modelo conceptual: **una cita contiene varias llamadas**; para cerrar o gestionar una cita se realizan llamados. Se apoya en la relación existente `Llamada.cita_id → Solicitud` del schema Prisma (1 cita — N llamadas), que se mantiene sin cambios estructurales.
- **`dashboard`** — estadísticas/indicadores.
- **`usuarios-roles`** — administración de funcionarios, roles y menús (Configuración).
- **`catalogos`** — tipos de solicitud y motivos (poblar selects).

Cada módulo sigue la convención: `actions/`, `components/`, `hooks/`, `schemas/`, `types/`, `utils/`.

## 8. UI: Tailwind + shadcn

- **Tailwind v3** + `tailwindcss-animate`, config en `tailwind.config.ts`.
- **shadcn re-inicializado**: `components.json` con `tsx: true`, estilo **new-york**, baseColor **gray**, `rsc: true`, alias `ui: @/shared/components/ui`, `utils: @/shared/lib/utils`.
- Los componentes UI actuales (`button`, `card`, `input`, `label`, `select`, `badge`, `textarea`) se regeneran como `.tsx` con los tipos canónicos de shadcn.
- `Providers.tsx` (cliente) con `SessionProvider` + `<Toaster position="top-right" richColors />` (sonner).

## 9. Toolchain y configuración

- **TypeScript:** `tsconfig.json` con `strict`, `moduleResolution: bundler`, `paths: { "@/*": ["./src/*"] }`, plugin `next`, `types: ["vitest/globals"]`.
- **Vitest:** `vitest.config.ts` + `vitest.setup.ts` (Testing Library + jsdom), scripts `test`, `test:watch`, `test:ui`.
- **ESLint:** `eslint-config-next` (`eslint.config.mjs`).
- **Formularios:** Zod + react-hook-form + `zodResolver`; feedback con `toast` (sonner); manejo de errores con `try/catch`.
- **AuditLogger** (`src/shared/lib/logger.ts`): misma interfaz pública que la referencia (`log`, `logAuth`, `logDataAccess`, `logSecurity`), pero persiste en la tabla `logs` vía Prisma.
- **Docs:** `README.md`, `AGENTS.md` y `.env.example` actualizados (variables `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `DATABASE_URL`).

## 10. Estrategia de migración (orden de trabajo)

1. **Reestructurar el repo:** mover `apps/web` → raíz, eliminar `services/` y `packages/`, nuevo `package.json` (sin workspaces) + `tsconfig.json` + configs.
2. **Prisma a la raíz:** `prisma/schema.prisma` (con `AuditLog` y `password_hash` opcional), cliente singleton, seed en TS.
3. **Auth:** `src/auth.ts` (Google), `middleware.ts`, tipos de sesión, ruta `api/auth/[...nextauth]`.
4. **UI base:** shadcn re-init + componentes `.tsx` + layout (Sidebar desde el AppShell actual) + `Providers`.
5. **Páginas → TSX** consumiendo Server Actions.
6. **Server Actions por módulo** (Zod + AuditLogger + control de acceso por rol).
7. **Tests:** Vitest + tests base de las actions críticas (`crearSolicitud`, `getPendientes`).
8. **Docs + verificación:** README/AGENTS/.env.example; correr `lint`, `build`, `test`.

## 11. Fuera de alcance (YAGNI)

- No se migra a MongoDB ni a mysql2 crudo (se mantiene Prisma).
- No se implementa login local con contraseña (se elimina del flujo; la columna queda como rastro).
- No se agregan integraciones externas (Google Sheets, etc.) presentes en la referencia.
- No se rediseñan vistas más allá del cambio de estilo shadcn (default/slate → new-york/gray).

## 12. Criterios de aceptación

- `npm run build`, `npm run lint` y `npm run test` pasan en verde.
- Login con Google funcional; un email no presente en `funcionarios` es rechazado.
- Las pantallas actuales (solicitudes ingresar/revisar, comunicador, dashboard, usuarios-roles) funcionan consumiendo Server Actions, sin los microservicios.
- El menú lateral se filtra por rol a partir de la sesión.
- AuditLogger registra eventos de auth y de acceso a datos en la tabla `logs`.
- No quedan referencias a `apps/`, `services/`, `packages/` ni a `src/lib/api.js`.
