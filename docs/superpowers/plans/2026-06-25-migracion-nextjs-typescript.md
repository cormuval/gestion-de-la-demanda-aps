# Migración a Next.js + TypeScript (app única) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el monorepo JS (Next.js + microservicios Express + paquete Prisma) a una app única Next.js en TypeScript, con backend vía Server Actions, auth Google (NextAuth v5), Prisma+MySQL, y UI Tailwind + shadcn lista para trabajar.

**Architecture:** Una sola app Next.js (App Router) en `src/`, estructura por dominios (`modules/`, `shared/`, `config/`). Los endpoints Express se reemplazan por Server Actions que llaman a Prisma. Autenticación con NextAuth v5 (Google OAuth) mapeando email→funcionario→rol→menú. Auditoría con AuditLogger sobre una tabla Prisma `logs`.

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), Prisma + MySQL, NextAuth v5 (Auth.js), Zod, react-hook-form, sonner, Tailwind v3 + shadcn (new-york/gray), Vitest + Testing Library.

## Global Constraints

- **Lenguaje/idioma:** todo en español (UI, comentarios, mensajes de commit).
- **Indentación:** 4 espacios. Sin tabulaciones.
- **TypeScript:** `strict: true`. Tipos explícitos; `interface` para objetos, `type` para uniones/`as const`.
- **Alias de imports:** `@/*` → `./src/*`. Excepción: `@/auth` → `src/auth.ts`.
- **Server Actions:** archivos `*.action.ts` con pragma `'use server'`; validar inputs con Zod; invocar `AuditLogger` en operaciones de datos.
- **API Routes:** solo para integraciones externas (en esta migración, únicamente `api/auth/[...nextauth]`).
- **shadcn:** `components.json` con `tsx: true`, estilo `new-york`, baseColor `gray`, alias `ui: @/shared/components/ui`, `utils: @/shared/lib/utils`.
- **Reglas de negocio (verbatim):** Solicitudes pendientes = `estado_solicitud = 'En Curso'`. Citas/gestiones pendientes = `respuesta_usuario` ∈ `['Sin llamadas','No contesta (1)','No contesta (2)']`.
- **Acceso a solicitudes (roles):** `['Administrador','Orientador','SOME','Orientador y Comunicador','Full']`.
- **Commits:** frecuentes, uno por tarea como mínimo. Mensajes en español.
- **Rama de trabajo:** `migracion-typescript` (no trabajar sobre `main`).

---

## Mapa de archivos (qué se crea / modifica / elimina)

**Se eliminan (git rm -r):**
- `apps/`, `services/`, `packages/`

