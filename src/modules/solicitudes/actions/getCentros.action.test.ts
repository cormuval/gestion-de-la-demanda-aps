import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn()
    }
}));
vi.mock("@/shared/lib/auth", () => ({
    requireSessionUser: vi.fn()
}));

import { prisma } from "@/shared/lib/prisma";
import { getCentros } from "./getCentros.action";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getCentros", () => {
    it("lista centros", async () => {
        (prisma.$queryRaw as any).mockResolvedValue([{ id_centro: "650", nombre_centro: "Centro De Salud Familiar Esperanza" }]);

        const centros = await getCentros();

        expect(centros).toEqual([{ id_centro: "650", nombre_centro: "Centro De Salud Familiar Esperanza" }]);
    });
});
