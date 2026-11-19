import { describe, expect, it } from "vitest";

// reglas
import { armarPayload, idContrarreferencia, type CasoOrigen } from "./reglas";

const pendiente: CasoOrigen = {
    id_solicitud: "con-1234-20261109151850",
    fecha_inicio: "2026-11-09 15:18:50",
    descripcion: "Texto clínico | Registro Contrarreferencia ID: 4342",
    centro_id: "625",
    rut_usuario: "12345678-5",
    nombre: "Ana",
    apellido: "Soto",
    telefono: "+56912345678",
    id_cita: null,
    profesional_id: null,
    prestacion_id: null,
    fecha_estimada_atencion: null,
    observacion_cita: null
};

const validada: CasoOrigen = {
    ...pendiente,
    id_cita: "cita-con-1234",
    profesional_id: "8",
    prestacion_id: "144",
    fecha_estimada_atencion: "2026-12-09",
    observacion_cita: "Receta por 30 días"
};

describe("idContrarreferencia", () => {
    it("lee el número de la marca al final de la descripción", () => {
        expect(idContrarreferencia("algo | Registro Contrarreferencia ID: 4342")).toBe(4342);
    });
    it("lee la marca seguida de otro campo", () => {
        expect(idContrarreferencia("Registro Contrarreferencia ID: 43 | Otro: x")).toBe(43);
    });
    it("devuelve null sin marca", () => {
        expect(idContrarreferencia("sin marca")).toBeNull();
        expect(idContrarreferencia(null)).toBeNull();
    });
});

describe("armarPayload", () => {
    it("arma una contrarreferencia pendiente conservando id, fecha y centro", () => {
        const r = armarPayload(pendiente, false);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload.modo).toBe("pendiente");
        expect(r.payload.contrarreferencia_id).toBe(4342);
        expect(r.payload.cita).toBeNull();
        expect(r.payload.solicitud.id_solicitud).toBe("con-1234-20261109151850");
        expect(r.payload.solicitud.centro_id).toBe("625");
        // 15:18:50 en Chile (verano, UTC-3) = 18:18:50 UTC
        expect(r.payload.solicitud.fecha_inicio.toISOString()).toBe("2026-11-09T18:18:50.000Z");
    });

    it("arma una validada con la cita y su fecha estimada original", () => {
        const r = armarPayload(validada, false);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload.modo).toBe("validada");
        expect(r.payload.cita).toMatchObject({ id_cita: "cita-con-1234", profesional_id: 8, prestacion_id: 144, observacion: "Receta por 30 días" });
        expect(r.payload.cita?.fecha_estimada_atencion.toISOString()).toBe("2026-12-09T00:00:00.000Z");
    });

    it("normaliza la k minúscula del RUT", () => {
        const r = armarPayload({ ...pendiente, rut_usuario: "14292482-k" }, false);
        expect(r.ok && r.payload.paciente.rut).toBe("14292482-K");
    });

    it("rechaza un RUT con dígito verificador inválido", () => {
        expect(armarPayload({ ...pendiente, rut_usuario: "983478006" }, false)).toEqual({ ok: false, motivo: "RUT inválido" });
    });

    it("rechaza una descripción sin marca de contrarreferencia", () => {
        expect(armarPayload({ ...pendiente, descripcion: "sin marca" }, false)).toEqual({
            ok: false,
            motivo: "Sin marca de contrarreferencia"
        });
    });

    it("no envía el teléfono si el paciente ya existe en destino", () => {
        const r = armarPayload(pendiente, true);
        expect(r.ok && r.payload.paciente.telefono).toBeNull();
    });

    it("envía el teléfono si el paciente es nuevo", () => {
        const r = armarPayload(pendiente, false);
        expect(r.ok && r.payload.paciente.telefono).toBe("+56912345678");
    });

    it("rechaza una cita incompleta", () => {
        const r = armarPayload({ ...validada, fecha_estimada_atencion: null }, false);
        expect(r.ok).toBe(false);
    });
});
