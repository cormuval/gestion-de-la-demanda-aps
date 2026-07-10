import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
    cita: { findUnique: vi.fn(), update: vi.fn() },
    llamada: { count: vi.fn(), create: vi.fn() },
    solicitud: { update: vi.fn() }
};
vi.mock("@/shared/lib/prisma", () => ({
    prisma: { $transaction: vi.fn(async (cb: any) => cb(tx)) }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { registrarLlamada } from "./registrarLlamada.action";
import { requireSessionUser } from "@/shared/lib/auth";
import { RESPUESTA_LLAMADA } from "../types/comunicador";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
    tx.cita.findUnique.mockResolvedValue({ id_cita: "CITA-1", solicitud_id: "SOL-1", estado_cita: "Sin llamadas", centro_id: "501" });
    tx.llamada.count.mockResolvedValue(0);
    tx.cita.update.mockResolvedValue({});
    tx.llamada.create.mockResolvedValue({});
});

describe("registrarLlamada", () => {
    it("rechaza rol sin acceso", async () => {
        (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
        await expect(registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any)).rejects.toThrow("No tienes permiso");
    });

    it("primer No contesta -> estado 'No contesta (1)', no cierra solicitud", async () => {
        const r = await registrarLlamada({ cita_id: "CITA-1", respuesta: RESPUESTA_LLAMADA.NO_CONTESTA } as any);
        expect(r.estadoCita).toBe("No contesta (1)");
        expect(r.solicitudRealizada).toBe(false);
        expect(tx.solicitud.update).not.toHaveBeenCalled();
        const updateArg = tx.cita.update.mock.calls[0][0];
        expect(updateArg.data.estado_cita).toBe("No contesta (1)");
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
