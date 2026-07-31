import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const RAIZ = join(process.cwd(), "src/app/(app)");

// Paginas que legitimamente no llevan guard de permiso.
const SIN_GUARD = ["sin-acceso"];

// Exige una llamada real (no basta con importar el simbolo o mencionarlo en un comentario).
const LLAMADA_GUARD = /requirePermisoPagina\s*\(/;

// Acepta la directiva de cliente con comillas simples o dobles.
const USE_CLIENT = /^["']use client["']/;

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
            const primerSegmento = relativa.split(sep)[0];
            if (SIN_GUARD.includes(primerSegmento)) return false;
            return !LLAMADA_GUARD.test(readFileSync(ruta, "utf8"));
        });
        expect(sinGuard, `Paginas sin guard de permiso: ${sinGuard.join(", ")}`).toEqual([]);
    });

    it("ninguna pagina del grupo (app) es componente cliente", () => {
        const clientes = paginas.filter((ruta) => USE_CLIENT.test(readFileSync(ruta, "utf8").trimStart()));
        expect(clientes, `Paginas cliente sin guard server: ${clientes.join(", ")}`).toEqual([]);
    });
});
