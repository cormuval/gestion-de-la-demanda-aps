-- CreateTable
CREATE TABLE `roles_permisos` (
    `rol_id` INTEGER NOT NULL,
    `permiso` VARCHAR(60) NOT NULL,

    PRIMARY KEY (`rol_id`, `permiso`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `roles_permisos` ADD CONSTRAINT `roles_permisos_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id_rol`) ON DELETE CASCADE ON UPDATE CASCADE;
