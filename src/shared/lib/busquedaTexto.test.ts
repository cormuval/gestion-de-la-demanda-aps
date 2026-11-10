import { describe, expect, it } from "vitest";
import { escaparTextoLike, textoBusquedaSchema } from "./busquedaTexto";

describe("textoBusquedaSchema", () => {
    it("recorta espacios y convierte ausencia en texto vacio", () => {
        expect(textoBusquedaSchema.parse("  control  ")).toBe("control");
        expect(textoBusquedaSchema.parse(undefined)).toBe("");
        expect(textoBusquedaSchema.parse("   ")).toBe("");
    });

    it("acepta 200 caracteres y rechaza 201 luego de recortar", () => {
        expect(textoBusquedaSchema.parse(` ${"a".repeat(200)} `)).toHaveLength(200);
        expect(textoBusquedaSchema.safeParse("a".repeat(201)).success).toBe(false);
    });
});

describe("escaparTextoLike", () => {
    it.each([
        ["50%_!", "!", "50!%!_!!"],
        ["50%_!", "\\", "50\\%\\_!"],
        ["ruta\\archivo", "\\", "ruta\\\\archivo"],
        ["ruta\\archivo", "!", "ruta\\archivo"],
        ["O'Brien ' OR 1=1 --", "!", "O'Brien ' OR 1=1 --"],
        ["control de presion", "!", "control de presion"],
        ["", "!", ""]
    ] as const)("escapa %s con %s sin agregar comodines", (texto, escape, esperado) => {
        expect(escaparTextoLike(texto, escape)).toBe(esperado);
    });
});
