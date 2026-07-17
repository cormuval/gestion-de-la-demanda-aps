-- CreateTable
CREATE TABLE `roles` (
    `id_rol` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_rol` VARCHAR(50) NOT NULL,
    `estado` VARCHAR(50) NOT NULL DEFAULT 'Activo',

    PRIMARY KEY (`id_rol`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu` (
    `id_menu` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(300) NOT NULL,
    `descripcion` VARCHAR(300) NULL,
    `ruta` VARCHAR(300) NOT NULL,
    `imagen` VARCHAR(300) NULL,
    `role_id` INTEGER NOT NULL,

    INDEX `menu_role_id_idx`(`role_id`),
    PRIMARY KEY (`id_menu`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funcionarios` (
    `rut` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `nombre` VARCHAR(50) NOT NULL,
    `rol_id` INTEGER NOT NULL,
    `estado` VARCHAR(50) NOT NULL DEFAULT 'Activo',
    `codigo` VARCHAR(50) NULL,
    `rut_consulta` VARCHAR(300) NULL,
    `centro_id` VARCHAR(50) NULL,
    `programa_asociado` VARCHAR(50) NULL,
    `invitacion_app` VARCHAR(10) NULL,
    `password_hash` VARCHAR(200) NULL,

    UNIQUE INDEX `funcionarios_email_key`(`email`),
    INDEX `funcionarios_rol_id_idx`(`rol_id`),
    PRIMARY KEY (`rut`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `rut` VARCHAR(300) NOT NULL,
    `nombre` VARCHAR(50) NOT NULL,
    `apellido` VARCHAR(50) NOT NULL,
    `nombre_social` VARCHAR(50) NULL,
    `genero` VARCHAR(50) NULL,
    `otro_genero` VARCHAR(50) NULL,
    `fecha_nacimiento` DATE NULL,
    `sector` VARCHAR(50) NULL,
    `telefono` VARCHAR(150) NULL,
    `telefono_alternativo` VARCHAR(150) NULL,
    `correo_contacto` VARCHAR(100) NULL,
    `gestante` VARCHAR(50) NULL,
    `discapacidad` VARCHAR(150) NULL,
    `priorizacion_administrativa` DOUBLE NULL,
    `centro_id` VARCHAR(50) NULL,
    `policonsultante` VARCHAR(50) NULL,

    PRIMARY KEY (`rut`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `centros` (
    `id_centro` VARCHAR(50) NOT NULL,
    `nombre_centro` VARCHAR(50) NULL,
    `Telefono` VARCHAR(50) NULL,

    PRIMARY KEY (`id_centro`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipo_solicitud` (
    `id_tipo_solicitud` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_tipo_solicitud` VARCHAR(50) NOT NULL,
    `estado` VARCHAR(50) NOT NULL DEFAULT 'Activo',
    `esperanza` VARCHAR(1) NULL,
    `placeres` VARCHAR(1) NULL,
    `padre_damian` VARCHAR(1) NULL,
    `baron` VARCHAR(1) NULL,
    `rodelillo` VARCHAR(1) NULL,
    `reina_isabel` VARCHAR(1) NULL,
    `placilla` VARCHAR(1) NULL,
    `las_canas` VARCHAR(1) NULL,
    `mena` VARCHAR(1) NULL,
    `cordillera` VARCHAR(1) NULL,
    `quebrada_verde` VARCHAR(1) NULL,
    `cecosf_porvenir_bajo` VARCHAR(1) NULL,
    `puertas_negras` VARCHAR(1) NULL,
    `cecosf_laguna_verde` VARCHAR(1) NULL,
    `cecosf_juan_pablo_ii` VARCHAR(1) NULL,
    `desarrollo` VARCHAR(1) NULL,

    PRIMARY KEY (`id_tipo_solicitud`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `motivos` (
    `id_motivo` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_solicitud_id` INTEGER NOT NULL,
    `nombre_motivo` VARCHAR(150) NOT NULL,
    `estado` VARCHAR(50) NOT NULL DEFAULT 'Activo',

    INDEX `motivos_tipo_solicitud_id_idx`(`tipo_solicitud_id`),
    PRIMARY KEY (`id_motivo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitudes` (
    `id_solicitud` VARCHAR(50) NOT NULL,
    `fecha_inicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `rut_orientador` VARCHAR(50) NULL,
    `rut_usuario` VARCHAR(50) NOT NULL,
    `tipo_solicitud_id` INTEGER NOT NULL,
    `motivo_id` INTEGER NULL,
    `ultimo_control` VARCHAR(50) NULL,
    `descripcion` TEXT NULL,
    `disponibilidad_llamada` VARCHAR(50) NULL,
    `priorizacion_admin` DOUBLE NULL,
    `rut_gestor` VARCHAR(50) NULL,
    `accion` VARCHAR(50) NULL,
    `razon_rechazo` VARCHAR(150) NULL,
    `fecha_validacion` DATETIME(3) NULL,
    `estado_solicitud` VARCHAR(50) NOT NULL DEFAULT 'En Curso',
    `centro_id` VARCHAR(50) NULL,
    `observacion_rechazo` VARCHAR(200) NULL,

    INDEX `solicitudes_rut_usuario_idx`(`rut_usuario`),
    INDEX `solicitudes_estado_solicitud_idx`(`estado_solicitud`),
    INDEX `solicitudes_tipo_solicitud_id_idx`(`tipo_solicitud_id`),
    INDEX `solicitudes_motivo_id_idx`(`motivo_id`),
    INDEX `solicitudes_rut_orientador_idx`(`rut_orientador`),
    INDEX `solicitudes_rut_gestor_idx`(`rut_gestor`),
    PRIMARY KEY (`id_solicitud`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `llamadas` (
    `id_llamada` VARCHAR(50) NOT NULL,
    `cita_id` VARCHAR(50) NOT NULL,
    `rut_usuario` VARCHAR(50) NOT NULL,
    `rut_comunicador` VARCHAR(50) NULL,
    `respuesta_usuario` VARCHAR(50) NOT NULL DEFAULT 'Sin llamadas',
    `observacion` VARCHAR(350) NULL,
    `hora_agendada` DATETIME(3) NULL,
    `fecha_llamada` DATETIME(3) NULL,
    `centro_id` VARCHAR(50) NULL,

    INDEX `llamadas_cita_id_idx`(`cita_id`),
    INDEX `llamadas_rut_usuario_idx`(`rut_usuario`),
    INDEX `llamadas_rut_comunicador_idx`(`rut_comunicador`),
    INDEX `llamadas_respuesta_usuario_idx`(`respuesta_usuario`),
    PRIMARY KEY (`id_llamada`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prestaciones` (
    `id_prestacion` INTEGER NOT NULL AUTO_INCREMENT,
    `profesional_id` INTEGER NOT NULL,
    `nombre_prestacion` VARCHAR(100) NOT NULL,
    `estado` VARCHAR(50) NOT NULL DEFAULT 'Activo',

    INDEX `prestaciones_profesional_id_idx`(`profesional_id`),
    PRIMARY KEY (`id_prestacion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profesionales` (
    `id_profesional` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(50) NOT NULL,
    `estado` VARCHAR(50) NOT NULL DEFAULT 'Activo',
    `esperanza` VARCHAR(1) NULL,
    `placeres` VARCHAR(1) NULL,
    `padre_damian` VARCHAR(1) NULL,
    `baron` VARCHAR(1) NULL,
    `rodelillo` VARCHAR(1) NULL,
    `reina_isabel` VARCHAR(1) NULL,
    `placilla` VARCHAR(1) NULL,
    `las_canas` VARCHAR(1) NULL,
    `mena` VARCHAR(1) NULL,
    `cordillera` VARCHAR(1) NULL,
    `quebrada_verde` VARCHAR(1) NULL,
    `cecosf_porvenir_bajo` VARCHAR(1) NULL,
    `puertas_negras` VARCHAR(1) NULL,
    `cecosf_laguna_verde` VARCHAR(1) NULL,
    `cecosf_juan_pablo_ii` VARCHAR(1) NULL,
    `desarrollo` VARCHAR(1) NULL,

    PRIMARY KEY (`id_profesional`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `citas` (
    `id_cita` VARCHAR(50) NOT NULL,
    `solicitud_id` VARCHAR(50) NOT NULL,
    `rut_usuario` VARCHAR(50) NOT NULL,
    `rut_gestor` VARCHAR(50) NULL,
    `tipo_prestacion` VARCHAR(100) NOT NULL,
    `profesional_id` INTEGER NULL,
    `prestacion_id` INTEGER NULL,
    `fecha_estimada_atencion` DATE NULL,
    `observacion` VARCHAR(500) NULL,
    `estado_cita` VARCHAR(50) NULL,
    `priorizacion_clinica` VARCHAR(50) NULL,
    `priorizacion` INTEGER NULL,
    `centro_id` VARCHAR(50) NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `razon_rechazo` VARCHAR(150) NULL,

    INDEX `citas_solicitud_id_idx`(`solicitud_id`),
    INDEX `citas_rut_usuario_idx`(`rut_usuario`),
    INDEX `citas_rut_gestor_idx`(`rut_gestor`),
    INDEX `citas_profesional_id_idx`(`profesional_id`),
    INDEX `citas_prestacion_id_idx`(`prestacion_id`),
    INDEX `citas_centro_id_estado_cita_idx`(`centro_id`, `estado_cita`),
    INDEX `citas_rut_usuario_estado_cita_idx`(`rut_usuario`, `estado_cita`),
    PRIMARY KEY (`id_cita`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estadisticas` (
    `id_estadistica` INTEGER NOT NULL AUTO_INCREMENT,
    `centro_id` VARCHAR(50) NULL,
    `nombre` VARCHAR(300) NULL,
    `imagen` VARCHAR(300) NULL,
    `profesional_id` INTEGER NULL,
    `prestacion_id` VARCHAR(100) NULL,
    `fecha_estimada_atencion` DATE NULL,
    `observacion` VARCHAR(500) NULL,
    `estado` VARCHAR(50) NOT NULL DEFAULT 'Activo',
    `razon_rechazo` VARCHAR(350) NULL,

    INDEX `estadisticas_profesional_id_idx`(`profesional_id`),
    INDEX `estadisticas_prestacion_id_idx`(`prestacion_id`),
    PRIMARY KEY (`id_estadistica`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `category` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `user_id` VARCHAR(150) NULL,
    `user_name` VARCHAR(150) NULL,
    `user_rut` VARCHAR(50) NULL,
    `resource_id` VARCHAR(150) NULL,
    `details` TEXT NULL,
    `error` TEXT NULL,

    INDEX `logs_category_idx`(`category`),
    INDEX `logs_action_idx`(`action`),
    INDEX `logs_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `menu` ADD CONSTRAINT `menu_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id_rol`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionarios` ADD CONSTRAINT `funcionarios_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id_rol`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `motivos` ADD CONSTRAINT `motivos_tipo_solicitud_id_fkey` FOREIGN KEY (`tipo_solicitud_id`) REFERENCES `tipo_solicitud`(`id_tipo_solicitud`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_rut_usuario_fkey` FOREIGN KEY (`rut_usuario`) REFERENCES `usuarios`(`rut`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_tipo_solicitud_id_fkey` FOREIGN KEY (`tipo_solicitud_id`) REFERENCES `tipo_solicitud`(`id_tipo_solicitud`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_motivo_id_fkey` FOREIGN KEY (`motivo_id`) REFERENCES `motivos`(`id_motivo`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_rut_orientador_fkey` FOREIGN KEY (`rut_orientador`) REFERENCES `funcionarios`(`rut`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_rut_gestor_fkey` FOREIGN KEY (`rut_gestor`) REFERENCES `funcionarios`(`rut`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `llamadas` ADD CONSTRAINT `llamadas_cita_id_fkey` FOREIGN KEY (`cita_id`) REFERENCES `citas`(`id_cita`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `llamadas` ADD CONSTRAINT `llamadas_rut_comunicador_fkey` FOREIGN KEY (`rut_comunicador`) REFERENCES `funcionarios`(`rut`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prestaciones` ADD CONSTRAINT `prestaciones_profesional_id_fkey` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales`(`id_profesional`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `citas` ADD CONSTRAINT `citas_solicitud_id_fkey` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes`(`id_solicitud`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `citas` ADD CONSTRAINT `citas_rut_usuario_fkey` FOREIGN KEY (`rut_usuario`) REFERENCES `usuarios`(`rut`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `citas` ADD CONSTRAINT `citas_rut_gestor_fkey` FOREIGN KEY (`rut_gestor`) REFERENCES `funcionarios`(`rut`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `citas` ADD CONSTRAINT `citas_profesional_id_fkey` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales`(`id_profesional`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `citas` ADD CONSTRAINT `citas_prestacion_id_fkey` FOREIGN KEY (`prestacion_id`) REFERENCES `prestaciones`(`id_prestacion`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estadisticas` ADD CONSTRAINT `estadisticas_profesional_id_fkey` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales`(`id_profesional`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estadisticas` ADD CONSTRAINT `estadisticas_prestacion_id_fkey` FOREIGN KEY (`prestacion_id`) REFERENCES `solicitudes`(`id_solicitud`) ON DELETE SET NULL ON UPDATE CASCADE;

