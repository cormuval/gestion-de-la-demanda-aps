export const ESTADO_CITA = {
    SIN_LLAMADAS: "Sin llamadas",
    NO_CONTESTA_1: "No contesta (1)",
    NO_CONTESTA_2: "No contesta (2)",
    SOLO_AVISO: "Solo llamada de aviso",
    ACEPTADA: "Cita Aceptada",
    RECHAZADA_NO_NECESARIA: "Cita Rechazada (No Necesaria)",
    RECHAZADA_SOLICITANTE: "Cita Rechazada (Solicitante)",
    RECHAZADA_NUMERO_EQUIVOCADO: "Cita Rechazada (Número equivocado)",
    RECHAZADA_SIN_RESPUESTA: "Cita Rechazada (Sin respuesta)"
} as const;

export type EstadoCita = (typeof ESTADO_CITA)[keyof typeof ESTADO_CITA];

// Orden de prioridad para la cola (índice = orden ascendente).
export const ORDEN_ESTADOS_PENDIENTES = [
    ESTADO_CITA.NO_CONTESTA_2,
    ESTADO_CITA.NO_CONTESTA_1,
    ESTADO_CITA.SOLO_AVISO,
    ESTADO_CITA.SIN_LLAMADAS
] as const;

export const ESTADOS_PENDIENTES = [
    ESTADO_CITA.SIN_LLAMADAS,
    ESTADO_CITA.NO_CONTESTA_1,
    ESTADO_CITA.NO_CONTESTA_2,
    ESTADO_CITA.SOLO_AVISO
] as const;

export const RESPUESTA_LLAMADA = {
    NO_CONTESTA: "No contesta",
    LLAMADA_AVISO: "Llamada de aviso",
    ACEPTADA: "Cita Aceptada",
    RECHAZADA_NO_NECESARIA: "Cita Rechazada (No Necesaria)",
    RECHAZADA_SOLICITANTE: "Cita Rechazada (Solicitante)",
    RECHAZADA_NUMERO_EQUIVOCADO: "Cita Rechazada (Número equivocado)"
} as const;

export type RespuestaLlamada = (typeof RESPUESTA_LLAMADA)[keyof typeof RESPUESTA_LLAMADA];

export const RESPUESTAS_LLAMADA = Object.values(RESPUESTA_LLAMADA);

export const TEMPORALIDAD = {
    TODAS: "Todas",
    PROXIMOS: "Agendamientos próximos",
    FUTUROS: "Agendamientos futuros",
    ATRASADOS: "Agendamientos atrasados"
} as const;

export type Temporalidad = (typeof TEMPORALIDAD)[keyof typeof TEMPORALIDAD];

export const TEMPORALIDADES = Object.values(TEMPORALIDAD);

export function esEstadoPendiente(estado: string | null | undefined): boolean {
    return !!estado && (ESTADOS_PENDIENTES as readonly string[]).includes(estado);
}

export function esEstadoTerminal(estado: string | null | undefined): boolean {
    return !!estado && !esEstadoPendiente(estado);
}
