# RBAC por permisos: reemplazo de la tabla `menu` como modelo de autorizacion

Fecha: 2026-07-23
Rama: `feat/rbac-permisos`

## Problema

Hoy la autorizacion esta repartida en lugares que no se hablan entre si:

| Fuente | Ubicacion | Que protege |
| --- | --- | --- |
| Tabla `menu` (`role_id`, 1:N) | BD / `prisma/seed.ts` | El nav y el `canAccess` client-side |
| `ROLES_SOLICITUDES`, `ROLES_COMUNICADOR` | `src/shared/lib/access.ts` | Actions de solicitudes y comunicador |
| `ROLES_CONFIGURACION` | `src/modules/configuracion/actions/mantenedores.action.ts:24` | Actions de configuracion |
| Ruta inyectada a mano | `src/shared/components/layout/app-shell.tsx:48` | Nada: no existe en `menu` |

Defectos concretos:

1. **La autorizacion de rutas es client-side.** `middleware.ts` solo valida autenticacion; `(app)/layout.tsx` solo valida sesion. El `router.replace` de `app-shell.tsx:76` es cosmetico. `/dashboard` no tiene ninguna validacion server-side.
2. **`menu` es un menu, no un modelo de permisos.** `Menu.role_id` es 1:N, asi que la misma ruta se duplica por cada rol. No existe entidad "permiso" ni tabla pivote.
3. **`canAccess` autoriza por un string editable:** `menu.some(item => item.nombre === "Solicitudes")` (`app-shell.tsx:58`). El nombre visible del menu es la llave de autorizacion.
4. **Los checks usan `rol.nombre`.** El mantenedor permite renombrar roles (`guardarRol`); renombrar "SOME" rompe en silencio todos los `includes(...)`. `Role.estado` no se valida: un rol Inactivo sigue autenticando.
5. **Ya hay desincronizacion:** `Full` esta en `ROLES_CONFIGURACION` pero en el seed no tiene menu de Configuracion.
6. **Explosion combinatoria de roles:** "Orientador y Comunicador", "Gestor y Comunicador", "Full" son combinaciones, sintoma de que faltan permisos granulares.
7. **Permisos por modulo, no por accion.** `puedeAccederSolicitudes` cubre por igual ingresar, revisar y gestionar. `getCatalogos` y `getCentros` solo validan sesion.
8. **El menu viaja en el JWT:** cambiar permisos no surte efecto hasta re-login.

## Objetivo

Dos dolores priorizados por el usuario:

- **Dejar de hardcodear roles:** agregar un rol o cambiar sus permisos no debe requerir tocar codigo ni desplegar.
- **Granularidad por accion:** distinguir permisos dentro de un modulo (ingresar vs revisar vs gestionar).

El endurecimiento server-side entra como consecuencia necesaria, no como objetivo separado: sin el, los permisos configurables no se aplican realmente.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Catalogo de permisos | Fijo en codigo (`as const`), asignable en BD | TypeScript valida que el permiso citado existe; no hay permisos huerfanos |
| Tabla `menu` | Se elimina; nav derivado del catalogo | Una sola fuente de verdad; elimina rutas fantasma y desincronizacion |
| Propagacion | Lectura de BD por request con cache | Cambios y revocaciones aplican en la siguiente navegacion, sin re-login |
| Poblado inicial | Derivar del estado actual (`menu` + constantes) | Cubre roles creados desde la UI; nadie pierde acceso |

## Diseno

### 1. Catalogo de permisos y modelo de datos

`src/config/permisos.ts`, unica declaracion:

