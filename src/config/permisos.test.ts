import { describe, it, expect } from "vitest";
import { PERMISOS, CLAVES_PERMISOS, esPermiso, agruparPermisos } from "./permisos";

describe("catalogo de permisos", () => {
    it("expone una clave por permiso declarado", () => {
        expect(CLAVES_PERMISOS).toHaveLength(Object.keys(PERMISOS).length);
        expect(new Set(CLAVES_PERMISOS).size).toBe(CLAVES_PERMISOS.length);
    });

    it("usa el formato modulo.accion en todas las claves", () => {
        for (const clave of CLAVES_PERMISOS) {
            expect(clave).toMatch(/^[a-z]+\.[a-z_]+$/);
        }
    });

    it("incluye los permisos definidos en el diseno", () => {
        expect(CLAVES_PERMISOS).toContain("solicitudes.gestionar");
        expect(CLAVES_PERMISOS).toContain("comunicador.paciente");
        expect(CLAVES_PERMISOS).toContain("some.ver");
        expect(CLAVES_PERMISOS).toContain("config.roles");
        expect(CLAVES_PERMISOS).toContain("historial.ver");
    });

    it("esPermiso reconoce claves validas y rechaza el resto", () => {
        expect(esPermiso("solicitudes.ver")).toBe(true);
        expect(esPermiso("solicitudes.inventado")).toBe(false);
        expect(esPermiso("")).toBe(false);
    });

    it("agruparPermisos agrupa por modulo sin perder permisos", () => {
        const grupos = agruparPermisos();
        const total = grupos.reduce((acc, grupo) => acc + grupo.permisos.length, 0);
        expect(total).toBe(CLAVES_PERMISOS.length);
        expect(grupos.map((grupo) => grupo.modulo)).toContain("Solicitudes");
        const solicitudes = grupos.find((grupo) => grupo.modulo === "Solicitudes");
        expect(solicitudes?.permisos.map((permiso) => permiso.clave)).toContain("solicitudes.crear");
    });
});
