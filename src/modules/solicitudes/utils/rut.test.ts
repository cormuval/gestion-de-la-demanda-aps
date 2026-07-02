import { describe, expect, it } from "vitest";
import { esRutChilenoValido, normalizarRut } from "./rut";

describe("RUT chileno", () => {
    it("acepta RUT valido con puntos y guion", () => {
        expect(esRutChilenoValido("12.345.678-5")).toBe(true);
    });

    it("acepta RUT valido sin puntos", () => {
        expect(esRutChilenoValido("12345678-5")).toBe(true);
    });

    it("acepta y normaliza RUT valido sin guion", () => {
        expect(esRutChilenoValido("123456785")).toBe(true);
        expect(normalizarRut("123456785")).toBe("12345678-5");
    });

    it("acepta digito verificador K", () => {
        expect(esRutChilenoValido("1.000.005-K")).toBe(true);
    });

    it("rechaza RUT invalido", () => {
        expect(esRutChilenoValido("12.345.678-9")).toBe(false);
    });

    it("normaliza puntos y espacios", () => {
        expect(normalizarRut(" 12.345.678-5 ")).toBe("12345678-5");
    });
});