```ts
export const PERMISOS = {
    "solicitudes.ver":       { modulo: "Solicitudes",   etiqueta: "Ver solicitudes" },
    "solicitudes.crear":     { modulo: "Solicitudes",   etiqueta: "Ingresar solicitud" },
    "solicitudes.gestionar": { modulo: "Solicitudes",   etiqueta: "Revisar y gestionar" },
    "comunicador.ver":       { modulo: "Comunicador",   etiqueta: "Ver citas y llamados" },
    "comunicador.llamar":    { modulo: "Comunicador",   etiqueta: "Registrar llamada" },
    "comunicador.paciente":  { modulo: "Comunicador",   etiqueta: "Editar datos del paciente" },
    "dashboard.ver":         { modulo: "Dashboard",     etiqueta: "Ver indicadores" },
    "config.ver":            { modulo: "Configuracion", etiqueta: "Ver configuracion" },
    "config.funcionarios":   { modulo: "Configuracion", etiqueta: "Editar funcionarios" },
    "config.roles":          { modulo: "Configuracion", etiqueta: "Editar roles y permisos" },
    "config.catalogos":      { modulo: "Configuracion", etiqueta: "Editar catalogos" }
} as const;

export type Permiso = keyof typeof PERMISOS;
```

`modulo` y `etiqueta` alimentan la matriz del mantenedor sin necesidad de una tabla extra.

Prisma:

```prisma
model RolPermiso {
  rol_id  Int
  permiso String @db.VarChar(60)
  role    Role   @relation(fields: [rol_id], references: [id_rol], onDelete: Cascade)

  @@id([rol_id, permiso])
  @@map("roles_permisos")
}
```

`Role` gana `permisos RolPermiso[]` y pierde `menus`. `model Menu` se elimina.

Reglas:

- La clave se guarda como `String`, no enum de BD: agregar un permiso es cambio de codigo + seed, no `ALTER TABLE`.
- Claves en BD que no existen en el catalogo se ignoran al leer y se reportan en el seed. Renombrar un permiso nunca otorga acceso por accidente.
- El catalogo se sincroniza a BD solo para validar; la fuente de verdad de que existe es el archivo TS.

### 2. Capa de autorizacion

`src/shared/lib/permisos.ts`, una sola API para paginas y actions:

```ts
export const getPermisosRol = cache(async (rolId: number): Promise<Set<Permiso>> => { ... });
export async function getSessionPermisos(): Promise<{ user: SessionUser; permisos: Set<Permiso> }>;
export async function requirePermiso(...permisos: Permiso[]): Promise<SessionUser>;        // lanza
export async function requirePermisoPagina(...permisos: Permiso[]): Promise<SessionUser>;  // redirige
```

Un rol con `estado` distinto de activo se resuelve como conjunto vacio de permisos.

**En actions**, reemplaza el par `requireSessionUser()` + `puedeAccederX(user.rol.nombre)`:

```ts
// antes
const user = await requireSessionUser();
if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");
// despues
const user = await requirePermiso("solicitudes.gestionar");
```

Mapa de actions a permisos:

| Permiso | Actions |
| --- | --- |
| `solicitudes.ver` | `getSolicitudes`, `getPendientes`, `getCatalogos`, `getCentros`, `getUsuarioPorRut` |
| `solicitudes.crear` | `crearSolicitud`, `guardarUsuario` |
| `solicitudes.gestionar` | `gestionarSolicitud`, `getRevisionCatalogos`, `getOtrasSolicitudes` |
| `comunicador.ver` | `getCitasPendientes`, `getCitasPendientesPaciente`, `getFiltrosComunicador`, `getHistorialLlamadas`, `getContactoPaciente` |
| `comunicador.llamar` | `registrarLlamada` |
| `comunicador.paciente` | `getUsuarioParaEdicion`, `actualizarUsuarioComunicador` |
| `config.ver` | `getMantenedoresConfig` |
| `config.funcionarios` | `guardarFuncionario` |
| `config.roles` | `guardarRol`, `guardarPermisosRol` |
| `config.catalogos` | `guardarTipoSolicitud`, `guardarMotivo`, `guardarProfesional`, `guardarPrestacion` |

`src/shared/lib/access.ts` queda solo con `esEstadoActivo`; se borran las tres listas hardcodeadas.

