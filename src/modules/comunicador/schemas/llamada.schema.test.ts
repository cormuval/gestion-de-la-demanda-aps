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

    it("acepta y recorta rut y sector", () => {
        const r = citasFiltrosSchema.parse({ rut: "  12.345.678-9 ", sector: "  Amarillo " });
        expect(r.rut).toBe("12.345.678-9");
        expect(r.sector).toBe("Amarillo");
    });

    it("rut y sector son opcionales", () => {
        const r = citasFiltrosSchema.parse({});
        expect(r.rut).toBeUndefined();
        expect(r.sector).toBeUndefined();
    });

    it("acepta prestacion por nombre (texto) y la recorta", () => {
        const r = citasFiltrosSchema.parse({ prestacion: "  Control Niño Sano " });
        expect(r.prestacion).toBe("Control Niño Sano");
    });
});

// Detecta que Comunicador descarte el texto o acepte entradas que no puede buscar.
describe("texto de busqueda de citas", () => {
    it("normaliza espacios y aplica vacio por defecto", () => {
        expect(citasFiltrosSchema.parse({}).texto).toBe("");
        expect(citasFiltrosSchema.parse({ texto: "  observacion  " }).texto).toBe("observacion");
        expect(citasFiltrosSchema.parse({ texto: "   " }).texto).toBe("");
    });

    it.each([null, 12, {}, "a".repeat(201)])("rechaza texto invalido %s", (texto) => {
        expect(citasFiltrosSchema.safeParse({ texto }).success).toBe(false);
    });

    it("acepta el limite de 200 caracteres", () => {
        expect(citasFiltrosSchema.parse({ texto: "a".repeat(200) }).texto).toHaveLength(200);
    });
});
