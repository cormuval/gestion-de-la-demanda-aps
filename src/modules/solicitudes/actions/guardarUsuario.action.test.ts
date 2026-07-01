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
vi.mock("@/shared/lib/auth", () => ({
    requireSessionUser: vi.fn()
}));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { actualizarUsuario, crearUsuario } from "./guardarUsuario.action";

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
    discapacidad: "El usuario no posee una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
    centro_id: "650"
};

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "o@demo.local",
        nombre: "Orientador",
        centro_id: "650",
        rol: { id: 2, nombre: "Orientador" },
        menu: []
    });
    (prisma.$queryRaw as any).mockResolvedValue([{ id_centro: "650" }]);
});

describe("guardarUsuario actions", () => {
    it("rechaza crear usuario con RUT invalido", async () => {
        await expect(crearUsuario({ ...usuarioInput, rut: "12.345.678-9" })).rejects.toThrow("RUT invalido");
    });

    it("rechaza crear usuario duplicado", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({ rut: "12345678-5" });
        await expect(crearUsuario(usuarioInput)).rejects.toThrow("El usuario ya existe");
    });

    it("rechaza centro inexistente", async () => {
        (prisma.$queryRaw as any).mockResolvedValue([]);
        await expect(crearUsuario(usuarioInput)).rejects.toThrow("Centro no encontrado");
    });

    it("crea usuario con RUT normalizado", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue(null);
        (prisma.usuario.create as any).mockResolvedValue({ rut: "12345678-5" });

        await crearUsuario(usuarioInput);

        const arg = (prisma.usuario.create as any).mock.calls[0][0];
        expect(arg.data.rut).toBe("12345678-5");
        expect(arg.data.centro_id).toBe("650");
        expect(arg.data.nombre_social).toBe("Nombre Social");
        expect(arg.data.correo_contacto).toBe("paciente@demo.local");
        expect(arg.data.sector).toBe("Sector 1");
    });

    it("actualiza usuario sin cambiar el RUT", async () => {
        (prisma.usuario.update as any).mockResolvedValue({ rut: "12345678-5" });

        await actualizarUsuario(usuarioInput);

        const arg = (prisma.usuario.update as any).mock.calls[0][0];
        expect(arg.where.rut).toBe("12345678-5");
        expect(arg.data.rut).toBeUndefined();
        expect(arg.data.nombre).toBe("Paciente");
        expect(arg.data.nombre_social).toBe("Nombre Social");
        expect(arg.data.correo_contacto).toBe("paciente@demo.local");
        expect(arg.data.sector).toBe("Sector 1");
    });

    it("fuerza gestante No aplica si genero no es Femenino", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue(null);
        (prisma.usuario.create as any).mockResolvedValue({ rut: "12345678-5" });

        await crearUsuario({ ...usuarioInput, genero: "Masculino", gestante: "Si" });

        const arg = (prisma.usuario.create as any).mock.calls[0][0];
        expect(arg.data.gestante).toBe("No aplica");
    });
});
