// types
import { ESTADO_CITA, RESPUESTA_LLAMADA, RespuestaLlamada } from "../types/comunicador";

/**
 * Deriva el nuevo estado de una cita a partir del estado actual, la cantidad de
 * intentos "No contesta" previos y la respuesta registrada en el nuevo llamado.
 */
export function computeEstadoCita(estadoActual: string, intentosNoContestaPrevios: number, respuesta: RespuestaLlamada): string {
    switch (respuesta) {
        case RESPUESTA_LLAMADA.NO_CONTESTA: {
            const n = intentosNoContestaPrevios + 1;
            if (n >= 3) return ESTADO_CITA.RECHAZADA_SIN_RESPUESTA;
            if (n === 2) return ESTADO_CITA.NO_CONTESTA_2;
            return ESTADO_CITA.NO_CONTESTA_1;
        }
        case RESPUESTA_LLAMADA.LLAMADA_AVISO:
            return estadoActual === ESTADO_CITA.SIN_LLAMADAS ? ESTADO_CITA.SOLO_AVISO : estadoActual;
        case RESPUESTA_LLAMADA.ACEPTADA:
            return ESTADO_CITA.ACEPTADA;
        case RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA:
            return ESTADO_CITA.RECHAZADA_NO_NECESARIA;
        case RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE:
            return ESTADO_CITA.RECHAZADA_SOLICITANTE;
        case RESPUESTA_LLAMADA.RECHAZADA_NUMERO_EQUIVOCADO:
            return ESTADO_CITA.RECHAZADA_NUMERO_EQUIVOCADO;
        default:
            return estadoActual;
    }
}
