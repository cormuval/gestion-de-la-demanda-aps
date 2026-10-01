# AGENTS.md — Gestion de la Demanda (APS)

## Constitucion

Aplicacion web para apoyar la gestion de la demanda de atencion en la salud primaria (Valparaiso).
Su flujo principal, y razon de ser, es: **se ingresa una solicitud → la solicitud se gestiona → se
contacta telefonicamente al usuario para coordinar la entrega de la prestacion**. Asi se gestiona la
demanda. Todo lo demas (dashboard, SOME, configuracion, catalogos) es complementario a ese flujo y
no debe competir con el ni complicarlo. App unica Next.js (front + back).

**Premisa: integralidad centrada en el paciente.** En las tres etapas el sistema mira al paciente
completo, no solo la solicitud en curso, para no duplicar acciones y hacer eficientes las revisiones
y llamadas:

- **Ingreso:** evitar solicitudes duplicadas para el mismo paciente.
- **Gestion:** al revisar una solicitud, mostrar en el mismo espacio las demas pendientes del paciente.
- **Contacto:** al llamar, mostrar todo lo pendiente del paciente para resolverlo en un solo llamado.

Toda funcionalidad nueva de estas etapas debe respetar esta premisa.

## Metodologia de desarrollo (SDD)

El proyecto se desarrolla con **SDD (Subagent-Driven Development)** usando el framework
**superpowers**. No es opcional para trabajo de fondo: es la forma en que se toman y se documentan
las decisiones del proyecto.

**Cuando aplicarlo (casi siempre):** funcionalidades medianas o grandes, decisiones importantes de
arquitectura, y cualquier cambio de reglas de negocio. En esos casos **la documentacion es la clave
del proceso**: el spec y el plan quedan versionados en el repo antes de escribir codigo.

**Cuando basta el flujo directo:** correcciones puntuales, ajustes de copy, refactors mecanicos sin
cambio de comportamiento. Ante la duda, aplicar SDD.

### Skills requeridas en cada entorno local

```bash
npx skills add obra/superpowers
npx skills add https://github.com/shadcn/ui --skill shadcn
npx skills add https://github.com/google-labs-code/stitch-skills --skill shadcn-ui
```

Esos mismos comandos son los que hay que correr si en un entorno **faltan** las skills o hay que
actualizarlas. Se deben instalar **todas** las de superpowers.

La skill **`shadcn` es obligatoria**: todo el frontend se construye sobre shadcn/ui, y esa skill
aporta el contexto del proyecto, la documentacion de componentes y los ejemplos de uso.

Tras actualizar skills, **commitear los cambios de `.agents/skills/` y `skills-lock.json`** para que
todo el equipo quede en la misma version.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript strict
- Prisma + MySQL 8.4 (Docker) — backend via Server Actions
- NextAuth v5 (Auth.js) con Google OAuth
- Tailwind v3 + shadcn/ui (estilo new-york) + sonner (toasts)
- Zod; Vitest + Testing Library

## Arquitectura

```
prisma/                      schema.prisma + seed.ts
src/
  app/                       rutas; grupo (app) protegido; auth/; api/auth/[...nextauth]
  modules/[modulo]/          actions/ components/ hooks/ schemas/ types/ utils/
  shared/                    components/(ui shadcn, layout) · hooks/ · lib/(prisma, auth, permisos, logger) · types/
  config/                    constantes (permisos, navegacion)
  auth.ts · auth.config.ts · middleware.ts
```

Modulos: `solicitudes`, `comunicador` (citas + llamados), `dashboard`, `some`, `configuracion`
(funcionarios, roles, permisos), `catalogos`.

**La aplicacion es modular y la convencion se respeta en todo el ciclo de desarrollo.** Lo exclusivo
de un modulo o entidad (actions, componentes, hooks, schemas, tipos, interfaces, utils) vive en
`src/modules/[modulo]/`. Solo lo que comparten varios modulos va a `src/shared/`.

## Comandos

