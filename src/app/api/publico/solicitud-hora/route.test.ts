// lib
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AuditLogger } from "@/shared/lib/logger";
import { consultarPercapita } from "@/modules/solicitud-web/lib/percapita";
import { tiposHabilitados } from "@/modules/solicitud-web/services/tiposHabilitados";

import { POST, OPTIONS } from "./route";
import { ipDe } from "@/modules/solicitud-web/lib/http";

vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));
vi.mock("@/modules/solicitud-web/lib/percapita", () => ({ consultarPercapita: vi.fn() }));
vi.mock("@/modules/solicitud-web/services/tiposHabilitados", () => ({ tiposHabilitados: vi.fn() }));
const { permitir } = vi.hoisted(() => ({ permitir: vi.fn(() => true) }));
vi.mock("@/modules/solicitud-web/lib/limiteIp", () => ({ crearLimitador: vi.fn(() => ({ permitir })) }));
const paciente = { nombre: "Privado", apellido: "Reservado", centro_id: "501", fecha_nacimiento: null, genero: null };
function peticion(cuerpo: unknown, origin = "https://formulario.example.test"): Request {
    return new Request("http://localhost/api/publico/solicitud-hora", {
        method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": " 192.0.2.1, 192.0.2.2" },
        body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)
    });
}
async function comprobar(cuerpo: unknown, status: number, esperado: unknown): Promise<void> {
    const respuesta = await POST(peticion(cuerpo));
    expect(respuesta.status).toBe(status);
    const datos = await respuesta.json();
    expect(datos).toEqual(esperado);
    expect(datos).not.toHaveProperty("nombre");
    expect(datos).not.toHaveProperty("centro");
    const texto = JSON.stringify(datos);
    expect(texto).not.toContain("apellido");
    expect(texto).not.toContain("centro_id");
    expect(texto).not.toContain("Privado");
    expect(texto).not.toContain("Reservado");
}
afterEach(() => {
    expect(JSON.stringify(vi.mocked(AuditLogger.logDataAccess).mock.calls)).not.toContain("+56912345678");
    expect(JSON.stringify(vi.mocked(AuditLogger.logDataAccess).mock.calls)).not.toContain("contacto@example.test");
    vi.unstubAllEnvs();
});
// lib
import { verificarToken } from "@/modules/solicitud-web/lib/token";
// services
import { registrarSolicitudWeb } from "@/modules/solicitud-web/services/registrarSolicitudWeb";
vi.mock("@/modules/solicitud-web/lib/token", () => ({ verificarToken: vi.fn() }));
vi.mock("@/modules/solicitud-web/services/registrarSolicitudWeb", () => ({ registrarSolicitudWeb: vi.fn() }));
const entrada = { token: "token", telefono: "+56912345678", correo: "contacto@example.test", discapacidad: "Ninguna de las anteriores", tipo_solicitud_id: 1, descripcion: "Necesito una consulta", disponibilidad_llamada: "AM" };
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SOLICITUD_WEB_ORIGEN", "https://formulario.example.test");
    vi.stubEnv("SOLICITUD_WEB_TOKEN_SECRET", "secreto-ficticio");
    permitir.mockReturnValue(true);
    vi.mocked(verificarToken).mockReturnValue({ rut: "12345678-5", centro_id: "501", exp: Date.now() + 1000 });
    vi.mocked(consultarPercapita).mockResolvedValue({ estado: "INSCRITO", paciente });
    vi.mocked(tiposHabilitados).mockResolvedValue([{ id: 1, nombre: "Consulta" }]);
    vi.mocked(registrarSolicitudWeb).mockResolvedValue({ ok: true, estado: "CREADA", id_solicitud: "WEB-ficticia" });
});
describe("envío público", () => {
    it("prioriza x-real-ip sobre cualquier cadena reenviada", async () => {
        const request = peticion(entrada);
        request.headers.set("x-real-ip", " 192.0.2.3 ");
        await POST(request);
        expect(permitir).toHaveBeenCalledWith("192.0.2.3");
    });
    it("un prefijo falsificado no cambia la clave del límite", async () => {
        for (const prefijo of ["198.51.100.1", "198.51.100.2, 198.51.100.3"]) {
            const request = peticion(entrada);
            request.headers.set("x-forwarded-for", `${prefijo}, 192.0.2.2`);
            await POST(request);
        }
        expect(permitir.mock.calls).toEqual([["192.0.2.2"], ["192.0.2.2"]]);
    });
    it("sin encabezados de IP devuelve null", () => {
        expect(ipDe(new Request("http://localhost"))).toBeNull();
    });
    it("Vary Origin está presente con origen ajeno o ausente", async () => {
        const request = peticion(entrada, "https://otro.example.test");
        expect((await POST(request)).headers.get("vary")).toBe("Origin");
        expect(OPTIONS(request).headers.get("vary")).toBe("Origin");
        request.headers.delete("origin");
        expect(OPTIONS(request).headers.get("vary")).toBe("Origin");
    });
    it("rechaza content-length mayor al límite antes de leer el cuerpo", async () => {
        const request = peticion(entrada);
        request.headers.set("content-length", "16385");
        const leer = vi.spyOn(request, "text");
        const respuesta = await POST(request);
        expect(respuesta.status).toBe(413);
        expect(await respuesta.json()).toEqual({ error: "DATOS" });
        expect(leer).not.toHaveBeenCalled();
        expect(consultarPercapita).not.toHaveBeenCalled();
    });
    it("rechaza texto mayor al límite sin content-length antes de parsear JSON", async () => {
        const respuesta = await POST(peticion("x".repeat(16385)));
        expect(respuesta.status).toBe(413);
        expect(await respuesta.json()).toEqual({ error: "DATOS" });
        expect(consultarPercapita).not.toHaveBeenCalled();
    });
    it("acepta exactamente 16384 caracteres y bytes declarados", async () => {
        const contenido = JSON.stringify(entrada);
        const request = peticion(contenido + " ".repeat(16384 - contenido.length));
        request.headers.set("content-length", "16384");
        expect((await POST(request)).status).toBe(201);
    });
    it("aplica CORS también a respuestas POST", async () => {
        expect((await POST(peticion(entrada))).headers.get("access-control-allow-origin")).toBe("https://formulario.example.test");
        expect((await POST(peticion(entrada, "https://otro.example.test"))).headers.has("access-control-allow-origin")).toBe(false);
    });
    it("incluye CORS solo para el origen configurado", async () => {
        expect((await OPTIONS(peticion({}))).status).toBe(204);
        const permitida = await OPTIONS(peticion({}));
        expect(permitida.headers.get("access-control-allow-origin")).toBe("https://formulario.example.test");
        expect(permitida.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
        expect(permitida.headers.get("access-control-allow-headers")).toBe("content-type");
        expect(permitida.headers.get("access-control-max-age")).toBe("600");
        expect(permitida.headers.get("vary")).toBe("Origin");
        expect((await OPTIONS(peticion({}, "https://otro.example.test"))).headers.has("access-control-allow-origin")).toBe(false);
    });
    it("limita por la última IP reenviada sin auditar", async () => {
        permitir.mockReturnValue(false);
        await comprobar(entrada, 429, { error: "LIMITE" });
        expect(permitir).toHaveBeenCalledWith("192.0.2.2");
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });
    it("campo trampa simula éxito sin validar token ni guardar", async () => {
        await comprobar({ sitio_web: "robot" }, 201, { ok: true });
        expect(registrarSolicitudWeb).not.toHaveBeenCalled();
        expect(verificarToken).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("CREATE", true, { name: "Formulario web" }, "solicitudes", { details: "/api/publico/solicitud-hora rut=- → 201 trampa" });
    });
    it("sin secreto rechaza TOKEN sin consultar per cápita", async () => {
        vi.stubEnv("SOLICITUD_WEB_TOKEN_SECRET", "");
        await comprobar(entrada, 400, { error: "TOKEN" });
        expect(consultarPercapita).not.toHaveBeenCalled();
        expect(registrarSolicitudWeb).not.toHaveBeenCalled();
    });
    it("token vencido", async () => {
        vi.mocked(verificarToken).mockReturnValue(null);
        await comprobar(entrada, 400, { error: "TOKEN" });
    });
    it("JSON roto", async () => { await comprobar("{roto", 400, { error: "DATOS", campos: [] }); });
    it("schema inválido", async () => { await comprobar({ ...entrada, telefono: "malo" }, 400, { error: "DATOS", campos: ["telefono"] }); });
    it("tipo no habilitado", async () => {
        vi.mocked(tiposHabilitados).mockResolvedValue([]);
        await comprobar(entrada, 400, { error: "DATOS", campos: ["tipo_solicitud_id"] });
        expect(registrarSolicitudWeb).not.toHaveBeenCalled();
    });
    it.each(["NO_INSCRITO", "NO_DISPONIBLE"] as const)("per cápita %s", async (estado) => {
        vi.mocked(consultarPercapita).mockResolvedValue({ estado });
        await comprobar(entrada, 503, { error: "NO_DISPONIBLE" });
    });
    it("creada", async () => { await comprobar(entrada, 201, { ok: true }); });
    it("duplicada responde idéntico y audita", async () => {
        vi.mocked(registrarSolicitudWeb).mockResolvedValue({ ok: true, estado: "DUPLICADA" });
        await comprobar(entrada, 201, { ok: true });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("CREATE", true, { name: "Formulario web" }, "solicitudes", { details: "/api/publico/solicitud-hora rut=12345678-5 → 201 duplicada" });
    });
    it("error interno", async () => {
        vi.mocked(registrarSolicitudWeb).mockResolvedValue({ ok: false, codigo: "INTERNO", error: "Privado" });
        await comprobar(entrada, 500, { error: "INTERNO" });
    });
});
