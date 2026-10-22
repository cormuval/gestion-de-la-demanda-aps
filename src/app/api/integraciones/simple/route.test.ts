import { beforeEach, describe, expect, it, vi } from "vitest";

// lib
import { AuditLogger } from "@/shared/lib/logger";
import { registrarSolicitudSimple } from "@/modules/integraciones/services/registrarSolicitudSimple";
import { POST } from "./route";

vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logSecurity: vi.fn(), logDataAccess: vi.fn() }
}));
vi.mock("@/modules/integraciones/services/registrarSolicitudSimple", () => ({
    registrarSolicitudSimple: vi.fn()
}));

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

function peticion(cuerpo: unknown, key?: string): Request {
    return new Request("http://localhost/api/integraciones/simple", {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { "api-key": key } : {}) },
        body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)
    });
}

describe("POST /api/integraciones/simple", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("INTEGRACION_KEY_GI", "key-gi");
        vi.stubEnv("INTEGRACION_KEY_GAS", "key-gas");
    });

    it("sin api-key responde 403 con el body exacto y audita seguridad", async () => {
        const res = await POST(peticion(cuerpoV22));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ Mensaje: "api-key no valida" });
        expect(AuditLogger.logSecurity).toHaveBeenCalledOnce();
        expect(registrarSolicitudSimple).not.toHaveBeenCalled();
    });

    it("la key de GAS no sirve en la ruta simple", async () => {
        const res = await POST(peticion(cuerpoV22, "key-gas"));
        expect(res.status).toBe(403);
    });

    it("JSON roto responde 400 con detalles vacios", async () => {
        const res = await POST(peticion("no-json{", "key-gi"));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Datos inválidos", detalles: {} });
    });

    it("cuerpo que no cumple el esquema responde 400 con los campos invalidos", async () => {
        const res = await POST(peticion({ ...cuerpoV22, rut_usuario: undefined }, "key-gi"));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Datos inválidos");
        expect(Object.keys(body.detalles)).toContain("rut_usuario");
    });

    it("ejemplo v2.2 responde 201 y la auditoria no incluye datos de contacto", async () => {
        vi.mocked(registrarSolicitudSimple).mockResolvedValue({ ok: true, data: { id_solicitud: "DES99-2" } });
        const res = await POST(peticion(cuerpoV22, "key-gi"));
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ message: "Solicitud creada con éxito", id_solicitud: "DES99-2" });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
            "CREATE", true, { name: "Integración GI" }, "solicitudes",
            { details: "/api/integraciones/simple DES99-2 → 201" }
        );
        const auditoria = JSON.stringify(vi.mocked(AuditLogger.logDataAccess).mock.calls);
        expect(auditoria).not.toContain("+56987654321");
        expect(auditoria).not.toContain("paciente@example.cl");
    });

    it("DUPLICADO responde 409", async () => {
        vi.mocked(registrarSolicitudSimple).mockResolvedValue({ ok: false, codigo: "DUPLICADO", error: "Ya existe" });
        const res = await POST(peticion(cuerpoV22, "key-gi"));
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: "Ya existe" });
    });

    it("CATALOGO responde 422", async () => {
        vi.mocked(registrarSolicitudSimple).mockResolvedValue({ ok: false, codigo: "CATALOGO", error: "Centro inexistente" });
        const res = await POST(peticion(cuerpoV22, "key-gi"));
        expect(res.status).toBe(422);
        expect(await res.json()).toEqual({ error: "Centro inexistente" });
    });

    it("INTERNO responde 500 con mensaje generico", async () => {
        vi.mocked(registrarSolicitudSimple).mockResolvedValue({ ok: false, codigo: "INTERNO", error: "detalle de BD" });
        const res = await POST(peticion(cuerpoV22, "key-gi"));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "Error interno del servidor" });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
            "CREATE", false, { name: "Integración GI" }, "solicitudes",
            { details: "/api/integraciones/simple DES99-2 → 500" }
        );
    });
});