- `npm run dev` · `npm run build` · `npm run lint` · `npm test`
- `npm run db:generate | db:push | db:seed | db:studio`
- `npm run services:up | services:down` (MySQL por Docker, host **3308**)

## Configuracion del Entorno local

1. `npm install`; `cp .env.example .env`; completar `AUTH_GOOGLE_ID/SECRET`, `AUTH_SECRET` (`npx auth secret`), `DATABASE_URL` (puerto 3308).
2. `npm run services:up && npm run db:generate && npm run db:push && npm run db:seed && npm run db:seed:ref`
   - `db:seed`: roles, permisos, funcionarios demo. `db:seed:ref`: datos de referencia reales desde `prisma/seed-data/referencia.sql`.
3. `npm run dev` → http://localhost:3000 (Google OAuth requiere el redirect URI `http://localhost:3000/api/auth/callback/google`; para entrar, usar un correo real sembrado como funcionario activo, los `@demo.local` no sirven).

## Convenciones

- Idioma: espanol (UI, comentarios, commits). Indentacion: 4 espacios.
- `interface` para objetos, `type`/`as const` para uniones; tipos explicitos.
- Alias `@/` -> `src/`. Imports categorizados con comentarios (`// lib`, `// components`, ...).
- Revisar `shared/components/ui` antes de crear componentes nuevos.

## Backend (Server Actions)

- En `src/modules/[modulo]/actions/*.action.ts`. API Routes solo para integraciones externas (hoy: `api/auth/[...nextauth]`).
- Validar inputs con Zod; control de acceso con `requirePermiso('modulo.accion')`.
- Devolver `ResultadoAccion<T>` (`src/shared/types/resultado.ts`) en vez de lanzar errores: en produccion Next oculta el mensaje.
- Auditar operaciones de datos con `AuditLogger` (`src/shared/lib/logger.ts`, tabla `logs`).
- Feedback de UI con `toast` (sonner). Sin `console.log` en produccion.

## Auth

- NextAuth v5 Google. Split config: `auth.config.ts` (edge-safe, sin Prisma) + `auth.ts` (callbacks con Prisma).
- `signIn` solo permite emails de `funcionarios` con `estado = 'Activo'` y cuyo `Role` este activo.
- La sesion expone `rut`, `nombre`, `rol` y `centro`; los permisos se leen por request desde `roles_permisos`.

## Reglas de negocio

- Modelos clave: `Funcionario`/`Role`/`RolPermiso`, `Usuario` (paciente), `Solicitud`, `Cita`, `Llamada`, `TipoSolicitud`/`Motivo`.
- Una solicitud genera citas (`Cita.solicitud_id`) y cada cita puede tener varias llamadas (`Llamada.cita_id`).
- Solicitudes pendientes: `estado_solicitud = 'En Curso'`.
- Citas pendientes: `estado_cita` en `ESTADOS_PENDIENTES` (`src/modules/comunicador/types/comunicador.ts`).

## Permisos (RBAC)

**Antes de tocar permisos, leer `docs/rbac-permisos.md`** (que vive en codigo y que en BD, salvaguardas
y checklist para crear, quitar o renombrar un permiso).

- Catalogo en `src/config/permisos.ts`; asignacion por rol en `roles_permisos`, editable desde
  Configuracion -> Roles -> Permisos. Agregar un permiso es cambio de codigo + deploy.
- Paginas con `requirePermisoPagina`; Server Actions con `requirePermiso`. El middleware solo valida autenticacion.
- Anti-escalada: nadie puede otorgar permisos que su rol no tiene, editar roles/funcionarios
  superiores, cambiar su propio rol/estado/centro, ni dejar el sistema sin administradores activos.
- El seed siembra permisos solo para roles sin ninguno; luego el mantenedor es la fuente de verdad.

## Documentacion del proyecto

- `docs/rbac-permisos.md` — RBAC.
- `docs/er-implementacion.md` — modelo de datos.
- `docs/superpowers/specs/` y `docs/superpowers/plans/` — specs y planes SDD de cada feature (por que algo esta hecho como esta).
