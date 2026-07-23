import { describe, it, expect, vi, beforeEach } from "vitest";

const { cacheSpy } = vi.hoisted(() => ({ cacheSpy: vi.fn((fn: unknown) => fn) }));

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return { ...actual, cache: (fn: unknown) => cacheSpy(fn) };
});
vi.mock("@/shared/lib/prisma", () => ({ prisma: { role: { findUnique: vi.fn() } } }));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: vi.fn() }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn((destino: string) => {
        throw new Error(`REDIRECT:${destino}`);
    })
}));

import { getPermisosRol, requirePermiso, requirePermisoPagina } from "./permisos";
import { prisma } from "@/shared/lib/prisma";
import { getSessionUser } from "@/shared/lib/auth";

const usuario = {
    rut: "1-9",
    email: "o@x.cl",
    nombre: "Orientador",
    centro_id: "501",
    centro_nombre: "CESFAM",
    rol: { id: 2, nombre: "Orientador" }
};

beforeEach(() => {
    // No se usa vi.clearAllMocks(): cache() de React se invoca una sola vez al
    // cargar el modulo, antes del primer beforeEach, y el clear borraria ese
    // registro. Se limpian solo los mocks que cada test vuelve a configurar.
    (prisma.role.findUnique as any).mockClear();
    (getSessionUser as any).mockClear();
    (getSessionUser as any).mockResolvedValue(usuario);
    (prisma.role.findUnique as any).mockResolvedValue({
        estado: "Activo",
        permisos: [{ permiso: "solicitudes.ver" }, { permiso: "solicitudes.crear" }]
    });
});

describe("getPermisosRol", () => {
    it("devuelve las claves del rol", async () => {
        const permisos = await getPermisosRol(2);
        expect(permisos.has("solicitudes.ver")).toBe(true);
        expect(permisos.has("solicitudes.gestionar")).toBe(false);
    });

    it("descarta claves que ya no existen en el catalogo", async () => {
        (prisma.role.findUnique as any).mockResolvedValue({
            estado: "Activo",
            permisos: [{ permiso: "solicitudes.ver" }, { permiso: "modulo.borrado" }]
        });
        const permisos = await getPermisosRol(2);
        expect(permisos.size).toBe(1);
        expect(permisos.has("solicitudes.ver")).toBe(true);
    });

    it("trata un rol inactivo como sin permisos", async () => {
        (prisma.role.findUnique as any).mockResolvedValue({
            estado: "Inactivo",
            permisos: [{ permiso: "solicitudes.ver" }]
        });
        const permisos = await getPermisosRol(2);
        expect(permisos.size).toBe(0);
    });

    it("trata un rol inexistente como sin permisos", async () => {
        (prisma.role.findUnique as any).mockResolvedValue(null);
        const permisos = await getPermisosRol(99);
        expect(permisos.size).toBe(0);
    });

    it("envuelve la lectura con cache() de React", () => {
        expect(cacheSpy).toHaveBeenCalledTimes(1);
    });
});

describe("requirePermiso", () => {
    it("devuelve el usuario cuando tiene el permiso", async () => {
        const user = await requirePermiso("solicitudes.ver");
        expect(user.rut).toBe("1-9");
    });

    it("acepta cuando tiene al menos uno de los permisos pedidos", async () => {
        const user = await requirePermiso("solicitudes.gestionar", "solicitudes.crear");
        expect(user.rut).toBe("1-9");
    });

    it("lanza cuando no tiene ninguno de los permisos", async () => {
        await expect(requirePermiso("config.roles")).rejects.toThrow("No tienes permiso para esta operacion");
    });

    it("lanza cuando no hay sesion", async () => {
        (getSessionUser as any).mockResolvedValue(null);
        await expect(requirePermiso("solicitudes.ver")).rejects.toThrow("No autenticado");
    });
});

describe("requirePermisoPagina", () => {
    it("redirige a /sin-acceso cuando falta el permiso", async () => {
        await expect(requirePermisoPagina("config.roles")).rejects.toThrow("REDIRECT:/sin-acceso");
    });

    it("redirige al login cuando no hay sesion", async () => {
        (getSessionUser as any).mockResolvedValue(null);
        await expect(requirePermisoPagina("solicitudes.ver")).rejects.toThrow("REDIRECT:/auth/login");
    });

    it("devuelve el usuario cuando tiene el permiso", async () => {
        const user = await requirePermisoPagina("solicitudes.ver");
        expect(user.nombre).toBe("Orientador");
    });
});
