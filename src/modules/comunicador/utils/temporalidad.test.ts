import { describe, it, expect } from "vitest";
import { rangoTemporalidad, addDays } from "./temporalidad";
import { TEMPORALIDAD } from "../types/comunicador";

const HOY = new Date(2026, 6, 10); // 2026-07-10, hora 00:00 local

describe("rangoTemporalidad", () => {
    it("Todas -> null (sin filtro)", () => {
        expect(rangoTemporalidad(TEMPORALIDAD.TODAS, HOY)).toBeNull();
    });
    it("Proximos -> [hoy-15, hoy+30]", () => {
        const r = rangoTemporalidad(TEMPORALIDAD.PROXIMOS, HOY)!;
        expect(r.gte).toEqual(addDays(HOY, -15));
        expect(r.lte).toEqual(addDays(HOY, 30));
    });
    it("Futuros -> >= hoy+31", () => {
        const r = rangoTemporalidad(TEMPORALIDAD.FUTUROS, HOY)!;
        expect(r.gte).toEqual(addDays(HOY, 31));
        expect(r.lte).toBeUndefined();
    });
    it("Atrasados -> < hoy-15", () => {
        const r = rangoTemporalidad(TEMPORALIDAD.ATRASADOS, HOY)!;
        expect(r.lt).toEqual(addDays(HOY, -15));
        expect(r.gte).toBeUndefined();
    });
});
