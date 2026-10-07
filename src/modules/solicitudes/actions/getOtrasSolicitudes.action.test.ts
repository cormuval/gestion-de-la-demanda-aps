import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        funcionario: { findUnique: vi.fn() },
        solicitud: { findMany: vi.fn() },
        cita: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { getOtrasSolicitudes } from "./getOtrasSolicitudes.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "gestor@demo.local",
        nombre: "Gestor",
        centro_id: "650",
        rol: { id: 2, nombre: "Gestor" }
    });
    (prisma.solicitud.findMany as any).mockResolvedValue([{ id_solicitud: "SOL-2", accion: "Realizar solicitud" }]);
    (prisma.cita.findMany as any).mockResolvedValue([
        { id_cita: "CITA-1", estado_cita: "Sin llamadas", _count: { llamadas: 0 } },
        { id_cita: "CITA-2", estado_cita: "Sin llamadas", _count: { llamadas: 1 } }
    ]);
});

describe("getOtrasSolicitudes", () => {
    it("consulta solicitudes En Curso del centro sin filtrar por accion y trae citas pendientes", async () => {
        const result = await getOtrasSolicitudes("12.345.678-5", "SOL-1");

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    rut_usuario: "12345678-5",
                    id_solicitud: { not: "SOL-1" },
                    estado_solicitud: "En Curso",
                    centro_id: "650"
                }
            })
        );
        expect(prisma.cita.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    rut_usuario: "12345678-5",
                    centro_id: "650",
                    estado_cita: { in: ["Sin llamadas", "No contesta (1)", "No contesta (2)", "Solo llamada de aviso"] }
                },
                include: { profesional: true, prestacion: true, _count: { select: { llamadas: true } } }
            })
        );
        expect(result).toEqual({
            ok: true,
            data: {
                solicitudes: [{ id_solicitud: "SOL-2", accion: "Realizar solicitud" }],
                citas: [
                    { id_cita: "CITA-1", estado_cita: "Sin llamadas", editable: true },
                    { id_cita: "CITA-2", estado_cita: "Sin llamadas", editable: false }
                ]
            }
        });
    });

    it("resuelve centro desde funcionario si la sesion no trae centro", async () => {
        (requirePermiso as any).mockResolvedValueOnce({
            rut: "22.222.222-2",
            email: "gestor@demo.local",
            nombre: "Gestor",
            centro_id: null,
            rol: { id: 2, nombre: "Gestor" }
        });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce({ centro_id: "501" });

        await getOtrasSolicitudes("12345678-5", "SOL-1");

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ centro_id: "501" }) }));
    });

    it("devuelve rut requerido como error de negocio", async () => {
        await expect(getOtrasSolicitudes("", "SOL-1")).resolves.toEqual({ ok: false, error: "rutUsuario es requerido" });
        expect(prisma.solicitud.findMany).not.toHaveBeenCalled();
    });

    it("devuelve listas vacias como exito", async () => {
        (prisma.solicitud.findMany as any).mockResolvedValueOnce([]);
        (prisma.cita.findMany as any).mockResolvedValueOnce([]);

        await expect(getOtrasSolicitudes("12345678-5", "SOL-1")).resolves.toEqual({
            ok: true,
            data: { solicitudes: [], citas: [] }
        });
    });

    it("devuelve error de configuracion cuando el funcionario no tiene centro", async () => {
        (requirePermiso as any).mockResolvedValueOnce({ rut: "22.222.222-2", centro_id: null });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce(null);

        await expect(getOtrasSolicitudes("12345678-5", "SOL-1")).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
    });

    it("mantiene los errores de permiso como rechazos", async () => {
        (requirePermiso as any).mockRejectedValueOnce(new Error("Sin permiso"));

        await expect(getOtrasSolicitudes("12345678-5", "SOL-1")).rejects.toThrow("Sin permiso");
    });

    it("mantiene los errores de Prisma como rechazos", async () => {
        (prisma.solicitud.findMany as any).mockRejectedValueOnce(new Error("DB caida"));

        await expect(getOtrasSolicitudes("12345678-5", "SOL-1")).rejects.toThrow("DB caida");
    });
});
