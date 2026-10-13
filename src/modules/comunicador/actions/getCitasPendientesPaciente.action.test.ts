import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: { cita: { findMany: vi.fn() } }
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

    it("no filtra por temporalidad: incluye citas atrasadas y futuras", async () => {
        await getCitasPendientesPaciente("1-9", "CITA-ACTUAL");
        const where = (prisma.cita.findMany as any).mock.calls[0][0].where;
        expect(where.fecha_estimada_atencion).toBeUndefined();
    });

    it("marca atrasadas las citas con fecha estimada anterior a hoy-15 y cuenta los 'No contesta'", async () => {
        const hace20 = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
        const en10 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        const base = { estado_cita: "Sin llamadas", priorizacion: 40, profesional: null, prestacion: null };
        (prisma.cita.findMany as any).mockResolvedValue([
            { ...base, id_cita: "VIEJA", fecha_estimada_atencion: hace20, _count: { llamadas: 1 } },
            { ...base, id_cita: "PROXIMA", fecha_estimada_atencion: en10, _count: { llamadas: 0 } },
            { ...base, id_cita: "SIN-FECHA", fecha_estimada_atencion: null, _count: { llamadas: 0 } }
        ]);

        const r = await getCitasPendientesPaciente("1-9", "CITA-ACTUAL");

        if (!r.ok) throw new Error(r.error);
        expect(r.data.map((c) => [c.id_cita, c.atrasada, c.intentos])).toEqual([
            ["VIEJA", true, 1],
            ["PROXIMA", false, 0],
            ["SIN-FECHA", false, 0]
        ]);
    });

    it("excluye la cita actual", async () => {
        await getCitasPendientesPaciente("1-9", "CITA-ACTUAL");
        const where = (prisma.cita.findMany as any).mock.calls[0][0].where;
        expect(where.id_cita).toEqual({ not: "CITA-ACTUAL" });
    });
});
