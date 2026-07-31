-- CreateIndex
CREATE INDEX `solicitudes_centro_id_fecha_inicio_idx` ON `solicitudes`(`centro_id`, `fecha_inicio`);

-- CreateIndex
CREATE INDEX `solicitudes_centro_id_fecha_validacion_idx` ON `solicitudes`(`centro_id`, `fecha_validacion`);

-- CreateIndex
CREATE INDEX `solicitudes_centro_id_accion_idx` ON `solicitudes`(`centro_id`, `accion`);

-- CreateIndex
CREATE INDEX `llamadas_centro_id_fecha_llamada_idx` ON `llamadas`(`centro_id`, `fecha_llamada`);

-- CreateIndex
CREATE INDEX `citas_centro_id_fecha_creacion_idx` ON `citas`(`centro_id`, `fecha_creacion`);
