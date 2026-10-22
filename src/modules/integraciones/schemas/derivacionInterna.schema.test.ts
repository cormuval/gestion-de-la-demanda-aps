import { describe, expect, it } from "vitest";

// schemas
import { derivacionInternaSchema } from "./derivacionInterna.schema";

const solicitud = { id_solicitud: "DI-1", tipo_solicitud_id: 1, motivo_id: null, descripcion: null, centro_id: 501 };
const cita = { profesional_id: 3, prestacion_id: 7, fecha_estimada_atencion: "2026-06-30", observacion: "Control" };

function camposInvalidos(cuerpo: unknown): string[] {
    const r = derivacionInternaSchema.safeParse(cuerpo);
    return r.success ? [] : Object.keys(r.error.flatten().fieldErrors);
}

describe("derivacionInternaSchema", () => {
    it("acepta una derivacion validada con cita y entrega la fecha como UTC a medianoche", () => {
        const r = derivacionInternaSchema.safeParse({ modo: "validada", paciente: { rut: "12345678-9", nombre: "Ana" }, solicitud, cita });
        expect(r.success).toBe(true);
        if (!r.success) return;
        expect(r.data.cita?.fecha_estimada_atencion.toISOString()).toBe("2026-06-30T00:00:00.000Z");
        expect(r.data.solicitud.centro_id).toBe("501");
    });

    it("rechaza validada sin cita", () => {
        expect(camposInvalidos({ modo: "validada", paciente: { rut: "1-9" }, solicitud })).toContain("cita");
        expect(camposInvalidos({ modo: "validada", paciente: { rut: "1-9" }, solicitud, cita: null })).toContain("cita");
    });

    it("rechaza pendiente con cita", () => {
        expect(camposInvalidos({ modo: "pendiente", paciente: { rut: "1-9" }, solicitud, cita })).toContain("cita");
    });

    it("acepta pendiente con cita null u omitida", () => {
        for (const extra of [{ cita: null }, {}]) {
            const r = derivacionInternaSchema.safeParse({ modo: "pendiente", paciente: { rut: "1-9" }, solicitud, ...extra });
            expect(r.success).toBe(true);
            if (r.success) expect(r.data.cita).toBeNull();
        }
    });

    it("convierte un nombre en blanco en null", () => {
        const r = derivacionInternaSchema.safeParse({ modo: "pendiente", paciente: { rut: "1-9", nombre: "  " }, solicitud });
        expect(r.success && r.data.paciente.nombre).toBeNull();
    });

    it("trunca paciente.nombre a 50 y cita.observacion a 500 caracteres", () => {
        const r = derivacionInternaSchema.safeParse({
            modo: "validada",
            paciente: { rut: "1-9", nombre: "n".repeat(80) },
            solicitud,
            cita: { ...cita, observacion: "o".repeat(700) }
        });
        expect(r.success).toBe(true);
        if (!r.success) return;
        expect(r.data.paciente.nombre).toHaveLength(50);
        expect(r.data.cita?.observacion).toHaveLength(500);
    });

    it("rechaza fecha_estimada_atencion invalida o imposible", () => {
        const base = { modo: "validada", paciente: { rut: "1-9" }, solicitud };
        expect(camposInvalidos({ ...base, cita: { ...cita, fecha_estimada_atencion: "30/06/2026" } })).toContain("cita");
        expect(camposInvalidos({ ...base, cita: { ...cita, fecha_estimada_atencion: "2026-02-31" } })).toContain("cita");
    });

    it("rechaza ids como texto y modo desconocido", () => {
        expect(camposInvalidos({ modo: "pendiente", paciente: { rut: "1-9" }, solicitud: { ...solicitud, tipo_solicitud_id: "1" } })).toContain("solicitud");
        expect(camposInvalidos({ modo: "otro", paciente: { rut: "1-9" }, solicitud })).toContain("modo");
    });
});
