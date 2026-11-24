// lib
import { describe, expect, it } from "vitest";
// utils
import { nombreCentroPublico } from "./nombreCentroPublico";

describe("nombreCentroPublico", () => {
    it.each([
        ["Centro De Salud FamiliarPlacilla (Valparaíso)", "CESFAM Placilla"],
        ["Centro De Salud FamiliarBarón", "CESFAM Barón"],
        ["Centro De Salud Familiar Esperanza", "CESFAM Esperanza"],
        ["Centro De Salud Familiar Las Cañas", "CESFAM Las Cañas"],
        ["Centro De Salud Familiar Rodelillo", "CESFAM Rodelillo"],
        ["Centro De Salud Familiar Padre Damián Molokai", "CESFAM Padre Damián Molokai"],
        ["Centro Comunitario De Salud Familiar Porvenir Bajo", "CECOSF Porvenir Bajo"],
        ["Centro Comunitario De Salud Familiar Juan Pablo II", "CECOSF Juan Pablo II"],
        ["Centro De Salud Familiar Laguna Verde", "CESFAM Laguna Verde"],
        ["Centro De Salud Familiar Puertas Negras", "CESFAM Puertas Negras"]
    ])("traduce el nombre de la base %s a %s", (nombre, esperado) => {
        expect(nombreCentroPublico(nombre)).toBe(esperado);
    });

    it.each([null, undefined, "", "   "])("devuelve null sin nombre utilizable: %j", (nombre) => {
        expect(nombreCentroPublico(nombre)).toBeNull();
    });

    it("conserva un nombre que no corresponde a un centro familiar", () => {
        expect(nombreCentroPublico("Centro de Salud Ambiente de Desarrollo")).toBe("Centro de Salud Ambiente de Desarrollo");
    });

    it("normaliza espacios sobrantes", () => {
        expect(nombreCentroPublico("  Centro   De Salud Familiar   Barón  ")).toBe("CESFAM Barón");
    });
});
