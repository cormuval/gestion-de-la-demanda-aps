# AGENTS.md — Gestion de la Demanda (APS)

App web para gestionar la demanda de atencion en salud primaria (Valparaiso): solicitudes, comunicador (citas + llamados), dashboard y configuracion. App unica Next.js (front + back).

## Metodologia de desarrollo (SDD + superpowers)

El proyecto se desarrolla con **SDD (Subagent-Driven Development)** sobre el framework
**superpowers**. No es opcional para trabajo de fondo: es la forma en que se toman y se documentan
las decisiones del proyecto.

**Cuando aplicarlo (casi siempre):** funcionalidades medianas o grandes, decisiones importantes de
arquitectura, y cualquier cambio de reglas de negocio. En esos casos **la documentacion es la clave
del proceso**: el spec y el plan quedan versionados en el repo antes de escribir codigo.

**Cuando basta el flujo directo:** correcciones puntuales, ajustes de copy, refactors mecanicos sin
cambio de comportamiento. Ante la duda, aplicar SDD.

Ciclo:

1. `brainstorming` — explorar intencion y requisitos **antes** de disenar.
2. `writing-plans` — spec en `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md` y plan por tareas
   en `docs/superpowers/plans/AAAA-MM-DD-<tema>.md`.
3. `using-git-worktrees` — aislar la rama de trabajo.
4. `subagent-driven-development` (o `executing-plans`) — ejecutar el plan tarea por tarea.
5. `test-driven-development` — test que falla, implementacion, test que pasa. En cada tarea.
6. `systematic-debugging` — ante cualquier bug o test rojo, antes de proponer un fix.
7. `verification-before-completion` — correr los comandos y confirmar la salida **antes** de decir
   que algo esta listo. Evidencia antes de afirmaciones.
8. `requesting-code-review` / `receiving-code-review` — revisar con rigor tecnico, no por cortesia.
9. `finishing-a-development-branch` — cerrar e integrar.

### Skills requeridas en cada entorno local

Las skills **se versionan en `.agents/skills/`**, junto con `skills-lock.json`. Un clon nuevo ya las
trae; no hay que instalarlas para leerlas.

`.claude/skills/` **no** se versiona (esta en `.gitignore`): son symlinks a `.agents/skills/` con
rutas absolutas, propias de cada maquina. Se regeneran localmente ejecutando el instalador, que es
idempotente:

```bash
npx skills add obra/superpowers
npx skills add https://github.com/shadcn/ui --skill shadcn
```

Esos mismos comandos son los que hay que correr si en un entorno **faltan** las skills o hay que
actualizarlas. Se instalan **todas** las de superpowers: `brainstorming`, `systematic-debugging`,
`writing-plans`, `using-superpowers`, `requesting-code-review`, `test-driven-development`,
`executing-plans`, `subagent-driven-development`, `verification-before-completion`,
`receiving-code-review`, `writing-skills`, `dispatching-parallel-agents`, `using-git-worktrees`,
`finishing-a-development-branch`.

La skill **`shadcn` es obligatoria**: todo el frontend se construye sobre shadcn/ui, y esa skill
aporta el contexto del proyecto, la documentacion de componentes y los ejemplos de uso.

Tras actualizar skills, **commitear los cambios de `.agents/skills/` y `skills-lock.json`** para que
todo el equipo quede en la misma version.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript strict
- Prisma + MySQL 8.4 (Docker) — backend via Server Actions
- NextAuth v5 (Auth.js) con Google OAuth
- Tailwind v3 + shadcn/ui (estilo new-york) + sonner (toasts)
- Zod + react-hook-form; Vitest + Testing Library

## Estructura

```
prisma/                      schema.prisma + seed.ts
src/
  app/                       rutas; grupo (app) protegido; auth/; api/auth/[...nextauth]
  modules/[modulo]/          actions/ components/ hooks/ schemas/ types/ utils/
  shared/                    components/(ui shadcn, layout) · lib/(prisma, auth, logger) · types/ · utils/
  config/                    constantes
  auth.ts · auth.config.ts · middleware.ts
```

Modulos: `solicitudes`, `comunicador` (citas+llamados unificados), `dashboard`, `usuarios-roles`, `catalogos`.

## Comandos

- `npm run dev` · `npm run build` · `npm run lint` · `npm test`
- `npm run db:generate | db:push | db:seed | db:studio`
- `npm run services:up | services:down` (MySQL por Docker, host **3308**)

