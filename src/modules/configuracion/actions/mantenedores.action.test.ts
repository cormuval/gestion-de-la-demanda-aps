import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        tipoSolicitud: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        motivo: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        role: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        profesional: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        prestacion: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        funcionario: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        centro: { findMany: vi.fn(), findUnique: vi.fn() }
    }
}));
vi.mock("@/shared/lib/auth", () => ({
    requireSessionUser: vi.fn()
}));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { guardarFuncionario, guardarMotivo, guardarPrestacion, guardarProfesional, guardarRol, guardarTipoSolicitud } from "./mantenedores.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

const user = {
    rut: "11.111.111-1",
    email: "admin@demo.local",
    nombre: "Admin",
    centro_id: "CENTRO-01",
    rol: { id: 1, nombre: "Administrador" },
    menu: []
};

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue(user);
    (prisma.tipoSolicitud.findFirst as any).mockResolvedValue(null);
    (prisma.tipoSolicitud.findUnique as any).mockResolvedValue({ id_tipo_solicitud: 1 });
    (prisma.motivo.findFirst as any).mockResolvedValue(null);
    (prisma.role.findFirst as any).mockResolvedValue(null);
    (prisma.role.findUnique as any).mockResolvedValue({ id_rol: 1 });
    (prisma.profesional.findFirst as any).mockResolvedValue(null);
    (prisma.profesional.findUnique as any).mockResolvedValue({ id_profesional: 1 });
    (prisma.prestacion.findFirst as any).mockResolvedValue(null);
    (prisma.funcionario.findFirst as any).mockResolvedValue(null);
    (prisma.funcionario.findUnique as any).mockResolvedValue(null);
    (prisma.centro.findUnique as any).mockResolvedValue({ id_centro: "CENTRO-01" });
});

