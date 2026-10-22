// lib
import { z } from "zod";

// utils
import { fechaDia, textoTruncado } from "../utils/normalizacion";

const idEntero = z.number().int();
const citaSchema = z.object({
    profesional_id: idEntero,
    prestacion_id: idEntero,
    fecha_estimada_atencion: fechaDia,
    observacion: textoTruncado(500)
});

// Cuerpo que envia la derivacion interna (Google Apps Script).
export const derivacionInternaSchema = z
    .object({
        modo: z.enum(["validada", "pendiente"]),
        paciente: z.object({
            rut: z.string().trim().min(1).max(50),
            nombre: textoTruncado(50).optional().default(null)
        }),
        solicitud: z.object({
            id_solicitud: z.string().trim().min(1).max(50),
            tipo_solicitud_id: idEntero,
            motivo_id: idEntero.nullish().transform((valor) => valor ?? null),
            descripcion: textoTruncado(),
            centro_id: z
                .union([z.number(), z.string(), z.null()])
                .transform((valor) => (valor === null ? null : String(valor).trim()))
                .pipe(z.string().min(1).nullable())
        }),
        cita: citaSchema.nullish().transform((valor) => valor ?? null)
    })
    .superRefine((datos, ctx) => {
        if (datos.modo === "validada" && datos.cita === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cita"], message: "La cita es obligatoria si modo es validada" });
        }
        if (datos.modo === "pendiente" && datos.cita !== null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cita"], message: "La cita no se permite si modo es pendiente" });
        }
    });

export type DerivacionInterna = z.output<typeof derivacionInternaSchema>;
