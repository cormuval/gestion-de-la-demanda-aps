import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        funcionario: { findUnique: vi.fn() },
        solicitud: { findFirst: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { verificarSolicitudPendiente } from "./verificarSolicitudPendiente.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "o@demo.local",
        nombre: "Gestor",
        centro_id: "655",
        centro_nombre: "CESFAM",
        rol: { id: 2, nombre: "Orientador" }
    });
});

describe("verificarSolicitudPendiente", () => {
    it("exige solicitudes.gestionar", async () => {
        await verificarSolicitudPendiente("SOL-1").catch(() => undefined);
        expect(requirePermiso).toHaveBeenCalledWith("solicitudes.gestionar");
    });

    it("pendiente cuando sigue en espera de validacion", async () => {
        (prisma.solicitud.findFirst as any).mockResolvedValue({ estado_solicitud: "En Curso", accion: "En espera de validación" });

        await expect(verificarSolicitudPendiente("SOL-1")).resolves.toEqual({
            ok: true,
            data: { pendiente: true, estado: "En Curso" }
        });
    });

    it("no pendiente cuando ya fue gestionada", async () => {
        (prisma.solicitud.findFirst as any).mockResolvedValue({ estado_solicitud: "Rechazado", accion: "Rechazar solicitud" });

        await expect(verificarSolicitudPendiente("SOL-1")).resolves.toEqual({
            ok: true,
            data: { pendiente: false, estado: "Rechazado" }
        });

        (prisma.solicitud.findFirst as any).mockResolvedValue({ estado_solicitud: "En Curso", accion: "Realizar solicitud" });

        await expect(verificarSolicitudPendiente("SOL-1")).resolves.toEqual({
            ok: true,
            data: { pendiente: false, estado: "En Curso" }
        });
    });

    it("inexistente en el centro", async () => {
        (prisma.solicitud.findFirst as any).mockResolvedValue(null);

        await expect(verificarSolicitudPendiente("SOL-1")).resolves.toEqual({
            ok: true,
            data: { pendiente: false, estado: null }
        });
        expect(prisma.solicitud.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id_solicitud: "SOL-1", centro_id: "655" } })
        );
    });

    it("usa el centro del funcionario si la sesion no tiene", async () => {
        (requirePermiso as any).mockResolvedValueOnce({ rut: "22.222.222-2", centro_id: null });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce({ centro_id: "655" });
        (prisma.solicitud.findFirst as any).mockResolvedValue({ estado_solicitud: "En Curso", accion: "En espera de validación" });

        await verificarSolicitudPendiente("SOL-1");

        expect(prisma.solicitud.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id_solicitud: "SOL-1", centro_id: "655" } })
        );
    });

    it("sin centro devuelve el error estandar", async () => {
        (requirePermiso as any).mockResolvedValueOnce({ rut: "22.222.222-2", centro_id: null });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce(null);

        await expect(verificarSolicitudPendiente("SOL-1")).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
    });
});
