import { describe, it, expect } from "vitest";
import { formatearTelefonos, formatearCorreo } from "./contacto";

describe("formatearTelefonos", () => {
    it("ambos -> separados por ' - '", () => {
        expect(formatearTelefonos("111", "222")).toBe("111 - 222");
    });
    it("solo uno -> ese", () => {
        expect(formatearTelefonos("111", null)).toBe("111");
        expect(formatearTelefonos("", "222")).toBe("222");
    });
    it("ninguno -> literal", () => {
        expect(formatearTelefonos(null, null)).toBe("Sin telefono(s) registrados");
        expect(formatearTelefonos("", "  ")).toBe("Sin telefono(s) registrados");
    });
});

describe("formatearCorreo", () => {
    it("con correo -> ese", () => {
        expect(formatearCorreo("a@b.cl")).toBe("a@b.cl");
    });
    it("sin correo -> literal exacto", () => {
        expect(formatearCorreo(null)).toBe("Correo electrónico de contacto no registrado");
        expect(formatearCorreo("   ")).toBe("Correo electrónico de contacto no registrado");
    });
});