describe("mantenedores configuracion", () => {
    it("guarda tipo de solicitud con estado binario y centros", async () => {
        (prisma.tipoSolicitud.create as any).mockResolvedValue({ id_tipo_solicitud: 1, nombre_tipo_solicitud: "Control", estado: "1" });

        await guardarTipoSolicitud({
            nombre_tipo_solicitud: "Control",
            estado: "1",
            centros: { esperanza: "1", placeres: "0" } as any
        });

        expect(prisma.tipoSolicitud.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ nombre_tipo_solicitud: "Control", estado: "1", esperanza: "1", placeres: "0" })
            })
        );
    });

    it("rechaza tipo de solicitud duplicado", async () => {
        (prisma.tipoSolicitud.findFirst as any).mockResolvedValue({ id_tipo_solicitud: 1 });

        await expect(guardarTipoSolicitud({ nombre_tipo_solicitud: "Control", estado: "1", centros: {} as any })).rejects.toThrow("Ya existe");
    });

    it("guarda motivo asociado a tipo existente", async () => {
        (prisma.tipoSolicitud.findUnique as any).mockResolvedValue({ id_tipo_solicitud: 3 });
        (prisma.motivo.create as any).mockResolvedValue({ id_motivo: 5, nombre_motivo: "Examen", estado: "1" });

        await guardarMotivo({ tipo_solicitud_id: 3, nombre_motivo: "Examen", estado: "1" });

        expect(prisma.motivo.create).toHaveBeenCalledWith({ data: { tipo_solicitud_id: 3, nombre_motivo: "Examen", estado: "1" } });
    });

    it("guarda rol basico", async () => {
        (prisma.role.create as any).mockResolvedValue({ id_rol: 9, nombre_rol: "SOME", estado: "Activo" });

        await guardarRol({ nombre_rol: "SOME", estado: "Activo" });

        expect(prisma.role.create).toHaveBeenCalledWith({ data: { nombre_rol: "SOME", estado: "Activo" } });
    });

    it("guarda profesional con centros", async () => {
        (prisma.profesional.create as any).mockResolvedValue({ id_profesional: 2, nombre: "Profesional", estado: "Activo" });

        await guardarProfesional({ nombre: "Profesional", estado: "Activo", centros: { baron: "1" } as any });

        expect(prisma.profesional.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nombre: "Profesional", estado: "Activo", baron: "1" }) }));
    });

    it("guarda prestacion asociada a profesional existente", async () => {
        (prisma.prestacion.create as any).mockResolvedValue({ id_prestacion: 4, nombre_prestacion: "Morbilidad", estado: "Activo" });

        await guardarPrestacion({ profesional_id: 1, nombre_prestacion: "Morbilidad", estado: "Activo" });

        expect(prisma.prestacion.create).toHaveBeenCalledWith({ data: { profesional_id: 1, nombre_prestacion: "Morbilidad", estado: "Activo" } });
    });

    it("rechaza prestacion si el profesional no existe", async () => {
        (prisma.profesional.findUnique as any).mockResolvedValue(null);

        await expect(guardarPrestacion({ profesional_id: 99, nombre_prestacion: "Morbilidad", estado: "Activo" })).rejects.toThrow("Profesional no existe");
    });

    it("crea funcionario con rut normalizado, rol, centro y programa", async () => {
        (prisma.funcionario.create as any).mockResolvedValue({ rut: "12345678-5", email: "funcionario@demo.local", nombre: "Funcionario" });

        await guardarFuncionario({
            rut: "12.345.678-5",
            email: "funcionario@demo.local",
            nombre: "Funcionario",
            rol_id: 1,
            centro_id: "CENTRO-01",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(prisma.funcionario.create).toHaveBeenCalledWith({
            data: {
                rut: "12345678-5",
                email: "funcionario@demo.local",
                nombre: "Funcionario",
                rol_id: 1,
                centro_id: "CENTRO-01",
                programa_asociado: "Programa cardiovascular",
                estado: "Activo"
            }
        });
    });

    it("edita funcionario existente sin cambiar rut", async () => {
        (prisma.funcionario.findUnique as any).mockResolvedValue({ rut: "12345678-5" });
        (prisma.funcionario.update as any).mockResolvedValue({ rut: "12345678-5", email: "nuevo@demo.local", nombre: "Nuevo" });

        await guardarFuncionario({
            rut: "12345678-5",
            email: "nuevo@demo.local",
            nombre: "Nuevo",
            rol_id: 1,
            centro_id: "CENTRO-01",
            programa_asociado: "Programa salud mental",
            estado: "Inactivo"
        });

        expect(prisma.funcionario.update).toHaveBeenCalledWith({
            where: { rut: "12345678-5" },
            data: {
                email: "nuevo@demo.local",
                nombre: "Nuevo",
                rol_id: 1,
                centro_id: "CENTRO-01",
                programa_asociado: "Programa salud mental",
                estado: "Inactivo"
            }
        });
    });

    it("rechaza funcionario con rut invalido", async () => {
        await expect(
            guardarFuncionario({
                rut: "12.345.678-9",
                email: "funcionario@demo.local",
                nombre: "Funcionario",
                rol_id: 1,
                centro_id: "CENTRO-01",
                programa_asociado: "Programa cardiovascular",
                estado: "Activo"
            })
        ).rejects.toThrow("RUT invalido");
    });

    it("rechaza funcionario con email duplicado", async () => {
        (prisma.funcionario.findFirst as any).mockResolvedValue({ rut: "99999999-9" });

        await expect(
            guardarFuncionario({
                rut: "12345678-5",
                email: "funcionario@demo.local",
                nombre: "Funcionario",
                rol_id: 1,
                centro_id: "CENTRO-01",
                programa_asociado: "Programa respiratorio",
                estado: "Activo"
            })
        ).rejects.toThrow("Ya existe un funcionario con ese email");
    });

    it("rechaza funcionario con rol o centro inexistente", async () => {
        (prisma.role.findUnique as any).mockResolvedValue(null);

        await expect(
            guardarFuncionario({
                rut: "12345678-5",
                email: "funcionario@demo.local",
                nombre: "Funcionario",
                rol_id: 99,
                centro_id: "CENTRO-01",
                programa_asociado: "Programa respiratorio",
                estado: "Activo"
            })
        ).rejects.toThrow("Rol no existe");

        (prisma.role.findUnique as any).mockResolvedValue({ id_rol: 1 });
        (prisma.centro.findUnique as any).mockResolvedValue(null);

        await expect(
            guardarFuncionario({
                rut: "12345678-5",
                email: "funcionario@demo.local",
                nombre: "Funcionario",
                rol_id: 1,
                centro_id: "CENTRO-X",
                programa_asociado: "Programa respiratorio",
                estado: "Activo"
            })
        ).rejects.toThrow("Centro no existe");
    });
});
