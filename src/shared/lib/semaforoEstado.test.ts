import { describe, expect, it } from "vitest";
// types
import { ESTADO_CITA, RESPUESTA_LLAMADA } from "@/modules/comunicador/types/comunicador";
// lib
import { tonoEstadoCita, tonoEstadoSolicitud, tonoRespuestaLlamada } from "./semaforoEstado";

describe("semáforo", () => {
    it.each([
        [ESTADO_CITA.SIN_LLAMADAS, "amarillo"],
        [ESTADO_CITA.NO_CONTESTA_1, "amarillo"],
        [ESTADO_CITA.NO_CONTESTA_2, "amarillo"],
        [ESTADO_CITA.SOLO_AVISO, "amarillo"],
        [ESTADO_CITA.ACEPTADA, "verde"],
        [ESTADO_CITA.RECHAZADA_NO_NECESARIA, "rojo"],
        [ESTADO_CITA.RECHAZADA_SOLICITANTE, "rojo"],
        [ESTADO_CITA.RECHAZADA_NUMERO_EQUIVOCADO, "rojo"],
        [ESTADO_CITA.RECHAZADA_SIN_RESPUESTA, "rojo"],
        [null, "gris"],
        ["Estado legado", "gris"]
    ])("cita %s", (estado, tono) => expect(tonoEstadoCita(estado)).toBe(tono));
    it.each([
        [RESPUESTA_LLAMADA.NO_CONTESTA, "amarillo"],
        [RESPUESTA_LLAMADA.LLAMADA_AVISO, "amarillo"],
        [RESPUESTA_LLAMADA.ACEPTADA, "verde"],
        [RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA, "rojo"],
        [RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE, "rojo"],
        [RESPUESTA_LLAMADA.RECHAZADA_NUMERO_EQUIVOCADO, "rojo"],
        [null, "gris"],
        ["Otra", "gris"]
    ])("llamada %s", (estado, tono) => expect(tonoRespuestaLlamada(estado)).toBe(tono));
    it.each([
        ["En Curso", "amarillo"], ["Realizado", "verde"], ["Rechazado", "rojo"], ["Otro", "gris"], [null, "gris"]
    ])("solicitud %s", (estado, tono) => expect(tonoEstadoSolicitud(estado)).toBe(tono));
});
