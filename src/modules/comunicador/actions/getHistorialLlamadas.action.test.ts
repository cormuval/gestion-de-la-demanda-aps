import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        llamada: { findMany: vi.fn() },
        funcionario: { findMany: vi.fn() },
        cita: { findUnique: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getHistorialLlamadas } from "./getHistorialLlamadas.action";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" } });
    (prisma.cita.findUnique as any).mockResolvedValue({ centro_id: "501" });
});

describe("getHistorialLlamadas", () => {
    it("informa el problema de configuracion cuando el funcionario no tiene centro", async () => {
        (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: null, rol: { id: 3, nombre: "Comunicador" } });

        await expect(getHistorialLlamadas("CITA-1")).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
        expect(prisma.cita.findUnique).not.toHaveBeenCalled();
    });

    it("propaga el rechazo cuando falta el permiso", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(getHistorialLlamadas("CITA-1")).rejects.toThrow("No tienes permiso");
        expect(prisma.cita.findUnique).not.toHaveBeenCalled();
    });

    it("mapea las llamadas y resuelve el nombre del comunicador", async () => {
        (prisma.llamada.findMany as any).mockResolvedValue([
            { id_llamada: "LLAM-2", fecha_llamada: new Date("2026-07-19T10:00:00"), respuesta_usuario: "No contesta", observacion: "no atiende", rut_comunicador: "5-5" }
        ]);
        (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "5-5", nombre: "Ana" }]);
        const r = await getHistorialLlamadas("CITA-1");
        expect(r).toEqual({ ok: true, data: [
            { id_llamada: "LLAM-2", fecha_llamada: new Date("2026-07-19T10:00:00"), respuesta_usuario: "No contesta", observacion: "no atiende", comunicador: "Ana" }
        ] });
    });

    it("devuelve lista vacía cuando no hay llamadas", async () => {
        (prisma.llamada.findMany as any).mockResolvedValue([]);
        (prisma.funcionario.findMany as any).mockResolvedValue([]);
        const r = await getHistorialLlamadas("CITA-1");
        expect(r).toEqual({ ok: true, data: [] });
    });

    it("consulta filtrando por cita y ordenada por fecha_llamada desc", async () => {
        (prisma.llamada.findMany as any).mockResolvedValue([]);
        (prisma.funcionario.findMany as any).mockResolvedValue([]);
        await getHistorialLlamadas("CITA-1");
        const arg = (prisma.llamada.findMany as any).mock.calls[0][0];
        expect(arg.where).toEqual({ cita_id: "CITA-1" });
        expect(arg.orderBy).toEqual({ fecha_llamada: "desc" });
    });

    it("resuelve varios comunicadores y maneja rut nulo o no encontrado", async () => {
        (prisma.llamada.findMany as any).mockResolvedValue([
            { id_llamada: "LLAM-1", fecha_llamada: new Date("2026-07-19T10:00:00"), respuesta_usuario: "No contesta", observacion: null, rut_comunicador: "5-5" },
            { id_llamada: "LLAM-2", fecha_llamada: new Date("2026-07-18T09:00:00"), respuesta_usuario: "No contesta", observacion: null, rut_comunicador: "9-9" },
            { id_llamada: "LLAM-3", fecha_llamada: new Date("2026-07-17T08:00:00"), respuesta_usuario: "No contesta", observacion: null, rut_comunicador: null }
        ]);
        (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "5-5", nombre: "Ana" }]);
        const r = await getHistorialLlamadas("CITA-1");
        expect(r).toEqual({ ok: true, data: [
            expect.objectContaining({ comunicador: "Ana" }),
            expect.objectContaining({ comunicador: "9-9" }),
            expect.objectContaining({ comunicador: null })
        ] });
    });

    it("informa una cita inexistente o ajena al centro", async () => {
        (prisma.cita.findUnique as any).mockResolvedValue({ centro_id: "999" });
        await expect(getHistorialLlamadas("CITA-X")).resolves.toEqual({ ok: false, error: "La cita no pertenece a tu centro" });

        (prisma.cita.findUnique as any).mockResolvedValue(null);
        await expect(getHistorialLlamadas("CITA-X")).resolves.toEqual({ ok: false, error: "La cita no pertenece a tu centro" });
    });
});
