# SOME multi-centro por permiso (`some.todos_centros`) — diseño

Fecha: 2026-11-10
Origen: issue #21 («Deuda RBAC: acceso a todos los centros en SOME depende del nombre del rol»)
Procedimiento RBAC: `docs/rbac-permisos.md` (§7 agregar permiso, §6 salvaguardas, §10 anti-patrones)

## Problema

El panel SOME decide si un usuario ve todos los centros o solo el suyo comparando el nombre
del rol:

```ts
// src/modules/some/actions/getSomePanel.action.ts
const esAdministrador = user.rol.nombre === "Administrador";
```

Es el anti-patrón que prohíbe `docs/rbac-permisos.md` §10 («Chequear por nombre de rol»): el
alcance de autorización depende de un texto editable desde el mantenedor, no de un permiso.

Mitigación vigente (desde S1): el nombre `Administrador` está reservado
(`NOMBRE_ROL_RESERVADO` en `src/modules/configuracion/utils/privilegios.ts`), con lo que no
existe vector de escalada activo; la deuda es la comparación y la reserva que la protege.

Además, el sistema tiene hoy dos definiciones de «administrador»:

| Dónde | Definición |
| --- | --- |
| Configuración (anti-escalada, último admin, cambiar centro propio) | `permisos.has("config.roles")` — permiso |
| Panel SOME (alcance multi-centro) | `rol.nombre === "Administrador"` — texto |

El cambio unifica el segundo hacia permisos, sin acoplarlo al mantenedor de configuración.

## Objetivo

El alcance multi-centro de SOME se decide por el permiso `some.todos_centros`, otorgado
únicamente al rol que hoy se llama «Administrador». La reserva del nombre deja de ser
necesaria y se retira.

Decisión de alcance acordada: el permiso se otorga **solo al rol «Administrador»** (no a todo
rol con `config.roles`). El permiso queda disponible por separado en la matriz del mantenedor:
dar «ver todos los centros en SOME» a otro rol en el futuro es marcar una casilla, no código.

## Cambios

### 1. Catálogo y guard

- `src/config/permisos.ts`: nueva clave
  `"some.todos_centros": { modulo: "SOME", etiqueta: "Ver todos los centros en SOME" }`
  (cumple `/^[a-z]+\.[a-z_]+$/`; el módulo SOME mantiene un solo permiso nuevo; no habilita sección
  de menú nueva, por lo que `NAV` no se toca).
- `getSomePanel.action.ts`: conserva `requirePermiso("some.ver")` como primera línea y resuelve
  el alcance con el permiso:

  ```ts
  const user = await requirePermiso("some.ver");
  const permisos = await getPermisosRol(user.rol.id); // cache() por request: sin consulta extra
  const alcanzaTodosLosCentros = permisos.has("some.todos_centros");
  ```

  `esAdministrador` solo se usaba para la lista de centros y el centro por defecto; nada más
  cambia en el panel. No cambian otros guards ni el inventario de
  `permisos-por-action.test.ts` (la action sigue exigiendo `some.ver`).

### 2. Otorgamiento

| Entorno | Mecanismo |
| --- | --- |
| Producción/ensayo (migraciones versionadas) | Migración de datos `prisma/migrations/<ts>_permiso_some_todos_centros/migration.sql`:
  `INSERT IGNORE INTO \`roles_permisos\` (\`rol_id\`, \`permiso\`) SELECT \`id_rol\`, 'some.todos_centros' FROM \`roles\` WHERE \`nombre_rol\` = 'Administrador';`
  — idempotente, misma referencia de la migración de `historial.ver`; `prisma migrate deploy`
  la aplica en el mismo despliegue que trae el código |
| Instalaciones nuevas | Clave agregada al array de `Administrador` en `rolePermisos` (`prisma/seed.ts`) |
| Entornos con `db:push` | SQL manual o marcado desde Configuración → Roles → Permisos (documentado en el PR) |

### 3. Retiro de la reserva del nombre

El único propósito documentado de `NOMBRE_ROL_RESERVADO` (RBAC §6 «Nombre reservado», §10)
era cerrar el vector de `rol.nombre === "Administrador"`. Con el permiso desplegado en el
mismo release, se retira:

- `src/modules/configuracion/utils/privilegios.ts`: eliminar `NOMBRE_ROL_RESERVADO`,
  `esNombreReservado`, la rama correspondiente de `validarEdicionRol` y el mensaje
  `nombreReservado`.
- `docs/rbac-permisos.md`: actualizar §6 y §10 (la comparación legacy deja de existir).

Quedan intactas todas las demás salvaguardas (anti-escalada por subconjunto de permisos,
auto-edición, último administrador, validación en escritura, tolerancia en lectura).

### 4. Criterio de aceptación (del issue #21)

- [ ] No quedan comparaciones con `rol.nombre` en `src/` que decidan autorización o alcance
      (el uso restante de `user.rol.nombre` es presentación o auditoría).
- [ ] Los administradores actuales siguen viendo todos los centros después del deploy.

## Pruebas (TDD)

- `getSomePanel.action.test.ts`: usuario con el permiso lista todos los centros; usuario sin él
  queda limitado a su centro (caso de regresión: quien hoy pasa por el nombre del rol). Centro
  por defecto según alcance.
- `privilegios.test.ts`: se eliminan los casos de `nombreReservado`; el resto de
  `validarEdicionRol` queda en verde (renombrar un rol a «Administrador» vuelve a ser legal).
- `permisos.test.ts`: la clave nueva es válida y el catálogo no se rompe; seed de
  `Administrador` incluye la clave.
- Regresión completa: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Riesgos y rollback

- Principal: que un administrador pierda el alcance multi-centro si el código se despliega sin
  la migración (o sin el SQL manual en los locales). Mitigación: el SQL corre en el mismo
  deploy y es `INSERT IGNORE`.
- Rollback: si se revierte solo el código, el permiso en BD queda inerte. Si se revierte todo
  el PR, el panel vuelve a decidir por nombre y la reserva regresa con el revert.
- OJO con la reserva retirada en producción: tras este cambio se puede crear un rol llamado
  «Administrador» si alguien borra el original; eso ya no implica alcance multi-centro (solo
  el permiso lo otorga), pero sí puede confundir en la matriz. Mitigación: la capacidad de
  crear roles tiene permiso `config.roles` y queda auditada.

## Fuera de alcance

- No hay otros permisos nuevos, ni UI para marcar «multi-centro» en roles (la matriz existente
  ya lista el permiso nuevo automáticamente vía `agruparPermisos`).
- No se toca el selector «Centro activo» del navbar ni la semántica de `config.roles` en
  Configuración.
- No hay migración de esquema ni cambio de `schema.prisma`: es solo un insert de datos en
  `roles_permisos`.
