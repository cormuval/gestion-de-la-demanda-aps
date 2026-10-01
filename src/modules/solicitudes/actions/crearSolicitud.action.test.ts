import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de dependencias de la action
vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        usuario: { findUnique: vi.fn(), create: vi.fn() },
        funcionario: { findUnique: vi.fn() },
        tipoSolicitud: { findFirst: vi.fn() },
        motivo: { findFirst: vi.fn(), count: vi.fn() },
        solicitud: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { crearSolicitud } from "./crearSolicitud.action";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";

const baseInput = {
    rut_usuario: "12.345.678-5",
    tipo_solicitud_id: 1,
    motivo_id: 1,
    disponibilidad_llamada: "Solo AM"
};

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "o@demo.local",
        nombre: "Orientador",
        centro_id: "650",
        centro_nombre: "CESFAM",
        rol: { id: 2, nombre: "Orientador" }
    });
    (prisma.$queryRaw as any).mockResolvedValue([{ nombre_centro: "Centro De Salud Familiar Esperanza" }]);
    (prisma.tipoSolicitud.findFirst as any).mockResolvedValue({ id_tipo_solicitud: 1 });
    (prisma.motivo.findFirst as any).mockResolvedValue({ id_motivo: 1 });
    (prisma.motivo.count as any).mockResolvedValue(1);
    (prisma.solicitud.findFirst as any).mockResolvedValue(null);
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
});

