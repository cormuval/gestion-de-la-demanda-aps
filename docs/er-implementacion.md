# Implementacion basada en ER

El schema inicial conserva las entidades visibles en el diagrama ER:

- `roles`
- `menu`
- `funcionarios`
- `usuarios`
- `solicitudes`
- `llamadas`
- `motivos`
- `tipo_solicitud`
- `prestaciones`
- `profesionales`
- `estadisticas`

Se agrego `password_hash` en `funcionarios` (actualmente opcional; el login es Google OAuth) y `role_id` en `menu` para materializar permisos por rol.

Las columnas principales del ER se mantienen en snake case para facilitar comparacion con la base original, incluyendo `estado_solicitud`, `rut_usuario`, `rut_orientador`, `rut_gestor`, `tipo_solicitud_id`, `motivo_id`, `centro_id`, `disponibilidad_llamada` y `priorizacion_admin`.

## AuditLog

Se agrego el modelo `AuditLog` (tabla `logs`) para registrar auditoria de autenticacion y acceso a datos desde las Server Actions. `funcionarios.password_hash` quedo opcional porque el login es via Google OAuth.
