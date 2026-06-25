# AGENTS.md — Guia para agentes (Gestion de la Demanda)

## Comandos

- `npm run dev` / `npm run build` / `npm run lint` / `npm test`
- `npm run db:generate|db:push|db:seed|db:studio`

## Convenciones

- Idioma: espanol (UI, comentarios, commits). Indentacion: 4 espacios.
- TypeScript strict. Tipos explicitos; `interface` para objetos, `type`/`as const` para uniones.
- Alias `@/` -> `src/`. UI en `@/shared/components/ui`.

## Backend

- Server Actions en `src/modules/[modulo]/actions/*.action.ts` con `'use server'`.
- Validar inputs con Zod. Registrar operaciones de datos con `AuditLogger` (`src/shared/lib/logger.ts`).
- API Routes solo para integraciones externas (hoy: `api/auth/[...nextauth]`).

## UI

- Tailwind + shadcn (new-york). Revisar `shared/components/ui` antes de crear componentes.
- Feedback con `toast` (sonner). Formularios con react-hook-form + zodResolver.

## Auth

- NextAuth v5 (Google). `signIn` valida que el email exista como funcionario activo.
- Acceso por rol segun el menu cargado en la sesion.
