# Sidebar Colapsable y Tabla de Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maximizar el ancho util de la app con un sidebar shadcn colapsable y una tabla de Revisar solicitudes que entre sin scroll horizontal a 1366px con el sidebar expandido.

**Architecture:** La base visual se mueve desde un layout propio de ancho fijo a `Sidebar` de shadcn, con persistencia por cookie leida en el layout server y render inicial sin parpadeo. La tabla de Revisar solicitudes conserva la misma data y flujos, pero agrupa columnas, usa `Table`, `Tooltip` y `DropdownMenu` para eliminar anchos fijos y evitar menus recortados dentro de `overflow-x-auto`.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript strict, Tailwind v3, shadcn/ui new-york, Radix primitives, lucide-react, Vitest + Testing Library.

## Global Constraints

- Idioma espanol en UI, tests y commits. Indentacion: 4 espacios.
- TypeScript strict; tipos explicitos. `interface` para objetos y `type`/`as const` para uniones.
- Alias `@/` -> `src/`. Imports categorizados con comentarios (`// lib`, `// components`, etc.).
- Usar shadcn/ui como fuente de componentes. No crear un sidebar propio nuevo.
- Usar `npx shadcn@latest` porque `package.json` usa npm.
- shadcn: usar colores semanticos, `gap-*` en vez de `space-*`, `cn()` para clases condicionales, `data-icon` en iconos dentro de `Button`, `DropdownMenuItem` dentro de `DropdownMenuGroup`.
- No introducir colores crudos, `dark:` manuales ni `z-index` manual en overlays nuevos.
- `Sidebar` expandido: 16rem. `Sidebar` colapsado: 3rem. Persistencia por cookie `sidebar_state`.
- Movil menor a 768px: sidebar como `Sheet`; eliminar fila horizontal de links del header.
- Alcance de tablas: solo `RevisarSolicitudesView.tsx`; resto queda fuera de alcance por issue #23.
- Verificacion final obligatoria: `npm test`, `npx tsc --noEmit`, `npm run lint`.

---

## Estrategia de Ejecucion por Etapas

Este plan conviene ejecutarlo por etapas porque mezcla infraestructura shadcn, layout global y tabla de alto trafico:

1. **Etapa A - Base shadcn y test setup:** instalar/actualizar componentes UI, variables de tema y `matchMedia`.
2. **Etapa B - AppShell colapsable:** leer cookie en layout server, migrar el shell a `Sidebar` y cubrir comportamiento con tests.
3. **Etapa C - Tabla Revisar solicitudes:** agrupar columnas, reemplazar menu manual por `DropdownMenu` y cubrir flujos con tests.
4. **Etapa D - Verificacion visual y cierre:** validar 1366px, 1920px y movil; correr suite completa.

---

