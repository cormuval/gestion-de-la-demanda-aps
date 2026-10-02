-- Amplia textos de rechazo para migrar desde AppSheet sin truncar.
-- AppSheet: solicitudes.observacion_rechazo VARCHAR(2000) y citas.razon_rechazo VARCHAR(350).
ALTER TABLE `solicitudes` MODIFY `observacion_rechazo` VARCHAR(2000) NULL;

ALTER TABLE `citas` MODIFY `razon_rechazo` VARCHAR(350) NULL;
