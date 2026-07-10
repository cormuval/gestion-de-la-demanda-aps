import { describe, it, expect } from "vitest";
import { computeEstadoCita } from "./estadoCita";
import { ESTADO_CITA, RESPUESTA_LLAMADA } from "../types/comunicador";

describe("computeEstadoCita", () => {
    it("No contesta: 1er intento -> No contesta (1)", () => {
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.NO_CONTESTA)).toBe(ESTADO_CITA.NO_CONTESTA_1);
    });
    it("No contesta: 2do intento -> No contesta (2)", () => {
        expect(computeEstadoCita(ESTADO_CITA.NO_CONTESTA_1, 1, RESPUESTA_LLAMADA.NO_CONTESTA)).toBe(ESTADO_CITA.NO_CONTESTA_2);
    });
    it("No contesta: 3er intento -> Rechazada (Sin respuesta) [autocierre]", () => {
        expect(computeEstadoCita(ESTADO_CITA.NO_CONTESTA_2, 2, RESPUESTA_LLAMADA.NO_CONTESTA)).toBe(ESTADO_CITA.RECHAZADA_SIN_RESPUESTA);
    });
    it("Aviso desde Sin llamadas -> Solo llamada de aviso", () => {
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.LLAMADA_AVISO)).toBe(ESTADO_CITA.SOLO_AVISO);
    });
    it("Aviso desde No contesta (1) -> mantiene No contesta (1)", () => {
        expect(computeEstadoCita(ESTADO_CITA.NO_CONTESTA_1, 1, RESPUESTA_LLAMADA.LLAMADA_AVISO)).toBe(ESTADO_CITA.NO_CONTESTA_1);
    });
    it("Aviso desde Solo llamada de aviso -> se mantiene", () => {
        expect(computeEstadoCita(ESTADO_CITA.SOLO_AVISO, 0, RESPUESTA_LLAMADA.LLAMADA_AVISO)).toBe(ESTADO_CITA.SOLO_AVISO);
    });
    it("Aceptada -> Cita Aceptada", () => {
        expect(computeEstadoCita(ESTADO_CITA.NO_CONTESTA_2, 2, RESPUESTA_LLAMADA.ACEPTADA)).toBe(ESTADO_CITA.ACEPTADA);
    });
    it("Rechazos directos fijan su estado", () => {
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA)).toBe(ESTADO_CITA.RECHAZADA_NO_NECESARIA);
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE)).toBe(ESTADO_CITA.RECHAZADA_SOLICITANTE);
        expect(computeEstadoCita(ESTADO_CITA.SIN_LLAMADAS, 0, RESPUESTA_LLAMADA.RECHAZADA_NUMERO_EQUIVOCADO)).toBe(ESTADO_CITA.RECHAZADA_NUMERO_EQUIVOCADO);
    });
});
