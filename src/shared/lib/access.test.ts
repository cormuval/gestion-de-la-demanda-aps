import { describe, it, expect } from "vitest";
import { puedeAccederComunicador } from "./access";

describe("puedeAccederComunicador", () => {
    it("permite roles con menú comunicador", () => {
        for (const rol of ["Administrador", "Comunicador", "SOME", "Orientador y Comunicador", "Gestor y Comunicador", "Full"]) {
            expect(puedeAccederComunicador(rol)).toBe(true);
        }
    });
    it("rechaza roles sin acceso", () => {
        expect(puedeAccederComunicador("Orientador")).toBe(false);
        expect(puedeAccederComunicador("")).toBe(false);
    });
});
