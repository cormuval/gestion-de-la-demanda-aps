import { describe, expect, it } from "vitest";

import { contrarreferenciaSchema } from "./contrarreferencia.schema";

const cita = {
    id_cita: "Cita-Contr-1",
    profesional_id: 8,
    prestacion_id: 144,
    fecha_estimada_atencion: "2026-11-11",
    observacion: "Gestionado"
};

const base = {
    contrarreferencia_id: 4321,
    modo: "validada",
    paciente: { rut: "12345678-9", nombre: "Ana María", apellido: "Soto Díaz", telefono: "+56912345678" },
    solicitud: { id_solicitud: "con-1", fecha_inicio: "2026-10-22 10:30:00", descripcion: "Registro Contrarreferencia ID: 4321 | x", centro_id: 615 },
    cita
};

describe("contrarreferenciaSchema", () => {
    it("acepta validada con cita y convierte fechas y centro", () => {
        const r = contrarreferenciaSchema.parse(base);
        expect(r.solicitud.fecha_inicio.toISOString()).toBe("2026-10-22T13:30:00.000Z");
        expect(r.solicitud.centro_id).toBe("615");
        expect(r.cita?.fecha_estimada_atencion.toISOString()).toBe("2026-11-11T00:00:00.000Z");
    });

    it("normaliza el RUT del paciente", () => {
        expect(contrarreferenciaSchema.parse({ ...base, paciente: { rut: "12.345.678-k" } }).paciente.rut).toBe("12345678-K");
        expect(contrarreferenciaSchema.parse({ ...base, paciente: { rut: " 12345678-5 " } }).paciente.rut).toBe("12345678-5");
    });

    it("validada sin cita -> issue en cita", () => {
        const r = contrarreferenciaSchema.safeParse({ ...base, cita: undefined });
        expect(r.success).toBe(false);
        expect(r.error?.issues[0].path).toEqual(["cita"]);
    });

    it("pendiente con cita -> issue en cita", () => {
        const r = contrarreferenciaSchema.safeParse({ ...base, modo: "pendiente" });
        expect(r.success).toBe(false);
        expect(r.error?.issues[0].path).toEqual(["cita"]);
    });

    it("pendiente con cita null u omitida -> cita null", () => {
        expect(contrarreferenciaSchema.parse({ ...base, modo: "pendiente", cita: null }).cita).toBeNull();
        expect(contrarreferenciaSchema.parse({ ...base, modo: "pendiente", cita: undefined }).cita).toBeNull();
    });

    it("rechaza fecha estimada imposible", () => {
        const r = contrarreferenciaSchema.safeParse({ ...base, cita: { ...cita, fecha_estimada_atencion: "2026-02-31" } });
        expect(r.success).toBe(false);
    });

    it("rechaza contrarreferencia_id 0 o texto", () => {
        expect(contrarreferenciaSchema.safeParse({ ...base, contrarreferencia_id: 0 }).success).toBe(false);
        expect(contrarreferenciaSchema.safeParse({ ...base, contrarreferencia_id: "4321" }).success).toBe(false);
    });

    it("trunca nombre/apellido a 50 y observacion a 500; telefono vacio -> null", () => {
        const r = contrarreferenciaSchema.parse({
            ...base,
            paciente: { rut: "1-9", nombre: "a".repeat(80), apellido: "b".repeat(80), telefono: "" },
            cita: { ...cita, observacion: "o".repeat(700) }
        });
        expect(r.paciente.nombre).toHaveLength(50);
        expect(r.paciente.apellido).toHaveLength(50);
        expect(r.paciente.telefono).toBeNull();
        expect(r.cita?.observacion).toHaveLength(500);
    });
});
