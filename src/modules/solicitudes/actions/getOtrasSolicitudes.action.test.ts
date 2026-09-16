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
        expect(result.solicitudes).toEqual([{ id_solicitud: "SOL-2", accion: "Realizar solicitud" }]);
        expect(result.citas).toEqual([
            { id_cita: "CITA-1", estado_cita: "Sin llamadas", editable: true },
            { id_cita: "CITA-2", estado_cita: "Sin llamadas", editable: false }
        ]);
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
});
