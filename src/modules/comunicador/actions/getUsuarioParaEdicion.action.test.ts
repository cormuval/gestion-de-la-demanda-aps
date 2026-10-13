import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({ prisma: { usuario: { findUnique: vi.fn() } } }));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getUsuarioParaEdicion } from "./getUsuarioParaEdicion.action";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermiso).mockResolvedValue({ rut: "1-9", email: "comunicador@aps.cl", nombre: "Comunicador", centro_id: "501", rol: { id: 3, nombre: "Comunicador" } } as never);
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null);
});

describe("getUsuarioParaEdicion", () => {
    it("informa que el RUT es requerido sin consultar al paciente", async () => {
        await expect(getUsuarioParaEdicion("  ")).resolves.toEqual({ ok: false, error: "RUT usuario es requerido" });
        expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it("informa un RUT invalido sin consultar al paciente", async () => {
        await expect(getUsuarioParaEdicion("12.345.678-9")).resolves.toEqual({ ok: false, error: "RUT invalido" });
        expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it("mantiene al paciente inexistente como una lectura exitosa", async () => {
        await expect(getUsuarioParaEdicion("12.345.678-5")).resolves.toEqual({ ok: true, data: { usuario: null } });
    });

    it("propaga los fallos de permisos", async () => {
        vi.mocked(requirePermiso).mockRejectedValue(new Error("No tienes permiso para esta operacion"));

        await expect(getUsuarioParaEdicion("12.345.678-5")).rejects.toThrow("No tienes permiso");
    });

    it("propaga los fallos de Prisma", async () => {
        vi.mocked(prisma.usuario.findUnique).mockRejectedValue(new Error("Base de datos no disponible"));

        await expect(getUsuarioParaEdicion("12.345.678-5")).rejects.toThrow("Base de datos no disponible");
    });
});
