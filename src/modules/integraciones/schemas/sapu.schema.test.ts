import { describe, expect, it } from "vitest";

import { cargaSapuSchema, filaSapuSchema } from "./sapu.schema";

const fila = {
    id_solicitud: "SAPU BARON-615-1",
    fecha_inicio: "2026-10-20 22:59:00",
    paciente: { rut: "12345678-9", nombre: "Juan" },
    motivo_id: 56,
    descripcion: "Caso",
    centro_id: 615
};

describe("cargaSapuSchema", () => {
    it("rechaza no-arreglo, vacío y más de 500; acepta 500 filas cualesquiera", () => {
        expect(cargaSapuSchema.safeParse({ solicitudes: {} }).success).toBe(false);
        expect(cargaSapuSchema.safeParse({ solicitudes: [] }).success).toBe(false);
        expect(cargaSapuSchema.safeParse({ solicitudes: Array(501).fill(fila) }).success).toBe(false);
        expect(cargaSapuSchema.safeParse({ solicitudes: Array(500).fill({ basura: 1 }) }).success).toBe(true);
    });

    it("archivo: vacío → null y recortado a 150", () => {
        expect(cargaSapuSchema.parse({ archivo: "  ", solicitudes: [fila] }).archivo).toBeNull();
        expect(cargaSapuSchema.parse({ solicitudes: [fila] }).archivo).toBeNull();
        expect(cargaSapuSchema.parse({ archivo: "a".repeat(200), solicitudes: [fila] }).archivo).toHaveLength(150);
    });
});

describe("filaSapuSchema", () => {
    it("fecha Chile → instante real y centro número → texto", () => {
        const r = filaSapuSchema.parse(fila);
        expect(r.fecha_inicio.toISOString()).toBe("2026-10-21T01:59:00.000Z");
        expect(r.centro_id).toBe("615");
    });

    it("normaliza el RUT del paciente", () => {
        expect(filaSapuSchema.parse({ ...fila, paciente: { rut: "12.345.678-k" } }).paciente.rut).toBe("12345678-K");
        expect(filaSapuSchema.parse({ ...fila, paciente: { rut: " 12345678-5 " } }).paciente.rut).toBe("12345678-5");
    });

    it("nombre en blanco → null; nombre largo recortado a 50", () => {
        expect(filaSapuSchema.parse({ ...fila, paciente: { rut: "1-9", nombre: "  " } }).paciente.nombre).toBeNull();
        expect(filaSapuSchema.parse({ ...fila, paciente: { rut: "1-9", nombre: "n".repeat(80) } }).paciente.nombre).toHaveLength(50);
    });

    it("rechaza fecha imposible, centro vacío, motivo texto y rut vacío", () => {
        for (const malo of [
            { fecha_inicio: "2026-02-31 10:00:00" },
            { fecha_inicio: "20/10/2026" },
            { centro_id: "" },
            { centro_id: null },
            { motivo_id: "56" },
            { paciente: { rut: "" } }
        ]) {
            expect(filaSapuSchema.safeParse({ ...fila, ...malo }).success).toBe(false);
        }
    });
});
