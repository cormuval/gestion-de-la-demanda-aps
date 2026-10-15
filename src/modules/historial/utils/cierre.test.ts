import { describe, it, expect } from "vitest";
import { fechaCierreCita, fechaCierreSolicitud } from "./cierre";

describe("fechaCierreCita", () => {
    it("cita terminal toma la ultima llamada", () => {
        const d1 = new Date("2026-01-01");
        const d3 = new Date("2026-03-01");
        expect(fechaCierreCita("Cita Aceptada", [d1, null, d3])).toEqual(d3);
    });

    it("cita terminal sin llamadas no tiene fecha", () => {
        expect(fechaCierreCita("Cita Rechazada (Gestor)", [])).toBeNull();
    });

    it("cita pendiente no tiene fecha de cierre", () => {
        const d1 = new Date("2026-01-01");
        expect(fechaCierreCita("No contesta (1)", [d1])).toBeNull();
    });
});

describe("fechaCierreSolicitud", () => {
    it("solicitud rechazada usa fecha_validacion", () => {
        const v = new Date("2026-02-01");
        const d1 = new Date("2026-01-01");
        expect(fechaCierreSolicitud("Rechazado", v, [d1])).toEqual(v);
    });

    it("solicitud realizada usa el ultimo cierre de sus citas", () => {
        const d1 = new Date("2026-01-01");
        const d3 = new Date("2026-03-01");
        expect(fechaCierreSolicitud("Realizado", null, [d1, d3, null])).toEqual(d3);
        expect(fechaCierreSolicitud("Realizado", null, [null])).toBeNull();
    });

    it("solicitud en curso no tiene fecha", () => {
        const v = new Date("2026-02-01");
        const d1 = new Date("2026-01-01");
        expect(fechaCierreSolicitud("En Curso", v, [d1])).toBeNull();
    });
});
