import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        funcionario: { findUnique: vi.fn() },
        solicitud: { findFirst: vi.fn(), findUnique: vi.fn() },
        $queryRaw: vi.fn()
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { getVoucherSolicitud } from "./getVoucherSolicitud.action";

const solicitudEnCurso = {
    id_solicitud: "SOL-1",
    fecha_inicio: new Date("2026-11-05T10:00:00.000Z"),
    disponibilidad_llamada: "Solo AM",
    usuario: {
        rut: "12.345.678-5",
        telefono: "+56911111111",
        telefono_alternativo: "+56922222222"
    },
    tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Morbilidad" },
    motivo: { id_motivo: 2, nombre_motivo: "Control" }
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermiso).mockResolvedValue({
        rut: "22.222.222-2",
        email: "orientador@demo.local",
        nombre: "Orientador",
        centro_id: "650",
        centro_nombre: "CESFAM Esperanza",
        rol: { id: 2, nombre: "Orientador" }
    });
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ nombre_centro: "CESFAM Esperanza" }]);
});

describe("getVoucherSolicitud", () => {
    it("admite solicitudes.ver o historial.ver", async () => {
        await getVoucherSolicitud("SOL-1").catch(() => undefined);

        expect(requirePermiso).toHaveBeenCalledWith("solicitudes.ver", "historial.ver");
    });

    it.each(["", "   ", null])("rechaza un ID de solicitud vacio o invalido sin consultar Prisma", async (idSolicitud) => {
        await expect(getVoucherSolicitud(idSolicitud as never)).resolves.toEqual({
            ok: false,
            error: "ID de solicitud requerido"
        });

        expect(prisma.funcionario.findUnique).not.toHaveBeenCalled();
        expect(prisma.solicitud.findFirst).not.toHaveBeenCalled();
        expect(prisma.solicitud.findUnique).not.toHaveBeenCalled();
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("devuelve el error estandar cuando el funcionario no tiene centro asignado", async () => {
        vi.mocked(requirePermiso).mockResolvedValueOnce({
            rut: "22.222.222-2",
            email: "orientador@demo.local",
            nombre: "Orientador",
            centro_id: null,
            centro_nombre: null,
            rol: { id: 2, nombre: "Orientador" }
        });
        vi.mocked(prisma.funcionario.findUnique).mockResolvedValueOnce(null);

        await expect(getVoucherSolicitud("SOL-1")).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
        expect(prisma.solicitud.findFirst).not.toHaveBeenCalled();
    });

    it("obtiene y mapea el voucher de una solicitud En Curso del centro activo", async () => {
        vi.mocked(prisma.solicitud.findFirst).mockResolvedValueOnce(solicitudEnCurso as never);

        await expect(getVoucherSolicitud("SOL-1")).resolves.toEqual({
            ok: true,
            data: {
                id_solicitud: "SOL-1",
                fecha_inicio: new Date("2026-11-05T10:00:00.000Z"),
                rut: "12.345.678-5",
                usuario: solicitudEnCurso.usuario,
                tipoSolicitud: solicitudEnCurso.tipoSolicitud,
                motivo: solicitudEnCurso.motivo,
                centro: "CESFAM Esperanza",
                disponibilidad_llamada: "Solo AM"
            }
        });
        expect(prisma.solicitud.findFirst).toHaveBeenCalledWith({
            where: {
                id_solicitud: "SOL-1",
                centro_id: "650",
                estado_solicitud: "En Curso"
            },
            select: {
                id_solicitud: true,
                fecha_inicio: true,
                disponibilidad_llamada: true,
                usuario: {
                    select: {
                        rut: true,
                        telefono: true,
                        telefono_alternativo: true
                    }
                },
                tipoSolicitud: { select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true } },
                motivo: { select: { id_motivo: true, nombre_motivo: true } }
            }
        });
    });

    it("excluye nombres del usuario en la reimpresion", async () => {
        vi.mocked(prisma.solicitud.findFirst).mockResolvedValueOnce(solicitudEnCurso as never);
        const resultado = await getVoucherSolicitud("SOL-1");
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        expect(resultado.data.usuario).not.toHaveProperty("nombre");
        expect(resultado.data.usuario).not.toHaveProperty("apellido");
        expect(resultado.data.usuario).not.toHaveProperty("nombre_social");
    });

    it("informa que una solicitud cerrada del centro activo no se puede reimprimir", async () => {
        vi.mocked(prisma.solicitud.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.solicitud.findUnique).mockResolvedValueOnce({
            id_solicitud: "SOL-1",
            centro_id: "650",
            estado_solicitud: "Gestionada"
        } as never);

        await expect(getVoucherSolicitud("SOL-1")).resolves.toEqual({
            ok: false,
            error: "Solo se pueden reimprimir vouchers de solicitudes En Curso"
        });
        expect(prisma.solicitud.findUnique).toHaveBeenCalledWith({
            where: { id_solicitud: "SOL-1" },
            select: { id_solicitud: true, centro_id: true, estado_solicitud: true }
        });
    });

    it("devuelve un error generico para una solicitud inexistente", async () => {
        vi.mocked(prisma.solicitud.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.solicitud.findUnique).mockResolvedValueOnce(null);

        await expect(getVoucherSolicitud("SOL-inexistente")).resolves.toEqual({
            ok: false,
            error: "No fue posible obtener el voucher de la solicitud"
        });
    });

    it("no revela datos de una solicitud de otro centro", async () => {
        vi.mocked(prisma.solicitud.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.solicitud.findUnique).mockResolvedValueOnce({
            id_solicitud: "SOL-otro-centro",
            centro_id: "999",
            estado_solicitud: "En Curso"
        } as never);

        await expect(getVoucherSolicitud("SOL-otro-centro")).resolves.toEqual({
            ok: false,
            error: "No fue posible obtener el voucher de la solicitud"
        });
    });

    it("audita la lectura exitosa del voucher", async () => {
        vi.mocked(prisma.solicitud.findFirst).mockResolvedValueOnce(solicitudEnCurso as never);

        await getVoucherSolicitud("SOL-1");

        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
            "SEARCH",
            true,
            { id: "orientador@demo.local", name: "Orientador", rut: "22.222.222-2" },
            "SOL-1",
            { details: "Reimpresion de voucher de solicitud" }
        );
    });
});
