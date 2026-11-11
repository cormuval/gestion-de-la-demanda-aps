import { z } from "zod";
// lib
import { textoBusquedaSchema } from "@/shared/lib/busquedaTexto";
// types
import { RESPUESTAS_LLAMADA, RESPUESTA_LLAMADA } from "../types/comunicador";

export const ORIGEN_LLAMADA = {
    COMUNICADOR: "comunicador",
    GESTION_SOLICITUDES: "gestion_solicitudes"
} as const;

export const registrarLlamadaSchema = z
    .object({
        cita_id: z.string().trim().min(1, "Cita requerida"),
        origen: z.enum([ORIGEN_LLAMADA.COMUNICADOR, ORIGEN_LLAMADA.GESTION_SOLICITUDES]).default(ORIGEN_LLAMADA.COMUNICADOR),
        respuesta: z.enum(RESPUESTAS_LLAMADA as [string, ...string[]]),
        observacion: z.string().trim().max(350, "Observacion maximo 350 caracteres").optional().default(""),
        hora_agendada: z.string().trim().optional().default("")
    })
    .superRefine((data, ctx) => {
        if (data.origen === ORIGEN_LLAMADA.GESTION_SOLICITUDES) {
            if (data.respuesta !== RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gestion solo permite rechazo no necesario", path: ["respuesta"] });
            }
            if (data.hora_agendada) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gestion no permite hora agendada", path: ["hora_agendada"] });
            }
            return;
        }

        if (data.respuesta === RESPUESTA_LLAMADA.ACEPTADA && !data.hora_agendada) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La hora agendada es obligatoria al aceptar la cita", path: ["hora_agendada"] });
        }
    });

export type RegistrarLlamadaInput = z.input<typeof registrarLlamadaSchema>;
export type RegistrarLlamadaData = z.output<typeof registrarLlamadaSchema>;

export const citasFiltrosSchema = z.object({
    texto: textoBusquedaSchema,
    temporalidad: z.string().trim().optional(),
    estado: z.string().trim().optional(),
    profesional_id: z.coerce.number().int().positive().optional(),
    prestacion: z.string().trim().optional(),
    edadMin: z.coerce.number().int().min(0).max(150).optional(),
    edadMax: z.coerce.number().int().min(0).max(150).optional(),
    fechaDesde: z.string().trim().optional(),
    fechaHasta: z.string().trim().optional(),
    rut: z.string().trim().optional(),
    sector: z.string().trim().optional(),
    pagina: z.coerce.number().int().min(1).default(1)
});

export type CitasFiltros = z.infer<typeof citasFiltrosSchema>;
