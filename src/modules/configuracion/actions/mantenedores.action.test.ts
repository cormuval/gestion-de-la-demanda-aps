import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        tipoSolicitud: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        motivo: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        role: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        profesional: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        prestacion: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        funcionario: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        centro: { findMany: vi.fn(), findUnique: vi.fn() },
        rolPermiso: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
        $queryRaw: vi.fn(),
        $transaction: vi.fn(async (operaciones: unknown[]) => operaciones)
    }
}));
vi.mock("@/shared/lib/permisos", () => ({
    requirePermiso: vi.fn(),
    getPermisosRol: vi.fn()
}));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: {
        logDataAccess: vi.fn(),
        logSecurity: vi.fn()
    }
}));

import { guardarFuncionario, guardarMotivo, guardarPermisosRol, guardarPrestacion, guardarProfesional, guardarRol, guardarTipoSolicitud } from "./mantenedores.action";
import { prisma as prismaClient } from "@/shared/lib/prisma";
import { getPermisosRol, requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";

const prisma = prismaClient as any;

const user = {
    rut: "11.111.111-1",
    email: "admin@demo.local",
    nombre: "Admin",
    centro_id: "650",
    rol: { id: 1, nombre: "Administrador" },
    menu: []
};

beforeEach(() => {
    vi.clearAllMocks();
    (AuditLogger.logDataAccess as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (AuditLogger.logSecurity as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue(user);
    (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.funcionarios", "config.roles", "config.catalogos"]));
    (prisma.tipoSolicitud.findFirst as any).mockResolvedValue(null);
    (prisma.tipoSolicitud.findUnique as any).mockResolvedValue({ id_tipo_solicitud: 1 });
    (prisma.motivo.findFirst as any).mockResolvedValue(null);
    (prisma.role.findFirst as any).mockResolvedValue(null);
    (prisma.role.findUnique as any).mockResolvedValue({ id_rol: 3, nombre_rol: "SOME", estado: "Activo", permisos: [{ permiso: "config.ver" }] });
    (prisma.profesional.findFirst as any).mockResolvedValue(null);
    (prisma.profesional.findUnique as any).mockResolvedValue({ id_profesional: 1 });
    (prisma.prestacion.findFirst as any).mockResolvedValue(null);
    (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "22.222.222-2", rol_id: 2 }]);
    (prisma.funcionario.findFirst as any).mockResolvedValue(null);
    (prisma.funcionario.findUnique as any).mockResolvedValue(null);
    (prisma.centro.findUnique as any).mockResolvedValue({ id_centro: "CENTRO-01" });
    prisma.$queryRaw.mockResolvedValue([]);
});

describe("mantenedores configuracion", () => {
    it("guarda tipo de solicitud con estado binario y centros", async () => {
        const tipoGuardado = { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Control", estado: "1" };
        (prisma.tipoSolicitud.create as any).mockResolvedValue(tipoGuardado);

        const resultado = await guardarTipoSolicitud({
            nombre_tipo_solicitud: "Control",
            estado: "1",
            centros: { esperanza: "1", placeres: "0" } as any
        });

        expect(resultado).toEqual({ ok: true, data: tipoGuardado });
        expect(prisma.tipoSolicitud.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ nombre_tipo_solicitud: "Control", estado: "1", esperanza: "1", placeres: "0" })
            })
        );
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("CREATE", true, { rut: user.rut, name: user.nombre }, "tipo_solicitud:1");
    });

    it("rechaza tipo de solicitud duplicado", async () => {
        (prisma.tipoSolicitud.findFirst as any).mockResolvedValue({ id_tipo_solicitud: 1 });

        await expect(guardarTipoSolicitud({ nombre_tipo_solicitud: "Control", estado: "1", centros: {} as any })).resolves.toEqual({
            ok: false,
            error: "Ya existe un tipo de solicitud con ese nombre"
        });
        expect(prisma.tipoSolicitud.create).not.toHaveBeenCalled();
        expect(prisma.tipoSolicitud.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("guarda motivo asociado a tipo existente", async () => {
        (prisma.tipoSolicitud.findUnique as any).mockResolvedValue({ id_tipo_solicitud: 3 });
        const motivoGuardado = { id_motivo: 5, tipo_solicitud_id: 3, nombre_motivo: "Examen", estado: "1" };
        (prisma.motivo.create as any).mockResolvedValue(motivoGuardado);

        const resultado = await guardarMotivo({ tipo_solicitud_id: 3, nombre_motivo: "Examen", estado: "1" });

        expect(resultado).toEqual({ ok: true, data: motivoGuardado });
        expect(prisma.motivo.create).toHaveBeenCalledWith({ data: { tipo_solicitud_id: 3, nombre_motivo: "Examen", estado: "1" } });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("CREATE", true, { rut: user.rut, name: user.nombre }, "motivo:5");
    });

    it("rechaza motivo si el tipo de solicitud no existe", async () => {
        (prisma.tipoSolicitud.findUnique as any).mockResolvedValue(null);

        await expect(guardarMotivo({ tipo_solicitud_id: 99, nombre_motivo: "Examen", estado: "1" })).resolves.toEqual({
            ok: false,
            error: "Tipo de solicitud no existe"
        });
        expect(prisma.motivo.create).not.toHaveBeenCalled();
        expect(prisma.motivo.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("rechaza motivo duplicado dentro del tipo de solicitud", async () => {
        (prisma.motivo.findFirst as any).mockResolvedValue({ id_motivo: 5 });

        await expect(guardarMotivo({ tipo_solicitud_id: 3, nombre_motivo: "Examen", estado: "1" })).resolves.toEqual({
            ok: false,
            error: "Ya existe un motivo con ese nombre para el tipo seleccionado"
        });
        expect(prisma.motivo.create).not.toHaveBeenCalled();
        expect(prisma.motivo.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("guarda rol basico", async () => {
        (prisma.role.create as any).mockResolvedValue({ id_rol: 9, nombre_rol: "SOME", estado: "Activo" });

        const result = await guardarRol({ nombre_rol: "SOME", estado: "Activo" });

        expect(result).toEqual({ ok: true, data: { id_rol: 9, nombre_rol: "SOME", estado: "Activo" } });
        expect(prisma.role.create).toHaveBeenCalledWith({ data: { nombre_rol: "SOME", estado: "Activo" } });
    });

    it("guarda profesional con centros", async () => {
        const profesionalGuardado = { id_profesional: 2, nombre: "Profesional", estado: "Activo" };
        (prisma.profesional.create as any).mockResolvedValue(profesionalGuardado);

        const resultado = await guardarProfesional({ nombre: "Profesional", estado: "Activo", centros: { baron: "1" } as any });

        expect(resultado).toEqual({ ok: true, data: profesionalGuardado });
        expect(prisma.profesional.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nombre: "Profesional", estado: "Activo", baron: "1" }) }));
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("CREATE", true, { rut: user.rut, name: user.nombre }, "profesional:2");
    });

    it("rechaza profesional duplicado", async () => {
        (prisma.profesional.findFirst as any).mockResolvedValue({ id_profesional: 2 });

        await expect(guardarProfesional({ nombre: "Profesional", estado: "Activo", centros: {} as any })).resolves.toEqual({
            ok: false,
            error: "Ya existe un profesional con ese nombre"
        });
        expect(prisma.profesional.create).not.toHaveBeenCalled();
        expect(prisma.profesional.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("guarda prestacion asociada a profesional existente", async () => {
        const prestacionGuardada = { id_prestacion: 4, profesional_id: 1, nombre_prestacion: "Morbilidad", estado: "Activo" };
        (prisma.prestacion.create as any).mockResolvedValue(prestacionGuardada);

        const resultado = await guardarPrestacion({ profesional_id: 1, nombre_prestacion: "Morbilidad", estado: "Activo" });

        expect(resultado).toEqual({ ok: true, data: prestacionGuardada });
        expect(prisma.prestacion.create).toHaveBeenCalledWith({ data: { profesional_id: 1, nombre_prestacion: "Morbilidad", estado: "Activo" } });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("CREATE", true, { rut: user.rut, name: user.nombre }, "prestacion:4");
    });

    it("rechaza prestacion si el profesional no existe", async () => {
        (prisma.profesional.findUnique as any).mockResolvedValue(null);

        await expect(guardarPrestacion({ profesional_id: 99, nombre_prestacion: "Morbilidad", estado: "Activo" })).resolves.toEqual({
            ok: false,
            error: "Profesional no existe"
        });
        expect(prisma.prestacion.create).not.toHaveBeenCalled();
        expect(prisma.prestacion.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("rechaza prestacion duplicada dentro del profesional", async () => {
        (prisma.prestacion.findFirst as any).mockResolvedValue({ id_prestacion: 4 });

        await expect(guardarPrestacion({ profesional_id: 1, nombre_prestacion: "Morbilidad", estado: "Activo" })).resolves.toEqual({
            ok: false,
            error: "Ya existe una prestacion con ese nombre para el profesional"
        });
        expect(prisma.prestacion.create).not.toHaveBeenCalled();
        expect(prisma.prestacion.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("mantiene los rechazos de Zod en catalogos", async () => {
        await expect(guardarTipoSolicitud({ nombre_tipo_solicitud: "", estado: "1", centros: {} as any })).rejects.toThrow();
        expect(prisma.tipoSolicitud.findFirst).not.toHaveBeenCalled();
    });

    it("propaga los fallos inesperados de Prisma en catalogos", async () => {
        (prisma.profesional.findFirst as any).mockRejectedValue(new Error("fallo de conexion"));

        await expect(guardarProfesional({ nombre: "Profesional", estado: "Activo", centros: {} as any })).rejects.toThrow("fallo de conexion");
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("propaga los fallos de auditoria en catalogos", async () => {
        (prisma.tipoSolicitud.create as any).mockResolvedValue({ id_tipo_solicitud: 1, nombre_tipo_solicitud: "Control", estado: "1" });
        (AuditLogger.logDataAccess as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("auditoria no disponible"));

        await expect(guardarTipoSolicitud({ nombre_tipo_solicitud: "Control", estado: "1", centros: {} as any })).rejects.toThrow("auditoria no disponible");
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

    it("crea funcionario sin programa asociado y lo guarda como null", async () => {
        (prisma.funcionario.create as any).mockResolvedValue({ rut: "12345678-5" });

        const result = await guardarFuncionario({
            rut: "12.345.678-5",
            email: "funcionario@demo.local",
            nombre: "Funcionario",
            rol_id: 3,
            centro_id: "CENTRO-01",
            programa_asociado: "",
            estado: "Activo"
        });

        expect(result.ok).toBe(true);
        expect((prisma.funcionario.create as any).mock.calls[0][0].data.programa_asociado).toBeNull();
    });

    it("exige programa asociado solo al rol Jefe de Programa", async () => {
        (prisma.role.findUnique as any).mockResolvedValue({ id_rol: 10, nombre_rol: "Jefe de Programa", estado: "Activo", permisos: [{ permiso: "config.ver" }] });

        const result = await guardarFuncionario({
            rut: "12.345.678-5",
            email: "jefe@demo.local",
            nombre: "Jefe",
            rol_id: 10,
            centro_id: "CENTRO-01",
            programa_asociado: "",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "Programa asociado requerido para el rol Jefe de Programa" });
        expect(prisma.funcionario.create).not.toHaveBeenCalled();
    });

    it("edita funcionario existente sin cambiar rut", async () => {
        (prisma.funcionario.findUnique as any).mockResolvedValue({
            rut: "12345678-5",
            rol_id: 1,
            estado: "Activo",
            centro_id: "CENTRO-01",
            role: {
                id_rol: 1,
                nombre_rol: "Administrador",
                estado: "Activo",
                permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
            }
        });
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
        ).resolves.toEqual({ ok: false, error: "Ya existe un funcionario con ese email" });
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
        ).resolves.toEqual({ ok: false, error: "Rol no existe" });

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
        ).resolves.toEqual({ ok: false, error: "Centro no existe" });
    });
});

describe("anti escalada en funcionarios", () => {
    it("bloquea que un SOME se asigne Administrador a si mismo", async () => {
        (requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue({
            rut: "22.222.222-2",
            email: "some@demo.local",
            nombre: "Some",
            centro_id: "650",
            rol: { id: 2, nombre: "SOME" }
        });
        (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.funcionarios"]));
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "650" });
        prisma.funcionario.findUnique.mockResolvedValue({
            rut: "22.222.222-2",
            rol_id: 2,
            estado: "Activo",
            centro_id: "650",
            role: {
                id_rol: 2,
                nombre_rol: "SOME",
                estado: "Activo",
                permisos: [{ permiso: "config.funcionarios" }]
            }
        });
        prisma.funcionario.findFirst.mockResolvedValue(null);

        const result = await guardarFuncionario({
            rut: "22.222.222-2",
            email: "some@demo.local",
            nombre: "Some",
            rol_id: 1,
            centro_id: "650",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "No puedes asignar el rol «Administrador»: incluye permisos que tu rol no tiene" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).toHaveBeenCalled();
    });

    it("bloquea editar a un funcionario con mas privilegios", async () => {
        (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.funcionarios"]));
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 2,
            nombre_rol: "SOME",
            estado: "Activo",
            permisos: [{ permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "650" });
        prisma.funcionario.findUnique.mockResolvedValue({
            rut: "33.333.333-3",
            rol_id: 1,
            estado: "Activo",
            centro_id: "650",
            role: {
                id_rol: 1,
                nombre_rol: "Administrador",
                estado: "Activo",
                permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
            }
        });
        prisma.funcionario.findFirst.mockResolvedValue(null);

        const result = await guardarFuncionario({
            rut: "33.333.333-3",
            email: "admin@demo.local",
            nombre: "Admin",
            rol_id: 2,
            centro_id: "650",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "No puedes editar a un funcionario con mas privilegios que tu" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });

    it("bloquea cambiar estado o centro propio", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "700" });
        prisma.funcionario.findUnique.mockResolvedValue({
            rut: "11.111.111-1",
            rol_id: 1,
            estado: "Activo",
            centro_id: "650",
            role: {
                id_rol: 1,
                nombre_rol: "Administrador",
                estado: "Activo",
                permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
            }
        });
        prisma.funcionario.findFirst.mockResolvedValue(null);

        const result = await guardarFuncionario({
            rut: "11.111.111-1",
            email: "admin@demo.local",
            nombre: "Admin",
            rol_id: 1,
            centro_id: "700",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "No puedes cambiar tu propio rol, estado o centro" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });

    it("bloquea autoedicion sensible aunque el input venga normalizado y el RUT almacenado tenga puntos", async () => {
        (requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...user,
            rut: "11111111-1"
        });
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "700" });
        prisma.funcionario.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                rut: "11.111.111-1",
                rol_id: 1,
                estado: "Activo",
                centro_id: "650",
                role: {
                    id_rol: 1,
                    nombre_rol: "Administrador",
                    estado: "Activo",
                    permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
                }
            });
        prisma.$queryRaw.mockResolvedValueOnce([{ rut: "11.111.111-1" }]);
        prisma.funcionario.findFirst.mockResolvedValueOnce(null);

        const result = await guardarFuncionario({
            rut: "11111111-1",
            email: "admin.nuevo@demo.local",
            nombre: "Admin",
            rol_id: 1,
            centro_id: "700",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "No puedes cambiar tu propio rol, estado o centro" });
        expect(prisma.funcionario.create).not.toHaveBeenCalled();
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });

    it("bloquea dejar el sistema sin administradores activos", async () => {
        (requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...user,
            rut: "99.999.999-9",
            rol: { id: 99, nombre: "Supervisor" }
        });
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 2,
            nombre_rol: "SOME",
            estado: "Activo",
            permisos: [{ permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "650" });
        prisma.funcionario.findUnique.mockResolvedValue({
            rut: "11.111.111-1",
            rol_id: 1,
            estado: "Activo",
            centro_id: "650",
            role: {
                id_rol: 1,
                nombre_rol: "Administrador",
                estado: "Activo",
                permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
            }
        });
        prisma.funcionario.findFirst.mockResolvedValue(null);
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11111111-1", rol_id: 1 }]);

        const result = await guardarFuncionario({
            rut: "11.111.111-1",
            email: "admin@demo.local",
            nombre: "Admin",
            rol_id: 2,
            centro_id: "650",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "Debe quedar al menos un administrador activo" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });

    it("bloquea degradar al ultimo administrador aunque el RUT almacenado tenga puntos", async () => {
        (requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...user,
            rut: "99.999.999-9",
            rol: { id: 99, nombre: "Supervisor" }
        });
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 2,
            nombre_rol: "SOME",
            estado: "Activo",
            permisos: [{ permiso: "config.funcionarios" }]
        });
        prisma.centro.findUnique.mockResolvedValue({ id_centro: "650" });
        prisma.funcionario.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                rut: "11.111.111-1",
                rol_id: 1,
                estado: "Activo",
                centro_id: "650",
                role: {
                    id_rol: 1,
                    nombre_rol: "Administrador",
                    estado: "Activo",
                    permisos: [{ permiso: "config.roles" }, { permiso: "config.funcionarios" }]
                }
            });
        prisma.funcionario.findFirst.mockResolvedValueOnce(null);
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11.111.111-1", rol_id: 1 }]);

        const result = await guardarFuncionario({
            rut: "11.111.111-1",
            email: "admin@demo.local",
            nombre: "Admin",
            rol_id: 2,
            centro_id: "650",
            programa_asociado: "Programa cardiovascular",
            estado: "Activo"
        });

        expect(result).toEqual({ ok: false, error: "Debe quedar al menos un administrador activo" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });
});

describe("anti escalada en roles", () => {
    it("crea un rol llamado Administrador (el nombre ya no esta reservado)", async () => {
        prisma.role.findFirst.mockResolvedValue(null);
        prisma.role.create.mockResolvedValue({ id_rol: 5, nombre_rol: "Administrador", estado: "Activo" });
        const result = await guardarRol({ nombre_rol: " administrador ", estado: "Activo" });

        expect(result.ok).toBe(true);
        expect(result).toMatchObject({ ok: true, data: { id_rol: 5, nombre_rol: "Administrador" } });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith("CREATE", true, { rut: "11.111.111-1", name: "Admin" }, "rol:5", expect.anything());
        expect(AuditLogger.logSecurity).not.toHaveBeenCalled();
    });

    it("rechaza con error de negocio un nombre de rol ya existente", async () => {
        prisma.role.findFirst.mockResolvedValue({ id_rol: 1 });

        const result = await guardarRol({ nombre_rol: "Administrador", estado: "Activo" });

        expect(result).toEqual({ ok: false, error: "Ya existe un rol con ese nombre" });
        expect(prisma.role.create).not.toHaveBeenCalled();
    });

    it("bloquea editar un rol con permisos superiores al actor", async () => {
        (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.roles"]));
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.ver" }, { permiso: "config.roles" }, { permiso: "config.funcionarios" }]
        });
        prisma.role.findFirst.mockResolvedValue(null);

        const result = await guardarRol({ id_rol: 1, nombre_rol: "Administrador", estado: "Activo" });

        expect(result).toEqual({ ok: false, error: "No puedes editar un rol con mas privilegios que el tuyo" });
        expect(prisma.role.update).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).toHaveBeenCalled();
    });

    it("bloquea desactivar el ultimo rol administrador", async () => {
        (requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...user,
            rol: { id: 99, nombre: "Supervisor" }
        });
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }]
        });
        prisma.role.findFirst.mockResolvedValue(null);
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11.111.111-1", rol_id: 1 }]);

        const result = await guardarRol({ id_rol: 1, nombre_rol: "Administrador", estado: "Inactivo" });

        expect(result).toEqual({ ok: false, error: "Debe quedar al menos un administrador activo" });
        expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it("prioriza bloquear la autoedicion del rol propio antes que el ultimo administrador", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }]
        });
        prisma.role.findFirst.mockResolvedValue(null);
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11.111.111-1", rol_id: 1 }]);

        const result = await guardarRol({ id_rol: 1, nombre_rol: "Administrador", estado: "Inactivo" });

        expect(result).toEqual({ ok: false, error: "No puedes renombrar ni desactivar tu propio rol" });
        expect(prisma.role.update).not.toHaveBeenCalled();
    });
});

