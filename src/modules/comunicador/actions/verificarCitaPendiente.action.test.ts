import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        cita: { findFirst: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { verificarCitaPendiente } from "./verificarCitaPendiente.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "1-9",
        email: "c@x.cl",
        nombre: "Com",
        centro_id: "655",
        rol: { id: 3, nombre: "Comunicador" }
    });
});

describe("verificarCitaPendiente", () => {
    it("exige comunicador.llamar", async () => {
        await verificarCitaPendiente("CITA-1").catch(() => undefined);
        expect(requirePermiso).toHaveBeenCalledWith("comunicador.llamar");
    });

    it("sin centro devuelve el error estandar", async () => {
        (requirePermiso as any).mockResolvedValueOnce({ rut: "1-9", centro_id: null });

        await expect(verificarCitaPendiente("CITA-1")).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
        expect(prisma.cita.findFirst).not.toHaveBeenCalled();
    });

    it("pendiente cuando el estado esta en la cola", async () => {
        (prisma.cita.findFirst as any).mockResolvedValue({ estado_cita: "No contesta (1)" });

        await expect(verificarCitaPendiente("CITA-1")).resolves.toEqual({
            ok: true,
            data: { pendiente: true, estado: "No contesta (1)" }
        });
    });

    it("pendiente cuando no tiene estado registrado", async () => {
        (prisma.cita.findFirst as any).mockResolvedValue({ estado_cita: null });

        await expect(verificarCitaPendiente("CITA-1")).resolves.toEqual({
            ok: true,
            data: { pendiente: true, estado: null }
        });
    });

    it("cerrada devuelve pendiente false con su estado", async () => {
        (prisma.cita.findFirst as any).mockResolvedValue({ estado_cita: "Cita Aceptada" });

        await expect(verificarCitaPendiente("CITA-1")).resolves.toEqual({
            ok: true,
            data: { pendiente: false, estado: "Cita Aceptada" }
        });
    });

    it("inexistente en el centro", async () => {
        (prisma.cita.findFirst as any).mockResolvedValue(null);

        await expect(verificarCitaPendiente("CITA-1")).resolves.toEqual({
            ok: true,
            data: { pendiente: false, estado: null }
        });
        expect(prisma.cita.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id_cita: "CITA-1", centro_id: "655" } })
        );
    });
});