### Task 1: Base shadcn, Tema Sidebar y Setup de Tests

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/shared/components/ui/sidebar.tsx`
- Create: `src/shared/components/ui/sheet.tsx`
- Create: `src/shared/components/ui/tooltip.tsx`
- Create: `src/shared/components/ui/separator.tsx`
- Create: `src/shared/components/ui/skeleton.tsx`
- Create: `src/shared/components/ui/table.tsx`
- Modify: `src/shared/components/ui/dropdown-menu.tsx`
- Create: `src/shared/hooks/use-mobile.tsx`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `vitest.setup.ts`

**Interfaces:**
- Produces: componentes shadcn `Sidebar*`, `Sheet*`, `Tooltip*`, `Table*`, `DropdownMenuGroup`, `DropdownMenuSeparator`.
- Produces: hook `useIsMobile(): boolean`.
- Produces: variables CSS `--sidebar-*` y colores Tailwind `sidebar`.
- Produces: mock global de `window.matchMedia` para tests jsdom.

- [ ] **Step 1: Consultar documentacion shadcn relevante**

Run:

```bash
npx shadcn@latest docs sidebar table tooltip sheet dropdown-menu
```

Expected: salida con URLs de documentacion para cada componente. Abrir o consultar las paginas antes de editar si hay cambios en API.

- [ ] **Step 2: Previsualizar componentes nuevos**

Run:

```bash
npx shadcn@latest add sidebar table tooltip --dry-run
```

Expected: lista de archivos a crear o modificar que incluya `sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `separator.tsx`, `skeleton.tsx`, `table.tsx`, `src/shared/hooks/use-mobile.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `package.json` y `package-lock.json`. Si el CLI lista `button.tsx` o `input.tsx` como unchanged, no forzar overwrite.

- [ ] **Step 3: Agregar componentes shadcn**

Run:

```bash
npx shadcn@latest add sidebar table tooltip
```

Expected: componentes creados bajo `src/shared/components/ui`, hook creado bajo `src/shared/hooks`, dependencias Radix agregadas y archivos de tema actualizados.

- [ ] **Step 4: Previsualizar actualizacion de dropdown-menu**

Run:

```bash
npx shadcn@latest add dropdown-menu --dry-run
```

Expected: confirma que `src/shared/components/ui/dropdown-menu.tsx` se actualizaria. No usar `--overwrite`.

Run:

```bash
npx shadcn@latest add dropdown-menu --diff src/shared/components/ui/dropdown-menu.tsx
```

Expected: diff que muestra exports faltantes como `DropdownMenuGroup`, `DropdownMenuSeparator`, `DropdownMenuLabel`, `DropdownMenuShortcut`, `DropdownMenuSub*`, `DropdownMenuCheckboxItem` y `DropdownMenuRadio*`.

- [ ] **Step 5: Actualizar `dropdown-menu.tsx` preservando imports locales**

Reemplazar el archivo por la version shadcn new-york adaptada a los aliases del proyecto. Debe conservar:

```tsx
"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
// lib
import { cn } from "@/shared/lib/utils";
```

Debe exportar al menos:

```tsx
export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuRadioGroup
};
```

Mantener `DropdownMenuContent` portalizado con `z-50` propio del componente shadcn, sin agregar `z-*` en los consumidores.

- [ ] **Step 6: Mapear variables de tema del sidebar**

En `src/app/globals.css`, dentro de `:root`, asegurar estos tokens:

```css
        --sidebar-background: var(--card);
        --sidebar-foreground: var(--foreground);
        --sidebar-primary: var(--primary);
        --sidebar-primary-foreground: var(--primary-foreground);
        --sidebar-accent: var(--muted);
        --sidebar-accent-foreground: var(--foreground);
        --sidebar-border: var(--border);
        --sidebar-ring: var(--ring);
```

No agregar bloque `dark:` ni paletas crudas.

- [ ] **Step 7: Agregar colores sidebar a Tailwind**

En `tailwind.config.ts`, dentro de `theme.extend.colors`, agregar:

```ts
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    foreground: "hsl(var(--sidebar-foreground))",
                    primary: "hsl(var(--sidebar-primary))",
                    "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
                    accent: "hsl(var(--sidebar-accent))",
                    "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
                    border: "hsl(var(--sidebar-border))",
                    ring: "hsl(var(--sidebar-ring))"
                }
```

- [ ] **Step 8: Agregar mock global de `matchMedia`**

Reemplazar `vitest.setup.ts` por:

```ts
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
    }))
});
```

- [ ] **Step 9: Verificar tipos de la base UI**

Run:

```bash
npx tsc --noEmit
```

Expected: puede fallar por usos futuros aun no migrados solo si los componentes shadcn quedaron incompletos. No avanzar con errores de import o tipos en archivos recien agregados.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/shared/components/ui src/shared/hooks/use-mobile.tsx src/app/globals.css tailwind.config.ts vitest.setup.ts
git commit -m "feat(ui): base shadcn para sidebar colapsable"
```

---

### Task 2: Tests de AppShell Colapsable

