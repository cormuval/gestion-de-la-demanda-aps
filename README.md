# Gestion de la Demanda

Aplicacion web (Next.js App Router + TypeScript) para gestionar la demanda de atencion en APS (Valparaiso): solicitudes, comunicador (citas + llamados), dashboard y configuracion. App unica: front y back en Next.js.

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

Convenciones y arquitectura detalladas: ver [AGENTS.md](./AGENTS.md).

## Puesta en marcha

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y completa:
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (cliente OAuth de Google)
   - `AUTH_SECRET` (generalo con `npx auth secret`)
   - `DATABASE_URL` (apunta a MySQL en el puerto `3308`)
3. Levanta MySQL (Docker, host `3308`):
   ```bash
   npm run services:up
   ```
4. Prepara la base:
   ```bash
   npm run db:generate && npm run db:push && npm run db:seed
   ```
5. Inicia la app:
   ```bash
   npm run dev
   ```
   Disponible en http://localhost:3000

## Autenticacion

- Login 100% Google OAuth. Solo entran correos registrados como `funcionarios` con `estado = 'Activo'` (los `@demo.local` del seed no sirven con Google real; usa un correo real sembrado en el seed).
- En el cliente OAuth de Google, registra el redirect URI:
  ```
  http://localhost:3000/api/auth/callback/google
  ```

## Reglas de pendientes

- Solicitudes pendientes: `solicitudes.estado_solicitud = 'En Curso'`.
- Citas/gestiones pendientes: `llamadas.respuesta_usuario` en `Sin llamadas`, `No contesta (1)`, `No contesta (2)`.

## Tests

```bash
npm test        # Vitest
npm run lint    # ESLint
```
