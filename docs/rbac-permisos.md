# RBAC por permisos — como funciona y como se extiende

Documento de referencia para humanos y agentes. Explica donde vive cada pieza del sistema de
permisos, como se aplica en runtime, y el procedimiento exacto para agregar, quitar o renombrar
un permiso.

Origen de la feature: `docs/superpowers/specs/2026-07-23-rbac-permisos-design.md` (diseno) y
`docs/superpowers/plans/2026-07-23-rbac-permisos.md` (plan de implementacion).

---

## 1. Respuesta corta: codigo o base de datos

**Los dos, con responsabilidades separadas.**

| Que | Donde vive | Fuente de verdad |
| --- | --- | --- |
| **Que permisos existen** (clave, modulo, etiqueta) | `src/config/permisos.ts` | Codigo |
| **Que rol tiene cada permiso** (asignacion) | Tabla `roles_permisos` (modelo `RolPermiso`) | Base de datos |

El propio catalogo lo declara en su cabecera:

> `// Catalogo unico de permisos del sistema.`
> `// La fuente de verdad de que permisos existen es este archivo; la BD solo guarda`
> `// que rol tiene cada clave (tabla roles_permisos).`

**Consecuencia practica:** no se puede crear un permiso nuevo desde la UI. Agregar un permiso es un
cambio de codigo + deploy. Lo que si es configurable en caliente, sin deploy, es marcar o desmarcar
un permiso existente por rol desde Configuracion -> Roles -> Permisos.

---

## 2. Piezas del sistema

| Archivo | Rol |
| --- | --- |
| `src/config/permisos.ts` | Catalogo `PERMISOS` (`as const`), `type Permiso`, `CLAVES_PERMISOS`, `esPermiso()`, `agruparPermisos()` |
| `prisma/schema.prisma` | `model RolPermiso` -> tabla `roles_permisos`; relacion `Role.permisos` |
| `src/shared/lib/permisos.ts` | Lectura por request + guards: `getPermisosRol`, `getSessionPermisos`, `requirePermiso`, `requirePermisoPagina` |
| `src/config/navegacion.ts` | `NAV` (cada item declara su `permiso`) y `navVisible()` |
| `src/shared/components/layout/app-shell.tsx` | Filtra el menu lateral con `navVisible(permisos)` |
| `src/modules/configuracion/actions/mantenedores.action.ts` | `guardarPermisosRol()` — mantenedor de la matriz rol x permiso |
| `src/modules/configuracion/components/PermisosRolModal.tsx` | UI de la matriz, alimentada por `agruparPermisos()` |
| `prisma/seed.ts` | Bootstrap de permisos por rol solo en instalaciones nuevas |

### Catalogo (codigo)

```ts
export const PERMISOS = {
    "solicitudes.ver":      { modulo: "Solicitudes",   etiqueta: "Ver solicitudes" },
    "solicitudes.crear":    { modulo: "Solicitudes",   etiqueta: "Ingresar solicitud" },
    "solicitudes.gestionar":{ modulo: "Solicitudes",   etiqueta: "Revisar y gestionar" },
    "comunicador.ver":      { modulo: "Comunicador",   etiqueta: "Ver citas y llamados" },
    "comunicador.llamar":   { modulo: "Comunicador",   etiqueta: "Registrar llamada" },
    "comunicador.paciente": { modulo: "Comunicador",   etiqueta: "Editar datos del paciente" },
    "dashboard.ver":        { modulo: "Dashboard",     etiqueta: "Ver indicadores" },
    "some.ver":             { modulo: "SOME",          etiqueta: "Ver panel SOME" },
    "config.ver":           { modulo: "Configuracion", etiqueta: "Ver configuracion" },
    "config.funcionarios":  { modulo: "Configuracion", etiqueta: "Editar funcionarios" },
    "config.roles":         { modulo: "Configuracion", etiqueta: "Editar roles y permisos" },
    "config.catalogos":     { modulo: "Configuracion", etiqueta: "Editar catalogos" },
    "historial.ver":        { modulo: "Historial",     etiqueta: "Ver historial del paciente" }
} as const;
```

Formato de clave: `modulo.accion`, minusculas, validado por test con `/^[a-z]+\.[a-z_]+$/`.

De ese objeto salen tres cosas:

- `type Permiso = keyof typeof PERMISOS` — TypeScript rechaza en compilacion cualquier
  `requirePermiso("inventado")`. No hay strings sueltos en los guards.
- `esPermiso(valor)` — type guard de runtime para lo que llega desde la BD o desde un formulario.
- `agruparPermisos()` — agrupa por modulo para pintar la matriz del mantenedor.

### Asignacion (base de datos)

