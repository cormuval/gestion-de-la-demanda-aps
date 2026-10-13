import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        centro: { findUnique: vi.fn() },
        funcionario: { update: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({
    getSessionPermisos: vi.fn()
}));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: {
        logDataAccess: vi.fn(),
        logSecurity: vi.fn()
    }
}));

import { cambiarCentroActivo } from "./cambiarCentroActivo.action";
import { prisma as prismaClient } from "@/shared/lib/prisma";
import { getSessionPermisos } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";

const prisma = prismaClient as any;

const user = {
    rut: "11-1",
    email: "admin@demo.local",
    nombre: "Admin",
    centro_id: "501",
    centro_nombre: "CESFAM Placeres",
    rol: { id: 1, nombre: "Administrador" }
};

beforeEach(() => {
    vi.clearAllMocks();
    (AuditLogger.logDataAccess as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (AuditLogger.logSecurity as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (getSessionPermisos as ReturnType<typeof vi.fn>).mockResolvedValue({ user, permisos: new Set(["config.roles"]) });
    (prisma.centro.findUnique as any).mockResolvedValue(null);
    (prisma.funcionario.update as any).mockResolvedValue({});
});

describe("cambiarCentroActivo", () => {
    it("rechaza a quien no es administrador sin escribir y audita el bloqueo", async () => {
        (getSessionPermisos as ReturnType<typeof vi.fn>).mockResolvedValue({ user, permisos: new Set(["config.ver"]) });

        const resultado = await cambiarCentroActivo("655");

        expect(resultado).toEqual({ ok: false, error: "Solo un administrador puede cambiar su centro" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).toHaveBeenCalledWith(
            "UPDATE",
            false,
            { rut: user.rut, name: user.nombre },
            expect.objectContaining({ error: "Solo un administrador puede cambiar su centro" })
        );
    });

    it("rechaza un centro inexistente o vacio", async () => {
        (prisma.centro.findUnique as any).mockResolvedValue(null);

        await expect(cambiarCentroActivo("999")).resolves.toEqual({ ok: false, error: "El centro seleccionado no existe" });
        await expect(cambiarCentroActivo("")).resolves.toEqual({ ok: false, error: "El centro seleccionado no existe" });

        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });

    it("no escribe si el centro es el actual", async () => {
        (prisma.centro.findUnique as any).mockResolvedValue({ id_centro: "501", nombre_centro: "CESFAM Placeres" });

        const resultado = await cambiarCentroActivo("501");

        expect(resultado).toEqual({ ok: true, data: { centro_id: "501", centro_nombre: "CESFAM Placeres" } });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
    });

    it("actualiza solo al funcionario en sesion y audita el cambio", async () => {
        (prisma.centro.findUnique as any).mockResolvedValue({ id_centro: "655", nombre_centro: "CESFAM Reina Isabel II" });

        const resultado = await cambiarCentroActivo("655");

        expect(prisma.funcionario.update).toHaveBeenCalledWith({ where: { rut: "11-1" }, data: { centro_id: "655" } });
        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
            "UPDATE",
            true,
            { rut: user.rut, name: user.nombre },
            "funcionario:11-1",
            expect.objectContaining({ details: expect.stringContaining("501 -> 655") })
        );
        expect(resultado).toEqual({ ok: true, data: { centro_id: "655", centro_nombre: "CESFAM Reina Isabel II" } });
    });

    it("devuelve error sin sesion", async () => {
        (getSessionPermisos as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const resultado = await cambiarCentroActivo("655");

        expect(resultado).toEqual({ ok: false, error: "No autenticado" });
        expect(prisma.funcionario.update).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
        expect(AuditLogger.logSecurity).not.toHaveBeenCalled();
    });
});
