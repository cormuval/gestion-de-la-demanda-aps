# Gestion de la Demanda

Aplicacion web (Next.js App Router + TypeScript) para gestionar la demanda de atencion en APS: solicitudes, comunicador (citas + llamados), dashboard y configuracion.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v3 + shadcn/ui (estilo new-york)
- Backend integrado via Server Actions; Prisma + MySQL 8.4 (Docker)
- Autenticacion NextAuth v5 (Google OAuth)
- Zod + react-hook-form, sonner (toasts), Vitest (tests)

## Estructura

- `src/app` — rutas (grupo `(app)` protegido) y `api/auth`
- `src/modules/[modulo]` — dominios (actions, components, schemas, types)
- `src/shared` — ui (shadcn), layout, lib (prisma, auth, logger), types
- `prisma` — schema y seed

## Puesta en marcha

1. Copia `.env.example` a `.env` y completa `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` y `DATABASE_URL`.
2. Levanta MySQL: `npm run services:up`
3. Instala dependencias: `npm install`
4. Prepara la base: `npm run db:generate && npm run db:push && npm run db:seed`
5. Inicia la app: `npm run dev` (http://localhost:3000)

## Autenticacion

El login es 100% Google OAuth. Solo entran correos registrados como `funcionarios` con `estado = 'Activo'`. Los correos de prueba `@demo.local` del seed deben reemplazarse por correos Google reales para iniciar sesion.

## Reglas de pendientes

- Solicitudes pendientes: `solicitudes.estado_solicitud = 'En Curso'`.
- Citas/gestiones pendientes: `llamadas.respuesta_usuario` en `Sin llamadas`, `No contesta (1)`, `No contesta (2)`.
