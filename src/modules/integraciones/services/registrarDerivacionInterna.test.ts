import { beforeEach, describe, expect, it, vi } from "vitest";

// lib
import { Prisma } from "@prisma/client";

const { tx, prismaMock } = vi.hoisted(() => {
    const tx = {
        solicitud: { findUnique: vi.fn(), create: vi.fn() },
        cita: { create: vi.fn() },
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

import { registrarDerivacionInterna } from "./registrarDerivacionInterna";
import type { DerivacionInterna } from "../schemas/derivacionInterna.schema";

const ahora = new Date("2026-10-21T15:00:00Z");

const validada: DerivacionInterna = {
    modo: "validada",
    paciente: { rut: "12345678-9", nombre: "Juan Perez" },
    solicitud: { id_solicitud: "ESP-a1b2c3", tipo_solicitud_id: 1, motivo_id: 2, descripcion: "Derivacion", centro_id: "650" },
    cita: {
        profesional_id: 7,
        prestacion_id: 8,
        fecha_estimada_atencion: new Date("2026-11-05T00:00:00Z"),
        observacion: "Urgente"
    }
};

const pendiente: DerivacionInterna = { ...validada, modo: "pendiente", cita: null };

beforeEach(() => {
    vi.clearAllMocks();
    tx.solicitud.create.mockReset();
    tx.cita.create.mockReset();
    tx.usuario.create.mockReset();
    tx.solicitud.findUnique.mockResolvedValue(null);
    tx.usuario.findUnique.mockResolvedValue(null);
    tx.tipoSolicitud.findUnique.mockResolvedValue({ id_tipo_solicitud: 1 });
    tx.motivo.findUnique.mockResolvedValue({ id_motivo: 2 });
    tx.funcionario.findUnique.mockResolvedValue({ rut: "11111112-2" });
    tx.profesional.findUnique.mockResolvedValue({ id_profesional: 7 });
    tx.prestacion.findUnique.mockResolvedValue({ id_prestacion: 8 });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("registrarDerivacionInterna", () => {
    it("validada: solicitud Realizar solicitud y cita Sin llamadas", async () => {
        const r = await registrarDerivacionInterna(validada, ahora);
        expect(tx.solicitud.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id_solicitud: "ESP-a1b2c3",
                rut_usuario: "12345678-9",
                fecha_inicio: ahora,
                fecha_validacion: ahora,
                estado_solicitud: "En Curso",
                accion: "Realizar solicitud",
                rut_orientador: "11111112-2",
                rut_gestor: "11111112-2",
                priorizacion_admin: 2,
                disponibilidad_llamada: null,
                ultimo_control: null,
                centro_id: "650"
            })
        });
        expect(tx.cita.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id_cita: "ESP-a1b2c3",
                solicitud_id: "ESP-a1b2c3",
                rut_usuario: "12345678-9",
                rut_gestor: "11111112-2",
                estado_cita: "Sin llamadas",
                priorizacion: 60,
                priorizacion_clinica: "Media",
                tipo_prestacion: "Agendar una hora con profesional",
                centro_id: "650",
                profesional_id: 7,
                prestacion_id: 8,
                fecha_estimada_atencion: new Date("2026-11-05T00:00:00Z"),
                observacion: "Urgente",
                fecha_creacion: ahora
            })
        });
        expect(tx.profesional.findUnique).toHaveBeenCalled();
        expect(tx.prestacion.findUnique).toHaveBeenCalled();
        expect(r).toEqual({ ok: true, data: { id_solicitud: "ESP-a1b2c3" } });
    });

    it("pendiente: solo solicitud En espera de validación", async () => {
        const r = await registrarDerivacionInterna(pendiente, ahora);
        expect(tx.solicitud.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ accion: "En espera de validación", estado_solicitud: "En Curso" })
        });
        expect(tx.cita.create).not.toHaveBeenCalled();
        expect(r).toEqual({ ok: true, data: { id_solicitud: "ESP-a1b2c3" } });
    });

    it("usa el nombre de la derivación al crear el paciente", async () => {
        await registrarDerivacionInterna(validada, ahora);
        expect(tx.usuario.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ rut: "12345678-9", nombre: "Juan Perez", apellido: "", centro_id: "650" })
        });
    });

    it("sin nombre → Sin registro", async () => {
        await registrarDerivacionInterna({ ...validada, paciente: { rut: "12345678-9", nombre: null } }, ahora);
        expect(tx.usuario.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nombre: "Sin registro" }) });
    });

    it("paciente existente no se modifica", async () => {
        tx.usuario.findUnique.mockResolvedValue({ rut: "12345678-9" });
        await registrarDerivacionInterna(validada, ahora);
        expect(tx.usuario.create).not.toHaveBeenCalled();
        expect(tx.usuario.update).not.toHaveBeenCalled();
    });

    it("id repetido: DUPLICADO sin crear nada", async () => {
        tx.solicitud.findUnique.mockResolvedValue({ id_solicitud: "ESP-a1b2c3" });
        const r = await registrarDerivacionInterna(validada, ahora);
        expect(r).toEqual({ ok: false, codigo: "DUPLICADO", error: "La solicitud ya existe" });
        expect(tx.solicitud.create).not.toHaveBeenCalled();
        expect(tx.cita.create).not.toHaveBeenCalled();
    });

    it("prestación inexistente → CATALOGO y no crea solicitud ni cita", async () => {
        tx.prestacion.findUnique.mockResolvedValue(null);
        const r = await registrarDerivacionInterna(validada, ahora);
        expect(r).toEqual({ ok: false, codigo: "CATALOGO", error: "prestacion_id 8 no existe" });
        expect(tx.solicitud.create).not.toHaveBeenCalled();
        expect(tx.cita.create).not.toHaveBeenCalled();
    });

    it("P2002 de Cita: DUPLICADO", async () => {
        tx.cita.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x", meta: { modelName: "Cita" } })
        );
        const r = await registrarDerivacionInterna(validada, ahora);
        expect(r).toEqual({ ok: false, codigo: "DUPLICADO", error: "La solicitud ya existe" });
    });

    it("falla la cita → la transacción propaga el error", async () => {
        tx.cita.create.mockRejectedValue(new Error("fallo al insertar cita"));
        const r = await registrarDerivacionInterna(validada, ahora);
        expect(r).toEqual({ ok: false, codigo: "INTERNO", error: "Error interno del servidor" });
        expect(console.error).toHaveBeenCalled();
    });
});
