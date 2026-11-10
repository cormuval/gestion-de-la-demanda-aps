import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

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
import { limpiarDedupBusquedas } from "@/shared/lib/auditoriaBusquedas";
import { getSolicitudes } from "./getSolicitudes.action";

beforeEach(() => {
    vi.clearAllMocks();
    limpiarDedupBusquedas();
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
    it("busca descripcion literal normalizada en pagina y conteo conservando filtros y centro autorizado", async () => {
        await getSolicitudes({ texto: "  50%_!\\ O'Brien  ", centroId: "otro", estado: "Cerrada", rut: "12.345.678-5", tipoSolicitudId: "3", motivoId: "9", sector: "Sector 1", fechaDesde: "2026-07-01", fechaHasta: "2026-07-31", page: 2 });

        const where = {
            accion: "En espera de validación", estado_solicitud: "En Curso", centro_id: "650",
            descripcion: { contains: "50\\%\\_!\\\\ O'Brien" }, rut_usuario: "12345678-5", tipo_solicitud_id: 3, motivo_id: 9,
            usuario: { sector: { contains: "Sector 1" } },
            fecha_inicio: { gte: new Date("2026-07-01T00:00:00"), lte: new Date("2026-07-31T23:59:59") }
        };
        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 100, skip: 100 }));
        expect(prisma.solicitud.count).toHaveBeenCalledWith({ where });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("SEARCH", true, expect.anything(), "LISTADO_SOLICITUDES", {
            details: expect.stringContaining('"texto":"50%_!\\\\ O\'Brien"')
        });
    });

    it("parametriza descripcion literal en ambas consultas numericas sin interpolar comillas", async () => {
        const texto = "50%_!\\ ' OR 1=1 --";
        await getSolicitudes({ texto, edadDesde: "0", edadHasta: "80", centroId: "otro", rut: "12.345.678-5", tipoSolicitudId: "3", motivoId: "9", sector: "Sector 1", fechaDesde: "2026-07-01", fechaHasta: "2026-07-31", page: 2 });

        const queries = vi.mocked(prisma.$queryRaw).mock.calls.map(([strings, ...values]) => Prisma.sql(strings as TemplateStringsArray, ...values));
        expect(queries).toHaveLength(2);
        for (const query of queries) {
            expect(query.sql).toContain("s.descripcion LIKE ? ESCAPE '!'");
            expect(query.sql).toContain("CAST(s.ultimo_control AS UNSIGNED) >= ?");
            expect(query.sql).toContain("CAST(s.ultimo_control AS UNSIGNED) <= ?");
            expect(query.sql).not.toContain("OR 1=1");
            expect(query.values.slice(0, 3)).toEqual(["En espera de validación", "En Curso", "650"]);
            expect(query.values).toContain("%50!%!_!!\\ ' OR 1=1 --%");
            expect(query.values).toEqual(expect.arrayContaining(["12345678-5", 3, 9, "%Sector 1%", 0, 80, new Date("2026-07-01T00:00:00"), new Date("2026-07-31T23:59:59")]));
        }
        expect(queries[0].values.slice(-2)).toEqual([100, 100]);
        expect(queries[0].sql.split("WHERE ")[1].split("ORDER BY")[0].trim()).toBe(queries[1].sql.split("WHERE ")[1].trim());
    });

    it.each([undefined, "", "   "])("omite descripcion cuando el texto es vacio: %s", async (texto) => {
        await getSolicitudes({ texto });
        const args = vi.mocked(prisma.solicitud.findMany).mock.calls[0][0];
        expect(args?.where).not.toHaveProperty("descripcion");
    });

    it.each([{ texto: "a".repeat(201) }, { page: 0 }, { edadDesde: "abc" }, { fechaDesde: "2026-02-30" }])("rechaza filtros invalidos sin consultar BD: %j", async (filtros) => {
        vi.mocked(requirePermiso).mockResolvedValueOnce({
            rut: "22.222.222-2", email: "o@demo.local", nombre: "Orientador", centro_id: null,
            centro_nombre: null, rol: { id: 2, nombre: "Orientador" }
        });
        await expect(getSolicitudes(filtros)).resolves.toEqual({ ok: false, error: expect.any(String) });
        expect(prisma.funcionario.findUnique).not.toHaveBeenCalled();
        expect(prisma.solicitud.findMany).not.toHaveBeenCalled();
        expect(prisma.solicitud.count).not.toHaveBeenCalled();
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

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

    it("no repite el registro de auditoria si la misma busqueda se repite enseguida", async () => {
        await getSolicitudes({ rut: "12.345.678-5" });
        await getSolicitudes({ rut: "12.345.678-5" });

        expect(AuditLogger.logDataAccess).toHaveBeenCalledTimes(1);
    });

    it("registra la auditoria de nuevo si la misma busqueda se hace en otro centro", async () => {
        await getSolicitudes({ rut: "12.345.678-5" });
        (requirePermiso as any).mockResolvedValue({ rut: "22.222.222-2", email: "o@demo.local", nombre: "Orientador", centro_id: "655", centro_nombre: "CESFAM 2", rol: { id: 2, nombre: "Orientador" } });
        await getSolicitudes({ rut: "12.345.678-5" });

        expect(AuditLogger.logDataAccess).toHaveBeenCalledTimes(2);
    });

    it("registra la auditoria de nuevo si los filtros cambian", async () => {
        await getSolicitudes({ rut: "12.345.678-5" });
        await getSolicitudes({ rut: "98.765.432-1" });

        expect(AuditLogger.logDataAccess).toHaveBeenCalledTimes(2);
    });
});
