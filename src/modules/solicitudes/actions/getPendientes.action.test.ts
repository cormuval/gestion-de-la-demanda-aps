import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: { solicitud: { findMany: vi.fn() }, cita: { findMany: vi.fn() } }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getPendientes } from "./getPendientes.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
    (prisma.cita.findMany as any).mockResolvedValue([{ id_cita: "CITA-1", estado_cita: "Sin llamadas" }]);
});

describe("getPendientes", () => {
    it("consulta citas pendientes desde Cita con estados pendientes", async () => {
        const r = await getPendientes("12.345.678-9");
        expect(r.citasPendientes).toHaveLength(1);
        const arg = (prisma.cita.findMany as any).mock.calls[0][0];
        expect(arg.where.estado_cita.in).toContain("Sin llamadas");
    });
});
