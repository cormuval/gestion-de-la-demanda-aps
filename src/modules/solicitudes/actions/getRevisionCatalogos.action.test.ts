import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        funcionario: { findUnique: vi.fn() },
        tipoSolicitud: { findMany: vi.fn() },
        motivo: { findMany: vi.fn() },
        profesional: { findMany: vi.fn() },
        prestacion: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { getRevisionCatalogos } from "./getRevisionCatalogos.action";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermiso).mockResolvedValue({ rut: "22.222.222-2", centro_id: "650" } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    vi.mocked(prisma.tipoSolicitud.findMany).mockResolvedValue([]);
    vi.mocked(prisma.motivo.findMany).mockResolvedValue([]);
    vi.mocked(prisma.profesional.findMany).mockResolvedValue([]);
    vi.mocked(prisma.prestacion.findMany).mockResolvedValue([]);
});

describe("getRevisionCatalogos", () => {
    it("devuelve catalogos vacios como exito", async () => {
        await expect(getRevisionCatalogos()).resolves.toEqual({
            ok: true,
            data: { tiposSolicitud: [], motivos: [], profesionales: [], prestaciones: [], centros: [] }
        });
    });

    it("incluye tipos y motivos inactivos para filtrar solicitudes como Atencion Sapu o Contrarreferencia", async () => {
        await getRevisionCatalogos();

        expect(vi.mocked(prisma.tipoSolicitud.findMany).mock.calls[0][0]?.where).toBeUndefined();
        expect(vi.mocked(prisma.motivo.findMany).mock.calls[0][0]?.where).toBeUndefined();
    });

    it("devuelve error de configuracion cuando el funcionario no tiene centro", async () => {
        vi.mocked(requirePermiso).mockResolvedValueOnce({ rut: "22.222.222-2", centro_id: null } as never);
        vi.mocked(prisma.funcionario.findUnique).mockResolvedValueOnce(null);

        await expect(getRevisionCatalogos()).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
        expect(prisma.tipoSolicitud.findMany).not.toHaveBeenCalled();
    });

    it("mantiene los errores de permiso como rechazos", async () => {
        vi.mocked(requirePermiso).mockRejectedValueOnce(new Error("Sin permiso"));

        await expect(getRevisionCatalogos()).rejects.toThrow("Sin permiso");
    });

    it("mantiene los errores de Prisma como rechazos", async () => {
        vi.mocked(prisma.tipoSolicitud.findMany).mockRejectedValueOnce(new Error("DB caida"));

        await expect(getRevisionCatalogos()).rejects.toThrow("DB caida");
    });
});
