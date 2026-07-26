import { describe, expect, it } from "vitest";
import { acortarId } from "./acortarId";

describe("acortarId", () => {
    it("acorta un id SOL con UUID a prefijo + ultimos 5", () => {
        expect(acortarId("SOL-550e8400-e29b-41d4-a716-446655440000")).toBe("SOL-40000");
    });

    it("acorta un id CITA", () => {
        expect(acortarId("CITA-550e8400-e29b-41d4-a716-446655440000")).toBe("CITA-40000");
    });

    it("acorta un id LLAM", () => {
        expect(acortarId("LLAM-550e8400-e29b-41d4-a716-446655440000")).toBe("LLAM-40000");
    });

    it("acorta el id demo (por encima del umbral)", () => {
        expect(acortarId("SOL-DEMO-001")).toBe("SOL-O-001");
    });

    it("es idempotente sobre un id ya corto", () => {
        expect(acortarId("SOL-40000")).toBe("SOL-40000");
    });

    it("devuelve tal cual un id sin guion", () => {
        expect(acortarId("12345")).toBe("12345");
    });

    it("devuelve tal cual un id por debajo del umbral", () => {
        expect(acortarId("SOL-01")).toBe("SOL-01");
    });

    it("devuelve tal cual un id vacio", () => {
        expect(acortarId("")).toBe("");
    });
});
