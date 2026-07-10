import { z } from "zod";
// types
import { RESPUESTAS_LLAMADA, RESPUESTA_LLAMADA } from "../types/comunicador";

export const registrarLlamadaSchema = z
    .object({
        cita_id: z.string().trim().min(1, "Cita requerida"),
        respuesta: z.enum(RESPUESTAS_LLAMADA as [string, ...string[]]),
        observacion: z.string().trim().max(350, "Observacion maximo 350 caracteres").optional().default(""),
        hora_agendada: z.string().trim().optional().default("")
    })
    .superRefine((data, ctx) => {
        if (data.respuesta === RESPUESTA_LLAMADA.ACEPTADA && !data.hora_agendada) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La hora agendada es obligatoria al aceptar la cita", path: ["hora_agendada"] });
        }
    });

export type RegistrarLlamadaInput = z.input<typeof registrarLlamadaSchema>;
export type RegistrarLlamadaData = z.output<typeof registrarLlamadaSchema>;

export const citasFiltrosSchema = z.object({
    temporalidad: z.string().trim().optional(),
    estado: z.string().trim().optional(),
    profesional_id: z.coerce.number().int().positive().optional(),
    prestacion_id: z.coerce.number().int().positive().optional(),
    edadMin: z.coerce.number().int().min(0).max(150).optional(),
    edadMax: z.coerce.number().int().min(0).max(150).optional(),
    fechaDesde: z.string().trim().optional(),
    fechaHasta: z.string().trim().optional(),
    pagina: z.coerce.number().int().min(1).default(1)
});

export type CitasFiltros = z.infer<typeof citasFiltrosSchema>;
