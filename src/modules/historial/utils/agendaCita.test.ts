import { describe, expect, it } from "vitest";
// types
import type { LlamadaHistorial } from "../types/historial";
// utils
import { formatearAgendaCita, resolverAgendaCita } from "./agendaCita";

const AGENDA = new Date("2026-07-01T13:30:00Z");
const OTRA_AGENDA = new Date("2026-07-02T14:00:00Z");

function llamada(id: string, fecha: string | null, agenda: Date | null = AGENDA, respuesta = "Cita Aceptada"): LlamadaHistorial {
    return {
        id_llamada: id,
        fecha_llamada: fecha ? new Date(fecha) : null,
        respuesta_usuario: respuesta,
        comunicador: null,
        observacion: null,
        hora_agendada: agenda
    };
}

describe("resolverAgendaCita", () => {
    it.each([null, "Por llamar", "Cita Rechazada"])("omite agenda con estado actual %s aunque exista una aceptacion", (estado) => {
        expect(resolverAgendaCita(estado, [llamada("LL-1", "2026-06-01")])).toBeNull();
    });

    it("devuelve null si no existen aceptaciones", () => {
        expect(resolverAgendaCita("Cita Aceptada", [])).toBeNull();
        expect(resolverAgendaCita("Cita Aceptada", [llamada("LL-1", "2026-06-01", AGENDA, "No contesta")])).toBeNull();
    });

    it("elige la ultima aceptacion por fecha sin tomar respuestas posteriores", () => {
        const llamadas = [
            llamada("LL-3", "2026-06-03", null, "No contesta"),
            llamada("LL-1", "2026-06-01"),
            llamada("LL-2", "2026-06-02", OTRA_AGENDA)
        ];
        expect(resolverAgendaCita("Cita Aceptada", llamadas)).toEqual(OTRA_AGENDA);
    });

    it("desempata fechas iguales por ID mayor", () => {
        expect(resolverAgendaCita("Cita Aceptada", [
            llamada("LL-1", "2026-06-01"),
            llamada("LL-2", "2026-06-01", OTRA_AGENDA)
        ])).toEqual(OTRA_AGENDA);
    });

    it("no rescata una agenda anterior si la ultima aceptacion carece de agenda", () => {
        expect(resolverAgendaCita("Cita Aceptada", [
            llamada("LL-1", "2026-06-01"),
            llamada("LL-2", "2026-06-02", null)
        ])).toBeNull();
    });

    it("considera las fechas nulas anteriores a las validas aunque su ID sea mayor", () => {
        expect(resolverAgendaCita("Cita Aceptada", [
            llamada("LL-9", null, OTRA_AGENDA),
            llamada("LL-1", "2026-06-01"),
            llamada("LL-8", null, OTRA_AGENDA)
        ])).toEqual(AGENDA);
    });

    it("desempata fechas nulas por ID mayor", () => {
        expect(resolverAgendaCita("Cita Aceptada", [
            llamada("LL-1", null),
            llamada("LL-2", null, OTRA_AGENDA)
        ])).toEqual(OTRA_AGENDA);
    });

    it("no muta ni reordena las llamadas recibidas", () => {
        const llamadas = Object.freeze([
            Object.freeze(llamada("LL-2", "2026-06-02", OTRA_AGENDA)),
            Object.freeze(llamada("LL-1", "2026-06-01"))
        ]);
        expect(resolverAgendaCita("Cita Aceptada", llamadas)).toEqual(OTRA_AGENDA);
        expect(llamadas.map((item) => item.id_llamada)).toEqual(["LL-2", "LL-1"]);
    });
});

describe("formatearAgendaCita", () => {
    it.each([
        ["2026-07-01T13:30:00Z", "01-07-2026, 09:30"],
        ["2026-01-15T13:30:00Z", "15-01-2026, 10:30"]
    ])("formatea %s con el horario de Santiago", (instante, esperado) => {
        expect(formatearAgendaCita(new Date(instante))).toBe(esperado);
    });
});
