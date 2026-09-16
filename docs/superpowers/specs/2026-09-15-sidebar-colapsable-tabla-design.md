# Espacio de trabajo: sidebar colapsable y tabla de Revisar solicitudes sin scroll horizontal

Fecha: 2026-09-15
Rama: `feat/mejoras-minuta-2026-09-14`
Origen: minuta del 14-09-2026, punto 1 ("Barra lateral colapsable" y "Visualizacion de tablas").
Capturas: punto 1 (sidebar fijo en Ingresar solicitud) y punto 3 (tabla de Revisar solicitudes con la
columna Acciones cortada y scroll horizontal).
Relacionados: issue #23 (resto de tablas con ancho fijo).

## Problema

1. **El sidebar no se puede contraer.** `src/shared/components/layout/app-shell.tsx` es un sidebar propio
   de ancho fijo `w-72` (288px), repetido en `md:pl-72`. En los equipos de los centros de salud ocupa
   espacio que necesitan las tablas.
2. **El contenido tiene tope de 1280px.** `<main className="mx-auto max-w-7xl ...">`: en monitores
   anchos, liberar espacio lateral no ensancharia el contenido.
3. **La tabla de Revisar solicitudes siempre tiene scroll horizontal.**
   `src/modules/solicitudes/components/RevisarSolicitudesView.tsx:391-460`: `min-w-[1180px] table-fixed`
   con 9 columnas de ancho fijo que suman 1277px. En una pantalla de 1440px el espacio util es ~1040px
   (1440 - 288 sidebar - 64 padding - 48 card).
4. **El menu "Gestionar" es manual.** Estado `actionsOpen` (:117) y un `div absolute w-60` dentro de un
   contenedor `overflow-x-auto`: queda recortado por el scroll y no se cierra al hacer clic fuera.
5. **Movil:** el header muestra los enlaces en una fila con scroll horizontal (`app-shell.tsx:103-116`).

## Objetivo

Maximizar el area de trabajo: sidebar contraible a iconos con estado persistente, contenido que use todo
el ancho, y la tabla de Revisar solicitudes legible completa sin scroll horizontal en un notebook de
1366px con el sidebar expandido.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Sidebar | Migrar a `Sidebar` de shadcn, `collapsible="icon"` | Regla del proyecto (shadcn obligatorio); trae tooltips, atajo, accesibilidad, persistencia por cookie y version movil |
| Persistencia | Cookie `sidebar_state` leida en el layout server | Render inicial correcto, sin parpadeo |
| Ancho del contenido | Quitar `max-w-7xl` | Que colapsar el sidebar se traduzca en mas ancho real para las tablas |
| Tabla | 6 columnas agrupadas | Cabe en ~900px sin perder informacion |
| Menu de acciones | `DropdownMenu` de shadcn, mismo boton "Gestionar" | Portal (sin recorte), cierre con clic fuera/Esc; los usuarios reconocen el boton |
| Alcance de tablas | Solo Revisar solicitudes | Lo pedido en la minuta; resto en #23 |

## Diseno

### 1. Componentes shadcn

Usar la skill `shadcn` en cada paso.

- `npx shadcn@latest add sidebar table tooltip`. Segun `--dry-run` (2026-09-15): crea `ui/sidebar.tsx`,
  `ui/sheet.tsx`, `ui/tooltip.tsx`, `ui/separator.tsx`, `ui/skeleton.tsx`, `ui/table.tsx` y
  `src/shared/hooks/use-mobile.tsx`; `ui/button.tsx` e `ui/input.tsx` identicos (skip); agrega
  `@radix-ui/react-tooltip`, `@radix-ui/react-separator`, `@radix-ui/react-dialog` y 16 variables CSS en
  `src/app/globals.css` (mas colores `sidebar` en `tailwind.config.ts`).
