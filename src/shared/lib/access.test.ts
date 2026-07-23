import { describe, it, expect } from "vitest";
import { esEstadoActivo } from "./access";

describe("esEstadoActivo", () => {
    it("acepta los estados activos conocidos", () => {
        expect(esEstadoActivo("Activo")).toBe(true);
        expect(esEstadoActivo(" 1 ")).toBe(true);
    });

    it("rechaza estados inactivos, vacios o nulos", () => {
        expect(esEstadoActivo("Inactivo")).toBe(false);
        expect(esEstadoActivo("")).toBe(false);
        expect(esEstadoActivo(null)).toBe(false);
        expect(esEstadoActivo(undefined)).toBe(false);
    });
});
