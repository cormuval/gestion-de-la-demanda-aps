// lib
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        centro: { findUnique: vi.fn() },
        tipoSolicitud: { findMany: vi.fn() }
    }
}));

vi.mock("@/shared/lib/prisma", () => ({ prisma: prismaMock }));

// services
import { tiposHabilitados } from "./tiposHabilitados";

beforeEach(() => {
    vi.resetAllMocks();
});

describe("tiposHabilitados", () => {
    it("consulta solo tipos activos habilitados en Barón y devuelve id y nombre", async () => {
        prismaMock.centro.findUnique.mockResolvedValue({ nombre_centro: "Centro De Salud FamiliarBarón" });
        prismaMock.tipoSolicitud.findMany.mockResolvedValue([
            { id_tipo_solicitud: 7, nombre_tipo_solicitud: "Consulta general" }
        ]);

        expect(await tiposHabilitados("centro-ficticio")).toEqual([{ id: 7, nombre: "Consulta general" }]);
        expect(prismaMock.centro.findUnique).toHaveBeenCalledWith({
            where: { id_centro: "centro-ficticio" }, select: { nombre_centro: true }
        });
        expect(prismaMock.tipoSolicitud.findMany).toHaveBeenCalledWith({
            where: { estado: "1", baron: "1" },
            select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true },
            orderBy: { nombre_tipo_solicitud: "asc" }
        });
    });

    it.each([null, { nombre_centro: null }, { nombre_centro: "Centro sin columna" }])(
        "devuelve vacío sin consultar tipos si el centro no tiene columna: %s", async (centro) => {
            prismaMock.centro.findUnique.mockResolvedValue(centro);
            expect(await tiposHabilitados("inexistente")).toEqual([]);
            expect(prismaMock.tipoSolicitud.findMany).not.toHaveBeenCalled();
        }
    );

    it("devuelve vacío si el centro no tiene tipos habilitados", async () => {
        prismaMock.centro.findUnique.mockResolvedValue({ nombre_centro: "CESFAM Esperanza" });
        prismaMock.tipoSolicitud.findMany.mockResolvedValue([]);
        expect(await tiposHabilitados("centro-ficticio")).toEqual([]);
        expect(prismaMock.tipoSolicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { estado: "1", esperanza: "1" }
        }));
    });
});