- **`ui/dropdown-menu.tsx` local esta recortado** (solo exporta `DropdownMenu`, `DropdownMenuTrigger`,
  `DropdownMenuContent`, `DropdownMenuItem`). Actualizarlo con
  `npx shadcn@latest add dropdown-menu --dry-run` y `--diff`, integrando las piezas faltantes
  (`DropdownMenuGroup`, `DropdownMenuSeparator`, etc.) y preservando ajustes locales. Revisar los usos
  existentes del componente tras actualizar.
- **Tema:** mapear las variables `--sidebar-*` a la paleta actual para conservar el aspecto:
  `--sidebar-background` = `--card`, `--sidebar-foreground` = `--foreground`,
  `--sidebar-primary`/`--sidebar-primary-foreground` = `--primary`/`--primary-foreground` (item activo
  teal, como hoy), `--sidebar-accent` = `--muted`, `--sidebar-border` = `--border`,
  `--sidebar-ring` = `--ring`.
- Revisar los archivos agregados (composicion, imports con alias `@/shared/...`, iconos `lucide-react`).

### 2. Shell de la app

**`src/app/(app)/layout.tsx`** (server): leer la cookie con `cookies()` de `next/headers`
(asincrono en Next 15) y pasar `defaultOpen` al shell.

```tsx
const cookieStore = await cookies();
const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
return (
    <AppShell user={contexto.user} permisos={[...contexto.permisos]} defaultOpen={defaultOpen}>
        {children}
    </AppShell>
);
```

**`src/shared/components/layout/app-shell.tsx`** (cliente), estructura:

```
SidebarProvider defaultOpen={defaultOpen}
├─ Sidebar collapsible="icon"
│  ├─ SidebarHeader        logo CMV + "Gestion Demanda" / "Valparaiso" (textos ocultos al colapsar)
│  ├─ SidebarContent
│  │  └─ SidebarGroup > SidebarMenu
│  │     └─ por item de navVisible(permisos):
│  │        SidebarMenuItem > SidebarMenuButton asChild isActive={isActive(href)} tooltip={label}
│  │           > Link (Icon + label)
│  ├─ SidebarFooter        nombre, centro y Badge de rol (ocultos al colapsar)
│  │                        + SidebarMenuButton "Salir" con tooltip, llama a signOut
│  └─ SidebarRail
└─ SidebarInset
   ├─ header sticky        SidebarTrigger (todos los breakpoints); en movil ademas logo + "Gestion Demanda"
   └─ main                 className="px-4 py-6 md:px-8" (sin max-w-7xl)
```

- `navVisible(permisos)` e `isActive` no cambian: el filtrado por permisos sigue igual.
- Anchos del componente: 16rem expandido (hoy 18rem), 3rem colapsado. Atajo Ctrl/Cmd+B incluido.
- Ocultar textos al colapsar con las utilidades del propio sidebar
  (`group-data-[collapsible=icon]:hidden`), sin `dark:` ni colores crudos.
- **Movil (< 768px, `useIsMobile`):** el sidebar se abre como `Sheet` desde el `SidebarTrigger`. Se elimina
  la fila horizontal de enlaces del header. Al hacer clic en un enlace llamar `setOpenMobile(false)`
  (`useSidebar()`), si no el Sheet queda abierto tras navegar.

### 3. Tabla de Revisar solicitudes

En `RevisarSolicitudesView.tsx`, reemplazar el `<table>` de :391-460 por `Table`, `TableHeader`,
`TableRow`, `TableHead`, `TableBody`, `TableCell`. Sin `min-w-[...]`, `table-fixed` ni `w-[...]` por
columna. `Table` ya envuelve en un contenedor con scroll como respaldo para pantallas angostas.

