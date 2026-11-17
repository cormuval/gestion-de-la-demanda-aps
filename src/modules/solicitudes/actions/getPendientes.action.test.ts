import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: { solicitud: { findMany: vi.fn() }, cita: { findMany: vi.fn() } }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getPendientes } from "./getPendientes.action";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", centro_nombre: "CESFAM", rol: { id: 2, nombre: "Orientador" } });
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
    (prisma.cita.findMany as any).mockResolvedValue([{ id_cita: "CITA-1", estado_cita: "Sin llamadas" }]);
});

describe("getPendientes", () => {
    it("consulta citas pendientes desde Cita con estados pendientes", async () => {
        const r = await getPendientes("12.345.678-9");
        expect(r).toEqual({
            ok: true,
            data: {
                solicitudesPendientes: [],
                citasPendientes: [{ id_cita: "CITA-1", estado_cita: "Sin llamadas" }]
            }
        });
        const arg = (prisma.cita.findMany as any).mock.calls[0][0];
        expect(arg.where.estado_cita.in).toContain("Sin llamadas");
    });

    it("selecciona cascada completa sin cargar funcionarios completos", async () => {
        await getPendientes("12.345.678-9");
        const solicitud = (prisma.solicitud.findMany as any).mock.calls[0][0];
        const cita = (prisma.cita.findMany as any).mock.calls[0][0];
        expect(solicitud.include).toBeUndefined();
        expect(solicitud.select).toEqual(expect.objectContaining({ tipo_solicitud_id: true, motivo_id: true, centro_id: true }));
        expect(solicitud.select.citas.where).toBeUndefined();
        expect(solicitud.select.citas.select.gestor).toEqual({ select: { nombre: true } });
        expect(solicitud.select.citas.select.llamadas.select.comunicador).toEqual({ select: { nombre: true } });
        expect(cita.where).toEqual({ rut_usuario: "12345678-9", estado_cita: { in: ["Sin llamadas", "No contesta (1)", "No contesta (2)", "Solo llamada de aviso"] } });
    });

    it("devuelve exitosamente pendientes vacios", async () => {
        (prisma.cita.findMany as any).mockResolvedValue([]);

        await expect(getPendientes("12.345.678-9")).resolves.toEqual({
            ok: true,
            data: { solicitudesPendientes: [], citasPendientes: [] }
        });
    });

    it("devuelve un error esperado cuando el RUT es requerido", async () => {
        await expect(getPendientes("   ")).resolves.toEqual({ ok: false, error: "rutUsuario es requerido" });
        expect(prisma.solicitud.findMany).not.toHaveBeenCalled();
        expect(prisma.cita.findMany).not.toHaveBeenCalled();
    });

    it("propaga el rechazo cuando falta el permiso", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(getPendientes("12.345.678-9")).rejects.toThrow("No tienes permiso para esta operacion");
        expect(prisma.cita.findMany).not.toHaveBeenCalled();
    });

    it("propaga el rechazo de Prisma", async () => {
        (prisma.solicitud.findMany as any).mockRejectedValue(new Error("Base de datos no disponible"));

        await expect(getPendientes("12.345.678-9")).rejects.toThrow("Base de datos no disponible");
    });
});