**En paginas** (esto hoy no existe). Cada `page.tsx` bajo `(app)` es server component y abre con el guard:

```tsx
export default async function RevisarSolicitudesPage() {
    await requirePermisoPagina("solicitudes.gestionar");
    return <RevisarSolicitudesView />;
}
```

`configuracion/usuarios-roles/page.tsx` es hoy `"use client"` con mas de 600 lineas: se parte en `page.tsx` server (guard) y componente cliente en `src/modules/configuracion/components/`, siguiendo el corte que ya usan los otros modulos.

**Red de seguridad:** test que recorre `src/app/(app)/**/page.tsx` y falla si alguno no invoca `requirePermisoPagina`. Sin el, la siguiente pagina nueva vuelve a nacer desprotegida, que es lo que paso con `/dashboard`.

**Middleware:** sigue validando solo autenticacion. No puede consultar Prisma en runtime edge, y duplicar la logica ahi recrearia la segunda fuente de verdad que estamos eliminando.

Correcciones incluidas en esta capa:

- `Role.estado` se valida en `signIn` y en cada lectura de permisos.
- `getCatalogos` y `getCentros`, que solo validaban sesion, pasan a exigir `solicitudes.ver`.

### 3. Navegacion, sesion y mantenedor

`src/config/navegacion.ts` reemplaza a la tabla `menu` y al `buildNavLinks` que inyecta rutas a mano:

```ts
export const NAV = [
    { label: "Solicitudes",         href: "/solicitudes/ingresar",         icon: FileText,        permiso: "solicitudes.ver" },
    { label: "Revisar solicitudes", href: "/solicitudes/revisar",          icon: ClipboardCheck,  permiso: "solicitudes.gestionar" },
    { label: "Llamadas",            href: "/comunicador",                  icon: Megaphone,       permiso: "comunicador.ver" },
    { label: "Dashboard",           href: "/dashboard",                    icon: LayoutDashboard, permiso: "dashboard.ver" },
    { label: "Configuracion",       href: "/configuracion/usuarios-roles", icon: Settings,        permiso: "config.ver" }
] as const satisfies readonly NavItem[];
```

`permiso` esta tipado contra el catalogo. Desaparecen la inyeccion de `/solicitudes/revisar` y el `canAccess` que autoriza por `item.nombre === "Solicitudes"`.

**Sesion.** El JWT adelgaza a `{ rut, nombre, rol: { id, nombre }, centro_id, centro_nombre }`; sale `menu`. `MenuItem` se elimina de `src/shared/types/session.ts`. El layout resuelve permisos y los pasa al shell:

```tsx
const { user, permisos } = await getSessionPermisos();
return <AppShell user={user} permisos={[...permisos]}>{children}</AppShell>;
```

El `AppShell` filtra `NAV` con esos permisos. Es UI: quien escriba la URL a mano choca igual con el guard de la pagina.

**Mantenedor de permisos.** En la pestana Roles de `/configuracion/usuarios-roles`, editar un rol abre una matriz de checkboxes agrupada por `modulo` (datos del catalogo, sin consulta extra). Action nueva:

```ts
export async function guardarPermisosRol(input: { rol_id: number; permisos: Permiso[] }) {
    const user = await requirePermiso("config.roles");
    // valida contra el catalogo, reemplaza en transaccion, audita
}
```

Salvaguardas:

- Zod valida cada clave contra `PERMISOS`; una clave desconocida rechaza toda la operacion.
- No se puede quitar `config.roles` al propio rol del usuario que edita, para no dejar la instalacion sin administrador.
- Cada cambio se audita con `AuditLogger`, guardando permisos antes y despues.

### 4. Migracion de datos

Script idempotente `prisma/scripts/derivar-permisos.ts` (fuera de `prisma/migrations/`, que gestiona Prisma), ejecutable con `npm run db:rbac:migrar`. Recorre los roles reales de la BD, no los del seed:

