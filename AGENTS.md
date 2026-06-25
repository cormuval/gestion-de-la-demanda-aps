# AGENTS.md — Gestion de la Demanda (APS)

App web para gestionar la demanda de atencion en salud primaria (Valparaiso): solicitudes, comunicador (citas + llamados), dashboard y configuracion. App unica Next.js (front + back).

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
2. `npm run services:up && npm run db:generate && npm run db:push && npm run db:seed`
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
- Validar inputs con Zod. Control de acceso via sesion (`requireSessionUser`, `puedeAccederSolicitudes`).
- Auditar operaciones de datos con `AuditLogger` (`src/shared/lib/logger.ts`, tabla `logs`).
- API Routes solo para integraciones externas (hoy: `api/auth/[...nextauth]`).
- Feedback de UI con `toast` (sonner); manejo de errores con `try/catch`. Sin `console.log` en produccion.

## Auth

- NextAuth v5 Google. Split config: `auth.config.ts` (edge-safe, sin Prisma) + `auth.ts` (callbacks con Prisma).
- `signIn` solo permite emails que existan en `funcionarios` con `estado = 'Activo'`.
- La sesion expone `rut`, `nombre`, `rol`, `menu`; el acceso por rol se deriva del menu cargado.

## Datos y reglas de negocio

- Modelos clave: `Funcionario`/`Role`/`Menu`, `Usuario`, `Solicitud`, `Llamada`, `TipoSolicitud`/`Motivo`.
- Una cita (solicitud) puede tener varias llamadas (`Llamada.cita_id -> Solicitud`).
- Solicitudes pendientes: `estado_solicitud = 'En Curso'`.
- Citas/gestiones pendientes: `respuesta_usuario` en `Sin llamadas`, `No contesta (1)`, `No contesta (2)`.
- Acceso a solicitudes: `Administrador`, `Orientador`, `SOME`, `Orientador y Comunicador`, `Full`.
