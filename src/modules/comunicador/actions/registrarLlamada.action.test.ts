import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
    $queryRaw: vi.fn(),
    cita: { findUnique: vi.fn(), update: vi.fn() },
    llamada: { count: vi.fn(), create: vi.fn() },
    solicitud: { update: vi.fn() }
};
vi.mock("@/shared/lib/prisma", () => ({
    prisma: { $transaction: vi.fn(async (cb: any) => cb(tx)) }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { registrarLlamada } from "./registrarLlamada.action";
import { requirePermiso } from "@/shared/lib/permisos";
import { RESPUESTA_LLAMADA } from "../types/comunicador";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" } });
    tx.$queryRaw.mockResolvedValue([{ id_cita: "CITA-1" }]);
    tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", estado_cita: "Sin llamadas", centro_id: "501" });
    tx.llamada.count.mockResolvedValue(0);
    tx.cita.update.mockResolvedValue({});
    tx.llamada.create.mockResolvedValue({});
});

describe("registrarLlamada", () => {
    it("propaga el rechazo cuando falta el permiso de llamar", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(registrarLlamada({} as any)).rejects.toThrow("No tienes permiso para esta operacion");
    });

    it("primer No contesta -> estado 'No contesta (1)', no cierra solicitud", async () => {
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any);
        expect(r.estadoCita).toBe("No contesta (1)");
        expect(r.solicitudRealizada).toBe(false);
        expect(tx.solicitud.update).not.toHaveBeenCalled();
        const updateArg = tx.cita.update.mock.calls[0][0];
        expect(updateArg.data.estado_cita).toBe("No contesta (1)");
    });

    it("bloquea la cita FOR UPDATE antes de leerla", async () => {
        await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any);

        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        const lockQuery = tx.$queryRaw.mock.calls[0][0].join("");
        expect(lockQuery).toContain("FOR UPDATE");
        expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.cita.findUnique.mock.invocationCallOrder[0]);
    });

    it("respuesta terminal que deja 0 citas pendientes -> cierra solicitud como Realizado", async () => {
        tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", estado_cita: "No contesta (2)", centro_id: "501" });
        tx.llamada.count.mockResolvedValue(0); // intentos previos
        (tx.cita as any).count = vi.fn().mockResolvedValue(0); // citas pendientes restantes de la solicitud
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.ACEPTADA, hora_agendada: "2026-08-01T10:00" } as any);
        expect(r.estadoCita).toBe("Cita Aceptada");
        expect(r.solicitudRealizada).toBe(true);
        expect(tx.solicitud.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado_solicitud: "Realizado" } }));
    });

    it("respuesta terminal con citas pendientes restantes -> NO cierra solicitud", async () => {
        (tx.cita as any).count = vi.fn().mockResolvedValue(2);
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.RECHAZADA_SOLICITANTE } as any);
        expect(r.solicitudRealizada).toBe(false);
        expect(tx.solicitud.update).not.toHaveBeenCalled();
    });

    it("rechaza cita inexistente", async () => {
        tx.cita.findUnique.mockResolvedValue(null);
        await expect(registrarLlamada({ cita_id: "X", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).rejects.toThrow();
    });

    it("rechaza cita en estado terminal", async () => {
        tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", estado_cita: "Cita Aceptada", centro_id: "501" });
        await expect(registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).rejects.toThrow();
    });
});
