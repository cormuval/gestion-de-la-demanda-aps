-- Otorga el permiso historial.ver a todos los roles existentes.
INSERT IGNORE INTO `roles_permisos` (`rol_id`, `permiso`) SELECT `id_rol`, 'historial.ver' FROM `roles`;
