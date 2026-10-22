import { beforeEach, describe, expect, it, vi } from "vitest";

// lib
import { Prisma } from "@prisma/client";

const { tx, prismaMock } = vi.hoisted(() => {
    const tx = {
        solicitud: { findUnique: vi.fn(), create: vi.fn() },
        usuario: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        tipoSolicitud: { findUnique: vi.fn() },
        motivo: { findUnique: vi.fn() },
        funcionario: { findUnique: vi.fn() }
    };
    return { tx, prismaMock: { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) } };
});

vi.mock("@/shared/lib/prisma", () => ({ prisma: prismaMock }));

import { registrarSolicitudSimple } from "./registrarSolicitudSimple";
import { asegurarPaciente } from "./paciente";

const datos = {
    id_solicitud: "DES99-2",
    fecha_inicio: new Date("2026-10-21T15:00:00Z"),
    rut_usuario: "12345678-9",
    tipo_solicitud_id: 1,
    motivo_id: 2,
    descripcion: "Control",
    disponibilidad_llamada: "AM" as const,
    priorizacion_admin: null,
    centro_id: "501",
    telefono: "+56987654321",
    correo: "paciente@example.cl"
};

beforeEach(() => {
    vi.clearAllMocks();
    tx.solicitud.findUnique.mockResolvedValue(null);
    tx.usuario.findUnique.mockResolvedValue(null);
    tx.tipoSolicitud.findUnique.mockResolvedValue({ id_tipo_solicitud: 1 });
    tx.motivo.findUnique.mockResolvedValue({ id_motivo: 2 });
    tx.funcionario.findUnique.mockResolvedValue({ rut: "11111112-3" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("registrarSolicitudSimple", () => {
    it("crea paciente Sin registro si no existe y la solicitud con valores fijos", async () => {
        const r = await registrarSolicitudSimple(datos);
        expect(tx.usuario.create).toHaveBeenCalledWith({
            data: {
                rut: "12345678-9",
                nombre: "Sin registro",
                apellido: "",
                centro_id: "501",
                telefono: "+56987654321",
                correo_contacto: "paciente@example.cl"
            }
        });
        expect(tx.solicitud.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id_solicitud: "DES99-2",
                estado_solicitud: "En Curso",
                accion: "En espera de validación",
                rut_orientador: "11111112-3",
                rut_gestor: null,
                fecha_validacion: null
            })
        });
        expect(r).toEqual({ ok: true, data: { id_solicitud: "DES99-2" } });
    });

    it("paciente existente: actualiza solo el contacto que llega", async () => {
        tx.usuario.findUnique.mockResolvedValue({ rut: "12345678-9" });
        await registrarSolicitudSimple({ ...datos, telefono: "+569", correo: null });
        expect(tx.usuario.create).not.toHaveBeenCalled();
        expect(tx.usuario.update).toHaveBeenCalledWith({ where: { rut: "12345678-9" }, data: { telefono: "+569" } });
    });

    it("paciente existente sin contacto: no lo modifica", async () => {
        tx.usuario.findUnique.mockResolvedValue({ rut: "12345678-9" });
        await registrarSolicitudSimple({ ...datos, telefono: null, correo: null });
        expect(tx.usuario.update).not.toHaveBeenCalled();
    });

    it("id repetido: DUPLICADO sin crear nada", async () => {
        tx.solicitud.findUnique.mockResolvedValue({ id_solicitud: "DES99-2" });
        const r = await registrarSolicitudSimple(datos);
        expect(r).toEqual({ ok: false, codigo: "DUPLICADO", error: "La solicitud ya existe" });
        expect(tx.usuario.create).not.toHaveBeenCalled();
        expect(tx.solicitud.create).not.toHaveBeenCalled();
    });

    it("tipo inexistente: CATALOGO", async () => {
        tx.tipoSolicitud.findUnique.mockResolvedValue(null);
        const r = await registrarSolicitudSimple({ ...datos, tipo_solicitud_id: 99 });
        expect(r).toEqual({ ok: false, codigo: "CATALOGO", error: "tipo_solicitud_id 99 no existe" });
        expect(tx.solicitud.create).not.toHaveBeenCalled();
    });

    it("P2002 al crear: DUPLICADO", async () => {
        tx.solicitud.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" })
        );
        const r = await registrarSolicitudSimple(datos);
        expect(r).toEqual({ ok: false, codigo: "DUPLICADO", error: "La solicitud ya existe" });
    });

    it("error generico: INTERNO con mensaje generico", async () => {
        tx.solicitud.create.mockRejectedValue(new Error("conexion perdida con db-host"));
        const r = await registrarSolicitudSimple(datos);
        expect(r).toEqual({ ok: false, codigo: "INTERNO", error: "Error interno del servidor" });
    });
});

describe("asegurarPaciente", () => {
    it("descarta telefono y correo demasiado largos sin fallar", async () => {
        await asegurarPaciente(
            tx as never,
            { rut: "1-9", nombre: null, centro_id: "501", telefono: "9".repeat(151), correo: "a".repeat(101) },
            { actualizarContacto: true }
        );
        const data = tx.usuario.create.mock.calls[0][0].data;
        expect(data.telefono).toBeUndefined();
        expect(data.correo_contacto).toBeUndefined();
    });
});
