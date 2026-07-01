import { z } from "zod";
// utils
import { esRutChilenoValido, normalizarRut } from "../utils/rut";

export const crearSolicitudSchema = z.object({
    rut_usuario: z
        .string()
        .trim()
        .min(1, "RUT requerido")
        .refine(esRutChilenoValido, "RUT invalido")
        .transform(normalizarRut),
    tipo_solicitud_id: z.coerce.number().int().positive("Tipo de solicitud requerido"),
    motivo_id: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().int().positive("Motivo requerido").nullable()),
    disponibilidad_llamada: z.enum(["Solo AM", "Solo PM", "AM/PM"], { required_error: "Disponibilidad de llamada requerida" }),
    descripcion: z.string().trim().optional().default("")
});

export type CrearSolicitudInput = z.infer<typeof crearSolicitudSchema>;

export interface SolicitudFiltros {
    rut?: string;
    estado?: string;
    centroId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}
