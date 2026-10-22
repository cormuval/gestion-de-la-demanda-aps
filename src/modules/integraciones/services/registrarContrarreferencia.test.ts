import { beforeEach, describe, expect, it, vi } from "vitest";

// lib
import { Prisma } from "@prisma/client";

const { tx, prismaMock } = vi.hoisted(() => {
    const tx = {
        solicitud: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
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

import { registrarContrarreferencia } from "./registrarContrarreferencia";
import type { Contrarreferencia } from "../schemas/contrarreferencia.schema";

const inicio = new Date("2026-10-22T13:30:00Z");

const validada: Contrarreferencia = {
    contrarreferencia_id: 4321,
    modo: "validada",
    paciente: { rut: "12345678-9", nombre: "Ana María", apellido: "Soto Díaz", telefono: "+56912345678" },
    solicitud: { id_solicitud: "con-1", fecha_inicio: inicio, descripcion: "Registro Contrarreferencia ID: 4321 | x", centro_id: "615" },
    cita: {
        id_cita: "Cita-Contr-1",
        profesional_id: 8,
        prestacion_id: 144,
        fecha_estimada_atencion: new Date("2026-11-11T00:00:00Z"),
        observacion: "Gestionado"
    }
};

const pendiente: Contrarreferencia = { ...validada, modo: "pendiente", cita: null };

beforeEach(() => {
    vi.clearAllMocks();
    tx.solicitud.create.mockReset();
    tx.cita.create.mockReset();
    tx.usuario.create.mockReset();
    tx.usuario.update.mockReset();
    tx.solicitud.findUnique.mockResolvedValue(null);
    tx.solicitud.findMany.mockResolvedValue([]);
    tx.usuario.findUnique.mockResolvedValue(null);
    tx.tipoSolicitud.findUnique.mockResolvedValue({ id_tipo_solicitud: 18 });
    tx.funcionario.findUnique.mockResolvedValue({ rut: "11111111-1" });
    tx.profesional.findUnique.mockResolvedValue({ id_profesional: 8 });
    tx.prestacion.findUnique.mockResolvedValue({ id_prestacion: 144 });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("registrarContrarreferencia", () => {
    it("validada: crea solicitud y cita con los valores fijos", async () => {
        const r = await registrarContrarreferencia(validada);
        expect(r).toEqual({ ok: true, data: { id_solicitud: "con-1" } });
        expect(tx.solicitud.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id_solicitud: "con-1",
                rut_usuario: "12345678-9",
                tipo_solicitud_id: 18,
                motivo_id: null,
                descripcion: "Registro Contrarreferencia ID: 4321 | x",
                centro_id: "615",
                fecha_inicio: inicio,
                fecha_validacion: inicio,
                rut_orientador: "11111111-1",
                rut_gestor: "11111111-1",
                accion: "Realizar solicitud",
                estado_solicitud: "En Curso",
                priorizacion_admin: 3.6,
                disponibilidad_llamada: "AM/PM",
                ultimo_control: null
            })
        });
        expect(tx.cita.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id_cita: "Cita-Contr-1",
                solicitud_id: "con-1",
                rut_usuario: "12345678-9",
                centro_id: "615",
                rut_gestor: "11111111-1",
                tipo_prestacion: "Agendar una hora con profesional",
                profesional_id: 8,
                prestacion_id: 144,
                fecha_estimada_atencion: new Date("2026-11-11T00:00:00Z"),
                observacion: "Gestionado",
                estado_cita: "Sin llamadas",
                priorizacion_clinica: "Alta",
                priorizacion: 80,
                fecha_creacion: inicio
            })
        });
    });

    it("pendiente: en espera de validacion y sin cita", async () => {
        const r = await registrarContrarreferencia(pendiente);
        expect(r.ok).toBe(true);
        expect(tx.solicitud.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ accion: "En espera de validación", fecha_validacion: null })
        });
        expect(tx.cita.create).not.toHaveBeenCalled();
    });

    it("duplicado por id_solicitud", async () => {
        tx.solicitud.findUnique.mockResolvedValue({ id_solicitud: "con-1" });
        const r = await registrarContrarreferencia(validada);
        expect(r).toMatchObject({ ok: false, codigo: "DUPLICADO" });
        expect(tx.solicitud.create).not.toHaveBeenCalled();
        expect(tx.cita.create).not.toHaveBeenCalled();
    });

    it("duplicado por descripcion con el mismo id", async () => {
        tx.solicitud.findMany.mockResolvedValue([{ descripcion: "Registro Contrarreferencia ID: 4321 | Correo" }]);
        const r = await registrarContrarreferencia(validada);
        expect(r).toMatchObject({ ok: false, codigo: "DUPLICADO" });
        expect(tx.solicitud.create).not.toHaveBeenCalled();
        expect(tx.cita.create).not.toHaveBeenCalled();
    });

    it("el id 43 no calza con 4321", async () => {
        tx.solicitud.findMany.mockResolvedValue([{ descripcion: "Registro Contrarreferencia ID: 4321 | Correo" }]);
        const r = await registrarContrarreferencia({ ...validada, contrarreferencia_id: 43 });
        expect(r.ok).toBe(true);
        expect(tx.solicitud.create).toHaveBeenCalled();
    });

    it("descripcion que termina en el id es duplicado", async () => {
        tx.solicitud.findMany.mockResolvedValue([{ descripcion: "Registro Contrarreferencia ID: 43" }]);
        const r = await registrarContrarreferencia({ ...validada, contrarreferencia_id: 43 });
        expect(r).toMatchObject({ ok: false, codigo: "DUPLICADO" });
        expect(tx.solicitud.create).not.toHaveBeenCalled();
        expect(tx.cita.create).not.toHaveBeenCalled();
    });

    it("busca candidatos por descripcion del tipo 18", async () => {
        await registrarContrarreferencia(validada);
        expect(tx.solicitud.findMany).toHaveBeenCalledWith({
            where: { tipo_solicitud_id: 18, descripcion: { contains: "Registro Contrarreferencia ID: 4321" } },
            select: { descripcion: true }
        });
    });

    it("paciente nuevo con nombre, apellido, telefono y centro", async () => {
        await registrarContrarreferencia(validada);
        expect(tx.usuario.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                rut: "12345678-9",
                nombre: "Ana María",
                apellido: "Soto Díaz",
                telefono: "+56912345678",
                centro_id: "615"
            })
        });
    });

    it("paciente nuevo sin nombre -> Sin registro", async () => {
        await registrarContrarreferencia({ ...validada, paciente: { rut: "12345678-9", nombre: null, apellido: null, telefono: null } });
        expect(tx.usuario.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ nombre: "Sin registro", apellido: "" })
        });
    });

    it("paciente existente con telefono actualiza solo el telefono", async () => {
        tx.usuario.findUnique.mockResolvedValue({ rut: "12345678-9" });
        await registrarContrarreferencia(validada);
        expect(tx.usuario.create).not.toHaveBeenCalled();
        expect(tx.usuario.update).toHaveBeenCalledWith({ where: { rut: "12345678-9" }, data: { telefono: "+56912345678" } });
    });

    it("paciente existente sin telefono no se actualiza", async () => {
        tx.usuario.findUnique.mockResolvedValue({ rut: "12345678-9" });
        await registrarContrarreferencia({ ...validada, paciente: { ...validada.paciente, telefono: null } });
        expect(tx.usuario.update).not.toHaveBeenCalled();
    });

    it("profesional inexistente -> CATALOGO", async () => {
        tx.profesional.findUnique.mockResolvedValue(null);
        const r = await registrarContrarreferencia(validada);
        expect(r).toEqual({ ok: false, codigo: "CATALOGO", error: "profesional_id 8 no existe" });
        expect(tx.solicitud.create).not.toHaveBeenCalled();
    });

    it("P2002 -> DUPLICADO", async () => {
        tx.solicitud.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x", meta: { modelName: "Solicitud" } })
        );
        const r = await registrarContrarreferencia(validada);
        expect(r).toMatchObject({ ok: false, codigo: "DUPLICADO" });
        expect(tx.cita.create).not.toHaveBeenCalled();
    });

    it("P2002 de Cita -> DUPLICADO", async () => {
        tx.cita.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x", meta: { modelName: "Cita" } })
        );
        const r = await registrarContrarreferencia(validada);
        expect(r).toMatchObject({ ok: false, codigo: "DUPLICADO" });
    });
});
