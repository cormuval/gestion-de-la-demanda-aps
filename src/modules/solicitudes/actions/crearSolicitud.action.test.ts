import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de dependencias de la action
vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        usuario: { findUnique: vi.fn(), create: vi.fn() },
        solicitud: { create: vi.fn() }
    }
}));
vi.mock("@/shared/lib/auth", () => ({
    requireSessionUser: vi.fn()
}));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { crearSolicitud } from "./crearSolicitud.action";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

const baseInput = {
    rut_usuario: "12.345.678-9",
    nombre_usuario: "Paciente",
    apellido_usuario: "Demo",
    tipo_solicitud_id: 1,
    motivo_id: 1
};

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({ rut: "22.222.222-2", email: "o@demo.local", nombre: "Orientador", rol: { id: 2, nombre: "Orientador" }, menu: [] });
});

describe("crearSolicitud", () => {
    it("rechaza si el rol no tiene acceso", async () => {
        (requireSessionUser as any).mockResolvedValue({ rut: "33.333.333-3", email: "c@demo.local", nombre: "Comunicador", rol: { id: 3, nombre: "Comunicador" }, menu: [] });
        await expect(crearSolicitud(baseInput as any)).rejects.toThrow("No tienes permiso");
    });

    it("rechaza input invalido (falta nombre)", async () => {
        await expect(crearSolicitud({ ...baseInput, nombre_usuario: "" } as any)).rejects.toThrow("Nombre requerido");
    });

    it("crea la solicitud con estado 'En Curso' y rut_orientador del usuario en sesion", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValue({ rut: "12.345.678-9" });
        (prisma.solicitud.create as any).mockResolvedValue({ id_solicitud: "SOL-x" });

        await crearSolicitud(baseInput as any);

        expect(prisma.solicitud.create).toHaveBeenCalledTimes(1);
        const arg = (prisma.solicitud.create as any).mock.calls[0][0];
        expect(arg.data.estado_solicitud).toBe("En Curso");
        expect(arg.data.rut_orientador).toBe("22.222.222-2");
        expect(arg.data.tipo_solicitud_id).toBe(1);
    });
});
