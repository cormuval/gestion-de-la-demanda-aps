import { describe, expect, it } from "vitest";
// utils
import { calcularPriorizacionCita, esCitaEditable, evaluarFechaEstimada } from "./citas";

function dateInputFromOffset(days: number): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function maxDateInput(extraDays = 0): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setFullYear(date.getFullYear() + 2);
    date.setDate(date.getDate() + extraDays);
    return date.toISOString().slice(0, 10);
}

describe("esCitaEditable", () => {
    it("permite solo citas Sin llamadas y sin llamadas registradas", () => {
        expect(esCitaEditable({ estado_cita: "Sin llamadas", cantidadLlamadas: 0 })).toBe(true);
        expect(esCitaEditable({ estado_cita: "Sin llamadas", cantidadLlamadas: 1 })).toBe(false);
        expect(esCitaEditable({ estado_cita: "Solo llamada de aviso", cantidadLlamadas: 0 })).toBe(false);
        expect(esCitaEditable({ estado_cita: "No contesta (1)", cantidadLlamadas: 0 })).toBe(false);
        expect(esCitaEditable({ estado_cita: null, cantidadLlamadas: 0 })).toBe(false);
    });
});

describe("evaluarFechaEstimada", () => {
    it("acepta hoy y hoy mas dos anos", () => {
        expect(evaluarFechaEstimada(dateInputFromOffset(0)).ok).toBe(true);
        expect(evaluarFechaEstimada(maxDateInput(0)).ok).toBe(true);
    });

    it("rechaza fechas fuera de rango o invalidas", () => {
        expect(evaluarFechaEstimada(dateInputFromOffset(-1))).toEqual({ ok: false, error: "La fecha estimada no puede ser anterior a hoy" });
        expect(evaluarFechaEstimada(maxDateInput(1))).toEqual({ ok: false, error: "La fecha estimada no puede superar los 2 años" });
        expect(evaluarFechaEstimada("no-es-fecha")).toEqual({ ok: false, error: "Fecha estimada invalida" });
    });
});

describe("calcularPriorizacionCita", () => {
    it("suma priorizacion clinica y administrativa", () => {
        expect(calcularPriorizacionCita("Alta", 10)).toBe(70);
        expect(calcularPriorizacionCita("Baja", null)).toBe(20);
    });

    it("aplica tope 100", () => {
        expect(calcularPriorizacionCita("Urgente", 45)).toBe(100);
    });
});
