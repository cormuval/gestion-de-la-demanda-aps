-- Otorga some.todos_centros al rol «Administrador» (issue #21).
-- El nombre sigue siendo único en este punto (aún reservado); el permiso es lo que otorga.
INSERT IGNORE INTO `roles_permisos` (`rol_id`, `permiso`) SELECT `id_rol`, 'some.todos_centros' FROM `roles` WHERE `nombre_rol` = 'Administrador';