## Entorno local

1. `cp .env.example .env`; completar `AUTH_GOOGLE_ID/SECRET`, `AUTH_SECRET` (`npx auth secret`), `DATABASE_URL` (puerto 3308).
2. `npm run services:up && npm run db:generate && npm run db:push && npm run db:seed && npm run db:seed:ref`
   - `db:seed`: roles, permisos, funcionarios demo. `db:seed:ref`: datos de referencia reales (centros, profesionales, prestaciones, tipos, motivos) desde `prisma/seed-data/referencia.sql`.
3. `npm run dev` → http://localhost:3000
- Login Google requiere redirect URI `http://localhost:3000/api/auth/callback/google` registrado en el cliente OAuth.

## Convenciones

- Idioma: espanol (UI, comentarios, commits). Indentacion: 4 espacios.
- TypeScript strict; tipos explicitos. `interface` para objetos, `type`/`as const` para uniones.
- Alias `@/` -> `src/`. Imports categorizados con comentarios (`// lib`, `// components`, ...).
- Componentes PascalCase; funciones/vars camelCase; Server Actions con sufijo `.action.ts`.
- Revisar `shared/components/ui` antes de crear componentes nuevos.

## Backend (Server Actions)

- Mutaciones/consultas internas en `src/modules/[modulo]/actions/*.action.ts` con `'use server'`.
- Validar inputs con Zod. Control de acceso con `requirePermiso('modulo.accion')` de `src/shared/lib/permisos.ts`.
- Auditar operaciones de datos con `AuditLogger` (`src/shared/lib/logger.ts`, tabla `logs`).
- API Routes solo para integraciones externas (hoy: `api/auth/[...nextauth]`).
- Feedback de UI con `toast` (sonner); manejo de errores con `try/catch`. Sin `console.log` en produccion.

## Auth

- NextAuth v5 Google. Split config: `auth.config.ts` (edge-safe, sin Prisma) + `auth.ts` (callbacks con Prisma).
- `signIn` solo permite emails que existan en `funcionarios` con `estado = 'Activo'`.
- La sesion expone `rut`, `nombre`, `rol` y `centro`; los permisos se leen por request desde `roles_permisos` (`src/shared/lib/permisos.ts`).
- `signIn` tambien exige que el `Role` del funcionario este activo.

## Datos y reglas de negocio

- Modelos clave: `Funcionario`/`Role`/`RolPermiso`, `Usuario`, `Solicitud`, `Llamada`, `TipoSolicitud`/`Motivo`.
- Una cita (solicitud) puede tener varias llamadas (`Llamada.cita_id -> Solicitud`).
- Solicitudes pendientes: `estado_solicitud = 'En Curso'`.
- Citas/gestiones pendientes: `respuesta_usuario` en `Sin llamadas`, `No contesta (1)`, `No contesta (2)`.
- Autorizacion RBAC: catalogo de permisos en `src/config/permisos.ts`; asignacion por rol en la tabla `roles_permisos`, editable desde Configuracion -> Roles -> Permisos.
- Anti-escalada RBAC: desde Configuracion nadie puede otorgar permisos que su propio rol no tiene,
  editar roles/funcionarios superiores, cambiar su propio rol/estado/centro, ni dejar el sistema sin
  administradores activos. Ver `docs/rbac-permisos.md`.
- Paginas protegidas con `requirePermisoPagina`; Server Actions con `requirePermiso`. El middleware solo valida autenticacion.
- El seed siembra permisos solo para roles sin ninguno (bootstrap); una vez configurado un rol, el mantenedor es la fuente de verdad.
- **Antes de tocar permisos, leer `docs/rbac-permisos.md`**: explica que vive en codigo y que en BD, el flujo completo, las salvaguardas, y el **procedimiento paso a paso para crear, quitar o renombrar un permiso** (incluye checklist). Agregar un permiso es cambio de codigo + deploy; no se puede crear desde la UI.

## Documentacion del proyecto

- `docs/rbac-permisos.md` — RBAC: catalogo, `roles_permisos`, guards, y como crear un permiso nuevo.
- `docs/er-implementacion.md` — modelo de datos.
- `docs/superpowers/specs/` y `docs/superpowers/plans/` — specs y planes SDD de cada feature (fuente para entender por que algo esta hecho como esta).
