import { describe, expect, it } from "vitest";

// schemas
import { simpleSchema } from "./simple.schema";

const cuerpoV22 = {
    id_solicitud: "DES99-2",
    fecha_inicio: "2026-05-14 12:25:15",
    rut_orientador: "11111112-3",
    rut_usuario: "12345678-9",
    tipo_solicitud_id: 1,
    motivo_id: null,
    ultimo_control: null,
    descripcion: "Registro de prueba API.",
    disponibilidad_llamada: "AM",
    priorizacion_admin: 2,
    rut_gestor: null,
    accion: "En espera de validación",
    razon_rechazo: null,
    fecha_validacion: null,
    estado_solicitud: "En curso",
    centro_id: 501,
    telefono: "+56987654321",
    correo: "paciente@example.cl"
};

function camposInvalidos(cuerpo: unknown): string[] {
    const r = simpleSchema.safeParse(cuerpo);
    return r.success ? [] : Object.keys(r.error.flatten().fieldErrors);
}

describe("simpleSchema", () => {
    it("acepta el ejemplo del contrato v2.2 y normaliza los valores", () => {
        const r = simpleSchema.safeParse(cuerpoV22);
        expect(r.success).toBe(true);
        if (!r.success) return;
        expect(r.data.centro_id).toBe("501");
        expect(r.data.fecha_inicio.toISOString()).toBe("2026-05-14T16:25:15.000Z");
        expect(r.data.motivo_id).toBeNull();
        expect(r.data.telefono).toBe("+56987654321");
        expect(r.data).not.toHaveProperty("rut_orientador");
        expect(r.data).not.toHaveProperty("accion");
    });

    it("convierte telefono y correo vacios o ausentes en null", () => {
        const r = simpleSchema.safeParse({ ...cuerpoV22, telefono: "", correo: undefined });
        expect(r.success).toBe(true);
        if (!r.success) return;
        expect(r.data.telefono).toBeNull();
        expect(r.data.correo).toBeNull();
    });

    it("acepta numeros como texto y los convierte", () => {
        const r = simpleSchema.safeParse({ ...cuerpoV22, tipo_solicitud_id: " 3 ", motivo_id: "12", priorizacion_admin: "2.5" });
        expect(r.success).toBe(true);
        if (!r.success) return;
        expect(r.data.tipo_solicitud_id).toBe(3);
        expect(r.data.motivo_id).toBe(12);
        expect(r.data.priorizacion_admin).toBe(2.5);
    });

    it("motivo_id y priorizacion_admin vacios o ausentes son null; disponibilidad vacia es null", () => {
        const { motivo_id: _m, priorizacion_admin: _p, ...resto } = cuerpoV22;
        const r = simpleSchema.safeParse({ ...resto, disponibilidad_llamada: " " });
        expect(r.success).toBe(true);
        if (!r.success) return;
        expect(r.data.motivo_id).toBeNull();
        expect(r.data.priorizacion_admin).toBeNull();
        expect(r.data.disponibilidad_llamada).toBeNull();
        const v = simpleSchema.safeParse({ ...cuerpoV22, motivo_id: "", priorizacion_admin: null });
        expect(v.success && v.data.motivo_id === null && v.data.priorizacion_admin === null).toBe(true);
    });

    it("rechaza motivo_id y priorizacion_admin con texto no numerico", () => {
        expect(camposInvalidos({ ...cuerpoV22, motivo_id: "abc" })).toContain("motivo_id");
        expect(camposInvalidos({ ...cuerpoV22, priorizacion_admin: "alta" })).toContain("priorizacion_admin");
    });

    it("rechaza disponibilidad_llamada fuera de AM, PM, AM/PM", () => {
        expect(camposInvalidos({ ...cuerpoV22, disponibilidad_llamada: "Noche" })).toContain("disponibilidad_llamada");
    });

    it("rechaza fecha_inicio con formato distinto", () => {
        expect(camposInvalidos({ ...cuerpoV22, fecha_inicio: "14/05/2026" })).toContain("fecha_inicio");
    });

    it("rechaza id_solicitud vacio o de mas de 50 caracteres", () => {
        expect(camposInvalidos({ ...cuerpoV22, id_solicitud: "" })).toContain("id_solicitud");
        expect(camposInvalidos({ ...cuerpoV22, id_solicitud: "x".repeat(51) })).toContain("id_solicitud");
    });

    it("rechaza tipo_solicitud_id vacio o no numerico y centro_id vacio", () => {
        expect(camposInvalidos({ ...cuerpoV22, tipo_solicitud_id: "" })).toContain("tipo_solicitud_id");
        expect(camposInvalidos({ ...cuerpoV22, tipo_solicitud_id: "x1" })).toContain("tipo_solicitud_id");
        expect(camposInvalidos({ ...cuerpoV22, centro_id: " " })).toContain("centro_id");
    });
});
