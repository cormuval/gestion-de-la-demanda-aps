import { describe, it, expect } from "vitest";
import { registrarLlamadaSchema, citasFiltrosSchema } from "./llamada.schema";
import { RESPUESTA_LLAMADA } from "../types/comunicador";

describe("registrarLlamadaSchema", () => {
    it("hora_agendada obligatoria en 'Cita Aceptada'", () => {
        const r = registrarLlamadaSchema.safeParse({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.ACEPTADA });
        expect(r.success).toBe(false);
    });
    it("acepta 'Cita Aceptada' con hora_agendada", () => {
        const r = registrarLlamadaSchema.safeParse({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.ACEPTADA, hora_agendada: "2026-08-01T10:00" });
        expect(r.success).toBe(true);
    });
    it("no exige hora_agendada en otras respuestas", () => {
        const r = registrarLlamadaSchema.safeParse({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA });
        expect(r.success).toBe(true);
    });
    it("rechaza respuesta inválida", () => {
        const r = registrarLlamadaSchema.safeParse({ cita_id: "CITA-1", respuesta: "otra" });
        expect(r.success).toBe(false);
    });
});

describe("citasFiltrosSchema", () => {
    it("aplica pagina=1 por defecto y coacciona números", () => {
        const r = citasFiltrosSchema.parse({ profesional_id: "3", edadMin: "20" });
        expect(r.pagina).toBe(1);
        expect(r.profesional_id).toBe(3);
        expect(r.edadMin).toBe(20);
    });
});
