// lib
import { z } from "zod";

// utils
import { fechaDia, instanteDesdeHoraChile, textoTruncado } from "../utils/normalizacion";

const idEntero = z.number().int();

// "YYYY-MM-DD HH:mm:ss" en hora de Chile -> instante real.
const fechaHoraChile = z.string().transform((texto, ctx) => {
    const instante = instanteDesdeHoraChile(texto.trim());
    if (instante === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Formato esperado: YYYY-MM-DD HH:mm:ss" });
        return z.NEVER;
    }
    return instante;
});

const citaSchema = z.object({
    id_cita: z.string().trim().min(1).max(50),
    profesional_id: idEntero,
    prestacion_id: idEntero,
    fecha_estimada_atencion: fechaDia,
    observacion: textoTruncado(500)
});

// Cuerpo que envia la gestion de contrarreferencia (Google Apps Script).
export const contrarreferenciaSchema = z
    .object({
        contrarreferencia_id: idEntero.positive(),
        modo: z.enum(["validada", "pendiente"]),
        paciente: z.object({
            rut: z.string().trim().min(1).max(50),
            nombre: textoTruncado(50).optional().default(null),
            apellido: textoTruncado(50).optional().default(null),
            telefono: textoTruncado().optional().default(null)
        }),
        solicitud: z.object({
            id_solicitud: z.string().trim().min(1).max(50),
            fecha_inicio: fechaHoraChile,
            descripcion: textoTruncado(),
            centro_id: z
                .union([z.number(), z.string()])
                .transform((valor) => String(valor).trim())
                .pipe(z.string().min(1))
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

export type Contrarreferencia = z.output<typeof contrarreferenciaSchema>;