```prisma
model RolPermiso {
  rol_id  Int
  permiso String @db.VarChar(60)
  role    Role   @relation(fields: [rol_id], references: [id_rol], onDelete: Cascade)

  @@id([rol_id, permiso])
  @@map("roles_permisos")
}
```

Pivote simple: PK compuesta `(rol_id, permiso)` y `onDelete: Cascade` (borrar un rol limpia sus
permisos). El campo `permiso` es un `VarChar` libre — **la BD no valida contra el catalogo**; esa
validacion la hace el codigo en dos puntos (al leer y al escribir, ver seccion 6).

---

## 3. Flujo de una request

```
sesion NextAuth (rut, nombre, rol, centro)
        |
        v
getSessionPermisos()                       src/shared/lib/permisos.ts
        |
        v
getPermisosRol(user.rol.id)   <-- envuelto en cache() de React
        |
        +--> SELECT estado, permisos FROM roles + roles_permisos
        |
        +--> rol inexistente o inactivo  ->  Set vacio
        +--> .filter(esPermiso)          ->  descarta claves fuera del catalogo
        |
        v
Set<Permiso>
        |
        +--> requirePermiso(...)        Server Actions  -> throw
        +--> requirePermisoPagina(...)  Paginas server  -> redirect
        +--> navVisible(permisos)       Menu lateral    -> filtra items
```

Puntos a retener:

- **Una sola consulta por request.** `getPermisosRol` esta envuelto en `cache()` de React, asi que
  no importa cuantos guards la pidan durante el render de una pagina: la BD se consulta una vez.
- **Los permisos no viven en el JWT.** Se leen por request. Un cambio en el mantenedor tiene efecto
  en la siguiente navegacion, sin necesidad de cerrar sesion.
- **Rol inactivo = cero permisos.** No lanza error: devuelve `Set` vacio, y el guard resuelve
  redirect o throw normalmente.

---

## 4. Enforcement

Dos funciones con la **misma semantica OR**: basta con tener *uno* de los permisos pedidos.

| Funcion | Donde se usa | Comportamiento al fallar |
| --- | --- | --- |
| `requirePermiso(...claves)` | Server Actions (`*.action.ts`) | `throw new Error("No tienes permiso para esta operacion")` |
| `requirePermisoPagina(...claves)` | Paginas server del grupo `(app)` | `redirect("/auth/login")` sin sesion, `redirect("/sin-acceso")` sin permiso |

Sin sesion, `requirePermiso` lanza `Error("No autenticado")`.

Ejemplo de OR real en el codigo (`getSolicitudes.action.ts:75`):

```ts
const user = await requirePermiso("solicitudes.ver", "solicitudes.gestionar");
```

**Regla no negociable:** el guard es la **primera linea** de cada Server Action y de cada pagina.
Hay tests que lo verifican estructuralmente (seccion 8).

### Capa de UI

`src/config/navegacion.ts` declara el menu lateral; cada item lleva su `permiso`. `app-shell.tsx`
lo filtra con `navVisible(permisos)`, y las pestanas de Configuracion se filtran igual dentro de
`UsuariosRolesView`.

Esto es **solo cosmetico**. Ocultar un boton no protege nada: el enforcement real siempre es
server-side. Nunca se debe agregar una accion sensible confiando en que la UI la esconde.

---

## 5. Seed y bootstrap

`prisma/seed.ts` mantiene un mapa `rolePermisos: Record<string, Permiso[]>` con la configuracion
inicial de cada rol. Pero **el seed solo siembra permisos a roles que tienen cero filas** en
`roles_permisos`:

```ts
const yaConfigurado = await prisma.rolPermiso.count({ where: { rol_id: role.id_rol } });
if (yaConfigurado > 0) continue;
```

La razon esta comentada en el propio archivo: `roles_permisos` es configuracion viva editable desde
el mantenedor, y el seed corre en cada deploy. Con esta regla:

- Un permiso que el administrador **quito** no reaparece en el proximo deploy.
- Un permiso **nuevo** del catalogo **no se otorga solo** a roles ya configurados: hay que asignarlo
  a proposito desde el mantenedor (o con un script puntual). Esto es deliberado — el default seguro
  es "nadie lo tiene".

El seed ademas reporta claves huerfanas (filas en BD que ya no existen en el catalogo) con
`WARN Permiso desconocido en BD: rol N -> "clave"`.

---

## 6. Salvaguardas

**Anti-escalada.** El mantenedor de roles y funcionarios aplica la regla "no otorgar lo que no
tienes". Un actor no puede asignar un rol, editar un rol/funcionario superior, ni marcar permisos
que su propio rol no posee. Estas reglas viven en `src/modules/configuracion/utils/privilegios.ts`
y se usan tanto en las Server Actions como en la UI preventiva.

