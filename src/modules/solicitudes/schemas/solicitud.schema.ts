import { z } from "zod";

export const crearSolicitudSchema = z.object({
    rut_usuario: z.string().trim().min(1, "RUT requerido"),
    nombre_usuario: z.string().trim().min(1, "Nombre requerido"),
    apellido_usuario: z.string().trim().min(1, "Apellido requerido"),
    telefono: z.string().trim().optional().default(""),
    correo_contacto: z.string().trim().optional().default(""),
    tipo_solicitud_id: z.coerce.number().int().positive("Tipo de solicitud requerido"),
    motivo_id: z.coerce.number().int().positive("Motivo requerido"),
    disponibilidad_llamada: z.string().trim().optional().default(""),
    priorizacion_admin: z.string().trim().optional().default(""),
    centro_id: z.string().trim().optional().default(""),
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