**Se crean en la raíz:**
- `package.json` (reescrito, sin workspaces), `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `components.json`
- `prisma/schema.prisma`, `prisma/seed.ts`
- `src/shared/lib/prisma.ts`, `src/shared/lib/utils.ts`, `src/shared/lib/logger.ts`, `src/shared/lib/auth.ts`
- `src/shared/types/next-auth.d.ts`, `src/shared/types/logger.ts`, `src/shared/types/session.ts`
- `src/shared/components/ui/*.tsx` (button, card, input, label, textarea, badge, select)
- `src/shared/components/layout/app-shell.tsx`, `src/shared/components/layout/stage-placeholder.tsx`
- `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`
- `src/app/layout.tsx`, `src/app/Providers.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- `src/app/auth/login/page.tsx`, `src/app/auth/error/page.tsx`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/(app)/layout.tsx` y páginas: `solicitudes/ingresar`, `solicitudes/revisar`, `comunicador`, `dashboard`, `configuracion/usuarios-roles`
- `src/modules/catalogos/actions/getCatalogos.action.ts`
- `src/modules/solicitudes/actions/{getPendientes,getSolicitudes,crearSolicitud}.action.ts` + `schemas/solicitud.schema.ts` + tests
- `src/modules/comunicador/` (placeholder de página)
- `.env.example` (reescrito)

---

## FASE 1 — Andamiaje raíz

### Task 1: Rama + reescritura del `package.json` raíz y limpieza de workspaces

**Files:**
- Modify: `package.json` (raíz)
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Delete: `apps/`, `services/`, `packages/`

**Interfaces:**
- Produces: scripts npm `dev/build/start/lint/test/test:watch/test:ui`, `db:generate/db:push/db:seed/db:studio`, `services:up/down`.

- [ ] **Step 1: Crear rama de trabajo**

```bash
git checkout -b migracion-typescript
```

- [ ] **Step 2: Eliminar los workspaces antiguos (su contenido se reescribe en `src/` y `prisma/`)**

```bash
git rm -r apps services packages
```

- [ ] **Step 3: Reescribir `package.json` raíz** (sin `workspaces`, con todas las dependencias)

```json
{
    "name": "gestion-de-la-demanda",
    "version": "0.1.0",
    "private": true,
    "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "next start",
        "lint": "eslint .",
        "test": "vitest run",
        "test:watch": "vitest",
        "test:ui": "vitest --ui",
        "db:generate": "prisma generate",
        "db:push": "prisma db push",
        "db:seed": "prisma db seed",
        "db:studio": "prisma studio",
        "services:up": "docker compose up -d mysql",
        "services:down": "docker compose down"
    },
    "prisma": {
        "seed": "tsx prisma/seed.ts"
    },
    "dependencies": {
        "@hookform/resolvers": "^4.1.3",
        "@prisma/client": "^6.2.1",
        "@radix-ui/react-label": "^2.1.1",
        "@radix-ui/react-slot": "^1.1.1",
        "bcryptjs": "^2.4.3",
        "class-variance-authority": "^0.7.1",
        "clsx": "^2.1.1",
        "lucide-react": "^0.468.0",
        "next": "^15.1.3",
        "next-auth": "5.0.0-beta.25",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "react-hook-form": "^7.54.2",
        "sonner": "^1.7.1",
        "tailwind-merge": "^2.6.0",
        "tailwindcss-animate": "^1.0.7",
        "zod": "^3.24.1"
    },
    "devDependencies": {
        "@testing-library/jest-dom": "^6.6.3",
        "@testing-library/react": "^16.1.0",
        "@types/bcryptjs": "^2.4.6",
        "@types/node": "^20",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@vitejs/plugin-react": "^4.3.4",
        "@vitest/ui": "^2.1.8",
        "autoprefixer": "^10.4.20",
        "eslint": "^9.17.0",
        "eslint-config-next": "^15.1.3",
        "jsdom": "^25.0.1",
        "postcss": "^8.4.49",
        "prisma": "^6.2.1",
        "tailwindcss": "^3.4.17",
        "tsx": "^4.19.2",
        "typescript": "^5.7.2",
        "vite-tsconfig-paths": "^5.1.4",
        "vitest": "^2.1.8"
    }
}
```

- [ ] **Step 4: Reescribir `.env.example`** (variables de NextAuth + Prisma; se eliminan las de microservicios)

```bash
# Base de datos MySQL (Prisma)
DATABASE_URL="mysql://gestion:gestion_password@localhost:3307/gestion_demanda"

# NextAuth v5 (Auth.js)
AUTH_SECRET="cambiar_en_desarrollo_local"
AUTH_URL="http://localhost:3000/api/auth"
AUTH_TRUST_HOST="true"

# Google OAuth
AUTH_GOOGLE_ID="tu_google_client_id"
AUTH_GOOGLE_SECRET="tu_google_client_secret"
```

> Nota: el `docker-compose.yml` expone MySQL en el host por `3307`; por eso `DATABASE_URL` usa `localhost:3307`. Si prefieres `3306`, ajusta ambos.

- [ ] **Step 5: Ajustar `docker-compose.yml`** — añadir nombre de servicio explícito para el script (`docker compose up -d mysql` ya funciona porque el servicio se llama `mysql`). No requiere cambios salvo confirmar el nombre `mysql`. Dejar el archivo como está.

- [ ] **Step 6: Instalar dependencias**

Run: `npm install`
Expected: instala sin errores de peer-deps que rompan (warnings aceptables). Se genera `package-lock.json` nuevo.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: reescribir package.json raiz y eliminar workspaces (apps/services/packages)"
```

---

### Task 2: Configuración base de TypeScript, Next, ESLint, PostCSS, Tailwind

**Files:**
- Create: `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`

**Interfaces:**
- Produces: alias `@/*`→`./src/*`; Tailwind con `content` apuntando a `./src`; tema con variables HSL de marca.

- [ ] **Step 1: Crear `tsconfig.json`**

```json
{
    "compilerOptions": {
        "lib": ["dom", "dom.iterable", "esnext"],
        "allowJs": true,
        "skipLibCheck": true,
        "strict": true,
        "noEmit": true,
        "esModuleInterop": true,
        "module": "esnext",
        "moduleResolution": "bundler",
        "resolveJsonModule": true,
        "isolatedModules": true,
        "jsx": "preserve",
        "incremental": true,
        "plugins": [{ "name": "next" }],
        "paths": {
            "@/*": ["./src/*"]
        },
        "target": "ES2017",
        "types": ["vitest/globals", "node"]
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Crear `next-env.d.ts`**

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 3: Crear `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Crear `eslint.config.mjs`**

```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [...compat.extends("next/core-web-vitals")];

export default eslintConfig;
```

> Si falta `@eslint/eslintrc`, instalarlo: `npm i -D @eslint/eslintrc`.

- [ ] **Step 5: Crear `postcss.config.mjs`**

```javascript
const config = {
    plugins: {
        tailwindcss: {},
        autoprefixer: {}
    }
};

export default config;
```

- [ ] **Step 6: Crear `tailwind.config.ts`** (preserva los colores de marca actuales + radios; añade `tailwindcss-animate`)

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))"
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))"
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))"
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))"
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))"
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))"
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))"
                }
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)"
            }
        }
    },
    plugins: [require("tailwindcss-animate")]
};

export default config;
```

- [ ] **Step 7: Verificar typecheck base**

Run: `npx tsc --noEmit`
Expected: sin errores (aún no hay archivos `.ts` de app; puede no reportar nada).

- [ ] **Step 8: Commit**

```bash
git add tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs postcss.config.mjs tailwind.config.ts
git commit -m "chore: configs base de TypeScript, Next, ESLint, PostCSS y Tailwind"
```

---

### Task 3: Prisma a la raíz (schema + cliente + seed TS)

**Files:**
- Create: `prisma/schema.prisma` (migrado desde `packages/db/prisma/schema.prisma` con cambios)
- Create: `prisma/seed.ts` (migrado desde `packages/db/prisma/seed.js`)
- Create: `src/shared/lib/prisma.ts`

**Interfaces:**
- Produces: `import { prisma } from "@/shared/lib/prisma"` (instancia singleton `PrismaClient`). Modelos Prisma incluyendo `AuditLog`.

- [ ] **Step 1: Crear `prisma/schema.prisma`** — copiar el schema actual (los 11 modelos) y aplicar DOS cambios: (a) `Funcionario.password_hash` pasa a opcional; (b) añadir modelo `AuditLog`. El resto de modelos queda idéntico al original.

Cambio (a), en `model Funcionario`:

```prisma
  password_hash      String?     @db.VarChar(200)
```

Cambio (b), añadir al final del archivo:

```prisma
model AuditLog {
  id          Int      @id @default(autoincrement())
  timestamp   DateTime @default(now())
  category    String   @db.VarChar(50)
  action      String   @db.VarChar(50)
  success     Boolean
  user_id     String?  @db.VarChar(150)
  user_name   String?  @db.VarChar(150)
  user_rut    String?  @db.VarChar(50)
  resource_id String?  @db.VarChar(150)
  details     String?  @db.Text
  error       String?  @db.Text

  @@index([category])
  @@index([action])
  @@index([timestamp])
  @@map("logs")
}
```

> El resto del schema (Role, Menu, Funcionario, Usuario, TipoSolicitud, Motivo, Solicitud, Llamada, Prestacion, Profesional, Estadistica) se copia VERBATIM desde `packages/db/prisma/schema.prisma` (que sigue en el historial de git en el commit anterior; recuperar con `git show HEAD~1:packages/db/prisma/schema.prisma`).

- [ ] **Step 2: Crear `src/shared/lib/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Crear `prisma/seed.ts`** — migrar el seed actual a TS. Tipar `roleMenus` y mantener la lógica. Ajustar el correo de los funcionarios sigue siendo `@demo.local` (documentado: para login Google real, reemplazar por correos Google válidos). Contenido íntegro:

```typescript
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "demo123";

type MenuTuple = [nombre: string, ruta: string, descripcion: string];

const roleMenus: Record<string, MenuTuple[]> = {
    Administrador: [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"],
        ["Llamados", "/comunicador", "Gestion de llamadas"],
        ["Dashboard", "/dashboard", "Indicadores principales"],
        ["Configuracion", "/configuracion/usuarios-roles", "Usuarios, roles y catalogos"]
    ],
    Orientador: [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"]
    ],
    Comunicador: [["Llamados", "/comunicador", "Gestion de llamadas"]],
    SOME: [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"],
        ["Llamados", "/comunicador", "Gestion de llamadas"],
        ["Dashboard", "/dashboard", "Indicadores principales"],
        ["Usuarios y Roles", "/configuracion/usuarios-roles", "Configuracion permitida para SOME"]
    ],
    "Orientador y Comunicador": [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Llamados", "/comunicador", "Gestion de llamadas"]
    ],
    "Gestor y Comunicador": [
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"],
        ["Llamados", "/comunicador", "Gestion de llamadas"]
    ],
    Full: [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"],
        ["Llamados", "/comunicador", "Gestion de llamadas"],
        ["Dashboard", "/dashboard", "Indicadores principales"]
    ]
};

const funcionarios: [rut: string, email: string, nombre: string, roleName: string][] = [
    ["11.111.111-1", "admin@demo.local", "Administrador Demo", "Administrador"],
    ["22.222.222-2", "orientador@demo.local", "Orientador Demo", "Orientador"],
    ["33.333.333-3", "comunicador@demo.local", "Comunicador Demo", "Comunicador"],
    ["44.444.444-4", "some@demo.local", "SOME Demo", "SOME"],
    ["55.555.555-5", "orientador.comunicador@demo.local", "Orientador Comunicador Demo", "Orientador y Comunicador"],
    ["66.666.666-6", "gestor.comunicador@demo.local", "Gestor Comunicador Demo", "Gestor y Comunicador"],
    ["77.777.777-7", "full@demo.local", "Full Demo", "Full"]
];

async function main() {
    const password_hash = await bcrypt.hash(PASSWORD, 10);
    const roleByName = new Map<string, { id_rol: number }>();

    const roleNames = Object.keys(roleMenus);
    for (const roleName of roleNames) {
        const role = await prisma.role.upsert({
            where: { id_rol: roleNames.indexOf(roleName) + 1 },
            update: { nombre_rol: roleName, estado: "Activo" },
            create: { nombre_rol: roleName, estado: "Activo" }
        });
        roleByName.set(roleName, role);
    }

    await prisma.menu.deleteMany();
    for (const [roleName, menus] of Object.entries(roleMenus)) {
        const role = roleByName.get(roleName)!;
        for (const [nombre, ruta, descripcion] of menus) {
            await prisma.menu.create({
                data: { nombre, ruta, descripcion, imagen: null, role_id: role.id_rol }
            });
        }
    }

    for (const [rut, email, nombre, roleName] of funcionarios) {
        const role = roleByName.get(roleName)!;
        await prisma.funcionario.upsert({
            where: { rut },
            update: { email, nombre, rol_id: role.id_rol, estado: "Activo", password_hash },
            create: {
                rut,
                email,
                nombre,
                rol_id: role.id_rol,
                estado: "Activo",
                codigo: roleName.toUpperCase().replaceAll(" ", "_"),
                centro_id: "CENTRO-01",
                programa_asociado: "Demanda",
                invitacion_app: "Si",
                password_hash
            }
        });
    }

    const tipoSolicitud = await prisma.tipoSolicitud.upsert({
        where: { id_tipo_solicitud: 1 },
        update: { nombre_tipo_solicitud: "Atencion general", estado: "Activo" },
        create: { nombre_tipo_solicitud: "Atencion general", estado: "Activo" }
    });

    const motivo = await prisma.motivo.upsert({
        where: { id_motivo: 1 },
        update: { tipo_solicitud_id: tipoSolicitud.id_tipo_solicitud, nombre_motivo: "Consulta inicial", estado: "Activo" },
        create: { tipo_solicitud_id: tipoSolicitud.id_tipo_solicitud, nombre_motivo: "Consulta inicial", estado: "Activo" }
    });

    await prisma.usuario.upsert({
        where: { rut: "12.345.678-9" },
        update: {},
        create: {
            rut: "12.345.678-9",
            nombre: "Paciente",
            apellido: "Demo",
            genero: "No informado",
            telefono: "+56912345678",
            correo_contacto: "paciente.demo@local",
            centro_id: "CENTRO-01"
        }
    });

    await prisma.solicitud.upsert({
        where: { id_solicitud: "SOL-DEMO-001" },
        update: {},
        create: {
            id_solicitud: "SOL-DEMO-001",
            rut_orientador: "22.222.222-2",
            rut_usuario: "12.345.678-9",
            tipo_solicitud_id: tipoSolicitud.id_tipo_solicitud,
            motivo_id: motivo.id_motivo,
            descripcion: "Solicitud demo en curso para probar pendientes.",
            disponibilidad_llamada: "Manana",
            priorizacion_admin: 1,
            estado_solicitud: "En Curso",
            centro_id: "CENTRO-01"
        }
    });

    await prisma.llamada.upsert({
        where: { id_llamada: "LLAM-DEMO-001" },
        update: {},
        create: {
            id_llamada: "LLAM-DEMO-001",
            cita_id: "SOL-DEMO-001",
            rut_usuario: "12.345.678-9",
            rut_comunicador: "33.333.333-3",
            respuesta_usuario: "Sin llamadas",
            observacion: "Gestion demo pendiente.",
            centro_id: "CENTRO-01"
        }
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });
```

- [ ] **Step 4: Generar el cliente Prisma**

Run: `npm run db:generate`
Expected: "Generated Prisma Client" sin errores.

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores en `prisma/seed.ts` ni `src/shared/lib/prisma.ts`.

- [ ] **Step 6: Commit**

```bash
git add prisma src/shared/lib/prisma.ts
git commit -m "feat: mover Prisma a la raiz (schema con AuditLog, cliente singleton, seed en TS)"
```

---

### Task 4: shadcn (components.json + globals.css + cn) y componentes UI base

**Files:**
- Create: `components.json`, `src/shared/lib/utils.ts`, `src/app/globals.css`
- Create: `src/shared/components/ui/{button,card,input,label,textarea,badge,select}.tsx`

**Interfaces:**
- Consumes: `cn` desde `@/shared/lib/utils`.
- Produces: componentes UI `Button`, `Card` (+ subcomponentes), `Input`, `Label`, `Textarea`, `Badge` (variantes `default|warning|muted|success`), `Select` (nativo). Importables desde `@/shared/components/ui/*`.

- [ ] **Step 1: Crear `src/shared/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Crear `components.json`**

```json
{
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "rsc": true,
    "tsx": true,
    "tailwind": {
        "config": "tailwind.config.ts",
        "css": "src/app/globals.css",
        "baseColor": "gray",
        "cssVariables": true,
        "prefix": ""
    },
    "aliases": {
        "components": "@/shared/components",
        "utils": "@/shared/lib/utils",
        "ui": "@/shared/components/ui",
        "lib": "@/shared/lib",
        "hooks": "@/shared/hooks"
    },
    "iconLibrary": "lucide"
}
```

- [ ] **Step 3: Crear `src/app/globals.css`** — base shadcn con las variables de marca actuales (teal primary) + variables faltantes que shadcn/Tailwind necesitan (`popover`, `radius`). Mantener selectores base existentes.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :root {
        --background: 210 20% 98%;
        --foreground: 222 47% 11%;
        --card: 0 0% 100%;
        --card-foreground: 222 47% 11%;
        --popover: 0 0% 100%;
        --popover-foreground: 222 47% 11%;
        --primary: 187 85% 26%;
        --primary-foreground: 0 0% 100%;
        --secondary: 36 56% 56%;
        --secondary-foreground: 222 47% 11%;
        --muted: 210 24% 92%;
        --muted-foreground: 215 16% 42%;
        --accent: 157 36% 45%;
        --accent-foreground: 0 0% 100%;
        --destructive: 0 70% 44%;
        --destructive-foreground: 0 0% 100%;
        --border: 214 22% 84%;
        --input: 214 22% 84%;
        --ring: 187 85% 26%;
        --radius: 0.5rem;
    }
}

@layer base {
    * {
        @apply border-border;
    }
    body {
        @apply bg-background text-foreground;
    }
    button,
    input,
    select,
    textarea {
        font: inherit;
    }
}
```

- [ ] **Step 4: Generar componentes shadcn canónicos**

Run: `npx shadcn@latest add button card input label textarea --yes`
Expected: crea `src/shared/components/ui/{button,card,input,label,textarea}.tsx` e instala `@radix-ui/react-label`, `@radix-ui/react-slot` si faltan.

> Si el CLI pide confirmar sobreescritura de `globals.css` o `tailwind.config.ts`, responder NO (ya los configuramos a mano).

- [ ] **Step 5: Crear `src/shared/components/ui/badge.tsx`** (preservando variantes `warning`, `muted`, `success` usadas por las páginas)

```tsx
import { cn } from "@/shared/lib/utils";

type BadgeVariant = "default" | "warning" | "muted" | "success";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                variant === "default" && "bg-primary/10 text-primary",
                variant === "warning" && "bg-secondary/20 text-secondary-foreground",
                variant === "muted" && "bg-muted text-muted-foreground",
                variant === "success" && "bg-accent/15 text-accent",
                className
            )}
            {...props}
        />
    );
}
```

- [ ] **Step 6: Crear `src/shared/components/ui/select.tsx`** (select nativo tipado; NO usar el Radix de shadcn para no reescribir los formularios)

```tsx
import { cn } from "@/shared/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
    return (
        <select
            className={cn(
                "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        >
            {children}
        </select>
    );
}
```

- [ ] **Step 7: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/shared/components/ui` ni `utils.ts`.

- [ ] **Step 8: Commit**

```bash
git add components.json src/shared/lib/utils.ts src/app/globals.css src/shared/components/ui
git commit -m "feat: inicializar shadcn (new-york/gray) y componentes UI base en TSX"
```

---

## FASE 2 — Autenticación (NextAuth v5 + Google)

### Task 5: Tipos de auditoría + AuditLogger sobre Prisma

**Files:**
- Create: `src/shared/types/logger.ts`, `src/shared/lib/logger.ts`

**Interfaces:**
- Produces: `AuditLogger` con métodos `log`, `logAuth`, `logDataAccess`, `logSecurity`. Constantes `LOG_CATEGORY`, `LOG_ACTION`. Persiste en tabla `logs` (modelo `AuditLog`).

- [ ] **Step 1: Crear `src/shared/types/logger.ts`**

```typescript
export const LOG_CATEGORY = {
    AUTH: "AUTH",
    DATA_ACCESS: "DATA_ACCESS",
    SECURITY: "SECURITY",
    SYSTEM: "SYSTEM"
} as const;

export const LOG_ACTION = {
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
    READ: "READ",
    SEARCH: "SEARCH",
    CREATE: "CREATE",
    UPDATE: "UPDATE",
    DELETE: "DELETE"
} as const;

export type LogCategory = (typeof LOG_CATEGORY)[keyof typeof LOG_CATEGORY];
export type LogAction = (typeof LOG_ACTION)[keyof typeof LOG_ACTION];

export interface LogUser {
    id?: string;
    name?: string;
    rut?: string;
}

export interface LogMetadata {
    resourceId?: string;
    details?: string;
    error?: string;
}
```

- [ ] **Step 2: Crear `src/shared/lib/logger.ts`**

```typescript
import { prisma } from "./prisma";
// types
import { LOG_CATEGORY, LOG_ACTION, LogAction, LogCategory, LogMetadata, LogUser } from "@/shared/types/logger";

class AuditLoggerService {
    async log(
        category: LogCategory,
        action: LogAction,
        success: boolean,
        user: LogUser = {},
        metadata: LogMetadata = {}
    ): Promise<void> {
        try {
            await prisma.auditLog.create({
                data: {
                    category,
                    action,
                    success,
                    user_id: user.id ?? null,
                    user_name: user.name ?? null,
                    user_rut: user.rut ?? null,
                    resource_id: metadata.resourceId ?? null,
                    details: metadata.details?.substring(0, 1000) ?? null,
                    error: metadata.error ?? null
                }
            });
        } catch (error) {
            console.error("❌ Fallo critico al escribir log de auditoria:", { error, intendedLog: { category, action, user, metadata } });
        }
    }

    async logAuth(action: Extract<LogAction, "LOGIN" | "LOGOUT">, success: boolean, user: LogUser = {}, metadata: LogMetadata = {}) {
        await this.log(LOG_CATEGORY.AUTH, action, success, user, metadata);
    }

    async logDataAccess(
        action: Extract<LogAction, "READ" | "SEARCH" | "CREATE" | "UPDATE" | "DELETE">,
        success: boolean,
        user: LogUser,
        resourceId: string,
        metadata: LogMetadata = {}
    ) {
        await this.log(LOG_CATEGORY.DATA_ACCESS, action, success, user, { ...metadata, resourceId });
    }

    async logSecurity(action: LogAction, success: boolean, user: LogUser = {}, metadata: LogMetadata = {}) {
        await this.log(LOG_CATEGORY.SECURITY, action, success, user, metadata);
    }
}

export const AuditLogger = new AuditLoggerService();
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores (asume `prisma.auditLog` existe por el modelo `AuditLog`).

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/logger.ts src/shared/lib/logger.ts
git commit -m "feat: AuditLogger sobre Prisma (tabla logs)"
```

---

### Task 6: Tipos de sesión + configuración NextAuth (split config) + ruta + middleware

**Files:**
- Create: `src/shared/types/session.ts`, `src/shared/types/next-auth.d.ts`
- Create: `src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `prisma`, `AuditLogger`.
- Produces: `auth`, `handlers`, `signIn`, `signOut` desde `@/auth`. Tipo `SessionUser` con `rut`, `rol`, `menu`. La sesión (`session.user`) expone `rut`, `rol: { id, nombre }`, `menu: MenuItem[]`.

- [ ] **Step 1: Crear `src/shared/types/session.ts`**

```typescript
export interface MenuItem {
    id: number;
    nombre: string;
    descripcion: string | null;
    ruta: string;
    imagen: string | null;
}

export interface SessionUser {
    rut: string;
    email: string;
    nombre: string;
    rol: { id: number; nombre: string };
    menu: MenuItem[];
}
```

- [ ] **Step 2: Crear `src/shared/types/next-auth.d.ts`**

```typescript
import { MenuItem } from "./session";

declare module "next-auth" {
    interface Session {
        user: {
            name?: string | null;
            email?: string | null;
            image?: string | null;
            rut: string;
            nombre: string;
            rol: { id: number; nombre: string };
            menu: MenuItem[];
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        rut?: string;
        nombre?: string;
        rol?: { id: number; nombre: string };
        menu?: MenuItem[];
    }
}
```

- [ ] **Step 3: Crear `src/auth.config.ts`** (edge-safe: providers + `authorized`, SIN Prisma)

```typescript
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            authorization: {
                params: { prompt: "consent", access_type: "offline", response_type: "code" }
            }
        })
    ],
    pages: {
        signIn: "/auth/login",
        error: "/auth/error"
    },
    callbacks: {
        // Usado por el middleware para proteger rutas (corre en edge, sin Prisma)
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = Boolean(auth?.user);
            const isAuthPage = nextUrl.pathname.startsWith("/auth");
            if (isAuthPage) return true;
            return isLoggedIn;
        }
    }
} satisfies NextAuthConfig;
```

- [ ] **Step 4: Crear `src/auth.ts`** (añade callbacks con Prisma sobre `authConfig`)

```typescript
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
// lib
import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";
// types
import { MenuItem } from "@/shared/types/session";

export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user }) {
            if (!user.email) {
                await AuditLogger.logAuth("LOGIN", false, { name: user.name ?? "Desconocido" }, { error: "Sin email", details: "Proveedor: google" });
                return false;
            }
            const funcionario = await prisma.funcionario.findUnique({ where: { email: user.email } });
            if (!funcionario || funcionario.estado !== "Activo") {
                await AuditLogger.logAuth("LOGIN", false, { name: user.name ?? "Desconocido" }, { error: "Funcionario no encontrado o inactivo", details: `Email: ${user.email}` });
                return false;
            }
            await AuditLogger.logAuth("LOGIN", true, { id: user.email, name: user.name ?? funcionario.nombre, rut: funcionario.rut }, { details: "Proveedor: google" });
            return true;
        },
        async jwt({ token, user }) {
            if (user?.email) {
                const funcionario = await prisma.funcionario.findUnique({
                    where: { email: user.email },
                    include: { role: { include: { menus: { orderBy: { id_menu: "asc" } } } } }
                });
                if (funcionario) {
                    token.rut = funcionario.rut;
                    token.nombre = funcionario.nombre;
                    token.rol = { id: funcionario.role.id_rol, nombre: funcionario.role.nombre_rol };
                    token.menu = funcionario.role.menus.map(
                        (m): MenuItem => ({ id: m.id_menu, nombre: m.nombre, descripcion: m.descripcion, ruta: m.ruta, imagen: m.imagen })
                    );
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.rut = token.rut ?? "";
                session.user.nombre = token.nombre ?? "";
                session.user.rol = token.rol ?? { id: 0, nombre: "" };
                session.user.menu = token.menu ?? [];
            }
            return session;
        }
    },
    events: {
        async signOut(message) {
            const email = "token" in message && message.token ? (message.token.email as string) : "Desconocido";
            await AuditLogger.logAuth("LOGOUT", true, { id: email }, { details: `Email: ${email}` });
        }
    }
});
```

- [ ] **Step 5: Crear `src/middleware.ts`**

```typescript
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"]
};
```

- [ ] **Step 6: Crear `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 7: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores en `auth.ts`, `auth.config.ts`, `middleware.ts`, tipos.

- [ ] **Step 8: Commit**

```bash
git add src/auth.ts src/auth.config.ts src/middleware.ts src/app/api/auth src/shared/types/session.ts src/shared/types/next-auth.d.ts
git commit -m "feat: NextAuth v5 con Google OAuth (mapeo email->funcionario->rol->menu)"
```

---

### Task 7: Helper de sesión + raíz de la app (layout, Providers, página raíz)

**Files:**
- Create: `src/shared/lib/auth.ts`, `src/app/layout.tsx`, `src/app/Providers.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `auth` desde `@/auth`.
- Produces: `getSessionUser(): Promise<SessionUser | null>`; `requireRole(roles: string[])` helper. Layout raíz con `Providers` (SessionProvider + Toaster).

- [ ] **Step 1: Crear `src/shared/lib/auth.ts`**

```typescript
import { auth } from "@/auth";
import { SessionUser } from "@/shared/types/session";

export async function getSessionUser(): Promise<SessionUser | null> {
    const session = await auth();
    if (!session?.user?.rut) return null;
    const u = session.user;
    return { rut: u.rut, email: u.email ?? "", nombre: u.nombre, rol: u.rol, menu: u.menu };
}

export async function requireSessionUser(): Promise<SessionUser> {
    const user = await getSessionUser();
    if (!user) throw new Error("No autenticado");
    return user;
}
```

- [ ] **Step 2: Crear `src/app/Providers.tsx`**

```tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            {children}
            <Toaster position="top-right" richColors />
        </SessionProvider>
    );
}
```

- [ ] **Step 3: Crear `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./Providers";

export const metadata: Metadata = {
    title: "Gestion de la Demanda",
    description: "Sistema de gestion de solicitudes, citas y llamados"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
```

- [ ] **Step 4: Crear `src/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
    redirect("/solicitudes/ingresar");
}
```

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/auth.ts src/app/layout.tsx src/app/Providers.tsx src/app/page.tsx
git commit -m "feat: layout raiz, Providers (SessionProvider + sonner) y helper de sesion"
```

---

### Task 8: Páginas de auth (login con Google + error)

**Files:**
- Create: `src/app/auth/login/page.tsx`, `src/app/auth/error/page.tsx`

**Interfaces:**
- Consumes: `signIn` desde `@/auth` (server action).

- [ ] **Step 1: Crear `src/app/auth/login/page.tsx`** (botón que dispara Google OAuth)

```tsx
import { LockKeyhole } from "lucide-react";
import { signIn } from "@/auth";
// components
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default function LoginPage() {
    return (
        <main className="grid min-h-screen place-items-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <LockKeyhole size={20} />
                    </div>
                    <CardTitle>Ingreso al sistema</CardTitle>
                    <CardDescription>Accede con tu cuenta institucional de Google registrada como funcionario.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        action={async () => {
                            "use server";
                            await signIn("google", { redirectTo: "/solicitudes/ingresar" });
                        }}
                    >
                        <Button className="w-full" type="submit">
                            Ingresar con Google
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
```

- [ ] **Step 2: Crear `src/app/auth/error/page.tsx`**

```tsx
import Link from "next/link";
// components
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default function AuthErrorPage() {
    return (
        <main className="grid min-h-screen place-items-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>No se pudo iniciar sesion</CardTitle>
                    <CardDescription>Tu cuenta no esta habilitada como funcionario activo o hubo un problema con Google.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full">
                        <Link href="/auth/login">Volver a intentar</Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth
git commit -m "feat: paginas de login (Google) y error de auth"
```

---

## FASE 3 — Módulos, Server Actions y páginas

### Task 9: Módulo catálogos (action + tipos)

**Files:**
- Create: `src/modules/catalogos/actions/getCatalogos.action.ts`
- Create: `src/modules/catalogos/types/catalogos.ts`

**Interfaces:**
- Produces: `getCatalogos(): Promise<{ tiposSolicitud: TipoSolicitud[]; motivos: Motivo[] }>` (tipos Prisma).

- [ ] **Step 1: Crear `src/modules/catalogos/types/catalogos.ts`**

```typescript
import type { TipoSolicitud, Motivo } from "@prisma/client";

export interface Catalogos {
    tiposSolicitud: TipoSolicitud[];
    motivos: Motivo[];
}
```

- [ ] **Step 2: Crear `src/modules/catalogos/actions/getCatalogos.action.ts`**

```typescript
"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
// types
import { Catalogos } from "../types/catalogos";

export async function getCatalogos(): Promise<Catalogos> {
    await requireSessionUser();
    const [tiposSolicitud, motivos] = await Promise.all([
        prisma.tipoSolicitud.findMany({ where: { estado: "Activo" }, orderBy: { nombre_tipo_solicitud: "asc" } }),
        prisma.motivo.findMany({ where: { estado: "Activo" }, orderBy: { nombre_motivo: "asc" } })
    ]);
    return { tiposSolicitud, motivos };
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/catalogos
git commit -m "feat: modulo catalogos (getCatalogos action)"
```

---

### Task 10: Módulo solicitudes — schema Zod + control de acceso + actions (con tests)

**Files:**
- Create: `src/modules/solicitudes/schemas/solicitud.schema.ts`
- Create: `src/modules/solicitudes/actions/getPendientes.action.ts`
- Create: `src/modules/solicitudes/actions/getSolicitudes.action.ts`
- Create: `src/modules/solicitudes/actions/crearSolicitud.action.ts`
- Create: `src/modules/solicitudes/actions/crearSolicitud.action.test.ts`
- Create: `src/shared/lib/access.ts`

**Interfaces:**
- Consumes: `prisma`, `requireSessionUser`, `AuditLogger`.
- Produces:
  - `crearSolicitudSchema` (Zod) y `type CrearSolicitudInput = z.infer<...>`.
  - `puedeAccederSolicitudes(rol: string): boolean`.
  - `getPendientes(rutUsuario: string)`, `getSolicitudes(filtros: SolicitudFiltros)`, `crearSolicitud(input: CrearSolicitudInput)`.

- [ ] **Step 1: Crear `src/shared/lib/access.ts`**

```typescript
export const ROLES_SOLICITUDES = ["Administrador", "Orientador", "SOME", "Orientador y Comunicador", "Full"] as const;

export function puedeAccederSolicitudes(rol: string): boolean {
    return (ROLES_SOLICITUDES as readonly string[]).includes(rol);
}
```

- [ ] **Step 2: Crear `src/modules/solicitudes/schemas/solicitud.schema.ts`**

```typescript
import { z } from "zod";

export const crearSolicitudSchema = z.object({
    rut_usuario: z.string().trim().min(1, "RUT requerido"),
    nombre_usuario: z.string().trim().min(1, "Nombre requerido"),
    apellido_usuario: z.string().trim().min(1, "Apellido requerido"),
    telefono: z.string().trim().optional().default(""),
    correo_contacto: z.string().trim().optional().default(""),
    tipo_solicitud_id: z.coerce.number().int().positive("Tipo de solicitud requerido"),
    motivo_id: z.coerce.number().int().positive("Motivo requerido"),
    disponibilidad_llamada: z.string().trim().optional().default(""),
    priorizacion_admin: z.string().trim().optional().default(""),
    centro_id: z.string().trim().optional().default(""),
    descripcion: z.string().trim().optional().default("")
});

export type CrearSolicitudInput = z.infer<typeof crearSolicitudSchema>;

export interface SolicitudFiltros {
    rut?: string;
    estado?: string;
    centroId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}
```

- [ ] **Step 3: Crear `src/modules/solicitudes/actions/getPendientes.action.ts`**

```typescript
"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";

const ESTADOS_CITAS_PENDIENTES = ["Sin llamadas", "No contesta (1)", "No contesta (2)"];

export async function getPendientes(rutUsuario: string) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const rut = rutUsuario.trim();
    if (!rut) throw new Error("rutUsuario es requerido");

    const [solicitudesPendientes, citasPendientes] = await Promise.all([
        prisma.solicitud.findMany({
            where: { rut_usuario: rut, estado_solicitud: "En Curso" },
            include: { tipoSolicitud: true, motivo: true },
            orderBy: { fecha_inicio: "desc" }
        }),
        prisma.llamada.findMany({
            where: { rut_usuario: rut, respuesta_usuario: { in: ESTADOS_CITAS_PENDIENTES } },
            include: { solicitud: { include: { tipoSolicitud: true, motivo: true } }, comunicador: true },
            orderBy: [{ fecha_llamada: "desc" }, { id_llamada: "desc" }]
        })
    ]);

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `PENDIENTES_${rut}`, {
        details: `Consulta de pendientes para RUT ${rut}`
    });

    return { solicitudesPendientes, citasPendientes };
}
```

- [ ] **Step 4: Crear `src/modules/solicitudes/actions/getSolicitudes.action.ts`**

```typescript
"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// types
import { SolicitudFiltros } from "../schemas/solicitud.schema";

function buildWhere(filtros: SolicitudFiltros): Prisma.SolicitudWhereInput {
    const where: Prisma.SolicitudWhereInput = {};
    if (filtros.rut) where.rut_usuario = filtros.rut.trim();
    if (filtros.estado) where.estado_solicitud = filtros.estado;
    if (filtros.centroId) where.centro_id = filtros.centroId;
    if (filtros.fechaDesde || filtros.fechaHasta) {
        where.fecha_inicio = {};
        if (filtros.fechaDesde) where.fecha_inicio.gte = new Date(`${filtros.fechaDesde}T00:00:00`);
        if (filtros.fechaHasta) where.fecha_inicio.lte = new Date(`${filtros.fechaHasta}T23:59:59`);
    }
    return where;
}

export async function getSolicitudes(filtros: SolicitudFiltros = {}) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const solicitudes = await prisma.solicitud.findMany({
        where: buildWhere(filtros),
        include: { usuario: true, tipoSolicitud: true, motivo: true, orientador: true, gestor: true },
        orderBy: { fecha_inicio: "desc" },
        take: 100
    });

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "LISTADO_SOLICITUDES", {
        details: `Filtros: ${JSON.stringify(filtros)}`
    });

    return { solicitudes };
}
```

- [ ] **Step 5: Crear `src/modules/solicitudes/actions/crearSolicitud.action.ts`**

```typescript
"use server";

import crypto from "node:crypto";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { crearSolicitudSchema, CrearSolicitudInput } from "../schemas/solicitud.schema";

async function ensureUsuario(data: CrearSolicitudInput) {
    const rut = data.rut_usuario.trim();
    const existing = await prisma.usuario.findUnique({ where: { rut } });
    if (existing) return existing;
    return prisma.usuario.create({
        data: {
            rut,
            nombre: data.nombre_usuario,
            apellido: data.apellido_usuario,
            telefono: data.telefono || null,
            correo_contacto: data.correo_contacto || null,
            centro_id: data.centro_id || null
        }
    });
}

export async function crearSolicitud(input: CrearSolicitudInput) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const data = crearSolicitudSchema.parse(input);
    const usuario = await ensureUsuario(data);

    const solicitud = await prisma.solicitud.create({
        data: {
            id_solicitud: `SOL-${crypto.randomUUID()}`,
            rut_orientador: user.rut,
            rut_usuario: usuario.rut,
            tipo_solicitud_id: data.tipo_solicitud_id,
            motivo_id: data.motivo_id,
            descripcion: data.descripcion || null,
            disponibilidad_llamada: data.disponibilidad_llamada || null,
            priorizacion_admin: data.priorizacion_admin ? Number(data.priorizacion_admin) : null,
            estado_solicitud: "En Curso",
            centro_id: data.centro_id || null
        },
        include: { usuario: true, tipoSolicitud: true, motivo: true }
    });

    await AuditLogger.logDataAccess("CREATE", true, { id: user.email, name: user.nombre, rut: user.rut }, solicitud.id_solicitud, {
        details: `Solicitud creada para RUT ${usuario.rut}`
    });

    return { solicitud };
}
```

- [ ] **Step 6: Escribir el test que falla `src/modules/solicitudes/actions/crearSolicitud.action.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de dependencias de la action
vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        usuario: { findUnique: vi.fn(), create: vi.fn() },
        solicitud: { create: vi.fn() }
    }
}));
vi.mock("@/shared/lib/auth", () => ({
    requireSessionUser: vi.fn()
}));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { crearSolicitud } from "./crearSolicitud.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

const baseInput = {
    rut_usuario: "12.345.678-9",
    nombre_usuario: "Paciente",
    apellido_usuario: "Demo",
    tipo_solicitud_id: 1,
    motivo_id: 1
};

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "22.222.222-2", email: "o@demo.local", nombre: "Orientador", rol: { id: 2, nombre: "Orientador" }, menu: [] });
});

describe("crearSolicitud", () => {
    it("rechaza si el rol no tiene acceso", async () => {
        (requireSessionUser as any).mockResolvedValue({ rut: "33.333.333-3", email: "c@demo.local", nombre: "Comunicador", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
        await expect(crearSolicitud(baseInput as any)).rejects.toThrow("No tienes permiso");
    });

    it("rechaza input invalido (falta nombre)", async () => {
        await expect(crearSolicitud({ ...baseInput, nombre_usuario: "" } as any)).rejects.toThrow();
    });

    it("crea la solicitud con estado 'En Curso' y rut_orientador del usuario en sesion", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({ rut: "12.345.678-9" });
        (prisma.solicitud.create as any).mockResolvedValue({ id_solicitud: "SOL-x" });

        await crearSolicitud(baseInput as any);

        expect(prisma.solicitud.create).toHaveBeenCalledTimes(1);
        const arg = (prisma.solicitud.create as any).mock.calls[0][0];
        expect(arg.data.estado_solicitud).toBe("En Curso");
        expect(arg.data.rut_orientador).toBe("22.222.222-2");
        expect(arg.data.tipo_solicitud_id).toBe(1);
    });
});
```

- [ ] **Step 7: Ejecutar el test (debe fallar antes de que exista la config de Vitest)**

Run: `npm test -- crearSolicitud`
Expected: FALLA porque aún no existe `vitest.config.ts` (se crea en Task 15) — o falla por imports. Si la infra de Vitest aún no está, marcar este step como "pendiente de Task 15" y continuar; los tests se ejecutan en verde en Task 15.

> Nota de orden: la action ya está implementada en Steps 3-5, por lo que cuando Vitest esté configurado (Task 15) estos tests deben pasar directamente. Este es un caso donde el "test que falla" falla por ausencia de runner, no de implementación.

- [ ] **Step 8: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores en las actions y el schema.

- [ ] **Step 9: Commit**

```bash
git add src/modules/solicitudes src/shared/lib/access.ts
git commit -m "feat: modulo solicitudes (schema Zod, control de acceso, actions getPendientes/getSolicitudes/crearSolicitud + test)"
```

---

### Task 11: Página "Ingresar solicitud" (TSX consumiendo actions)

**Files:**
- Create: `src/app/(app)/solicitudes/ingresar/page.tsx`

**Interfaces:**
- Consumes: `getCatalogos`, `getPendientes`, `crearSolicitud`, componentes UI, `toast`.

- [ ] **Step 1: Crear `src/app/(app)/solicitudes/ingresar/page.tsx`** — port del `page.jsx` actual, con tipos, imports a `@/shared/...`, y reemplazo de `solicitudesApi.*` por las actions. Usa `toast` (sonner) para feedback.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
// actions
import { getCatalogos } from "@/modules/catalogos/actions/getCatalogos.action";
import { getPendientes } from "@/modules/solicitudes/actions/getPendientes.action";
import { crearSolicitud } from "@/modules/solicitudes/actions/crearSolicitud.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
// types
import type { Catalogos } from "@/modules/catalogos/types/catalogos";

type FormState = {
    rut_usuario: string;
    nombre_usuario: string;
    apellido_usuario: string;
    telefono: string;
    correo_contacto: string;
    tipo_solicitud_id: string;
    motivo_id: string;
    disponibilidad_llamada: string;
    priorizacion_admin: string;
    centro_id: string;
    descripcion: string;
};

const emptyForm: FormState = {
    rut_usuario: "",
    nombre_usuario: "",
    apellido_usuario: "",
    telefono: "",
    correo_contacto: "",
    tipo_solicitud_id: "",
    motivo_id: "",
    disponibilidad_llamada: "",
    priorizacion_admin: "",
    centro_id: "CENTRO-01",
    descripcion: ""
};

type Pendientes = Awaited<ReturnType<typeof getPendientes>>;

export default function IngresarSolicitudPage() {
    const [rutBusqueda, setRutBusqueda] = useState("");
    const [pendientes, setPendientes] = useState<Pendientes | null>(null);
    const [catalogos, setCatalogos] = useState<Catalogos>({ tiposSolicitud: [], motivos: [] });
    const [form, setForm] = useState<FormState>(emptyForm);
    const [loadingPendientes, setLoadingPendientes] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        getCatalogos()
            .then(setCatalogos)
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cargar catalogos"));
    }, []);

    const motivosFiltrados = useMemo(() => {
        if (!form.tipo_solicitud_id) return catalogos.motivos;
        return catalogos.motivos.filter((m) => String(m.tipo_solicitud_id) === String(form.tipo_solicitud_id));
    }, [catalogos.motivos, form.tipo_solicitud_id]);

    function updateField(field: keyof FormState, value: string) {
        setForm((current) => ({ ...current, [field]: value, ...(field === "tipo_solicitud_id" ? { motivo_id: "" } : {}) }));
    }

    async function buscarPendientes(event: React.FormEvent) {
        event.preventDefault();
        setPendientes(null);
        setLoadingPendientes(true);
        try {
            const data = await getPendientes(rutBusqueda);
            setPendientes(data);
            setForm((current) => ({ ...current, rut_usuario: rutBusqueda }));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al buscar pendientes");
        } finally {
            setLoadingPendientes(false);
        }
    }

    async function onCrearSolicitud(event: React.FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        try {
            const { solicitud } = await crearSolicitud({
                ...form,
                tipo_solicitud_id: Number(form.tipo_solicitud_id),
                motivo_id: Number(form.motivo_id)
            });
            toast.success(`Solicitud creada: ${solicitud.id_solicitud}`);
            setForm({ ...emptyForm, rut_usuario: form.rut_usuario });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al crear solicitud");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Ingresar solicitud</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Primero busca el RUT para informar solicitudes en curso y citas pendientes antes del registro.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Revision previa</CardTitle>
                    <CardDescription>Solicitudes pendientes: estado_solicitud En Curso. Citas pendientes: Sin llamadas, No contesta (1), No contesta (2).</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={buscarPendientes}>
                        <Input placeholder="RUT usuario" value={rutBusqueda} onChange={(e) => setRutBusqueda(e.target.value)} required />
                        <Button disabled={loadingPendientes}>
                            <Search size={16} />
                            {loadingPendientes ? "Buscando..." : "Buscar pendientes"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {pendientes && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Solicitudes pendientes</CardTitle>
                            <CardDescription>Estado de solicitud En Curso.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pendientes.solicitudesPendientes.length === 0 ? (
                                <EmptyState text="No hay solicitudes En Curso para este RUT." />
                            ) : (
                                pendientes.solicitudesPendientes.map((s) => (
                                    <PendingRow key={s.id_solicitud} title={s.id_solicitud} badge={s.estado_solicitud} description={s.descripcion || s.motivo?.nombre_motivo} />
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Citas pendientes</CardTitle>
                            <CardDescription>Estados de llamada pendientes definidos para la primera etapa.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pendientes.citasPendientes.length === 0 ? (
                                <EmptyState text="No hay citas o llamadas pendientes para este RUT." />
                            ) : (
                                pendientes.citasPendientes.map((l) => (
                                    <PendingRow key={l.id_llamada} title={l.id_llamada} badge={l.respuesta_usuario} description={l.observacion || l.solicitud?.descripcion} />
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Nueva solicitud</CardTitle>
                    <CardDescription>El estado inicial queda como En Curso.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-4 lg:grid-cols-2" onSubmit={onCrearSolicitud}>
                        <Field label="RUT usuario">
                            <Input value={form.rut_usuario} onChange={(e) => updateField("rut_usuario", e.target.value)} required />
                        </Field>
                        <Field label="Centro">
                            <Input value={form.centro_id} onChange={(e) => updateField("centro_id", e.target.value)} />
                        </Field>
                        <Field label="Nombre">
                            <Input value={form.nombre_usuario} onChange={(e) => updateField("nombre_usuario", e.target.value)} required />
                        </Field>
                        <Field label="Apellido">
                            <Input value={form.apellido_usuario} onChange={(e) => updateField("apellido_usuario", e.target.value)} required />
                        </Field>
                        <Field label="Telefono">
                            <Input value={form.telefono} onChange={(e) => updateField("telefono", e.target.value)} />
                        </Field>
                        <Field label="Correo contacto">
                            <Input type="email" value={form.correo_contacto} onChange={(e) => updateField("correo_contacto", e.target.value)} />
                        </Field>
                        <Field label="Tipo solicitud">
                            <Select value={form.tipo_solicitud_id} onChange={(e) => updateField("tipo_solicitud_id", e.target.value)} required>
                                <option value="">Seleccionar</option>
                                {catalogos.tiposSolicitud.map((t) => (
                                    <option key={t.id_tipo_solicitud} value={t.id_tipo_solicitud}>
                                        {t.nombre_tipo_solicitud}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Motivo">
                            <Select value={form.motivo_id} onChange={(e) => updateField("motivo_id", e.target.value)} required>
                                <option value="">Seleccionar</option>
                                {motivosFiltrados.map((m) => (
                                    <option key={m.id_motivo} value={m.id_motivo}>
                                        {m.nombre_motivo}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Disponibilidad llamada">
                            <Input value={form.disponibilidad_llamada} onChange={(e) => updateField("disponibilidad_llamada", e.target.value)} placeholder="Ej: manana AM" />
                        </Field>
                        <Field label="Priorizacion admin">
                            <Input type="number" step="0.1" value={form.priorizacion_admin} onChange={(e) => updateField("priorizacion_admin", e.target.value)} />
                        </Field>
                        <div className="lg:col-span-2">
                            <Field label="Descripcion">
                                <Textarea value={form.descripcion} onChange={(e) => updateField("descripcion", e.target.value)} />
                            </Field>
                        </div>
                        <div className="lg:col-span-2">
                            <Button disabled={submitting}>{submitting ? "Guardando..." : "Guardar solicitud"}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
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

function EmptyState({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <CheckCircle2 size={16} />
            {text}
        </div>
    );
}

function PendingRow({ title, badge, description }: { title: string; badge: string; description?: string | null }) {
    return (
        <div className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description || "Sin observacion"}</p>
                </div>
                <Badge variant="warning">
                    <AlertTriangle size={12} />
                    {badge}
                </Badge>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/solicitudes/ingresar/page.tsx"
git commit -m "feat: pagina ingresar solicitud en TSX consumiendo server actions"
```

---

### Task 12: Página "Revisar solicitudes" (TSX)

**Files:**
- Create: `src/app/(app)/solicitudes/revisar/page.tsx`

**Interfaces:**
- Consumes: `getSolicitudes`, componentes UI, `toast`.

- [ ] **Step 1: Crear `src/app/(app)/solicitudes/revisar/page.tsx`** — port del `page.jsx`, tipado, usando la action `getSolicitudes`.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { toast } from "sonner";
// actions
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
// types
import type { SolicitudFiltros } from "@/modules/solicitudes/schemas/solicitud.schema";

const estados = ["", "En Curso", "Finalizada", "Rechazada"];

type Solicitudes = Awaited<ReturnType<typeof getSolicitudes>>["solicitudes"];

export default function RevisarSolicitudesPage() {
    const [filters, setFilters] = useState<SolicitudFiltros>({ rut: "", estado: "", fechaDesde: "", fechaHasta: "", centroId: "" });
    const [solicitudes, setSolicitudes] = useState<Solicitudes>([]);
    const [loading, setLoading] = useState(false);

    async function loadSolicitudes(nextFilters: SolicitudFiltros = filters) {
        setLoading(true);
        try {
            const data = await getSolicitudes(nextFilters);
            setSolicitudes(data.solicitudes);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al consultar solicitudes");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadSolicitudes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function updateFilter(field: keyof SolicitudFiltros, value: string) {
        setFilters((current) => ({ ...current, [field]: value }));
    }

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        loadSolicitudes(filters);
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Revisar solicitudes</h1>
                <p className="mt-1 text-sm text-muted-foreground">Listado filtrable de solicitudes registradas en la base local.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Consulta por RUT, estado, fechas y centro.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-4 md:grid-cols-5" onSubmit={handleSubmit}>
                        <Field label="RUT">
                            <Input value={filters.rut} onChange={(e) => updateFilter("rut", e.target.value)} />
                        </Field>
                        <Field label="Estado">
                            <Select value={filters.estado} onChange={(e) => updateFilter("estado", e.target.value)}>
                                {estados.map((estado) => (
                                    <option key={estado || "todos"} value={estado}>
                                        {estado || "Todos"}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Desde">
                            <Input type="date" value={filters.fechaDesde} onChange={(e) => updateFilter("fechaDesde", e.target.value)} />
                        </Field>
                        <Field label="Hasta">
                            <Input type="date" value={filters.fechaHasta} onChange={(e) => updateFilter("fechaHasta", e.target.value)} />
                        </Field>
                        <Field label="Centro">
                            <Input value={filters.centroId} onChange={(e) => updateFilter("centroId", e.target.value)} />
                        </Field>
                        <div className="md:col-span-5">
                            <Button disabled={loading}>
                                <Filter size={16} />
                                {loading ? "Consultando..." : "Aplicar filtros"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Solicitudes</CardTitle>
                    <CardDescription>Maximo 100 registros ordenados por fecha de inicio.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead className="bg-muted text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 font-medium">ID</th>
                                    <th className="px-3 py-2 font-medium">Fecha</th>
                                    <th className="px-3 py-2 font-medium">RUT usuario</th>
                                    <th className="px-3 py-2 font-medium">Usuario</th>
                                    <th className="px-3 py-2 font-medium">Tipo</th>
                                    <th className="px-3 py-2 font-medium">Motivo</th>
                                    <th className="px-3 py-2 font-medium">Estado</th>
                                    <th className="px-3 py-2 font-medium">Centro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {solicitudes.length === 0 ? (
                                    <tr>
                                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                                            No hay solicitudes para los filtros actuales.
                                        </td>
                                    </tr>
                                ) : (
                                    solicitudes.map((s) => (
                                        <tr key={s.id_solicitud} className="border-t">
                                            <td className="px-3 py-3 font-medium">{s.id_solicitud}</td>
                                            <td className="px-3 py-3">{new Date(s.fecha_inicio).toLocaleString("es-CL")}</td>
                                            <td className="px-3 py-3">{s.rut_usuario}</td>
                                            <td className="px-3 py-3">
                                                {s.usuario?.nombre} {s.usuario?.apellido}
                                            </td>
                                            <td className="px-3 py-3">{s.tipoSolicitud?.nombre_tipo_solicitud}</td>
                                            <td className="px-3 py-3">{s.motivo?.nombre_motivo}</td>
                                            <td className="px-3 py-3">
                                                <Badge variant={s.estado_solicitud === "En Curso" ? "warning" : "muted"}>{s.estado_solicitud}</Badge>
                                            </td>
                                            <td className="px-3 py-3">{s.centro_id || "-"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
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

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/solicitudes/revisar/page.tsx"
git commit -m "feat: pagina revisar solicitudes en TSX"
```

---

### Task 13: Layout autenticado + AppShell (Sidebar con sesión) + placeholder compartido

**Files:**
- Create: `src/shared/components/layout/stage-placeholder.tsx`
- Create: `src/shared/components/layout/app-shell.tsx`
- Create: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `useSession`, `signOut` (de `next-auth/react`), `MenuItem`.
- Produces: `AppShell` (client) que renderiza sidebar a partir de `session.user.menu` y filtra acceso por rol; `StagePlaceholder`.

- [ ] **Step 1: Crear `src/shared/components/layout/stage-placeholder.tsx`**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function StagePlaceholder({ title, description }: { title: string; description: string }) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Proxima etapa</CardTitle>
                    <CardDescription>La navegacion y el control de acceso ya estan preparados para este modulo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Esta pantalla queda como punto de entrada para continuar el desarrollo.</p>
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 2: Crear `src/shared/components/layout/app-shell.tsx`** — port del `app-shell.jsx` actual usando `useSession`/`signOut` en vez de `useAuth`. El control de acceso por ruta se mantiene; el menú viene de la sesión.

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { BarChart3, CalendarDays, LogOut, Megaphone, Settings, ShieldCheck, ClipboardList, UserCog } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
// lib
import { cn } from "@/shared/lib/utils";
// types
import type { MenuItem } from "@/shared/types/session";

const iconByName: Record<string, typeof ClipboardList> = {
    Solicitudes: ClipboardList,
    "Gestion de Citas": CalendarDays,
    Llamados: Megaphone,
    Dashboard: BarChart3,
    Configuracion: Settings,
    "Usuarios y Roles": UserCog
};

const protectedPrefixes = ["/solicitudes", "/comunicador", "/dashboard", "/configuracion"];

function canAccess(menu: MenuItem[], pathname: string): boolean {
    if (pathname.startsWith("/solicitudes")) return menu.some((item) => item.nombre === "Solicitudes");
    return menu.some((item) => pathname === item.ruta || pathname.startsWith(`${item.ruta}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status } = useSession();
    const user = session?.user;
    const loading = status === "loading";

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.replace("/auth/login");
            return;
        }
        const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
        if (isProtected && !canAccess(user.menu, pathname)) {
            router.replace(user.menu?.[0]?.ruta || "/auth/login");
        }
    }, [loading, user, pathname, router]);

    if (loading || !user || !canAccess(user.menu, pathname)) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">Cargando acceso...</div>
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-card md:flex md:flex-col">
                <div className="border-b p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Gestion Demanda</p>
                            <p className="text-xs text-muted-foreground">Valparaiso</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 p-3">
                    {user.menu.map((item) => {
                        const Icon = iconByName[item.nombre] || ClipboardList;
                        const active = pathname === item.ruta || pathname.startsWith(`${item.ruta}/`);
                        return (
                            <Link
                                key={`${item.id}-${item.ruta}`}
                                href={item.ruta}
                                className={cn(
                                    "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon size={18} />
                                <span>{item.nombre}</span>
                            </Link>
                        );
                    })}
                    {user.menu.some((item) => item.nombre === "Solicitudes") && (
                        <Link
                            href="/solicitudes/revisar"
                            className={cn(
                                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                                pathname.startsWith("/solicitudes/revisar") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <ClipboardList size={18} />
                            <span>Revisar solicitudes</span>
                        </Link>
                    )}
                </nav>

                <div className="border-t p-4">
                    <div className="mb-3">
                        <p className="truncate text-sm font-medium">{user.nombre}</p>
                        <div className="mt-1 flex items-center gap-2">
                            <Badge variant="muted">{user.rol.nombre}</Badge>
                        </div>
                    </div>
                    <Button variant="outline" className="w-full justify-start" onClick={() => signOut({ redirectTo: "/auth/login" })}>
                        <LogOut size={16} />
                        Salir
                    </Button>
                </div>
            </aside>

            <div className="md:pl-72">
                <header className="sticky top-0 z-10 border-b bg-card/95 px-4 py-3 backdrop-blur md:hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Gestion Demanda</span>
                        <Button variant="ghost" size="sm" onClick={() => signOut({ redirectTo: "/auth/login" })}>
                            Salir
                        </Button>
                    </div>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {user.menu.map((item) => (
                            <Link key={item.id} href={item.ruta} className="whitespace-nowrap rounded-md border px-3 py-2 text-sm">
                                {item.nombre}
                            </Link>
                        ))}
                    </div>
                </header>
                <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Crear `src/app/(app)/layout.tsx`** (guard de servidor + AppShell)

```tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/shared/lib/auth";
import { AppShell } from "@/shared/components/layout/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) redirect("/auth/login");
    return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/layout.tsx" src/shared/components/layout
git commit -m "feat: layout autenticado, AppShell con sesion y placeholder compartido"
```

---

### Task 14: Páginas placeholder (comunicador, dashboard, usuarios-roles)

**Files:**
- Create: `src/app/(app)/comunicador/page.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/configuracion/usuarios-roles/page.tsx`

**Interfaces:**
- Consumes: `StagePlaceholder`.

- [ ] **Step 1: Crear `src/app/(app)/comunicador/page.tsx`**

```tsx
import { StagePlaceholder } from "@/shared/components/layout/stage-placeholder";

export default function ComunicadorPage() {
    return (
        <StagePlaceholder
            title="Comunicador"
            description="Modulo unificado de citas y llamados. Una cita contiene varias llamadas; para cerrar o gestionar una cita se realizan llamados."
        />
    );
}
```

- [ ] **Step 2: Crear `src/app/(app)/dashboard/page.tsx`**

```tsx
import { StagePlaceholder } from "@/shared/components/layout/stage-placeholder";

export default function DashboardPage() {
    return <StagePlaceholder title="Dashboard" description="Modulo reservado para indicadores de solicitudes, citas y llamados." />;
}
```

- [ ] **Step 3: Crear `src/app/(app)/configuracion/usuarios-roles/page.tsx`**

```tsx
import { StagePlaceholder } from "@/shared/components/layout/stage-placeholder";

export default function UsuariosRolesPage() {
    return <StagePlaceholder title="Usuarios y Roles" description="Configuracion inicial visible para Administrador y SOME." />;
}
```

- [ ] **Step 4: Verificar typecheck + build**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/comunicador" "src/app/(app)/dashboard" "src/app/(app)/configuracion"
git commit -m "feat: paginas placeholder comunicador, dashboard y usuarios-roles"
```

---

## FASE 4 — Tests, documentación y verificación final

### Task 15: Configurar Vitest y validar tests de actions

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`

**Interfaces:**
- Produces: runner de tests con alias `@/` y entorno jsdom; globals de Vitest.

- [ ] **Step 1: Crear `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"]
    }
});
```

- [ ] **Step 2: Crear `vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Ejecutar los tests de la action (deben pasar)**

Run: `npm test`
Expected: PASS — `crearSolicitud` con 3 tests en verde.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts vitest.setup.ts
git commit -m "test: configurar Vitest + Testing Library y validar tests de solicitudes"
```

---

### Task 16: Documentación (README, AGENTS.md) y verificación final

**Files:**
- Modify: `README.md`
- Create: `AGENTS.md`
- Modify: `docs/er-implementacion.md` (nota de AuditLog)

**Interfaces:** N/A.

- [ ] **Step 1: Reescribir `README.md`** con el nuevo stack y puesta en marcha (Google OAuth, app única). Contenido:

```markdown
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
```

- [ ] **Step 2: Crear `AGENTS.md`** (adaptado del de la referencia: español, 4 espacios, server actions `.action.ts`, Zod, AuditLogger, estructura por modulos). Resumir las convenciones de la sección "Global Constraints" de este plan.

```markdown
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
```

- [ ] **Step 3: Añadir nota a `docs/er-implementacion.md`**

Añadir al final:

```markdown

## AuditLog

Se agrego el modelo `AuditLog` (tabla `logs`) para registrar auditoria de autenticacion y acceso a datos desde las Server Actions. `funcionarios.password_hash` quedo opcional porque el login es via Google OAuth.
```

- [ ] **Step 4: Verificación final completa**

Run: `npm run lint`
Expected: sin errores.

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: build exitoso (`Compiled successfully`). Si falla por variables de entorno de auth en build, asegurar `.env` con valores dummy válidos.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md docs/er-implementacion.md
git commit -m "docs: actualizar README y AGENTS para la app unica Next.js + TS"
```

- [ ] **Step 6: Verificación manual (smoke)**

1. `npm run dev`.
2. Visitar `http://localhost:3000` → redirige a `/auth/login`.
3. Iniciar sesion con una cuenta Google cuyo email exista en `funcionarios` (activo) → entra a `/solicitudes/ingresar`.
4. Buscar pendientes por RUT `12.345.678-9` → muestra la solicitud y llamada demo.
5. Crear una solicitud → toast de exito.
6. Ir a "Revisar solicitudes" → aparece en la tabla.
7. Verificar en `npm run db:studio` que la tabla `logs` registró los eventos.

---

## Self-Review (cobertura del spec)

- **Sección 1-2 spec (arquitectura/estructura):** Tasks 1-4, 7, 13 (estructura `src/modules`, `src/shared`, `src/config` implícita; app única). ✔
- **Sección 3 spec (carpetas):** Tasks 4, 7, 13, 14. ✔
- **Sección 4 spec (Prisma + AuditLog + password_hash opcional):** Task 3, Task 5. ✔
- **Sección 5 spec (NextAuth Google, callbacks, middleware, tipos sesión):** Tasks 6, 7, 8. ✔
- **Sección 6 spec (Server Actions reemplazan servicios):** Tasks 9, 10. ✔
- **Sección 7 spec (módulos; comunicador unificado):** Tasks 9, 10, 14. ✔
- **Sección 8 spec (Tailwind + shadcn new-york/gray):** Tasks 2, 4. ✔
- **Sección 9 spec (toolchain: Zod, RHF, Vitest, sonner, AuditLogger, ESLint):** Tasks 1, 5, 10, 11, 15. (react-hook-form queda disponible como dependencia; los formularios actuales se portaron con estado controlado + Zod en la action, que es equivalente funcional; RHF queda listo para nuevos formularios.) ✔
- **Sección 12 spec (criterios de aceptación):** Task 16 (lint/build/test + smoke; sin referencias a apps/services/packages/api.js). ✔

**Placeholder scan:** No quedan TBD/TODO con contenido faltante. La única dependencia de orden señalada (test de Task 10 que corre en Task 15) está documentada explícitamente.

**Type consistency:** `getPendientes`, `getSolicitudes`, `crearSolicitud`, `getCatalogos`, `SessionUser`, `MenuItem`, `Catalogos`, `SolicitudFiltros`, `CrearSolicitudInput`, `puedeAccederSolicitudes` se definen y consumen con las mismas firmas en todas las tareas.

**Nota sobre react-hook-form:** el spec lo lista en el toolchain. Los dos formularios migrados usan estado controlado (port 1:1 del código actual) y validación Zod en la action. RHF queda instalado y disponible; si se desea, una mejora futura es reescribir el formulario de ingresar con `useForm` + `zodResolver`. Esto se deja fuera de alcance para preservar el comportamiento actual sin reescritura de UI.
