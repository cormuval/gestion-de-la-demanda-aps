import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: { cita: { findMany: vi.fn() }, llamada: { count: vi.fn() } }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/modules/solicitudes/utils/rut", () => ({ normalizarRut: (r: string) => r }));

import { getCitasPendientesPaciente } from "./getCitasPendientesPaciente.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
    (prisma.cita.findMany as any).mockResolvedValue([]);
    (prisma.llamada.count as any).mockResolvedValue(0);
});

describe("getCitasPendientesPaciente", () => {
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
