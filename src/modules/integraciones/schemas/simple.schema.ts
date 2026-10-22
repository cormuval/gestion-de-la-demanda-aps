// lib
import { z } from "zod";

// utils
import { instanteDesdeHoraChile, vacioANull } from "../utils/normalizacion";

const idEntero = z.number().int();
const textoOpcional = z.unknown().transform(vacioANull).pipe(z.string().nullable());

// Cuerpo que envia Simple (contrato v2.2). Los campos fijos del contrato se aceptan y se descartan.
export const simpleSchema = z.object({
    id_solicitud: z.string().trim().min(1).max(50),
    fecha_inicio: z
        .string()
        .transform((texto, ctx) => {
            const instante = instanteDesdeHoraChile(texto.trim());
            if (instante === null) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Formato esperado: YYYY-MM-DD HH:mm:ss" });
                return z.NEVER;
            }
            return instante;
        }),
    rut_usuario: z.string().trim().min(1).max(50),
    tipo_solicitud_id: idEntero,
    motivo_id: idEntero.nullish().transform((valor) => valor ?? null),
    descripcion: textoOpcional,
    disponibilidad_llamada: z
        .enum(["AM", "PM", "AM/PM"])
        .nullish()
        .transform((valor) => valor ?? null),
    priorizacion_admin: z
        .number()
        .nullish()
        .transform((valor) => valor ?? null),
    centro_id: z
        .union([z.number(), z.string()])
        .transform((valor) => String(valor).trim())
        .pipe(z.string().min(1)),
    telefono: textoOpcional,
    correo: textoOpcional
});

export type SolicitudSimple = z.output<typeof simpleSchema>;
