import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        tipoSolicitud: { findMany: vi.fn() },
        motivo: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/auth", () => ({
    requireSessionUser: vi.fn()
}));

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { getCatalogos } from "./getCatalogos.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ centro_id: "650" });
    (prisma.$queryRaw as any).mockResolvedValue([{ nombre_centro: "Centro De Salud Familiar Esperanza" }]);
    (prisma.tipoSolicitud.findMany as any).mockResolvedValue([]);
    (prisma.motivo.findMany as any).mockResolvedValue([]);
});

describe("getCatalogos", () => {
    it("filtra tipos por estado 1 y columna del centro en 1", async () => {
        await getCatalogos();

        expect(prisma.tipoSolicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { estado: "1", esperanza: "1" }
            })
        );
    });

    it("lista solo motivos activos", async () => {
        await getCatalogos();

        expect(prisma.motivo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { estado: "1" }
            })
        );
    });
});
