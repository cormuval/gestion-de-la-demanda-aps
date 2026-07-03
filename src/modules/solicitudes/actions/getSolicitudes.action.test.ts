import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        funcionario: { findUnique: vi.fn() },
        solicitud: {
            findMany: vi.fn(),
            count: vi.fn()
        }
    }
}));
vi.mock("@/shared/lib/auth", () => ({
    requireSessionUser: vi.fn()
}));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { getSolicitudes } from "./getSolicitudes.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "o@demo.local",
        nombre: "Orientador",
        centro_id: "650",
        rol: { id: 2, nombre: "Orientador" },
        menu: []
    });
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
    (prisma.solicitud.count as any).mockResolvedValue(0);
});

describe("getSolicitudes", () => {
    it("filtra solicitudes pendientes del centro y pagina desde la base", async () => {
        await getSolicitudes({ rut: "12.345.678-5", tipoSolicitudId: "3", motivoId: "9", fechaDesde: "2026-07-01", fechaHasta: "2026-07-31", page: 2 });

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    accion: "En espera de validación",
                    estado_solicitud: "En Curso",
                    centro_id: "650",
                    rut_usuario: "12345678-5",
                    tipo_solicitud_id: 3,
                    motivo_id: 9
                }),
                orderBy: [{ priorizacion_admin: "desc" }, { fecha_inicio: "asc" }],
                take: 100,
                skip: 100
            })
        );
        expect(prisma.solicitud.count).toHaveBeenCalledWith({
            where: expect.objectContaining({ accion: "En espera de validación", centro_id: "650" })
        });
    });

    it("usa el centro del funcionario si no viene en la sesion", async () => {
        (requireSessionUser as any).mockResolvedValue({
            rut: "22.222.222-2",
            email: "o@demo.local",
            nombre: "Orientador",
            centro_id: null,
            rol: { id: 2, nombre: "Orientador" },
            menu: []
        });
        (prisma.funcionario.findUnique as any).mockResolvedValue({ centro_id: "610" });

        await getSolicitudes();

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ centro_id: "610" }) }));
    });
});