**Files:**
- Modify: `src/shared/components/layout/app-shell.test.tsx`
- Modify later in Task 3: `src/shared/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: `AppShellProps.defaultOpen?: boolean`.
- Produces: tests que exigen un solo set visible de links, sidebar con estado inicial, trigger funcional y item activo.

- [ ] **Step 1: Escribir tests fallidos del shell**

Reemplazar `src/shared/components/layout/app-shell.test.tsx` por:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
// config
import type { Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

vi.mock("next/navigation", () => ({
    usePathname: () => "/comunicador"
}));
vi.mock("next-auth/react", () => ({
    signOut: vi.fn()
}));

import { AppShell } from "./app-shell";

const usuario: SessionUser = {
    rut: "1-9",
    email: "o@x.cl",
    nombre: "Orientador de Prueba",
    centro_id: "501",
    centro_nombre: "CESFAM Placeres",
    rol: { id: 2, nombre: "Orientador" }
};

function renderShell(permisos: Permiso[], defaultOpen = true) {
    return render(
        <AppShell user={usuario} permisos={permisos} defaultOpen={defaultOpen}>
            <div>Contenido de prueba</div>
        </AppShell>
    );
}

describe("AppShell", () => {
    it("filtra el nav por permisos: solo comunicador.ver muestra Llamadas una vez", () => {
        renderShell(["comunicador.ver"]);

        expect(screen.getAllByText("Llamadas")).toHaveLength(1);
        expect(screen.queryAllByText("Solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Revisar solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Dashboard")).toHaveLength(0);
        expect(screen.queryAllByText("Configuracion")).toHaveLength(0);
    });

    it("muestra multiples links cuando hay multiples permisos sin duplicarlos en header movil", () => {
        renderShell(["solicitudes.ver", "solicitudes.gestionar"]);

        expect(screen.getAllByText("Solicitudes")).toHaveLength(1);
        expect(screen.getAllByText("Revisar solicitudes")).toHaveLength(1);
        expect(screen.queryAllByText("Llamadas")).toHaveLength(0);
    });

    it("sin permisos no renderiza links, pero el shell sigue montando", () => {
        renderShell([]);

        expect(screen.queryAllByText("Solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Revisar solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Llamadas")).toHaveLength(0);
        expect(screen.queryAllByText("Dashboard")).toHaveLength(0);
        expect(screen.queryAllByText("Configuracion")).toHaveLength(0);

        expect(screen.getByText("Orientador de Prueba")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument();
    });

    it("muestra los datos del usuario: nombre, centro y rol", () => {
        renderShell(["dashboard.ver"]);

        expect(screen.getByText("Orientador de Prueba")).toBeInTheDocument();
        expect(screen.getByText("CESFAM Placeres")).toBeInTheDocument();
        expect(screen.getByText("Orientador")).toBeInTheDocument();
    });

    it("renderiza el contenido pasado como children", () => {
        renderShell(["dashboard.ver"]);

        expect(screen.getByText("Contenido de prueba")).toBeInTheDocument();
    });

    it("renderiza colapsado cuando defaultOpen es false", () => {
        renderShell(["comunicador.ver"], false);

        expect(screen.getByTestId("app-sidebar-wrapper")).toHaveAttribute("data-state", "collapsed");
    });

    it("el trigger alterna el estado expanded y collapsed", () => {
        renderShell(["comunicador.ver"]);

        const wrapper = screen.getByTestId("app-sidebar-wrapper");
        expect(wrapper).toHaveAttribute("data-state", "expanded");

        fireEvent.click(screen.getByRole("button", { name: "Alternar menu lateral" }));

        expect(wrapper).toHaveAttribute("data-state", "collapsed");
    });

    it("marca el item activo segun usePathname", () => {
        renderShell(["comunicador.ver"]);

        const link = screen.getByRole("link", { name: /Llamadas/i });
        expect(link.closest("[data-active]")).toHaveAttribute("data-active", "true");
    });
});
```

- [ ] **Step 2: Ejecutar test y verificar que falla**

Run:

```bash
npm test -- src/shared/components/layout/app-shell.test.tsx
```

Expected: FAIL porque `AppShell` no acepta `defaultOpen`, los links se duplican y no existe `data-testid="app-sidebar-wrapper"`.

- [ ] **Step 3: Commit del test fallido si el flujo de trabajo exige checkpoint**

Si el equipo pide commits TDD estrictos por subtask:

```bash
git add src/shared/components/layout/app-shell.test.tsx
git commit -m "test(layout): cubre sidebar colapsable"
```

Si no se quiere dejar commit rojo, avanzar directamente a Task 3 y commitear test + implementacion juntos.

