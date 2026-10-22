import { describe, expect, it } from "vitest";

import { instanteDesdeHoraChile, vacioANull } from "./normalizacion";

describe("normalizacion", () => {
    it("vacioANull trata null, undefined y blancos como ausentes", () => {
        expect(vacioANull(null)).toBeNull();
        expect(vacioANull(undefined)).toBeNull();
        expect(vacioANull("   ")).toBeNull();
        expect(vacioANull(" +569 ")).toBe("+569");
        expect(vacioANull(650)).toBe("650");
    });

    it("instanteDesdeHoraChile convierte hora de Chile al instante real", () => {
        expect(instanteDesdeHoraChile("2026-10-19 16:33:51")?.toISOString()).toBe("2026-10-19T19:33:51.000Z");
        expect(instanteDesdeHoraChile("2026-07-15 10:00:00")?.toISOString()).toBe("2026-07-15T14:00:00.000Z");
        expect(instanteDesdeHoraChile("2026-09-06 00:30:00")?.toISOString()).toBe("2026-09-06T04:30:00.000Z");
        expect(instanteDesdeHoraChile("19/10/2026 16:33")).toBeNull();
    });

    it("instanteDesdeHoraChile rechaza fechas imposibles", () => {
        expect(instanteDesdeHoraChile("2026-13-01 10:00:00")).toBeNull();
        expect(instanteDesdeHoraChile("2026-02-31 10:00:00")).toBeNull();
        expect(instanteDesdeHoraChile("2026-10-19 25:00:00")).toBeNull();
    });
});
