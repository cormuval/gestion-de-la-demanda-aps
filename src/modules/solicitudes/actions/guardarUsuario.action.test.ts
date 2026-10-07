import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        usuario: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn()
        }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";
import { requirePermiso } from "@/shared/lib/permisos";
import { actualizarUsuario, crearUsuario } from "./guardarUsuario.action";

// `as const` mantiene los literales de las uniones (genero, gestante, discapacidad);
// sin el, TypeScript los ensancha a string y el fixture deja de tipar.
const usuarioInput = {
    rut: "12.345.678-5",
    nombre: "Paciente",
    apellido: "Demo",
    nombre_social: "Nombre Social",
    correo_contacto: "paciente@demo.local",
    sector: "Sector 1",
    genero: "Femenino",
    fecha_nacimiento: "1990-01-01",
    telefono: "+56911111111",
    telefono_alternativo: "+56922222222",
    gestante: "No",
    discapacidad: "El usuario no poseé una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
    centro_id: "650"
} as const;

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
    (prisma.$queryRaw as any).mockResolvedValue([{ id_centro: "650" }]);
});

describe("guardarUsuario actions", () => {
    it("rechaza crear usuario con RUT invalido", async () => {
        await expect(crearUsuario({ ...usuarioInput, rut: "12.345.678-9" })).rejects.toThrow("RUT invalido");
    });

    it("retorna error de negocio al crear usuario duplicado sin escribir ni auditar", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({ rut: "12345678-5" });
        expect(await crearUsuario(usuarioInput)).toEqual({ ok: false, error: "El usuario ya existe" });
        expect(prisma.usuario.create).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("retorna error de negocio al crear con centro inexistente sin escribir ni auditar", async () => {
        (prisma.$queryRaw as any).mockResolvedValue([]);
        expect(await crearUsuario(usuarioInput)).toEqual({ ok: false, error: "Centro no encontrado" });
        expect(prisma.usuario.create).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("retorna error de negocio al actualizar con centro inexistente sin escribir ni auditar", async () => {
        (prisma.$queryRaw as any).mockResolvedValue([]);

        expect(await actualizarUsuario(usuarioInput)).toEqual({ ok: false, error: "Centro no encontrado" });
        expect(prisma.usuario.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("crea usuario con RUT normalizado", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue(null);
        const usuario = { rut: "12345678-5" };
        (prisma.usuario.create as any).mockResolvedValue(usuario);

        await expect(crearUsuario(usuarioInput)).resolves.toEqual({ ok: true, data: { usuario } });

        const arg = (prisma.usuario.create as any).mock.calls[0][0];
        expect(arg.data.rut).toBe("12345678-5");
        expect(arg.data.centro_id).toBe("650");
        expect(arg.data.nombre_social).toBe("Nombre Social");
        expect(arg.data.correo_contacto).toBe("paciente@demo.local");
        expect(arg.data.sector).toBe("Sector 1");
        expect(arg.data.priorizacion_administrativa).toEqual(expect.any(Number));
    });

    it("actualiza usuario sin cambiar el RUT", async () => {
        const usuario = { rut: "12345678-5" };
        (prisma.usuario.update as any).mockResolvedValue(usuario);

        await expect(actualizarUsuario(usuarioInput)).resolves.toEqual({ ok: true, data: { usuario } });

        const arg = (prisma.usuario.update as any).mock.calls[0][0];
        expect(arg.where.rut).toBe("12345678-5");
        expect(arg.data.rut).toBeUndefined();
        expect(arg.data.nombre).toBe("Paciente");
        expect(arg.data.nombre_social).toBe("Nombre Social");
        expect(arg.data.correo_contacto).toBe("paciente@demo.local");
        expect(arg.data.sector).toBe("Sector 1");
        expect(arg.data.priorizacion_administrativa).toEqual(expect.any(Number));
    });

    it("fuerza gestante No aplica si genero no es Femenino", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue(null);
        (prisma.usuario.create as any).mockResolvedValue({ rut: "12345678-5" });

        await crearUsuario({ ...usuarioInput, genero: "Masculino", gestante: "Si" });

        const arg = (prisma.usuario.create as any).mock.calls[0][0];
        expect(arg.data.gestante).toBe("No aplica");
    });

    it("propaga fallas de Prisma al crear", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue(null);
        (prisma.usuario.create as any).mockRejectedValue(new Error("Falla de Prisma"));

        await expect(crearUsuario(usuarioInput)).rejects.toThrow("Falla de Prisma");
    });
});
