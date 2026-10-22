import { beforeEach, describe, expect, it, vi } from "vitest";

// lib
import { AuditLogger } from "@/shared/lib/logger";
import { registrarContrarreferencia } from "@/modules/integraciones/services/registrarContrarreferencia";
import { POST } from "./route";

vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logSecurity: vi.fn(), logDataAccess: vi.fn() }
}));
vi.mock("@/modules/integraciones/services/registrarContrarreferencia", () => ({
    registrarContrarreferencia: vi.fn()
}));

const ID_SOLICITUD = "con-1234-abcd";
const paciente = { rut: "12345678-9", nombre: "Ana", apellido: "Pérez", telefono: "+56912345678" };
const solicitud = {
    id_solicitud: ID_SOLICITUD,
    fecha_inicio: "2026-10-20 10:30:00",
    descripcion: "Contrarreferencia",
    centro_id: 501
};
const cita = { id_cita: "C-1", profesional_id: 3, prestacion_id: 7, fecha_estimada_atencion: "2026-10-30", observacion: "Control" };

function peticion(cuerpo: unknown, key?: string): Request {
    return new Request("http://localhost/api/integraciones/contrarreferencia", {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { "api-key": key } : {}) },
        body: JSON.stringify(cuerpo)
    });
}

describe("POST /api/integraciones/contrarreferencia", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("INTEGRACION_KEY_SAPU", "key-sapu");
        vi.stubEnv("INTEGRACION_KEY_CONTRARREFERENCIA", "key-cr");
    });

    it("la key de SAPU no sirve en esta ruta", async () => {
        const res = await POST(peticion({ contrarreferencia_id: 4321, modo: "validada", paciente, solicitud, cita }, "key-sapu"));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ Mensaje: "api-key no valida" });
        expect(registrarContrarreferencia).not.toHaveBeenCalled();
    });

    it("cuerpo sin modo responde 400", async () => {
        const res = await POST(peticion({ contrarreferencia_id: 4321, paciente, solicitud, cita }, "key-cr"));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Datos inválidos");
        expect(Object.keys(body.detalles)).toContain("modo");
        expect(registrarContrarreferencia).not.toHaveBeenCalled();
    });

    it("contrarreferencia validada responde 201 y audita id, cr y modo sin datos del paciente", async () => {
        vi.mocked(registrarContrarreferencia).mockResolvedValue({ ok: true, data: { id_solicitud: ID_SOLICITUD } });
        const res = await POST(peticion({ contrarreferencia_id: 4321, modo: "validada", paciente, solicitud, cita }, "key-cr"));
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ message: "Solicitud creada con éxito", id_solicitud: ID_SOLICITUD });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
            "CREATE", true, { name: "Integración CONTRARREFERENCIA" }, "solicitudes",
            { details: `/api/integraciones/contrarreferencia ${ID_SOLICITUD} cr=4321 validada → 201` }
        );
        const auditoria = JSON.stringify(vi.mocked(AuditLogger.logDataAccess).mock.calls);
        expect(auditoria).not.toContain("Ana");
        expect(auditoria).not.toContain("12345678-9");
        expect(auditoria).not.toContain("+56912345678");
    });

    it("duplicada responde 409", async () => {
        vi.mocked(registrarContrarreferencia).mockResolvedValue({ ok: false, codigo: "DUPLICADO", error: "La solicitud ya existe" });
        const res = await POST(peticion({ contrarreferencia_id: 4321, modo: "pendiente", paciente, solicitud }, "key-cr"));
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: "La solicitud ya existe" });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
            "CREATE", false, { name: "Integración CONTRARREFERENCIA" }, "solicitudes",
            { details: `/api/integraciones/contrarreferencia ${ID_SOLICITUD} cr=4321 pendiente → 409` }
        );
    });

    it("catalogo invalido responde 422 con el mensaje", async () => {
        vi.mocked(registrarContrarreferencia).mockResolvedValue({ ok: false, codigo: "CATALOGO", error: "Profesional no existe" });
        const res = await POST(peticion({ contrarreferencia_id: 4321, modo: "validada", paciente, solicitud, cita }, "key-cr"));
        expect(res.status).toBe(422);
        expect(await res.json()).toEqual({ error: "Profesional no existe" });
    });
});
