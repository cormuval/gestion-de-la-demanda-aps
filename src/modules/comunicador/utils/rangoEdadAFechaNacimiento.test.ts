import { describe, it, expect } from "vitest";
import { rangoEdadAFechaNacimiento } from "./rangoEdadAFechaNacimiento";

const HOY = new Date(2026, 6, 10); // 2026-07-10

describe("rangoEdadAFechaNacimiento", () => {
    it("sin límites -> objeto vacío", () => {
        expect(rangoEdadAFechaNacimiento(null, null, HOY)).toEqual({});
    });
    it("edad mínima N -> nacido a más tardar hoy - N años (lte)", () => {
        // edad >= 30  =>  fecha_nac <= 1996-07-10
        const r = rangoEdadAFechaNacimiento(30, null, HOY);
        expect(r.lte).toEqual(new Date(1996, 6, 10));
        expect(r.gte).toBeUndefined();
    });
    it("edad máxima M -> nacido después de hoy - (M+1) años (gte, +1 día)", () => {
        // edad <= 30  =>  fecha_nac >= 1995-07-11
        const r = rangoEdadAFechaNacimiento(null, 30, HOY);
        expect(r.gte).toEqual(new Date(1995, 6, 11));
        expect(r.lte).toBeUndefined();
    });
    it("rango [20,30]", () => {
        const r = rangoEdadAFechaNacimiento(20, 30, HOY);
        expect(r.lte).toEqual(new Date(2006, 6, 10)); // >=20
        expect(r.gte).toEqual(new Date(1995, 6, 11)); // <=30
    });
});
