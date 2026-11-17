import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        funcionario: { findUnique: vi.fn() },
        solicitud: { findMany: vi.fn() },
        cita: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { getOtrasSolicitudes } from "./getOtrasSolicitudes.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "gestor@demo.local",
        nombre: "Gestor",
        centro_id: "650",
        rol: { id: 2, nombre: "Gestor" }
    });
    (prisma.solicitud.findMany as any).mockResolvedValue([{ id_solicitud: "SOL-2", accion: "Realizar solicitud", citas: [
        { id_cita: "CITA-1", estado_cita: "Sin llamadas", llamadas: [] },
        { id_cita: "CITA-2", estado_cita: "No contesta (1)", llamadas: [{}] },
        { id_cita: "CITA-3", estado_cita: "Cita Aceptada", llamadas: [{}] }
    ] }]);
});

describe("getOtrasSolicitudes", () => {
    it("consulta solicitudes del centro con citas anidadas y conserva reglas de edición", async () => {
        const result = await getOtrasSolicitudes("12.345.678-5", "SOL-1");
        const args = (prisma.solicitud.findMany as any).mock.calls[0][0];
        expect(args.where).toEqual({ rut_usuario: "12345678-5", id_solicitud: { not: "SOL-1" }, estado_solicitud: "En Curso", centro_id: "650" });
        expect(args.select.citas.where).toEqual({ centro_id: "650" });
        expect(prisma.cita.findMany).not.toHaveBeenCalled();
        expect(result.ok && result.data.solicitudes[0].citas.map((cita) => [cita.editable, cita.puedeRegistrarRechazo])).toEqual([[true, true], [false, true], [false, false]]);
    });

    it("selecciona solo los campos del usuario usados por las acciones", async () => {
        await getOtrasSolicitudes("12345678-5", "SOL-1");
        const args = vi.mocked(prisma.solicitud.findMany).mock.calls[0][0]!;
        expect(args.select?.usuario).toEqual({
            select: {
                rut: true,
                nombre: true,
                apellido: true,
                nombre_social: true,
                correo_contacto: true,
                sector: true,
                genero: true,
                fecha_nacimiento: true,
                telefono: true,
                telefono_alternativo: true,
                gestante: true,
                discapacidad: true,
                centro_id: true
            }
        });
    });

    it("resuelve centro desde funcionario si la sesion no trae centro", async () => {
        (requirePermiso as any).mockResolvedValueOnce({
            rut: "22.222.222-2",
            email: "gestor@demo.local",
            nombre: "Gestor",
            centro_id: null,
            rol: { id: 2, nombre: "Gestor" }
        });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce({ centro_id: "501" });

        await getOtrasSolicitudes("12345678-5", "SOL-1");

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ centro_id: "501" }) }));
    });

    it("devuelve rut requerido como error de negocio", async () => {
        await expect(getOtrasSolicitudes("", "SOL-1")).resolves.toEqual({ ok: false, error: "rutUsuario es requerido" });
        expect(prisma.solicitud.findMany).not.toHaveBeenCalled();
    });

    it("devuelve listas vacias como exito", async () => {
        (prisma.solicitud.findMany as any).mockResolvedValueOnce([]);
        await expect(getOtrasSolicitudes("12345678-5", "SOL-1")).resolves.toEqual({
            ok: true,
            data: { solicitudes: [] }
        });
    });

    it("devuelve error de configuracion cuando el funcionario no tiene centro", async () => {
        (requirePermiso as any).mockResolvedValueOnce({ rut: "22.222.222-2", centro_id: null });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce(null);

        await expect(getOtrasSolicitudes("12345678-5", "SOL-1")).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
    });

    it("mantiene los errores de permiso como rechazos", async () => {
        (requirePermiso as any).mockRejectedValueOnce(new Error("Sin permiso"));

        await expect(getOtrasSolicitudes("12345678-5", "SOL-1")).rejects.toThrow("Sin permiso");
    });

    it("mantiene los errores de Prisma como rechazos", async () => {
        (prisma.solicitud.findMany as any).mockRejectedValueOnce(new Error("DB caida"));

        await expect(getOtrasSolicitudes("12345678-5", "SOL-1")).rejects.toThrow("DB caida");
    });
});
