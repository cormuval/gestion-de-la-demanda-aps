import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MODULES_ROOT = resolve(process.cwd(), "src/modules");

function listarActions(directorio: string): string[] {
    return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
        const ruta = join(directorio, entrada.name);

        if (entrada.isDirectory()) return listarActions(ruta);
        if (basename(directorio) !== "actions" || !entrada.name.endsWith(".action.ts")) return [];

        return [ruta];
    });
}

describe("ResultadoAccion en Server Actions", () => {
    it("impide reintroducir throw new Error en actions de modulos", () => {
        const infracciones = listarActions(MODULES_ROOT)
            .filter((ruta) => readFileSync(ruta, "utf8").includes("throw new Error"))
            .map((ruta) => relative(process.cwd(), ruta).replaceAll("\\", "/"));

        expect(infracciones, `Actions con throw new Error:\n${infracciones.join("\n")}`).toEqual([]);
    });
});
