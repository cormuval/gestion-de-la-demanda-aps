import { describe, it, expect } from "vitest";
import { ORIGEN_LLAMADA, registrarLlamadaSchema, citasFiltrosSchema } from "./llamada.schema";
import { RESPUESTA_LLAMADA } from "../types/comunicador";

describe("registrarLlamadaSchema", () => {
    it("asigna Comunicador como origen por defecto", () => {
        const r = registrarLlamadaSchema.parse({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA });

        expect(r.origen).toBe(ORIGEN_LLAMADA.COMUNICADOR);
    });

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

    it("Gestion acepta solamente el rechazo no necesario y recorta la observacion", () => {
        const r = registrarLlamadaSchema.parse({
            cita_id: "CITA-1",
            origen: ORIGEN_LLAMADA.GESTION_SOLICITUDES,
            respuesta: RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA,
            observacion: "  No requiere la prestacion  "
        });

        expect(r.observacion).toBe("No requiere la prestacion");
    });

    it("Gestion acepta una observacion vacia", () => {
        const r = registrarLlamadaSchema.parse({
            cita_id: "CITA-1",
            origen: ORIGEN_LLAMADA.GESTION_SOLICITUDES,
            respuesta: RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA,
            observacion: "   "
        });

        expect(r.observacion).toBe("");
    });

    it("Gestion acepta observacion de 350 caracteres y rechaza 351", () => {
        const base = {
            cita_id: "CITA-1",
            origen: ORIGEN_LLAMADA.GESTION_SOLICITUDES,
            respuesta: RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA
        };

        expect(registrarLlamadaSchema.safeParse({ ...base, observacion: "a".repeat(350) }).success).toBe(true);
        expect(registrarLlamadaSchema.safeParse({ ...base, observacion: "a".repeat(351) }).success).toBe(false);
    });

    it("Gestion rechaza otra respuesta y una hora agendada", () => {
        const base = { cita_id: "CITA-1", origen: ORIGEN_LLAMADA.GESTION_SOLICITUDES };

        expect(registrarLlamadaSchema.safeParse({ ...base, respuesta: RESPUESTA_LLAMADA.NO_CONTESTA }).success).toBe(false);
        expect(registrarLlamadaSchema.safeParse({ ...base, respuesta: RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA, hora_agendada: "2026-08-01T10:00" }).success).toBe(false);
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
