import { expect, it } from "vitest";
import { formatearFecha, formatearFechaHora, formatearFechaCalendario } from "./formatoFecha";

it("formatea fechas en Santiago y fechas calendario en UTC", () => {
    expect(formatearFecha(new Date("2025-12-30T15:00:00Z"))).toBe("30-12-2025");
    expect(formatearFechaHora(new Date("2026-01-15T13:45:00Z"))).toBe("15-01-2026 10:45");
    expect(formatearFechaHora("2026-07-10T03:05:00Z")).toBe("09-07-2026 23:05");
    expect(formatearFechaCalendario(new Date("2026-03-26T00:00:00Z"))).toBe("26-03-2026");
    expect(formatearFecha(null)).toBe("—");
    expect(formatearFechaHora(null)).toBe("—");
    expect(formatearFechaCalendario(null)).toBe("—");
});
