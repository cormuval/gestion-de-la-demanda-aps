// types
import { ESTADO_CITA, ESTADOS_PENDIENTES, RESPUESTA_LLAMADA } from "@/modules/comunicador/types/comunicador";

export type TonoSemaforo = "amarillo" | "verde" | "rojo" | "gris";

export function tonoEstadoSolicitud(estado: string | null): TonoSemaforo {
    if (estado === "En Curso") return "amarillo";
    if (estado === "Realizado") return "verde";
    if (estado === "Rechazado") return "rojo";
    return "gris";
}

export function tonoEstadoCita(estado: string | null): TonoSemaforo {
    if (estado && (ESTADOS_PENDIENTES as readonly string[]).includes(estado)) return "amarillo";
    if (estado === ESTADO_CITA.ACEPTADA) return "verde";
    if (([ESTADO_CITA.RECHAZADA_NO_NECESARIA, ESTADO_CITA.RECHAZADA_SOLICITANTE, ESTADO_CITA.RECHAZADA_NUMERO_EQUIVOCADO, ESTADO_CITA.RECHAZADA_SIN_RESPUESTA] as readonly (string | null)[]).includes(estado)) return "rojo";
    return "gris";
}

export function tonoRespuestaLlamada(respuesta: string | null): TonoSemaforo {
    if (respuesta === RESPUESTA_LLAMADA.NO_CONTESTA || respuesta === RESPUESTA_LLAMADA.LLAMADA_AVISO) return "amarillo";
    if (respuesta === RESPUESTA_LLAMADA.ACEPTADA) return "verde";
    if (([RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA, RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE, RESPUESTA_LLAMADA.RECHAZADA_NUMERO_EQUIVOCADO] as readonly (string | null)[]).includes(respuesta)) return "rojo";
    return "gris";
}
