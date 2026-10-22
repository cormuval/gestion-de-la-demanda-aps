import { beforeEach, describe, expect, it, vi } from "vitest";

// lib
import { AuditLogger } from "@/shared/lib/logger";
import { registrarCargaSapu } from "@/modules/integraciones/services/registrarCargaSapu";
import { POST } from "./route";

vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logSecurity: vi.fn(), logDataAccess: vi.fn() }
}));
vi.mock("@/modules/integraciones/services/registrarCargaSapu", () => ({
    registrarCargaSapu: vi.fn()
}));

const filas = [
    { id_solicitud: "S-1", paciente: { rut: "12345678-9", nombre: "Ana" } },
    { id_solicitud: "S-2", paciente: { rut: "98765432-1", nombre: "Luis" } }
];

function peticion(cuerpo: unknown, key?: string): Request {
    return new Request("http://localhost/api/integraciones/sapu", {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { "api-key": key } : {}) },
        body: JSON.stringify(cuerpo)
    });
}

describe("POST /api/integraciones/sapu", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("INTEGRACION_KEY_GAS", "key-gas");
        vi.stubEnv("INTEGRACION_KEY_SAPU", "key-sapu");
    });

    it("la key de GAS no sirve en esta ruta", async () => {
        const res = await POST(peticion({ solicitudes: filas }, "key-gas"));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ Mensaje: "api-key no valida" });
    });

    it.each([[{ solicitudes: [] }], [{ solicitudes: "x" }]])("lote invalido %j responde 400", async (cuerpo) => {
        const res = await POST(peticion(cuerpo, "key-sapu"));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe("Datos inválidos");
        expect(registrarCargaSapu).not.toHaveBeenCalled();
    });

    it("lote valido responde 200 con el resultado y audita sin datos del paciente", async () => {
        const resultado = {
            resultados: [
                { indice: 0, id_solicitud: "S-1", estado: "creada" as const },
                { indice: 1, id_solicitud: "S-2", estado: "rechazada" as const, error: "x" }
            ],
            totales: { creadas: 1, duplicadas: 0, rechazadas: 1 }
        };
        vi.mocked(registrarCargaSapu).mockResolvedValue(resultado);
        const res = await POST(peticion({ archivo: "carga.xlsx", solicitudes: filas }, "key-sapu"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(resultado);
        expect(registrarCargaSapu).toHaveBeenCalledWith(filas);
        const llamada = vi.mocked(AuditLogger.logDataAccess).mock.calls[0];
        const details = (llamada[4] as { details: string }).details;
        expect(details).toContain("/api/integraciones/sapu");
        expect(details).toContain("carga.xlsx");
        expect(details).toContain("creadas=1 duplicadas=0 rechazadas=1");
        expect(details).toContain("→ 200");
        const auditoria = JSON.stringify(vi.mocked(AuditLogger.logDataAccess).mock.calls);
        expect(auditoria).not.toContain("12345678-9");
        expect(auditoria).not.toContain("Ana");
    });
});
