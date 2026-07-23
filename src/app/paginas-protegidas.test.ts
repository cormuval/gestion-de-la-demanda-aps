import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(process.cwd(), "src/app/(app)");

// Paginas que legitimamente no llevan guard de permiso.
const SIN_GUARD = ["sin-acceso"];

function buscarPaginas(directorio: string): string[] {
    const encontrados: string[] = [];
    for (const entrada of readdirSync(directorio)) {
        const ruta = join(directorio, entrada);
        if (statSync(ruta).isDirectory()) {
            encontrados.push(...buscarPaginas(ruta));
        } else if (entrada === "page.tsx") {
            encontrados.push(ruta);
        }
    }
    return encontrados;
}

describe("paginas protegidas", () => {
    const paginas = buscarPaginas(RAIZ);

    it("encuentra las paginas del grupo (app)", () => {
        expect(paginas.length).toBeGreaterThan(0);
    });

    it("toda pagina llama a requirePermisoPagina", () => {
        const sinGuard = paginas.filter((ruta) => {
            const relativa = ruta.slice(RAIZ.length + 1);
            if (SIN_GUARD.some((permitida) => relativa.startsWith(permitida))) return false;
            return !readFileSync(ruta, "utf8").includes("requirePermisoPagina");
        });
        expect(sinGuard, `Paginas sin guard de permiso: ${sinGuard.join(", ")}`).toEqual([]);
    });

    it("ninguna pagina del grupo (app) es componente cliente", () => {
        const clientes = paginas.filter((ruta) => readFileSync(ruta, "utf8").trimStart().startsWith('"use client"'));
        expect(clientes, `Paginas cliente sin guard server: ${clientes.join(", ")}`).toEqual([]);
    });
});
