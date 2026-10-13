import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: { usuario: { findUnique: vi.fn() } }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getUsuarioPorRut } from "./getUsuarioPorRut.action";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermiso).mockResolvedValue({
        rut: "1-9",
        email: "o@x.cl",
        nombre: "Orientador",
        centro_id: "501",
        centro_nombre: "CESFAM",
        rol: { id: 2, nombre: "Orientador" }
    });
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null);
});

describe("getUsuarioPorRut", () => {
    it("devuelve un error esperado cuando el RUT es requerido", async () => {
        await expect(getUsuarioPorRut("   ")).resolves.toEqual({ ok: false, error: "RUT usuario es requerido" });
        expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it("devuelve un error esperado cuando el RUT es invalido", async () => {
        await expect(getUsuarioPorRut("12.345.678-4")).resolves.toEqual({ ok: false, error: "RUT invalido" });
        expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it("devuelve exitosamente un usuario inexistente", async () => {
        await expect(getUsuarioPorRut("12.345.678-5")).resolves.toEqual({ ok: true, data: { usuario: null } });
    });

    it("propaga el rechazo cuando falta el permiso", async () => {
        vi.mocked(requirePermiso).mockRejectedValue(new Error("No tienes permiso para esta operacion"));

        await expect(getUsuarioPorRut("12.345.678-5")).rejects.toThrow("No tienes permiso para esta operacion");
        expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it("propaga el rechazo de Prisma", async () => {
        vi.mocked(prisma.usuario.findUnique).mockRejectedValue(new Error("Base de datos no disponible"));

        await expect(getUsuarioPorRut("12.345.678-5")).rejects.toThrow("Base de datos no disponible");
    });
});