describe("crearSolicitud", () => {
    it("propaga el rechazo cuando falta el permiso", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(crearSolicitud(baseInput as any)).rejects.toThrow("No tienes permiso");
        expect(prisma.$queryRaw as any).not.toHaveBeenCalled();
    });

    it("rechaza input invalido (RUT incorrecto)", async () => {
        await expect(crearSolicitud({ ...baseInput, rut_usuario: "12.345.678-9" } as any)).rejects.toThrow("RUT invalido");
    });

    it("crea la solicitud con estado 'En Curso' y rut_orientador del usuario en sesion", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({
            rut: "12345678-5",
            nombre: "Paciente",
            apellido: "Demo",
            nombre_social: null,
            telefono: "+56911111111",
            telefono_alternativo: "+56922222222",
            fecha_nacimiento: new Date("1990-01-01T00:00:00"),
            priorizacion_administrativa: 2.5
        });
        (prisma.solicitud.create as any).mockResolvedValue({
            id_solicitud: "SOL-x",
            fecha_inicio: new Date("2026-07-02T12:00:00"),
            estado_solicitud: "En Curso",
            centro_id: "650",
            descripcion: null,
            disponibilidad_llamada: "Solo AM",
            priorizacion_admin: 2.5,
            ultimo_control: "36",
            accion: "En espera de validación",
            usuario: {
                rut: "12345678-5",
                nombre: "Paciente",
                apellido: "Demo",
                nombre_social: null,
                telefono: "+56911111111",
                telefono_alternativo: "+56922222222"
            },
            tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Tipo" },
            motivo: { id_motivo: 1, nombre_motivo: "Motivo" }
        });

        const result = await crearSolicitud({ ...baseInput, rut_usuario: "12.345.678-5" } as any);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.solicitud.id_solicitud).toBe("SOL-x");
            expect(result.data.voucher.id_solicitud).toBe("SOL-x");
        }
        expect(prisma.solicitud.create).toHaveBeenCalledTimes(1);
        const arg = (prisma.solicitud.create as any).mock.calls[0][0];
        expect(arg.data.estado_solicitud).toBe("En Curso");
        expect(arg.data.rut_orientador).toBe("22.222.222-2");
        expect(arg.data.tipo_solicitud_id).toBe(1);
        expect(arg.data.centro_id).toBe("650");
        expect(arg.data.priorizacion_admin).toBe(2.5);
        expect(arg.data.ultimo_control).toEqual(expect.any(String));
        expect(arg.data.accion).toBe("En espera de validación");
        expect(prisma.solicitud.findMany).toHaveBeenCalledWith({
            where: {
                rut_usuario: "12345678-5",
                estado_solicitud: "En Curso"
            },
            select: {
                id_solicitud: true,
                fecha_inicio: true,
                tipo_solicitud_id: true,
                motivo_id: true
            }
        });
    });

    it("crea solicitud sin motivo si el tipo no tiene motivos activos", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({
            rut: "12345678-5",
            nombre: "Paciente",
            apellido: "Demo",
            nombre_social: null,
            telefono: null,
            telefono_alternativo: null,
            fecha_nacimiento: null,
            priorizacion_administrativa: null
        });
        (prisma.motivo.count as any).mockResolvedValue(0);
        (prisma.solicitud.create as any).mockResolvedValue({
            id_solicitud: "SOL-x",
            fecha_inicio: new Date("2026-07-02T12:00:00"),
            estado_solicitud: "En Curso",
            centro_id: "650",
            descripcion: null,
            disponibilidad_llamada: "Solo AM",
            priorizacion_admin: null,
            ultimo_control: null,
            usuario: { rut: "12345678-5", nombre: "Paciente", apellido: "Demo", nombre_social: null, telefono: null, telefono_alternativo: null },
            tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Tipo" },
            motivo: null
        });

        const result = await crearSolicitud({ ...baseInput, motivo_id: null } as any);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.solicitud.id_solicitud).toBe("SOL-x");
            expect(result.data.voucher.id_solicitud).toBe("SOL-x");
        }
        const arg = (prisma.solicitud.create as any).mock.calls[0][0];
        expect(arg.data.motivo_id).toBeNull();
    });

    it("rechaza duplicado en curso con mismo usuario, tipo y motivo", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({
            rut: "12345678-5",
            nombre: "Paciente",
            apellido: "Demo",
            nombre_social: null,
            telefono: null,
            telefono_alternativo: null,
            fecha_nacimiento: null,
            priorizacion_administrativa: null
        });
        (prisma.solicitud.findMany as any).mockResolvedValue([
            {
                id_solicitud: "SOL-duplicada",
                fecha_inicio: new Date("2026-07-02T12:00:00"),
                tipo_solicitud_id: 1,
                motivo_id: 1
            }
        ]);

        await expect(crearSolicitud(baseInput as any)).resolves.toEqual({
            ok: false,
            error: expect.stringContaining("Ya existe la solicitud SOL-icada")
        });
        expect(prisma.solicitud.findMany).toHaveBeenCalledWith({
            where: {
                rut_usuario: "12345678-5",
                estado_solicitud: "En Curso"
            },
            select: {
                id_solicitud: true,
                fecha_inicio: true,
                tipo_solicitud_id: true,
                motivo_id: true
            }
        });
        expect(prisma.solicitud.create).not.toHaveBeenCalled();
    });

    it("rechaza duplicado sin motivo solo cuando la solicitud en curso tambien no tiene motivo", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({
            rut: "12345678-5",
            nombre: "Paciente",
            apellido: "Demo",
            nombre_social: null,
            telefono: null,
            telefono_alternativo: null,
            fecha_nacimiento: null,
            priorizacion_administrativa: null
        });
        (prisma.motivo.count as any).mockResolvedValue(0);
        (prisma.solicitud.findMany as any).mockResolvedValue([
            {
                id_solicitud: "SOL-con-motivo",
                fecha_inicio: new Date("2026-07-01T12:00:00"),
                tipo_solicitud_id: 1,
                motivo_id: 1
            },
            {
                id_solicitud: "SOL-sin-motivo",
                fecha_inicio: new Date("2026-07-02T12:00:00"),
                tipo_solicitud_id: 1,
                motivo_id: null
            }
        ]);

        await expect(crearSolicitud({ ...baseInput, motivo_id: null } as any)).resolves.toEqual({
            ok: false,
            error: expect.stringContaining("Ya existe la solicitud SOL-otivo")
        });
        expect(prisma.solicitud.create).not.toHaveBeenCalled();
    });

    it("permite crear sin motivo cuando solo existe duplicado con motivo distinto", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({
            rut: "12345678-5",
            nombre: "Paciente",
            apellido: "Demo",
            nombre_social: null,
            telefono: null,
            telefono_alternativo: null,
            fecha_nacimiento: null,
            priorizacion_administrativa: null
        });
        (prisma.motivo.count as any).mockResolvedValue(0);
        (prisma.solicitud.findMany as any).mockResolvedValue([
            {
                id_solicitud: "SOL-con-motivo",
                fecha_inicio: new Date("2026-07-01T12:00:00"),
                tipo_solicitud_id: 1,
                motivo_id: 1
            }
        ]);
        (prisma.solicitud.create as any).mockResolvedValue({
            id_solicitud: "SOL-x",
            fecha_inicio: new Date("2026-07-02T12:00:00"),
            estado_solicitud: "En Curso",
            centro_id: "650",
            descripcion: null,
            disponibilidad_llamada: "Solo AM",
            priorizacion_admin: null,
            ultimo_control: null,
            accion: "En espera de validación",
            usuario: { rut: "12345678-5", nombre: "Paciente", apellido: "Demo", nombre_social: null, telefono: null, telefono_alternativo: null },
            tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Tipo" },
            motivo: null
        });

        const result = await crearSolicitud({ ...baseInput, motivo_id: null } as any);

        expect(result.ok).toBe(true);
        expect(prisma.solicitud.create).toHaveBeenCalledTimes(1);
    });

    it("rechaza solicitud sin motivo si el tipo tiene motivos activos", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({ rut: "12345678-5" });
        (prisma.motivo.count as any).mockResolvedValue(1);

        await expect(crearSolicitud({ ...baseInput, motivo_id: null } as any)).resolves.toEqual({
            ok: false,
            error: expect.stringContaining("Motivo requerido")
        });
    });

    it("rechaza tipo no habilitado para el centro del funcionario", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({ rut: "12345678-5" });
        (prisma.tipoSolicitud.findFirst as any).mockResolvedValue(null);

        await expect(crearSolicitud(baseInput as any)).resolves.toEqual({
            ok: false,
            error: expect.stringContaining("no habilitado para el centro")
        });
    });

    it("rechaza funcionario sin centro cuando la sesion no trae centro", async () => {
        (requirePermiso as any).mockResolvedValue({
            rut: "22.222.222-2",
            email: "o@demo.local",
            nombre: "Orientador",
            centro_id: null,
            centro_nombre: null,
            rol: { id: 2, nombre: "Orientador" }
        });
        (prisma.funcionario.findUnique as any).mockResolvedValue({ centro_id: null });

        await expect(crearSolicitud(baseInput as any)).resolves.toEqual({
            ok: false,
            error: expect.stringContaining("no tiene centro asignado")
        });
        expect(prisma.$queryRaw as any).not.toHaveBeenCalled();
    });

    it("rechaza centro no validable para tipo de solicitud", async () => {
        (prisma.$queryRaw as any).mockResolvedValue([{ nombre_centro: "Centro Sin Mapeo" }]);

        await expect(crearSolicitud(baseInput as any)).resolves.toEqual({
            ok: false,
            error: expect.stringContaining("No se pudo validar el centro")
        });
        expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it("rechaza usuario no confirmado", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue(null);

        await expect(crearSolicitud(baseInput as any)).resolves.toEqual({
            ok: false,
            error: expect.stringContaining("Debes crear o confirmar el usuario")
        });
        expect(prisma.solicitud.create).not.toHaveBeenCalled();
    });

    it("rechaza motivo invalido", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({ rut: "12345678-5" });
        (prisma.motivo.findFirst as any).mockResolvedValue(null);

        await expect(crearSolicitud(baseInput as any)).resolves.toEqual({
            ok: false,
            error: expect.stringContaining("Motivo inactivo")
        });
        expect(prisma.solicitud.create).not.toHaveBeenCalled();
    });
});
