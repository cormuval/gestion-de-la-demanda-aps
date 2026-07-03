import { z } from "zod";

export const ACCION_ESPERA_VALIDACION = "En espera de validación";
export const ACCION_REALIZAR_SOLICITUD = "Realizar solicitud";
export const ACCION_RECHAZAR_SOLICITUD = "Rechazar solicitud";

export const TIPO_PRESTACION_EXAMENES = "Agendar una hora de exámenes";
export const TIPO_PRESTACION_PROFESIONAL = "Agendar una hora con profesional";
export const ESTADO_CITA_INICIAL = "Sin llamadas";

export const PRIORIDADES_CLINICAS = ["Urgente", "Alta", "Media", "Baja"] as const;
export const RAZONES_RECHAZO = ["El usuario no está inscrito", "El usuario no requiere atención", "Solicitud repetida", "Otra"] as const;

export const PRIORIZACION_CLINICA_NUMERICA: Record<(typeof PRIORIDADES_CLINICAS)[number], number> = {
    Urgente: 80,
    Alta: 60,
    Media: 40,
    Baja: 20
};

const citaSchema = z
    .object({
        tipo_prestacion: z.enum([TIPO_PRESTACION_EXAMENES, TIPO_PRESTACION_PROFESIONAL]),
        profesional_id: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().int().positive().nullable()),
        prestacion_id: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().int().positive().nullable()),
        fecha_estimada_atencion: z.string().trim().min(1, "Fecha estimada requerida"),
        observacion: z.string().trim().max(500, "Observacion maximo 500 caracteres").optional().default(""),
        priorizacion_clinica: z.enum(PRIORIDADES_CLINICAS)
    })
    .superRefine((data, ctx) => {
        if (data.tipo_prestacion === TIPO_PRESTACION_PROFESIONAL) {
            if (!data.profesional_id) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Profesional requerido", path: ["profesional_id"] });
            }
            if (!data.prestacion_id) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Prestacion requerida", path: ["prestacion_id"] });
            }
        }
    });

export const gestionarSolicitudSchema = z.discriminatedUnion("accion", [
    z.object({
        id_solicitud: z.string().trim().min(1, "Solicitud requerida"),
        accion: z.literal(ACCION_RECHAZAR_SOLICITUD),
        razon_rechazo: z.enum(RAZONES_RECHAZO),
        observacion_rechazo: z.string().trim().max(200, "Observacion maximo 200 caracteres").optional().default("")
    }),
    z.object({
        id_solicitud: z.string().trim().min(1, "Solicitud requerida"),
        accion: z.literal(ACCION_REALIZAR_SOLICITUD),
        citas: z.array(citaSchema).min(1, "Debes agregar al menos una cita").max(5, "No puedes agregar mas de 5 citas")
    })
]);

export type GestionarSolicitudInput = z.input<typeof gestionarSolicitudSchema>;
export type GestionarSolicitudData = z.output<typeof gestionarSolicitudSchema>;
export type CitaGestionData = Extract<GestionarSolicitudData, { accion: typeof ACCION_REALIZAR_SOLICITUD }>["citas"][number];
