import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        usuario: { update: vi.fn() }
    }
}));
vi.mock("@/shared/lib/auth", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { actualizarUsuarioComunicador } from "./actualizarUsuarioComunicador.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

const inputValido = {
    rut: "12345678-5",
    nombre: "Juan",
    apellido: "Pérez",
    genero: "Masculino",
    fecha_nacimiento: "1990-05-10",
    telefono: "999",
    telefono_alternativo: "888",
    gestante: "No aplica",
    discapacidad: "El usuario poseé una credencial de discapacidad.",
    centro_id: "501"
};

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
    (prisma.$queryRaw as any).mockResolvedValue([{ id_centro: "501" }]);
    (prisma.usuario.update as any).mockResolvedValue({ rut: "1-9", nombre: "Juan" });
});

describe("actualizarUsuarioComunicador", () => {
    it("rechaza rol sin acceso al comunicador", async () => {
        (requireSessionUser as any).mockResolvedValue({ rut: "1-9", email: "o@x.cl", nombre: "O", centro_id: "501", rol: { id: 2, nombre: "Orientador" }, menu: [] });
        await expect(actualizarUsuarioComunicador(inputValido as any)).rejects.toThrow("No tienes permiso");
    });

    it("actualiza el usuario para un rol de comunicador", async () => {
        const r = await actualizarUsuarioComunicador(inputValido as any);
        expect(r.usuario.rut).toBe("1-9");
        expect(prisma.usuario.update).toHaveBeenCalledTimes(1);
    });
});
