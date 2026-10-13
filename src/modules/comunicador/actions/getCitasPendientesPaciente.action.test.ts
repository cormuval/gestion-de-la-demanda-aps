import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: { cita: { findMany: vi.fn() }, llamada: { count: vi.fn() } }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/modules/solicitudes/utils/rut", () => ({ normalizarRut: (r: string) => r }));

import { getCitasPendientesPaciente } from "./getCitasPendientesPaciente.action";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" } });
    (prisma.cita.findMany as any).mockResolvedValue([]);
    (prisma.llamada.count as any).mockResolvedValue(0);
});

describe("getCitasPendientesPaciente", () => {
    it("informa el problema de configuracion cuando el funcionario no tiene centro", async () => {
        (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: null, rol: { id: 3, nombre: "Comunicador" } });

        await expect(getCitasPendientesPaciente("1-9", "CITA-ACTUAL")).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
        expect(prisma.cita.findMany).not.toHaveBeenCalled();
    });

    it("envuelve una lista vacia como lectura exitosa", async () => {
        await expect(getCitasPendientesPaciente("1-9", "CITA-ACTUAL")).resolves.toEqual({ ok: true, data: [] });
    });

    it("propaga los fallos de permisos y Prisma", async () => {
        (requirePermiso as any).mockRejectedValueOnce(new Error("No tienes permiso para esta operacion"));
        await expect(getCitasPendientesPaciente("1-9", "CITA-ACTUAL")).rejects.toThrow("No tienes permiso");

        (prisma.cita.findMany as any).mockRejectedValueOnce(new Error("Base de datos no disponible"));
        await expect(getCitasPendientesPaciente("1-9", "CITA-ACTUAL")).rejects.toThrow("Base de datos no disponible");
    });

    it("filtra por el rango de 'Agendamientos próximos' (hoy-15..hoy+30)", async () => {
        await getCitasPendientesPaciente("1-9", "CITA-ACTUAL");
        const where = (prisma.cita.findMany as any).mock.calls[0][0].where;
        expect(where.fecha_estimada_atencion).toBeDefined();
        expect(where.fecha_estimada_atencion.gte).toBeInstanceOf(Date);
        expect(where.fecha_estimada_atencion.lte).toBeInstanceOf(Date);
        const dias = (where.fecha_estimada_atencion.lte.getTime() - where.fecha_estimada_atencion.gte.getTime()) / (1000 * 60 * 60 * 24);
        expect(Math.round(dias)).toBe(45);
    });

    it("excluye la cita actual", async () => {
        await getCitasPendientesPaciente("1-9", "CITA-ACTUAL");
        const where = (prisma.cita.findMany as any).mock.calls[0][0].where;
        expect(where.id_cita).toEqual({ not: "CITA-ACTUAL" });
    });
});