---

### Task 3: Migrar AppShell a Sidebar shadcn

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/shared/components/layout/app-shell.tsx`
- Test: `src/shared/components/layout/app-shell.test.tsx`

**Interfaces:**
- Produces: `AppShell({ user, permisos, children, defaultOpen = true }: AppShellProps)`.
- Produces: `SidebarProvider defaultOpen={defaultOpen}`.
- Produces: header sticky con `SidebarTrigger` en todos los breakpoints.
- Produces: cierre del sheet movil al navegar usando `useSidebar().setOpenMobile(false)`.

- [ ] **Step 1: Leer cookie `sidebar_state` en layout server**

Modificar `src/app/(app)/layout.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
// lib
import { getSessionPermisos } from "@/shared/lib/permisos";
// components
import { AppShell } from "@/shared/components/layout/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const contexto = await getSessionPermisos();
    if (!contexto) redirect("/auth/login");

    const cookieStore = await cookies();
    const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

    return (
        <AppShell user={contexto.user} permisos={[...contexto.permisos]} defaultOpen={defaultOpen}>
            {children}
        </AppShell>
    );
}
```

- [ ] **Step 2: Reemplazar AppShell por composicion shadcn**

Reemplazar `src/shared/components/layout/app-shell.tsx` por:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
// components
import { Badge } from "@/shared/components/ui/badge";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
    useSidebar
} from "@/shared/components/ui/sidebar";
// config
import { navVisible } from "@/config/navegacion";
import type { Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

interface AppShellProps {
    user: SessionUser;
    permisos: Permiso[];
    children: React.ReactNode;
    defaultOpen?: boolean;
}

interface AppSidebarProps {
    user: SessionUser;
    permisos: Permiso[];
}

export function AppShell({ user, permisos, children, defaultOpen = true }: AppShellProps) {
    return (
        <SidebarProvider
            defaultOpen={defaultOpen}
            style={
                {
                    "--sidebar-width": "16rem",
                    "--sidebar-width-icon": "3rem"
                } as React.CSSProperties
            }
        >
            <AppSidebar user={user} permisos={permisos} />
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-6">
                    <SidebarTrigger aria-label="Alternar menu lateral" />
                    <div className="flex items-center gap-2 md:hidden">
                        <Image src="/assets/logo-cmv.png" alt="Corporacion Municipal Valparaiso" width={32} height={32} className="h-8 w-auto" />
                        <span className="text-sm font-semibold">Gestion Demanda</span>
                    </div>
                </header>
                <main className="px-4 py-6 md:px-8">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}

function AppSidebar({ user, permisos }: AppSidebarProps) {
    const pathname = usePathname();
    const { state, setOpenMobile } = useSidebar();
    const navLinks = navVisible(permisos);
    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    function closeMobileNav() {
        setOpenMobile(false);
    }

    return (
        <Sidebar collapsible="icon" data-testid="app-sidebar-wrapper" data-state={state}>
            <SidebarHeader className="border-b">
                <div className="flex h-14 items-center gap-3 px-2">
                    <div className="flex size-10 items-center justify-center overflow-hidden rounded-md">
                        <Image
                            src="/assets/logo-cmv.png"
                            alt="Corporacion Municipal Valparaiso"
                            width={40}
                            height={40}
                            className="h-10 w-auto"
                            priority
                        />
                    </div>
                    <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                        <p className="truncate text-sm font-semibold">Gestion Demanda</p>
                        <p className="truncate text-xs text-muted-foreground">Valparaiso</p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {navLinks.map(({ href, label, icon: Icon }) => {
                            const active = isActive(href);
                            return (
                                <SidebarMenuItem key={href}>
                                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                                        <Link href={href} onClick={closeMobileNav}>
                                            <Icon />
                                            <span>{label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t">
                <SidebarMenu>
                    <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
                        <div className="flex flex-col gap-2 rounded-md px-2 py-1.5">
                            <p className="truncate text-sm font-medium">{user.nombre}</p>
                            <p className="truncate text-xs text-muted-foreground">{user.centro_nombre || "Sin centro"}</p>
                            <div className="flex">
                                <Badge variant="muted">{user.rol.nombre}</Badge>
                            </div>
                        </div>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Salir" onClick={() => signOut({ redirectTo: "/auth/login" })}>
                            <LogOut />
                            <span>Salir</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
```

