import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
    $queryRaw: vi.fn(),
    cita: { findUnique: vi.fn(), update: vi.fn() }
};

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $transaction: vi.fn(async (callback: any) => callback(tx)),
        funcionario: { findUnique: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { editarCita } from "./editarCita.action";

const fechaValida = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "gestor@demo.local",
        nombre: "Gestor",
        centro_id: "650",
        rol: { id: 2, nombre: "Gestor" }
    });
    tx.$queryRaw.mockResolvedValue([{ id_cita: "CITA-1" }]);
    tx.cita.findUnique.mockResolvedValue({
        id_cita: "CITA-1",
        centro_id: "650",
        estado_cita: "Sin llamadas",
        priorizacion_clinica: "Alta",
        priorizacion: 70,
        fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
        usuario: { priorizacion_administrativa: 10 },
        _count: { llamadas: 0 }
    });
    tx.cita.update.mockResolvedValue({
        id_cita: "CITA-1",
        priorizacion_clinica: "Media",
        priorizacion: 50,
        fecha_estimada_atencion: new Date(`${fechaValida}T00:00:00`)
    });
});

describe("editarCita", () => {
    it("rechaza permiso faltante", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(editarCita({} as never)).rejects.toThrow("No tienes permiso");
    });

    it("actualiza cita editable recalculando priorizacion", async () => {
        const result = await editarCita({ id_cita: "CITA-1", priorizacion_clinica: "Media", fecha_estimada_atencion: fechaValida });

        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(tx.cita.findUnique).toHaveBeenCalledTimes(1);
        const lockQuery = tx.$queryRaw.mock.calls[0][0].join("");
        expect(lockQuery).toContain("FOR UPDATE");
        expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.cita.findUnique.mock.invocationCallOrder[0]);
        expect(tx.cita.update).toHaveBeenCalledWith({
            where: { id_cita: "CITA-1" },
            data: {
                priorizacion_clinica: "Media",
                fecha_estimada_atencion: expect.any(Date),
                priorizacion: 50
            },
            select: {
                id_cita: true,
                priorizacion_clinica: true,
                priorizacion: true,
                fecha_estimada_atencion: true
            }
        });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("UPDATE", true, { id: "gestor@demo.local", name: "Gestor", rut: "22.222.222-2" }, "CITA-1", {
            details: expect.stringContaining("Cita editada")
        });
        expect(result).toEqual({
            ok: true,
            data: {
                id_cita: "CITA-1",
                priorizacion_clinica: "Media",
                priorizacion: 50,
                fecha_estimada_atencion: expect.any(Date)
            }
        });
    });

    it("bloquea cita inexistente u otro centro sin escribir", async () => {
        tx.cita.findUnique.mockResolvedValueOnce(null);
        await expect(editarCita({ id_cita: "CITA-X", priorizacion_clinica: "Media", fecha_estimada_atencion: fechaValida })).resolves.toEqual({
            ok: false,
            error: "La cita no existe o no pertenece a tu centro"
        });
        expect(tx.cita.update).not.toHaveBeenCalled();
    });

    it("bloquea cita de otro centro sin escribir", async () => {
        tx.cita.findUnique.mockResolvedValueOnce({
            id_cita: "CITA-OTRO-CENTRO",
            centro_id: "999",
            estado_cita: "Sin llamadas",
            priorizacion_clinica: "Alta",
            priorizacion: 70,
            fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
            usuario: { priorizacion_administrativa: 10 },
            _count: { llamadas: 0 }
        });

        await expect(editarCita({ id_cita: "CITA-OTRO-CENTRO", priorizacion_clinica: "Media", fecha_estimada_atencion: fechaValida })).resolves.toEqual({
            ok: false,
            error: "La cita no existe o no pertenece a tu centro"
        });
        expect(tx.cita.update).not.toHaveBeenCalled();
    });

    it("bloquea cita con llamadas registradas", async () => {
        tx.cita.findUnique.mockResolvedValueOnce({
            id_cita: "CITA-1",
            centro_id: "650",
            estado_cita: "Sin llamadas",
            priorizacion_clinica: "Alta",
            priorizacion: 70,
            fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
            usuario: { priorizacion_administrativa: 10 },
            _count: { llamadas: 1 }
        });
        await expect(editarCita({ id_cita: "CITA-1", priorizacion_clinica: "Baja", fecha_estimada_atencion: fechaValida })).resolves.toEqual({
            ok: false,
            error: "La cita ya tiene llamadas registradas y no se puede modificar"
        });
        expect(tx.cita.update).not.toHaveBeenCalled();
    });

    it("bloquea estado distinto de Sin llamadas", async () => {
        tx.cita.findUnique.mockResolvedValueOnce({
            id_cita: "CITA-1",
            centro_id: "650",
            estado_cita: "Solo llamada de aviso",
            priorizacion_clinica: "Alta",
            priorizacion: 70,
            fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
            usuario: { priorizacion_administrativa: 10 },
            _count: { llamadas: 0 }
        });
        const result = await editarCita({ id_cita: "CITA-1", priorizacion_clinica: "Baja", fecha_estimada_atencion: fechaValida });
        expect(result).toEqual({ ok: false, error: "La cita ya tiene llamadas registradas y no se puede modificar" });
        expect(tx.cita.update).not.toHaveBeenCalled();
    });

    it("bloquea fecha anterior a hoy antes de abrir transaccion", async () => {
        const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const result = await editarCita({ id_cita: "CITA-1", priorizacion_clinica: "Media", fecha_estimada_atencion: ayer });
        expect(result).toEqual({ ok: false, error: "La fecha estimada no puede ser anterior a hoy" });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
