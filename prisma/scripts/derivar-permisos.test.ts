import { describe, it, expect } from "vitest";
import { derivarPermisos } from "./derivar-permisos";

describe("derivarPermisos", () => {
    it("deriva solicitudes desde el menu", () => {
        const permisos = derivarPermisos("Comunicador", ["/solicitudes/ingresar"]);
        expect(permisos).toContain("solicitudes.ver");
        expect(permisos).toContain("solicitudes.crear");
        expect(permisos).not.toContain("solicitudes.gestionar");
    });

    it("agrega gestionar a los roles de la lista legada de solicitudes", () => {
        const permisos = derivarPermisos("Orientador", ["/solicitudes/ingresar"]);
        expect(permisos).toContain("solicitudes.gestionar");
    });

    it("deriva comunicador completo desde el menu", () => {
        const permisos = derivarPermisos("Comunicador", ["/comunicador"]);
        expect(permisos).toEqual(expect.arrayContaining(["comunicador.ver", "comunicador.llamar", "comunicador.paciente"]));
    });

    it("otorga comunicador a un rol de la lista legada aunque no tenga menu", () => {
        const permisos = derivarPermisos("Gestor y Comunicador", []);
        expect(permisos).toContain("comunicador.ver");
    });

    it("deriva dashboard y configuracion desde el menu", () => {
        const permisos = derivarPermisos("Comunicador", ["/dashboard", "/configuracion/usuarios-roles"]);
        expect(permisos).toContain("dashboard.ver");
        expect(permisos).toContain("config.ver");
        expect(permisos).not.toContain("config.roles");
    });

    it("da configuracion completa a los roles de la lista legada aunque no tengan menu (caso Full)", () => {
        const permisos = derivarPermisos("Full", []);
        expect(permisos).toEqual(expect.arrayContaining(["config.ver", "config.funcionarios", "config.roles", "config.catalogos"]));
    });

    it("devuelve vacio para un rol sin menu ni listas legadas", () => {
        expect(derivarPermisos("Rol Nuevo", [])).toEqual([]);
    });

    it("no repite claves cuando menu y listas legadas coinciden", () => {
        const permisos = derivarPermisos("Administrador", ["/solicitudes/ingresar", "/comunicador", "/dashboard", "/configuracion/usuarios-roles"]);
        expect(new Set(permisos).size).toBe(permisos.length);
    });
});
