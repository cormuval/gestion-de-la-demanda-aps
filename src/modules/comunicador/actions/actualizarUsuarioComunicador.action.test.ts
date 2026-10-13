import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        usuario: { update: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { actualizarUsuarioComunicador } from "./actualizarUsuarioComunicador.action";
import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";
import { requirePermiso } from "@/shared/lib/permisos";

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
    (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" } });
    (prisma.$queryRaw as any).mockResolvedValue([{ id_centro: "501" }]);
    (prisma.usuario.update as any).mockResolvedValue({ rut: "1-9", nombre: "Juan" });
});

describe("actualizarUsuarioComunicador", () => {
    it("propaga el rechazo cuando falta el permiso", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));
        await expect(actualizarUsuarioComunicador(inputValido as any)).rejects.toThrow("No tienes permiso");
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it("actualiza el usuario para un rol de comunicador", async () => {
        const usuario = { rut: "1-9", nombre: "Juan" };
        (prisma.usuario.update as any).mockResolvedValue(usuario);

        await expect(actualizarUsuarioComunicador(inputValido as any)).resolves.toEqual({ ok: true, data: { usuario } });
        expect(prisma.usuario.update).toHaveBeenCalledTimes(1);
    });

    it("retorna error de negocio con centro inexistente sin escribir ni auditar", async () => {
        (prisma.$queryRaw as any).mockResolvedValue([]);

        expect(await actualizarUsuarioComunicador(inputValido as any)).toEqual({ ok: false, error: "Centro no encontrado" });
        expect(prisma.usuario.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("propaga fallas de Prisma", async () => {
        (prisma.usuario.update as any).mockRejectedValue(new Error("Falla de Prisma"));

        await expect(actualizarUsuarioComunicador(inputValido as any)).rejects.toThrow("Falla de Prisma");
    });
});