| Senal en la BD actual | Permisos derivados |
| --- | --- |
| Menu con ruta `/solicitudes/*` | `solicitudes.ver`, `solicitudes.crear` |
| Rol en `ROLES_SOLICITUDES` | `+ solicitudes.gestionar` |
| Menu `/comunicador` | `comunicador.ver`, `comunicador.llamar`, `comunicador.paciente` |
| Menu `/dashboard` | `dashboard.ver` |
| Menu `/configuracion/*` | `config.ver` |
| Rol en `ROLES_CONFIGURACION` | `+ config.funcionarios`, `config.roles`, `config.catalogos` |

Las tres listas hardcodeadas se copian congeladas dentro del script antes de borrarlas del codigo: son parte del estado actual que hay que preservar.

Casos que la tabla no cubre sola:

- **Rol creado desde la UI, sin menu y sin constantes:** 0 permisos y un `WARN` con nombre del rol y cantidad de funcionarios afectados. No se inventa acceso.
- **`Full` esta en `ROLES_CONFIGURACION` sin menu de Configuracion:** la derivacion es la union, gana `config.*` completo y queda listado en el resumen para revision manual.
- **Idempotencia:** `skipDuplicates`, nunca borra filas existentes. Correrlo dos veces no cambia nada.

Orden de ejecucion en produccion (el paso destructivo va al final y en commit posterior):

1. Migracion Prisma que crea `roles_permisos`. No toca `menu`.
2. `npm run db:rbac:migrar`: deriva y reporta.
3. Verificacion manual del resumen (funcionarios por rol x permisos).
4. Deploy del codigo nuevo.
5. Migracion Prisma que elimina `menu`, en un commit posterior.

Si algo falla entre 2 y 4, la tabla vieja sigue disponible para rollback.

El seed (`prisma/seed.ts`) cambia `roleMenus` por `rolePermisos` declarativo para instalaciones nuevas.

### 5. Pruebas

Vitest, siguiendo el patron de los `.action.test.ts` existentes:

- `permisos.test.ts`: `requirePermiso` deniega sin permiso, acepta con el, trata rol inactivo como sin permisos, y cachea la consulta dentro de un request.
- `paginas-protegidas.test.ts`: recorre `src/app/(app)/**/page.tsx` y falla si alguna no llama al guard.
- `navegacion.test.ts`: toda ruta de `NAV` tiene `page.tsx`, y todo `permiso` de `NAV` existe en el catalogo.
- `derivar-permisos.test.ts`: dado un set de menus y roles produce el mapa esperado; dos corridas no duplican.
- Actualizar los `.action.test.ts` existentes: hoy mockean el rol por nombre, pasaran a mockear permisos.
- `access.test.ts` se reduce a `esEstadoActivo`.

## Fuera de alcance (YAGNI)

- Multi-rol por funcionario.
- Permisos por centro de salud.
- Herencia o jerarquia de roles.
- Eliminar los roles combinados. Con permisos granulares, "Orientador y Comunicador" es un rol con la union de permisos; no hay razon para tocar datos de produccion.

## Archivos afectados

Nuevos:

- `src/config/permisos.ts`, `src/config/navegacion.ts`
- `src/shared/lib/permisos.ts`
- `src/modules/configuracion/components/` (vista cliente de usuarios-roles)
- `src/modules/configuracion/actions/` (`guardarPermisosRol`)
- `prisma/scripts/derivar-permisos.ts`

Modificados:

- `prisma/schema.prisma` (agrega `RolPermiso`, elimina `Menu`), `prisma/seed.ts`
- `src/auth.ts` (JWT sin menu, valida `Role.estado`), `src/shared/types/session.ts`
- `src/shared/lib/access.ts` (queda solo `esEstadoActivo`)
- `src/shared/components/layout/app-shell.tsx`, `src/app/(app)/layout.tsx`
- Todas las paginas bajo `src/app/(app)/`
- Todos los `*.action.ts` de `solicitudes`, `comunicador`, `configuracion`, `catalogos`
