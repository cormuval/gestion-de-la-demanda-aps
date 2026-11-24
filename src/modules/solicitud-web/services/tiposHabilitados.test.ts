// lib
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        centro: { findUnique: vi.fn() },
        tipoSolicitud: { findMany: vi.fn() },
        motivo: { findMany: vi.fn() }
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
            { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Consulta general" }
        ]);

        prismaMock.motivo.findMany.mockResolvedValue([
            { id_motivo: 9, tipo_solicitud_id: 1, nombre_motivo: "Control" }
        ]);
        expect(await tiposHabilitados("centro-ficticio")).toEqual([
            { id: 1, nombre: "Consulta general", submotivos: [{ id: 9, nombre: "Control" }] }
        ]);
        expect(prismaMock.motivo.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { estado: "1", tipo_solicitud_id: { in: [1] } }
        }));
        expect(prismaMock.centro.findUnique).toHaveBeenCalledWith({
            where: { id_centro: "centro-ficticio" }, select: { nombre_centro: true }
        });
        expect(prismaMock.tipoSolicitud.findMany).toHaveBeenCalledWith({
            where: { estado: "1", baron: "1", id_tipo_solicitud: { notIn: [7, 8] } },
            select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true },
            orderBy: { nombre_tipo_solicitud: "asc" }
        });
    });

    it("excluye los tipos 7 y 8 del formulario web aunque la consulta los devuelva", async () => {
        prismaMock.centro.findUnique.mockResolvedValue({ nombre_centro: "CESFAM Placeres" });
        prismaMock.tipoSolicitud.findMany.mockResolvedValue([
            { id_tipo_solicitud: 7, nombre_tipo_solicitud: "Consulta de morbilidad medica" },
            { id_tipo_solicitud: 8, nombre_tipo_solicitud: "Consulta de morbilidad odontologica" },
            { id_tipo_solicitud: 14, nombre_tipo_solicitud: "Control de ciclo vital" },
            { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Consulta general" }
        ]);
        prismaMock.motivo.findMany.mockResolvedValue([]);

        expect(await tiposHabilitados("centro-ficticio")).toEqual([
            { id: 14, nombre: "Control de ciclo vital (5 a 19 años)", submotivos: [] },
            { id: 1, nombre: "Consulta general", submotivos: [] }
        ]);
        expect(prismaMock.motivo.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { estado: "1", tipo_solicitud_id: { in: [14, 1] } }
        }));
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
            where: { estado: "1", esperanza: "1", id_tipo_solicitud: { notIn: [7, 8] } }
        }));
    });

    it("devuelve vacío si la consulta solo trae tipos excluidos", async () => {
        prismaMock.centro.findUnique.mockResolvedValue({ nombre_centro: "CESFAM Mena" });
        prismaMock.tipoSolicitud.findMany.mockResolvedValue([
            { id_tipo_solicitud: 7, nombre_tipo_solicitud: "Consulta de morbilidad medica" },
            { id_tipo_solicitud: 8, nombre_tipo_solicitud: "Consulta de morbilidad odontologica" }
        ]);
        expect(await tiposHabilitados("centro-ficticio")).toEqual([]);
        expect(prismaMock.motivo.findMany).not.toHaveBeenCalled();
    });
});