- [ ] **Step 3: Verificar y ajustar APIs reales del componente Sidebar**

Si el `sidebar.tsx` generado no permite `aria-label` directo en `SidebarTrigger`, adaptar el componente local para aceptar props de `Button` y pasarlas al trigger. El uso esperado debe seguir siendo:

```tsx
<SidebarTrigger aria-label="Alternar menu lateral" />
```

Si `SidebarMenuButton` no expone `data-active`, agregar `data-active={isActive}` al button local sin cambiar su API publica.

- [ ] **Step 4: Ejecutar test del shell**

Run:

```bash
npm test -- src/shared/components/layout/app-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Verificar tipos del layout**

Run:

```bash
npx tsc --noEmit
```

Expected: sin errores en `src/app/(app)/layout.tsx`, `app-shell.tsx` ni componentes shadcn.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(app)/layout.tsx' src/shared/components/layout/app-shell.tsx src/shared/components/layout/app-shell.test.tsx src/shared/components/ui/sidebar.tsx
git commit -m "feat(layout): sidebar colapsable persistente"
```

---

### Task 4: Tests de Tabla Compacta y Dropdown de Gestion

**Files:**
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`
- Modify later in Task 5: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`

**Interfaces:**
- Produces: tests que exigen columnas agrupadas, motivo nulo como "Sin motivo", descripcion con tooltip y menu `Gestionar` portalizado con cuatro opciones.

- [ ] **Step 1: Agregar casos de tabla compacta**

En `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`, agregar al final del archivo:

```tsx
describe("RevisarSolicitudesView tabla compacta", () => {
    it("muestra una fila agrupando solicitud, paciente y tipo con motivo", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");

        expect(screen.getByRole("columnheader", { name: "Solicitud" })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "Paciente" })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "Tipo / Motivo" })).toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "RUT" })).not.toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "Nombre usuario" })).not.toBeInTheDocument();

        expect(screen.getByText("Juan Perez")).toBeInTheDocument();
        expect(screen.getByText("12345678-5")).toBeInTheDocument();
        expect(screen.getByText("Atencion")).toBeInTheDocument();
        expect(screen.getByText("Control")).toBeInTheDocument();
    });

    it("muestra Sin motivo cuando la solicitud no tiene motivo", async () => {
        vi.mocked(getSolicitudes).mockResolvedValueOnce({
            solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-3", motivo: null }],
            total: 1,
            page: 1,
            pageSize: 100,
            totalPages: 1
        } as Awaited<ReturnType<typeof getSolicitudes>>);

        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-3");
        expect(screen.getByText("Sin motivo")).toBeInTheDocument();
    });

    it("abre Gestionar como menu con las cuatro acciones", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));

        expect(screen.getByRole("menuitem", { name: /Realizar solicitud/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Rechazar solicitud/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Otras solicitudes/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Editar usuario/i })).toBeInTheDocument();
    });

    it("cada opcion de Gestionar abre su flujo principal", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
        fireEvent.click(screen.getByRole("menuitem", { name: /Realizar solicitud/i }));
        expect(await screen.findByRole("dialog", { name: "Realizar solicitud" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
        fireEvent.click(screen.getByRole("menuitem", { name: /Rechazar solicitud/i }));
        expect(await screen.findByRole("dialog", { name: "Rechazar solicitud" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));
        await waitFor(() => expect(getOtrasSolicitudes).toHaveBeenCalledWith("12345678-5", "SOL-1"));

        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
        fireEvent.click(screen.getByRole("menuitem", { name: /Editar usuario/i }));
        expect(await screen.findByRole("dialog", { name: /Editar usuario/i })).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Ejecutar test y verificar que falla**

Run:

```bash
npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
```

Expected: FAIL porque la tabla aun usa 9 columnas fijas y el menu no expone roles `menuitem`.

---

### Task 5: Migrar Tabla de Revisar solicitudes a 6 Columnas

**Files:**
- Modify: `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`
- Test: `src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`

**Interfaces:**
- Consumes: `SolicitudRow`.
- Produces: tabla de 6 columnas: Solicitud, Paciente, Tipo / Motivo, Prioridad, Descripcion, Acciones.
- Produces: `DropdownMenu` portalizado para acciones.
- Removes: estado `actionsOpen`.

- [ ] **Step 1: Ajustar imports**

En `src/modules/solicitudes/components/RevisarSolicitudesView.tsx`, agregar:

```tsx
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
```

Mantener `MoreHorizontal`, `Check`, `X`, `Eye`, `Edit` desde `lucide-react`.

- [ ] **Step 2: Eliminar estado manual del menu**

Eliminar:

```tsx
    const [actionsOpen, setActionsOpen] = useState<string | null>(null);
