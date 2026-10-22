import { beforeEach, describe, expect, it, vi } from "vitest";

// lib
import { AuditLogger } from "@/shared/lib/logger";
import { registrarDerivacionInterna } from "@/modules/integraciones/services/registrarDerivacionInterna";
import { POST } from "./route";

vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logSecurity: vi.fn(), logDataAccess: vi.fn() }
}));
vi.mock("@/modules/integraciones/services/registrarDerivacionInterna", () => ({
    registrarDerivacionInterna: vi.fn()
}));

const solicitud = { id_solicitud: "DI-1", tipo_solicitud_id: 1, motivo_id: null, descripcion: null, centro_id: 501 };
const cita = { profesional_id: 3, prestacion_id: 7, fecha_estimada_atencion: "2026-06-30", observacion: "Control" };
const paciente = { rut: "12345678-9", nombre: "Ana" };

function peticion(cuerpo: unknown, key?: string): Request {
    return new Request("http://localhost/api/integraciones/derivacion-interna", {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { "api-key": key } : {}) },
        body: JSON.stringify(cuerpo)
    });
}

describe("POST /api/integraciones/derivacion-interna", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("INTEGRACION_KEY_GI", "key-gi");
        vi.stubEnv("INTEGRACION_KEY_GAS", "key-gas");
    });

    it("la key de GI no sirve en esta ruta", async () => {
        const res = await POST(peticion({ modo: "validada", paciente, solicitud, cita }, "key-gi"));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ Mensaje: "api-key no valida" });
    });

    it("derivacion validada responde 201 y audita id y modo sin datos del paciente", async () => {
        vi.mocked(registrarDerivacionInterna).mockResolvedValue({ ok: true, data: { id_solicitud: "DI-1" } });
        const res = await POST(peticion({ modo: "validada", paciente, solicitud, cita }, "key-gas"));
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ message: "Solicitud creada con éxito", id_solicitud: "DI-1" });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
            "CREATE", true, { name: "Integración GAS" }, "solicitudes",
            { details: "/api/integraciones/derivacion-interna DI-1 validada → 201" }
        );
        const auditoria = JSON.stringify(vi.mocked(AuditLogger.logDataAccess).mock.calls);
        expect(auditoria).not.toContain("Ana");
        expect(auditoria).not.toContain("12345678-9");
    });

    it("validada sin cita responde 400", async () => {
        const res = await POST(peticion({ modo: "validada", paciente, solicitud }, "key-gas"));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Datos inválidos");
        expect(Object.keys(body.detalles)).toContain("cita");
        expect(registrarDerivacionInterna).not.toHaveBeenCalled();
    });
});
