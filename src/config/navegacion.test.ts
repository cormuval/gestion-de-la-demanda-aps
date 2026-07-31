import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NAV, navVisible } from "./navegacion";
import { CLAVES_PERMISOS, type Permiso } from "./permisos";

describe("navegacion", () => {
    it("usa solo permisos del catalogo", () => {
        for (const item of NAV) {
            expect(CLAVES_PERMISOS).toContain(item.permiso);
        }
    });

    it("apunta a rutas que existen como pagina", () => {
        for (const item of NAV) {
            const ruta = join(process.cwd(), "src/app/(app)", item.href, "page.tsx");
            expect(existsSync(ruta), `Falta la pagina para ${item.href}`).toBe(true);
        }
    });

    it("no repite rutas", () => {
        const hrefs = NAV.map((item) => item.href);
        expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it("navVisible filtra por los permisos entregados", () => {
        const visibles = navVisible(["comunicador.ver"] as Permiso[]);
        expect(visibles.map((item) => item.href)).toEqual(["/comunicador"]);
    });

    it("muestra SOME cuando el rol tiene permiso some.ver", () => {
        const visibles = navVisible(["some.ver"] as Permiso[]);
        expect(visibles.map((item) => item.href)).toEqual(["/some"]);
    });

    it("navVisible devuelve vacio sin permisos", () => {
        expect(navVisible([])).toEqual([]);
    });
});