**Auto-edicion.** Un funcionario puede actualizar datos no sensibles de su propio registro, pero no
puede cambiar su rol, estado ni centro. Tampoco puede renombrar ni desactivar su propio rol.

Excepcion: un funcionario cuyo rol activo incluye `config.roles` puede cambiar su propio centro
desde el selector "Centro activo" del menu lateral (`cambiarCentroActivo`, auditado). Sigue sin
poder cambiar su rol ni su estado, y en Configuracion -> Funcionarios la regla no cambia.

**Ultimo administrador.** Las actions impiden desactivar o degradar al ultimo funcionario activo
cuyo rol activo incluye `config.roles`. La regla cubre cambios de funcionario, estado de rol y
matriz de permisos del rol.

**Nombre reservado.** `Administrador` es un nombre reservado para cerrar el vector legacy donde
algunas rutas aun comparan `user.rol.nombre === "Administrador"`. La deuda definitiva es reemplazar
esa comparacion por un permiso explicito, registrada en #21.

**Validacion en escritura.** `permisosRolSchema` (Zod) refina cada string con `esPermiso`, y ademas
`guardarPermisosRol` filtra contra `CLAVES_PERMISOS` — lo que tambien normaliza el orden. Una clave
invalida hace fallar la action antes de tocar la BD.

**Tolerancia en lectura.** `getPermisosRol` aplica `.filter(esPermiso)`: una fila cuya clave ya no
existe en el catalogo se ignora en silencio. Esto es lo que permite **borrar un permiso del codigo
sin migracion de datos**.

**Escritura atomica.** El guardado es `deleteMany` + `createMany` dentro de un `$transaction`:
reemplazo completo, nunca un estado intermedio.

**Auditoria.** Cada guardado registra el antes y el despues completos via `AuditLogger`:

```
rol:3 permisos antes=[solicitudes.ver] despues=[solicitudes.ver,comunicador.ver]
```

---

## 7. Procedimiento: agregar un permiso nuevo

> Sigue TDD (`test-driven-development`): test primero, verlo fallar, implementar, verlo pasar.

**Paso 1 — Declarar la clave en el catalogo.** `src/config/permisos.ts`, dentro de `PERMISOS`,
agrupada junto a las de su modulo:

```ts
"comunicador.exportar": { modulo: "Comunicador", etiqueta: "Exportar llamados" },
```

Formato `modulo.accion`, minusculas. La etiqueta es lo que ve el administrador en la matriz.

**Paso 2 — Aplicar el guard.** En la Server Action nueva o existente, como **primera linea**:

```ts
const user = await requirePermiso("comunicador.exportar");
```

Si es una pagina, `requirePermisoPagina("comunicador.exportar")` en el Server Component de
`src/app/(app)/...`. La pagina no puede ser `"use client"`.

**Paso 3 — Registrar la action en el inventario de tests.**
`src/modules/permisos-por-action.test.ts` mantiene una tabla con **todas** las Server Actions y el
permiso que exige cada una, mas una assertion de conteo total
(`it("cubre las 31 Server Actions del sistema")`). Si agregas una action: agregar la entrada **y**
actualizar el numero (en la assertion y en el comentario de la tabla). Si solo cambias el permiso de
una action existente: actualizar su fila.

**Paso 4 — Navegacion, si aplica.** Si el permiso habilita una seccion del menu lateral, agregar el
item a `NAV` en `src/config/navegacion.ts`. El test de navegacion verifica que la ruta exista como
`src/app/(app)/<href>/page.tsx`, que no haya rutas repetidas y que el permiso pertenezca al catalogo.

**Paso 5 — Bootstrap para instalaciones nuevas.** Agregar la clave a los roles que corresponda en
`rolePermisos` de `prisma/seed.ts`. Recordar que esto **solo** afecta instalaciones limpias: en
entornos ya configurados el seed no lo va a otorgar.

**Paso 6 — Asignarlo en los entornos existentes.** Es un cambio de datos, no de esquema, pero en
produccion/ensayo se despliega como **migracion de datos** aplicada por `prisma migrate deploy`
(no cambia ninguna tabla, solo inserta filas en `roles_permisos`). Tres opciones, de la mas manual
a la mas automatica:

- Desde la UI: Configuracion -> Roles -> Permisos, marcar la casilla en cada rol. Sirve para ajustes
  puntuales ya con el permiso desplegado, y queda auditada.
- Con SQL/script puntual sobre `roles_permisos`, si son muchos roles. En ese caso, dejar constancia
  de lo aplicado.
