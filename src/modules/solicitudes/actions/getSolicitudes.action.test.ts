import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        funcionario: { findUnique: vi.fn() },
        solicitud: {
            findMany: vi.fn(),
            count: vi.fn()
        }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { getSolicitudes } from "./getSolicitudes.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "o@demo.local",
        nombre: "Orientador",
        centro_id: "650",
        centro_nombre: "CESFAM",
        rol: { id: 2, nombre: "Orientador" }
    });
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
    (prisma.solicitud.count as any).mockResolvedValue(0);
    (prisma.$queryRaw as any).mockResolvedValue([]);
});

describe("getSolicitudes", () => {
    it("filtra solicitudes pendientes del centro y pagina desde la base", async () => {
        const result = await getSolicitudes({ rut: "12.345.678-5", tipoSolicitudId: "3", motivoId: "9", sector: "Sector 1", fechaDesde: "2026-07-01", fechaHasta: "2026-07-31", page: 2 });

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    accion: "En espera de validación",
                    estado_solicitud: "En Curso",
                    centro_id: "650",
                    rut_usuario: "12345678-5",
                    tipo_solicitud_id: 3,
                    motivo_id: 9,
                    usuario: { sector: { contains: "Sector 1" } }
                }),
                orderBy: [{ priorizacion_admin: "desc" }, { fecha_inicio: "asc" }],
                take: 100,
                skip: 100
            })
        );
        expect(prisma.solicitud.count).toHaveBeenCalledWith({
            where: expect.objectContaining({ accion: "En espera de validación", centro_id: "650" })
        });
        expect(result).toEqual({ ok: true, data: { solicitudes: [], total: 0, page: 2, pageSize: 100, totalPages: 1 } });
    });

    it("usa el centro del funcionario si no viene en la sesion", async () => {
        (requirePermiso as any).mockResolvedValue({
            rut: "22.222.222-2",
            email: "o@demo.local",
            nombre: "Orientador",
            centro_id: null,
            centro_nombre: "CESFAM",
            rol: { id: 2, nombre: "Orientador" }
        });
        (prisma.funcionario.findUnique as any).mockResolvedValue({ centro_id: "610" });

        await getSolicitudes();

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ centro_id: "610" }) }));
    });

    it("filtra edad con consulta numerica paginada desde la base", async () => {
        (prisma.$queryRaw as any)
            .mockResolvedValueOnce([{ id_solicitud: "SOL-1" }])
            .mockResolvedValueOnce([{ total: BigInt(1) }]);
        (prisma.solicitud.findMany as any).mockResolvedValue([{ id_solicitud: "SOL-1" }]);

        const result = await getSolicitudes({ edadDesde: "60", edadHasta: "80" });

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id_solicitud: { in: ["SOL-1"] } }
            })
        );
        expect(result).toEqual({
            ok: true,
            data: { solicitudes: [{ id_solicitud: "SOL-1" }], total: 1, page: 1, pageSize: 100, totalPages: 1 }
        });
    });

    it("devuelve listas vacias como exito", async () => {
        await expect(getSolicitudes()).resolves.toEqual({
            ok: true,
            data: { solicitudes: [], total: 0, page: 1, pageSize: 100, totalPages: 1 }
        });
    });

    it("devuelve error de configuracion cuando el funcionario no tiene centro", async () => {
        (requirePermiso as any).mockResolvedValueOnce({
            rut: "22.222.222-2",
            email: "o@demo.local",
            nombre: "Orientador",
            centro_id: null
        });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce({ centro_id: null });

        await expect(getSolicitudes()).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
        expect(prisma.solicitud.findMany).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("mantiene los errores de permiso como rechazos", async () => {
        (requirePermiso as any).mockRejectedValueOnce(new Error("Sin permiso"));

        await expect(getSolicitudes()).rejects.toThrow("Sin permiso");
    });

    it("mantiene los errores de Prisma como rechazos", async () => {
        (prisma.solicitud.findMany as any).mockRejectedValueOnce(new Error("DB caida"));

        await expect(getSolicitudes()).rejects.toThrow("DB caida");
    });
});