describe("anti escalada en permisos de rol", () => {
    it("bloquea otorgar permisos que el actor no tiene", async () => {
        (getPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["config.ver", "config.roles"]));
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 3,
            nombre_rol: "SOME",
            estado: "Activo",
            permisos: [{ permiso: "config.ver" }]
        });

        const result = await guardarPermisosRol({ rol_id: 3, permisos: ["config.ver", "config.funcionarios"] });

        expect(result).toEqual({ ok: false, error: "No puedes otorgar permisos que tu rol no tiene: Editar funcionarios" });
        expect(prisma.rolPermiso.deleteMany).not.toHaveBeenCalled();
        expect(prisma.rolPermiso.createMany).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).toHaveBeenCalledWith(
            "UPDATE",
            false,
            { rut: "11.111.111-1", name: "Admin" },
            expect.objectContaining({
                resourceId: "rol:3",
                error: "No puedes otorgar permisos que tu rol no tiene: Editar funcionarios"
            })
        );
    });

    it("bloquea quitar config.roles al ultimo administrador", async () => {
        (requirePermiso as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...user,
            rol: { id: 99, nombre: "Supervisor" }
        });
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }]
        });
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11.111.111-1", rol_id: 1 }]);

        const result = await guardarPermisosRol({ rol_id: 1, permisos: ["config.ver"] });

        expect(result).toEqual({ ok: false, error: "Debe quedar al menos un administrador activo" });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("prioriza bloquear quitar config.roles al propio rol antes que el ultimo administrador", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }]
        });
        prisma.funcionario.findMany.mockResolvedValue([{ rut: "11.111.111-1", rol_id: 1 }]);

        const result = await guardarPermisosRol({ rol_id: 1, permisos: ["config.ver"] });

        expect(result).toEqual({ ok: false, error: "No puedes quitar el permiso de editar roles a tu propio rol" });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("mantiene ZodError para permisos inventados", async () => {
        await expect(guardarPermisosRol({ rol_id: 3, permisos: ["inventado"] })).rejects.toThrow();
    });
});

