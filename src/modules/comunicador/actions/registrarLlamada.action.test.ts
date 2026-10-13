import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZodError } from "zod";

const tx = {
    $queryRaw: vi.fn(),
    cita: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    llamada: { count: vi.fn(), create: vi.fn() },
    solicitud: { update: vi.fn() }
};
vi.mock("@/shared/lib/prisma", () => ({
    prisma: { $transaction: vi.fn(async (cb: any) => cb(tx)) }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { registrarLlamada } from "./registrarLlamada.action";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { RESPUESTA_LLAMADA } from "../types/comunicador";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" } });
    tx.$queryRaw.mockResolvedValue([{ id_cita: "CITA-1" }]);
    tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", rut_usuario: "11.111.111-1", estado_cita: "Sin llamadas", centro_id: "501" });
    tx.llamada.count.mockResolvedValue(0);
    tx.cita.update.mockResolvedValue({});
    tx.cita.count.mockResolvedValue(0);
    tx.llamada.create.mockResolvedValue({});
});

describe("registrarLlamada", () => {
    it("propaga el rechazo cuando falta el permiso de llamar", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(registrarLlamada({} as any)).rejects.toThrow("No tienes permiso para esta operacion");
    });

    it("propaga el rechazo de Zod", async () => {
        await expect(registrarLlamada({} as any)).rejects.toBeInstanceOf(ZodError);
    });

    it("propaga fallos inesperados de Prisma", async () => {
        (prisma.$transaction as any).mockRejectedValueOnce(new Error("Base de datos no disponible"));

        await expect(registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).rejects.toThrow("Base de datos no disponible");
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("primer No contesta -> estado 'No contesta (1)', no cierra solicitud", async () => {
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any);
        expect(r).toEqual({ ok: true, data: { estadoCita: "No contesta (1)", solicitudRealizada: false } });
        expect(tx.solicitud.update).not.toHaveBeenCalled();
        const updateArg = tx.cita.update.mock.calls[0][0];
        expect(updateArg.data.estado_cita).toBe("No contesta (1)");
        expect(AuditLogger.logDataAccess).toHaveBeenCalledTimes(1);
    });

    it("bloquea la cita FOR UPDATE antes de leerla", async () => {
        await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any);

        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        const lockQuery = tx.$queryRaw.mock.calls[0][0].join("");
        expect(lockQuery).toContain("FOR UPDATE");
        expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.cita.findUnique.mock.invocationCallOrder[0]);
    });

    it("respuesta terminal que deja 0 citas pendientes -> cierra solicitud como Realizado", async () => {
        tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", rut_usuario: "11.111.111-1", estado_cita: "No contesta (2)", centro_id: "501" });
        tx.llamada.count.mockResolvedValue(0); // intentos previos
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.ACEPTADA, hora_agendada: "2026-08-01T10:00" } as any);
        expect(r).toEqual({ ok: true, data: { estadoCita: "Cita Aceptada", solicitudRealizada: true } });
        expect(tx.solicitud.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado_solicitud: "Realizado" } }));
    });

    it("respuesta terminal con citas pendientes restantes -> NO cierra solicitud", async () => {
        tx.cita.count.mockResolvedValue(2);
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE } as any);
        expect(r).toEqual({ ok: true, data: { estadoCita: "Cita Rechazada (Solicitante)", solicitudRealizada: false } });
        expect(tx.solicitud.update).not.toHaveBeenCalled();
    });

    it("devuelve error para una cita inexistente sin escribir ni auditar", async () => {
        tx.cita.findUnique.mockResolvedValue(null);
        await expect(registrarLlamada({ cita_id: "X", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).resolves.toEqual({ ok: false, error: "La cita no existe" });
        expect(tx.llamada.create).not.toHaveBeenCalled();
        expect(tx.cita.update).not.toHaveBeenCalled();
        expect(tx.solicitud.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("devuelve error para una cita de otro centro sin escribir ni auditar", async () => {
        tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", rut_usuario: "11.111.111-1", estado_cita: "Sin llamadas", centro_id: "999" });

        await expect(registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).resolves.toEqual({ ok: false, error: "La cita no pertenece a tu centro" });
        expect(tx.llamada.create).not.toHaveBeenCalled();
        expect(tx.cita.update).not.toHaveBeenCalled();
        expect(tx.solicitud.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("devuelve error para una cita cerrada sin escribir ni auditar", async () => {
        tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", rut_usuario: "11.111.111-1", estado_cita: "Cita Aceptada", centro_id: "501" });

        await expect(registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).resolves.toEqual({ ok: false, error: "La cita ya está cerrada" });
        expect(tx.llamada.create).not.toHaveBeenCalled();
        expect(tx.cita.update).not.toHaveBeenCalled();
        expect(tx.solicitud.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });
});
