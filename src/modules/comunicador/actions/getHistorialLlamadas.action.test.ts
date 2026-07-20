import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        llamada: { findMany: vi.fn() },
        funcionario: { findMany: vi.fn() },
        cita: { findUnique: vi.fn() }
    }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getHistorialLlamadas } from "./getHistorialLlamadas.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
    (prisma.cita.findUnique as any).mockResolvedValue({ centro_id: "501" });
});

describe("getHistorialLlamadas", () => {
    it("rechaza rol sin acceso al comunicador", async () => {
        (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
        await expect(getHistorialLlamadas("CITA-1")).rejects.toThrow("No tienes permiso");
    });

    it("mapea las llamadas y resuelve el nombre del comunicador", async () => {
        (prisma.llamada.findMany as any).mockResolvedValue([
            { id_llamada: "LLAM-2", fecha_llamada: new Date("2026-07-19T10:00:00"), respuesta_usuario: "No contesta", observacion: "no atiende", rut_comunicador: "5-5" }
        ]);
        (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "5-5", nombre: "Ana" }]);
        const r = await getHistorialLlamadas("CITA-1");
        expect(r).toEqual([
            { id_llamada: "LLAM-2", fecha_llamada: new Date("2026-07-19T10:00:00"), respuesta_usuario: "No contesta", observacion: "no atiende", comunicador: "Ana" }
        ]);
    });

    it("devuelve lista vacía cuando no hay llamadas", async () => {
        (prisma.llamada.findMany as any).mockResolvedValue([]);
        (prisma.funcionario.findMany as any).mockResolvedValue([]);
        const r = await getHistorialLlamadas("CITA-1");
        expect(r).toEqual([]);
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
        expect(r.map((x) => x.comunicador)).toEqual(["Ana", "9-9", null]);
    });

    it("rechaza una cita de otro centro", async () => {
        (prisma.cita.findUnique as any).mockResolvedValue({ centro_id: "999" });
        await expect(getHistorialLlamadas("CITA-X")).rejects.toThrow("La cita no pertenece a tu centro");
    });
});
