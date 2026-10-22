import { afterEach, describe, expect, it, vi } from "vitest";

import { autenticarIntegracion } from "./autenticarIntegracion";

function pedido(apiKey?: string): Request {
    const headers = new Headers();
    if (apiKey !== undefined) headers.set("api-key", apiKey);
    return new Request("https://gd.cmvalparaiso.cl/api/integraciones/simple", { method: "POST", headers });
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("autenticarIntegracion", () => {
    it("acepta la key del cliente", () => {
        vi.stubEnv("INTEGRACION_KEY_GI", "k-gi");
        vi.stubEnv("INTEGRACION_KEY_GAS", "k-gas");
        expect(autenticarIntegracion(pedido("k-gi"), "GI")).toBe(true);
        expect(autenticarIntegracion(pedido("k-gas"), "GAS")).toBe(true);
    });

    it("acepta las keys de SAPU y CONTRARREFERENCIA y no las cruza", () => {
        vi.stubEnv("INTEGRACION_KEY_SAPU", "k-sapu");
        vi.stubEnv("INTEGRACION_KEY_CONTRARREFERENCIA", "k-cr");
        expect(autenticarIntegracion(pedido("k-sapu"), "SAPU")).toBe(true);
        expect(autenticarIntegracion(pedido("k-cr"), "CONTRARREFERENCIA")).toBe(true);
        expect(autenticarIntegracion(pedido("k-sapu"), "CONTRARREFERENCIA")).toBe(false);
    });

    it("rechaza key incorrecta o ausente", () => {
        vi.stubEnv("INTEGRACION_KEY_GI", "k-gi");
        expect(autenticarIntegracion(pedido("x"), "GI")).toBe(false);
        expect(autenticarIntegracion(pedido("k-gi-extra"), "GI")).toBe(false);
        expect(autenticarIntegracion(pedido(), "GI")).toBe(false);
    });

    it("rechaza si la variable no está definida", () => {
        vi.stubEnv("INTEGRACION_KEY_GAS", undefined);
        expect(autenticarIntegracion(pedido(""), "GAS")).toBe(false);
        expect(autenticarIntegracion(pedido("cualquiera"), "GAS")).toBe(false);
        vi.stubEnv("INTEGRACION_KEY_GAS", "");
        expect(autenticarIntegracion(pedido(""), "GAS")).toBe(false);
    });

    it("la key de un cliente no sirve para el otro", () => {
        vi.stubEnv("INTEGRACION_KEY_GI", "k-gi");
        vi.stubEnv("INTEGRACION_KEY_GAS", "k-gas");
        expect(autenticarIntegracion(pedido("k-gi"), "GAS")).toBe(false);
        expect(autenticarIntegracion(pedido("k-gas"), "GI")).toBe(false);
    });
});