describe("guardarPermisosRol", () => {
    beforeEach(() => {
        (prisma.rolPermiso.deleteMany as any).mockResolvedValue({ count: 1 });
        (prisma.rolPermiso.createMany as any).mockResolvedValue({ count: 2 });
    });

    it("reemplaza los permisos del rol", async () => {
        const resultado = await guardarPermisosRol({ rol_id: 3, permisos: ["config.ver", "config.roles"] });
        expect(resultado).toEqual({ ok: true, data: { id_rol: 3, permisos: ["config.ver", "config.roles"] } });
        expect(prisma.rolPermiso.deleteMany).toHaveBeenCalledWith({ where: { rol_id: 3 } });
        const argsCreate = (prisma.rolPermiso.createMany as any).mock.calls[0][0];
        expect(argsCreate.data).toEqual([
            { rol_id: 3, permiso: "config.ver" },
            { rol_id: 3, permiso: "config.roles" }
        ]);
    });

    it("rechaza claves que no existen en el catalogo", async () => {
        await expect(guardarPermisosRol({ rol_id: 3, permisos: ["modulo.inventado"] })).rejects.toThrow();
        expect(prisma.rolPermiso.deleteMany).not.toHaveBeenCalled();
    });

    it("impide que el usuario se quite config.roles a si mismo", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }]
        });

        const resultado = await guardarPermisosRol({ rol_id: 1, permisos: ["config.ver"] });

        expect(resultado).toEqual({ ok: false, error: "No puedes quitar el permiso de editar roles a tu propio rol" });
        expect(prisma.rolPermiso.deleteMany).not.toHaveBeenCalled();
    });

    it("permite editar el propio rol si conserva config.roles", async () => {
        prisma.role.findUnique.mockResolvedValue({
            id_rol: 1,
            nombre_rol: "Administrador",
            estado: "Activo",
            permisos: [{ permiso: "config.roles" }]
        });

        const resultado = await guardarPermisosRol({ rol_id: 1, permisos: ["config.ver", "config.roles"] });
        expect(resultado).toEqual({ ok: true, data: { id_rol: 1, permisos: ["config.ver", "config.roles"] } });
    });

    it("reemplaza los permisos dentro de una transaccion", async () => {
        await guardarPermisosRol({ rol_id: 3, permisos: ["config.ver", "config.roles"] });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        const operaciones = (prisma.$transaction as any).mock.calls[0][0];
        expect(operaciones).toHaveLength(2);
    });

    it("propaga el fallo de la transaccion", async () => {
        (prisma.$transaction as any).mockRejectedValue(new Error("fallo de conexion"));

        await expect(guardarPermisosRol({ rol_id: 3, permisos: ["config.ver"] })).rejects.toThrow("fallo de conexion");
    });
});
