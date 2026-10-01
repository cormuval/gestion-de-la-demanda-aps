# Implementacion basada en ER

Fuente de verdad: `prisma/schema.prisma` (cambios versionados en `prisma/migrations/`).

Entidades: `roles`, `roles_permisos`, `funcionarios`, `usuarios` (pacientes), `centros`,
`solicitudes`, `citas`, `llamadas`, `tipo_solicitud`, `motivos`, `prestaciones`, `profesionales`,
`estadisticas` y `logs`.

Relacion del flujo principal: `solicitudes` 1—N `citas` 1—N `llamadas`.

Las columnas principales del ER original se mantienen en snake case para facilitar la comparacion con
la base original (`estado_solicitud`, `rut_usuario`, `rut_orientador`, `rut_gestor`,
`tipo_solicitud_id`, `motivo_id`, `centro_id`, `disponibilidad_llamada`, `priorizacion_admin`).

- `funcionarios.password_hash` es opcional: el login es Google OAuth.
- La tabla `menu` se elimino (migracion `20260724184201_eliminar_tabla_menu`); el acceso se rige por
  `roles_permisos` (ver `docs/rbac-permisos.md`).
- `logs` (modelo `AuditLog`) registra auditoria de autenticacion y acceso a datos desde las Server Actions.