- Con una migracion de Prisma versionada en el repo, si el permiso debe otorgarse a roles existentes
  en todos los entornos como parte del mismo deploy (el caso de `historial.ver`, otorgado a todos
  los roles). Se crea con `prisma migrate dev --create-only` (o a mano) una carpeta en
  `prisma/migrations/` con el `migration.sql` que inserta las filas, por ejemplo
  `prisma/migrations/20261015120000_permiso_historial_ver/migration.sql`:

  ```sql
  INSERT IGNORE INTO `roles_permisos` (`rol_id`, `permiso`) SELECT `id_rol`, 'historial.ver' FROM `roles`;
  ```

  En produccion/ensayo, `prisma migrate deploy` la aplica como cualquier otra migracion, en el mismo
  despliegue que trae el codigo que exige el permiso nuevo. **Entornos locales o de ensayo que usan
  `db:push` en vez de migraciones no la reciben automaticamente**: hay que correr ese mismo SQL a
  mano contra esa base (o reproducir el efecto desde la UI), o esos roles quedan sin el permiso
  nuevo pese a tener el codigo desplegado.

**Paso 7 — Verificar.**

```bash
npm test            # incluye permisos, navegacion, permisos-por-action, paginas-protegidas
npx tsc --noEmit
npm run lint
```

### Checklist

- [ ] Clave en `src/config/permisos.ts`
- [ ] `requirePermiso` / `requirePermisoPagina` en la primera linea del guard
- [ ] Fila (y conteo) en `src/modules/permisos-por-action.test.ts`
- [ ] Item en `src/config/navegacion.ts` si habilita una seccion del menu
- [ ] Rol(es) en `rolePermisos` de `prisma/seed.ts`
- [ ] Asignado en la BD de los entornos ya desplegados
- [ ] `npm test` + `npx tsc --noEmit` + `npm run lint` en verde

---

## 8. Procedimiento: quitar o renombrar un permiso

**Quitar.** Borrar la clave de `PERMISOS`, quitar sus guards (reemplazandolos por el permiso que
corresponda — nunca dejar una action sin guard), y quitarla del seed, de `NAV` y del inventario de
tests. Las filas que queden en `roles_permisos` **no requieren migracion**: `getPermisosRol` las
ignora y el seed las reporta como `WARN`. Aun asi, conviene limpiarlas para no acumular ruido.

**Renombrar.** Es quitar + agregar, y **si requiere tocar datos**: las filas con la clave vieja dejan
de tener efecto en cuanto se despliega el codigo. Hay que hacer el `UPDATE roles_permisos SET
permiso = 'nueva' WHERE permiso = 'vieja'` **en el mismo despliegue**, o los roles pierden el acceso.
Si se puede evitar, evitarlo.

---

## 9. Red de seguridad: tests estructurales

Tres tests impiden que el sistema se degrade silenciosamente. **No relajarlos.**

| Test | Que garantiza |
| --- | --- |
| `src/app/paginas-protegidas.test.ts` | Toda pagina del grupo `(app)` llama a `requirePermisoPagina`, y ninguna es componente cliente |
| `src/modules/permisos-por-action.test.ts` | Inventario explicito de las 34 Server Actions y el permiso exacto que exige cada una |
| `src/config/navegacion.test.ts` | Los items del menu usan permisos del catalogo y apuntan a paginas que existen |

Mas `src/config/permisos.test.ts` (formato e integridad del catalogo) y
`src/shared/lib/permisos.test.ts` (semantica OR, rol inactivo, claves huerfanas, uso de `cache()`).

Si agregas una pagina o una action sin guard, la suite falla. Ese es el punto.

---

## 10. Anti-patrones

- **Chequear por nombre de rol.** `if (user.rol.nombre === "Administrador")` es deuda legacy. Hoy el
  mantenedor reserva ese nombre para evitar escalada, pero el patron correcto sigue siendo autorizar
  por permisos. Ver #21 para eliminar la comparacion restante.
- **Confiar en que la UI oculta el boton.** El filtrado de `NAV` y de pestanas es cosmetico.
- **Guard despues de la logica.** Debe ser la primera linea: leer datos y despues validar ya filtro
  informacion.
- **Agregar un permiso al catalogo y asumir que los roles lo reciben.** El seed no lo otorga a roles
  ya configurados. Hay que asignarlo.
- **Crear una tabla de permisos en BD.** La existencia de un permiso es codigo, por diseno: da tipado
  estatico y hace imposible referenciar una clave que no existe.

---

## 11. Historia

- La autorizacion previa se basaba en la tabla `menu` y en listas de roles hardcodeadas
  (`puedeAccederSolicitudes`, `puedeAccederComunicador`, `ROLES_CONFIGURACION`).
- La migracion se ejecuto con el script `prisma/scripts/derivar-permisos.ts`, que poblo
  `roles_permisos` como la **union** de lo que otorgaba `menu` y lo que otorgaban esas listas, para
  que ningun rol perdiera acceso.
- La tabla `menu` se elimino del esquema y del seed una vez que nada la leia.
