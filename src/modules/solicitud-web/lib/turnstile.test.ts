// lib
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verificarCaptcha } from "./turnstile";

const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secreto-ficticio");
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("verificarCaptcha", () => {
    it.each([[true, true], [false, false], ["true", false], [undefined, false]])(
        "acepta solo success booleano verdadero: %s", async (success, esperado) => {
            fetchMock.mockResolvedValue(new Response(JSON.stringify({ success })));
            expect(await verificarCaptcha("token-ficticio", "192.0.2.1")).toBe(esperado);
        },
    );
    it("envía un formulario con secreto, respuesta e IP", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
        await verificarCaptcha("token-ficticio", "192.0.2.1");
        const [url, opciones] = fetchMock.mock.calls[0];
        expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
        expect(opciones.method).toBe("POST");
        expect(opciones.body).toBeInstanceOf(URLSearchParams);
        expect(Object.fromEntries(opciones.body)).toEqual({
            secret: "secreto-ficticio", response: "token-ficticio", remoteip: "192.0.2.1",
        });
    });
    it("omite remoteip cuando no hay IP", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
        expect(await verificarCaptcha("token-ficticio", null)).toBe(true);
        expect(fetchMock.mock.calls[0][1].body.has("remoteip")).toBe(false);
    });
    it("rechaza sin secreto sin consultar", async () => {
        vi.stubEnv("TURNSTILE_SECRET_KEY", "");
        expect(await verificarCaptcha("token-ficticio", null)).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each(["", "   "])("rechaza token vacío %j sin consultar", async (token) => {
        expect(await verificarCaptcha(token, null)).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it("rechaza errores de red", async () => {
        fetchMock.mockRejectedValue(new Error("red"));
        expect(await verificarCaptcha("token-ficticio", null)).toBe(false);
    });
    it("rechaza JSON inválido", async () => {
        fetchMock.mockResolvedValue(new Response("no-json"));
        expect(await verificarCaptcha("token-ficticio", null)).toBe(false);
    });
});

describe("límites de Turnstile", () => {
    it("usa un timeout de cinco segundos en la petición", async () => {
        const signal = new AbortController().signal;
        const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
        try {
            fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
            expect(await verificarCaptcha("token-ficticio", null)).toBe(true);
            expect(timeout).toHaveBeenCalledWith(5_000);
            expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
        } finally {
            timeout.mockRestore();
        }
    });
    it("rechaza tokens de más de 2048 caracteres sin consultar", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
        expect(await verificarCaptcha("a".repeat(2049), null)).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it("acepta tokens de exactamente 2048 caracteres", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
        expect(await verificarCaptcha("a".repeat(2048), null)).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
