import { describe, expect, it } from "vitest";
// utils/componente
import { FILTROS_INICIALES, detalleFiltrosActivos, type CitasFiltrosUI } from "./CitasFiltros";

const Opciones = {
    profesionales: [{ id: 7, nombre: "Médico General" }],
    prestaciones: []
} as Parameters<typeof detalleFiltrosActivos>[1];

const base: CitasFiltrosUI = { ...FILTROS_INICIALES };

describe("FILTROS_INICIALES", () => {
    it("parte por defecto en Agendamientos próximos", () => {
        expect(FILTROS_INICIALES.temporalidad).toBe("Agendamientos próximos");
        expect(FILTROS_INICIALES.estado).toBe("");
    });
});

describe("detalleFiltrosActivos", () => {
    it("devuelve vacio con los filtros iniciales (la temporalidad base no cuenta)", () => {
        expect(detalleFiltrosActivos({ ...base }, Opciones)).toEqual([]);
    });

    it("resume la temporalidad al salir del valor por defecto", () => {
        expect(detalleFiltrosActivos({ ...base, temporalidad: "Todas" }, Opciones)).toEqual([
            { etiqueta: "Temporalidad", valor: "Todas" }
        ]);
        expect(detalleFiltrosActivos({ ...base, temporalidad: "Agendamientos futuros" }, Opciones)).toEqual([
            { etiqueta: "Temporalidad", valor: "Agendamientos futuros" }
        ]);
    });

    it("resume el texto aplicado como observación clínica", () => {
        expect(detalleFiltrosActivos({ ...base, texto: "control pendiente" }, Opciones)).toEqual([
            { etiqueta: "Observación clínica", valor: "control pendiente" }
        ]);
    });

    it("resuelve el nombre del profesional desde las opciones", () => {
        const detalle = detalleFiltrosActivos({ ...base, profesional_id: "7" }, Opciones);
        expect(detalle).toEqual([{ etiqueta: "Profesión", valor: "Médico General" }]);
    });

    it("lista los filtros activos en orden fijo con etiquetas legibles", () => {
        const detalle = detalleFiltrosActivos(
            { ...base, estado: "Sin llamadas", profesional_id: "7", prestacion: "Consulta", edadMin: "5", edadMax: "12", fechaDesde: "2026-11-01", fechaHasta: "2026-11-30", rut: "123", sector: "Amarillo" },
            Opciones
        );
        expect(detalle).toEqual([
            { etiqueta: "Estado", valor: "Sin llamadas" },
            { etiqueta: "Profesión", valor: "Médico General" },
            { etiqueta: "Prestación", valor: "Consulta" },
            { etiqueta: "Edad", valor: "5–12 años" },
            { etiqueta: "Fecha estimada", valor: "2026-11-01 a 2026-11-30" },
            { etiqueta: "RUT", valor: "123" },
            { etiqueta: "Sector", valor: "Amarillo" }
        ]);
    });

    it("con edad o fecha de un solo extremo resume con un simbolo", () => {
        expect(detalleFiltrosActivos({ ...base, edadMin: "60" }, Opciones)).toEqual([{ etiqueta: "Edad", valor: "≥ 60 años" }]);
        expect(detalleFiltrosActivos({ ...base, edadMax: "18" }, Opciones)).toEqual([{ etiqueta: "Edad", valor: "≤ 18 años" }]);
        expect(detalleFiltrosActivos({ ...base, fechaDesde: "2026-11-01" }, Opciones)).toEqual([
            { etiqueta: "Fecha estimada", valor: "desde 2026-11-01" }
        ]);
        expect(detalleFiltrosActivos({ ...base, fechaHasta: "2026-11-30" }, Opciones)).toEqual([
            { etiqueta: "Fecha estimada", valor: "hasta 2026-11-30" }
        ]);
    });
});