```

En `openRechazo`, `openRealizar`, `openOtrasSolicitudes` y `openEditarUsuario`, eliminar cada linea:

```tsx
        setActionsOpen(null);
```

- [ ] **Step 3: Agregar helpers de fecha, descripcion y menu**

Antes de `export function RevisarSolicitudesView()`, agregar:

```tsx
function formatFechaSolicitud(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("es-CL");
}

function DescripcionSolicitudCell({ descripcion }: { descripcion: string | null }) {
    if (!descripcion) return <span className="text-muted-foreground">-</span>;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="line-clamp-2 max-w-[20rem] cursor-help">{descripcion}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
                <p>{descripcion}</p>
            </TooltipContent>
        </Tooltip>
    );
}
```

- [ ] **Step 4: Reemplazar tabla fija por `Table`**

Reemplazar el bloque desde `<div className="overflow-x-auto rounded-md border">` hasta su cierre por:

```tsx
                    <TooltipProvider>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Solicitud</TableHead>
                                        <TableHead>Paciente</TableHead>
                                        <TableHead>Tipo / Motivo</TableHead>
                                        <TableHead>Prioridad</TableHead>
                                        <TableHead>Descripcion</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.solicitudes.length === 0 ? (
                                        <TableRow>
                                            <TableCell className="py-6 text-center text-muted-foreground" colSpan={6}>
                                                No hay solicitudes en espera de validacion para los filtros actuales.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.solicitudes.map((s) => (
                                            <TableRow key={s.id_solicitud}>
                                                <TableCell className="align-top font-medium">
                                                    <div className="flex flex-col gap-1">
                                                        <CodigoId id={s.id_solicitud} />
                                                        <span className="text-xs font-normal text-muted-foreground">{formatFechaSolicitud(s.fecha_inicio)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="flex flex-col gap-1">
                                                        <span>
                                                            {s.usuario?.nombre} {s.usuario?.apellido}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">{s.rut_usuario}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="flex flex-col gap-1">
                                                        <span>{s.tipoSolicitud?.nombre_tipo_solicitud || "-"}</span>
                                                        <span className="text-xs text-muted-foreground">{s.motivo?.nombre_motivo || "Sin motivo"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <Badge variant="muted">{s.priorizacion_admin ?? "-"}</Badge>
                                                </TableCell>
                                                <TableCell className="max-w-[20rem] align-top">
                                                    <DescripcionSolicitudCell descripcion={s.descripcion} />
                                                </TableCell>
                                                <TableCell className="align-top text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button type="button" variant="outline" size="sm">
                                                                <MoreHorizontal data-icon="inline-start" />
                                                                Gestionar
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuGroup>
                                                                <DropdownMenuItem onSelect={() => openRealizar(s)}>
                                                                    <Check />
                                                                    Realizar solicitud
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => openRechazo(s)}>
                                                                    <X />
                                                                    Rechazar solicitud
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => openOtrasSolicitudes(s)}>
                                                                    <Eye />
                                                                    Otras solicitudes
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => openEditarUsuario(s)}>
                                                                    <Edit />
                                                                    Editar usuario
                                                                </DropdownMenuItem>
                                                            </DropdownMenuGroup>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TooltipProvider>
```

Confirmar que no quedan `min-w-[1180px]`, `table-fixed`, `w-[...]` por columna ni `absolute right-3`.

- [ ] **Step 5: Ejecutar tests de Revisar solicitudes**

Run:

```bash
npm test -- src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Verificar que no quedan usos del estado eliminado**

Run:

```bash
rg "actionsOpen|setActionsOpen|min-w-\[1180px\]|table-fixed|absolute right-3" src/modules/solicitudes/components/RevisarSolicitudesView.tsx
```

Expected: sin resultados.

- [ ] **Step 7: Commit**

```bash
git add src/modules/solicitudes/components/RevisarSolicitudesView.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
git commit -m "feat(solicitudes): tabla de revision compacta"
```

---

### Task 6: Integracion, Verificacion Visual y Cierre

**Files:**
- Modify only files from earlier tasks if verification finds concrete issues.

**Interfaces:**
- Produces: evidencia de aceptacion para desktop 1366px, desktop ancho, movil y comandos finales.

- [ ] **Step 1: Ejecutar tests focalizados**

Run:

```bash
npm test -- src/shared/components/layout/app-shell.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Ejecutar verificacion global**

Run:

```bash
npm test
```

Expected: PASS.

Run:

```bash
npx tsc --noEmit
```

Expected: sin errores.

Run:

```bash
npm run lint
```

Expected: sin errores.

- [ ] **Step 3: Levantar app local**

Run:

```bash
npm run dev
```

Expected: servidor en `http://localhost:3000`.

- [ ] **Step 4: Verificacion visual desktop 1366px**

Abrir `/solicitudes/revisar` a 1366px de ancho con sidebar expandido. Confirmar:

1. La tabla no muestra scroll horizontal en el contenedor de solicitudes.
2. Se ven completas las columnas Solicitud, Paciente, Tipo / Motivo, Prioridad, Descripcion y Acciones.
3. El boton `Gestionar` abre el menu completo y no queda recortado.
4. El contenido usa todo el ancho disponible; no queda centrado en `max-w-7xl`.

- [ ] **Step 5: Verificacion visual desktop ancho y colapsado**

A 1920px:

1. Sidebar expandido ocupa 16rem.
2. `SidebarTrigger`, rail y Ctrl/Cmd+B alternan expandido y colapsado.
3. En colapsado quedan iconos, tooltips y boton Salir disponibles.
4. Recargar conserva el estado via cookie `sidebar_state`.

- [ ] **Step 6: Verificacion visual movil**

A 390px:

1. El header muestra logo, texto `Gestion Demanda` y trigger.
2. No existe fila horizontal de links.
3. El trigger abre el menu como Sheet.
4. Al tocar un link, el Sheet se cierra y navega.

- [ ] **Step 7: Verificar paginas protegidas principales**

Recorrer:

1. `/solicitudes/ingresar`
2. `/solicitudes/revisar`
3. `/comunicador`
4. `/dashboard`
5. `/configuracion/usuarios-roles`

Confirmar que ninguna pagina queda tapada por el header/sidebar y que el scroll vertical sigue en el documento principal.

- [ ] **Step 8: Commit de ajustes si existieron**

Si la verificacion visual exigio cambios:

```bash
git add src/app src/shared src/modules/solicitudes tailwind.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "fix(layout): ajustes visuales de sidebar y tabla"
```

Si no hubo cambios, no crear commit vacio.

---

## Cierre

- [ ] **Checklist de aceptacion**

Confirmar:

1. El sidebar se contrae a iconos y se expande con trigger, rail y Ctrl/Cmd+B.
2. El estado se conserva al recargar y al navegar sin parpadeo inicial.
3. En movil el menu se abre como panel lateral y se cierra al navegar.
4. El contenido usa todo el ancho disponible.
5. A 1366px con sidebar expandido, Revisar solicitudes no muestra scroll horizontal.
6. El menu `Gestionar` no queda recortado y se cierra con clic fuera o Esc.
7. El filtrado del menu por permisos se mantiene.
8. `npm test`, `npx tsc --noEmit` y `npm run lint` quedan en verde.

- [ ] **Handoff de ejecucion recomendado**

Ejecutar con `subagent-driven-development`, una tarea por subagente y revision entre tareas. Si se ejecuta inline, usar `executing-plans` y cerrar cada etapa A-D con sus tests antes de avanzar.
