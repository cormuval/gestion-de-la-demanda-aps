import { describe, expect, it } from "vitest";
import { solicitudFiltrosSchema } from "./solicitudFiltros.schema";

describe("solicitudFiltrosSchema", () => {
    it("normaliza los filtros existentes y aplica valores por defecto", () => {
        expect(solicitudFiltrosSchema.parse({ texto: " control ", sector: " Sector 1 ", tipoSolicitudId: " 3 ", centroId: "otro" })).toEqual({
            texto: "control", sector: "Sector 1", tipoSolicitudId: "3", centroId: "otro", page: 1
        });
        expect(solicitudFiltrosSchema.parse({})).toEqual({ texto: "", page: 1 });
    });

    it("acepta los campos vacios que entrega la vista y edad cero", () => {
        expect(solicitudFiltrosSchema.safeParse({ rut: "", estado: "", tipoSolicitudId: "", motivoId: "", sector: "", edadDesde: "0", edadHasta: "", fechaDesde: "", fechaHasta: "", page: 1 }).success).toBe(true);
    });

    it.each([
        { texto: "a".repeat(201) }, { texto: null },
        { page: 0 }, { page: -1 }, { page: 1.5 }, { page: Infinity }, { page: "2" },
        { tipoSolicitudId: "abc" }, { tipoSolicitudId: "0" }, { motivoId: "-1" },
        { edadDesde: "-1" }, { edadHasta: "1.5" }, { edadDesde: "Infinity" }, { edadHasta: "9007199254740992" },
        { fechaDesde: "2026-02-30" }, { fechaHasta: "2026-13-01" }, { fechaDesde: "ayer" }
    ])("rechaza filtros invalidos: %j", (filtros) => {
        expect(solicitudFiltrosSchema.safeParse(filtros).success).toBe(false);
    });

    it("acepta fechas de calendario y los campos compatibles existentes", () => {
        expect(solicitudFiltrosSchema.safeParse({ fechaDesde: "2024-02-29", fechaHasta: "2026-11-10", rut: "12.345.678-5", estado: "En Curso", motivoId: "9", edadDesde: "60", edadHasta: "80", page: 2 }).success).toBe(true);
    });
});
