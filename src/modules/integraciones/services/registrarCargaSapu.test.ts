import { beforeEach, describe, expect, it, vi } from "vitest";

// lib
import { Prisma } from "@prisma/client";

const { tx, prismaMock } = vi.hoisted(() => {
    const tx = {
        solicitud: { findUnique: vi.fn(), create: vi.fn() },
        usuario: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        tipoSolicitud: { findUnique: vi.fn() },
        motivo: { findUnique: vi.fn() },
        funcionario: { findUnique: vi.fn() },
        profesional: { findUnique: vi.fn() },
        prestacion: { findUnique: vi.fn() }
    };
    return { tx, prismaMock: { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) } };
});

vi.mock("@/shared/lib/prisma", () => ({ prisma: prismaMock }));

import { registrarCargaSapu } from "./registrarCargaSapu";

function fila(sobrescribe: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id_solicitud: "SAPU-1",
        fecha_inicio: "2026-10-20 10:30:00",
        paciente: { rut: "12345678-9", nombre: "Juan" },
        motivo_id: 2,
        descripcion: "Control",
        centro_id: "615",
        ...sobrescribe
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    tx.solicitud.create.mockReset();
    tx.usuario.create.mockReset();
    tx.solicitud.findUnique.mockReset();
    tx.solicitud.findUnique.mockResolvedValue(null);
    tx.usuario.findUnique.mockResolvedValue(null);
    tx.tipoSolicitud.findUnique.mockResolvedValue({ id_tipo_solicitud: 17 });
    tx.motivo.findUnique.mockResolvedValue({ id_motivo: 2 });
    tx.funcionario.findUnique.mockResolvedValue({ rut: "11111112-3" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("registrarCargaSapu", () => {
    it("lote mixto: creada, duplicada, rechazada por catálogo y por schema, en orden", async () => {
        tx.solicitud.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id_solicitud: "SAPU-2" });
        tx.motivo.findUnique
            .mockResolvedValueOnce({ id_motivo: 2 })
            .mockResolvedValueOnce({ id_motivo: 2 })
            .mockResolvedValueOnce(null);
        const sinFecha = fila({ id_solicitud: " SAPU-4 " });
        delete sinFecha.fecha_inicio;

        const r = await registrarCargaSapu([
            fila(),
            fila({ id_solicitud: "SAPU-2" }),
            fila({ id_solicitud: "SAPU-3", motivo_id: 99 }),
            sinFecha
        ]);

        expect(r.resultados.map((x) => x.estado)).toEqual(["creada", "duplicada", "rechazada", "rechazada"]);
        expect(r.resultados.map((x) => x.indice)).toEqual([0, 1, 2, 3]);
        expect(r.resultados[2].error).toBe("motivo_id 99 no existe");
        expect(r.resultados[3].id_solicitud).toBe("SAPU-4");
        expect(r.resultados[3].error).toMatch(/^fecha_inicio: /);
        expect(r.totales).toEqual({ creadas: 1, duplicadas: 1, rechazadas: 2 });
        expect(tx.solicitud.create).toHaveBeenCalledTimes(1);
    });

    it("crea la solicitud con los valores fijos SAPU", async () => {
        await registrarCargaSapu([fila()]);
        expect(tx.solicitud.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                tipo_solicitud_id: 17,
                rut_orientador: "11111112-3",
                rut_gestor: "11111112-3",
                accion: "En espera de validación",
                estado_solicitud: "En Curso",
                priorizacion_admin: 3.6,
                disponibilidad_llamada: "AM/PM",
                fecha_validacion: null,
                ultimo_control: null,
                centro_id: "615",
                fecha_inicio: new Date("2026-10-20T13:30:00Z")
            })
        });
    });

    it("paciente nuevo con nombre o Sin registro; existente no se modifica", async () => {
        await registrarCargaSapu([fila(), fila({ id_solicitud: "SAPU-2", paciente: { rut: "1-9" } })]);
        expect(tx.usuario.create).toHaveBeenNthCalledWith(1, {
            data: expect.objectContaining({ nombre: "Juan", apellido: "", centro_id: "615" })
        });
        expect(tx.usuario.create).toHaveBeenNthCalledWith(2, {
            data: expect.objectContaining({ nombre: "Sin registro", apellido: "", centro_id: "615" })
        });

        tx.usuario.create.mockReset();
        tx.usuario.findUnique.mockResolvedValue({ rut: "12345678-9" });
        await registrarCargaSapu([fila()]);
        expect(tx.usuario.create).not.toHaveBeenCalled();
        expect(tx.usuario.update).not.toHaveBeenCalled();
    });

    it("P2002 de Solicitud en create → duplicada", async () => {
        tx.solicitud.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x", meta: { modelName: "Solicitud" } })
        );
        const r = await registrarCargaSapu([fila()]);
        expect(r.resultados[0]).toMatchObject({ estado: "duplicada", id_solicitud: "SAPU-1" });
        expect(r.totales.duplicadas).toBe(1);
    });

    it("error inesperado → rechazada con 'Error interno'", async () => {
        tx.solicitud.create.mockRejectedValue(new Error("boom"));
        const r = await registrarCargaSapu([fila()]);
        expect(r.resultados[0]).toMatchObject({ estado: "rechazada", error: "Error interno" });
        expect(console.error).toHaveBeenCalled();
    });

    it("cada fila usa su propia transacción", async () => {
        await registrarCargaSapu([fila(), fila({ id_solicitud: "SAPU-2" }), { basura: true }]);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    });
});