| # | Columna | Contenido |
| --- | --- | --- |
| 1 | Solicitud | `CodigoId` y debajo la fecha `dd-mm-aaaa` en `text-xs text-muted-foreground` |
| 2 | Paciente | Nombre y apellido; debajo el RUT en `text-xs text-muted-foreground` |
| 3 | Tipo / Motivo | Tipo; debajo el motivo en `text-xs text-muted-foreground`, o "Sin motivo" si es null |
| 4 | Prioridad | `Badge variant="muted"` (igual que hoy) |
| 5 | Descripcion | `line-clamp-2`; si hay texto, `Tooltip` con el texto completo; si no, "-" |
| 6 | Acciones | `DropdownMenu`: trigger `Button variant="outline" size="sm"` con icono `MoreHorizontal` (`data-icon`) y texto "Gestionar"; `DropdownMenuContent align="end"` con `DropdownMenuGroup` y los 4 `DropdownMenuItem` actuales: Realizar solicitud (`openRealizar`), Rechazar solicitud (`openRechazo`), Otras solicitudes (`openOtrasSolicitudes`), Editar usuario (`openEditarUsuario`) |

- Eliminar el estado `actionsOpen` y su menu `absolute`.
- La fila vacia ("No hay solicitudes en espera de validacion...") usa `colSpan={6}`.
- La descripcion corta no debe ensanchar la tabla: la celda puede llevar un ancho maximo relativo
  (ej. `max-w-[20rem]`) solo para acotar el `line-clamp`; no se reintroducen anchos fijos por columna.
- Paginacion y filtros sin cambios.

Referencia de espacio util a 1366px con sidebar expandido: 1366 - 256 - 64 - 48 = ~998px.

### 4. Tests

TDD donde aplique.

- **`vitest.setup.ts`:** mock de `window.matchMedia` (jsdom no lo implementa y `use-mobile` lo usa).
- **`src/shared/components/layout/app-shell.test.tsx`:**
  - Los conteos actuales esperan cada enlace 2 veces (sidebar + header movil); pasan a 1.
  - Se conservan los casos de filtrado por permisos y "sin permisos el shell monta".
  - Nuevo: el `SidebarTrigger` alterna el estado (`data-state` `expanded` ↔ `collapsed`).
  - Nuevo: `defaultOpen={false}` renderiza colapsado.
  - Nuevo: el item activo segun `usePathname` queda marcado (`data-active`).
- **`src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx` (nuevo)**, actions mockeadas:
  - Una fila muestra paciente con RUT y tipo con motivo en las columnas agrupadas; "Sin motivo" si es null.
  - "Gestionar" abre el menu con las 4 opciones, y cada una abre su modal/flujo.
- **Verificacion visual** (skill `run`, app levantada):
  - 1366px y 1920px, sidebar expandido y colapsado: Revisar solicitudes sin scroll horizontal y menu
    "Gestionar" completo.
  - 390px: header con trigger, menu en Sheet, se cierra al navegar.
  - Recargar conserva el estado del sidebar; Ctrl/Cmd+B alterna.
  - Resto de paginas (Ingresar, Llamadas, Dashboard, SOME, Configuracion) sin regresiones de layout.
- Verificacion final: `npm test`, `npx tsc --noEmit`, `npm run lint`.

### 5. Despliegue

Solo frontend. Nuevas dependencias npm (Radix) via `package.json`/`package-lock.json`; el CI ya ejecuta
`npm ci`. Sin cambios de esquema, permisos ni seed.

## Fuera de alcance

- Las otras 12 tablas con ancho minimo fijo (issue #23).
- Dividir `RevisarSolicitudesView.tsx` (946 lineas).
- Rediseno del modal "Otras solicitudes en curso" (S4).
- Nuevos items o reordenamiento del menu de navegacion.

## Criterios de aceptacion

- [ ] El sidebar se contrae a iconos y se expande con el trigger, el rail y Ctrl/Cmd+B; con tooltips al estar contraido.
- [ ] El estado se conserva al recargar y al navegar, sin parpadeo inicial.
- [ ] En movil el menu se abre como panel lateral y se cierra al navegar.
- [ ] El contenido usa todo el ancho disponible.
- [ ] A 1366px con sidebar expandido, Revisar solicitudes no muestra scroll horizontal y el menu "Gestionar" no queda recortado.
- [ ] El filtrado del menu por permisos se mantiene.
- [ ] `npm test`, `npx tsc --noEmit` y `npm run lint` en verde.
