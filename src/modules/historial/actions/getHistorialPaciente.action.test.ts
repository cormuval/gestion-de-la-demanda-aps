import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        usuario: { findUnique: vi.fn() },
        solicitud: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { getHistorialPaciente } from "./getHistorialPaciente.action";

const SESION = { rut: "9-9", nombre: "Func", centro_id: "655" };

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue(SESION);
    (prisma.usuario.findUnique as any).mockResolvedValue({ rut: "12345678-5", nombre: "Juana", apellido: "Perez" });
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
});

describe("getHistorialPaciente", () => {
    it("exige historial.ver", async () => {
        await getHistorialPaciente("12345678-5");

        expect(requirePermiso).toHaveBeenCalledWith("historial.ver");
    });

    it("rechaza un RUT invalido sin consultar", async () => {
        const resultado = await getHistorialPaciente("123");

        expect(resultado).toEqual({ ok: false, error: "RUT invalido" });
        expect(prisma.solicitud.findMany).not.toHaveBeenCalled();
    });

    it("informa cuando el funcionario no tiene centro", async () => {
        (requirePermiso as any).mockResolvedValueOnce({ ...SESION, centro_id: null });

        const resultado = await getHistorialPaciente("12345678-5");

        expect(resultado).toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
    });

    it("paciente inexistente devuelve historial vacio", async () => {
        (prisma.usuario.findUnique as any).mockResolvedValueOnce(null);

        const resultado = await getHistorialPaciente("12345678-5");

        expect(resultado).toEqual({ ok: true, data: { paciente: null, solicitudes: [] } });
    });

    it("normaliza el RUT y filtra por el centro de la sesion", async () => {
        await getHistorialPaciente("12.345.678-5");

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { rut_usuario: "12345678-5", centro_id: "655" },
                orderBy: { fecha_inicio: "desc" }
            })
        );
    });

    it("mapea citas y llamadas con fechas de cierre", async () => {
        const d1 = new Date("2026-01-01T10:00:00Z");
        const d2 = new Date("2026-01-02T10:00:00Z");

        (prisma.solicitud.findMany as any).mockResolvedValueOnce([
            {
                id_solicitud: "SOL-1",
                fecha_inicio: new Date("2025-12-01T00:00:00Z"),
                descripcion: "desc",
                estado_solicitud: "Realizado",
                accion: "Realizar solicitud",
                razon_rechazo: null,
                fecha_validacion: null,
                tipoSolicitud: { nombre_tipo_solicitud: "Tipo A" },
                motivo: { nombre_motivo: "Motivo A" },
                orientador: { nombre: "Orientador" },
                gestor: { nombre: "Gestor" },
                citas: [
                    {
                        id_cita: "CITA-1",
                        estado_cita: "Cita Aceptada",
                        fecha_estimada_atencion: null,
                        observacion: null,
                        profesional: { nombre: "Medico" },
                        prestacion: { nombre_prestacion: "Consulta" },
                        llamadas: [
                            {
                                id_llamada: "LL-1",
                                fecha_llamada: d1,
                                respuesta_usuario: "No contesta",
                                observacion: null,
                                hora_agendada: null,
                                comunicador: null
                            },
                            {
                                id_llamada: "LL-2",
                                fecha_llamada: d2,
                                respuesta_usuario: "Cita Aceptada",
                                observacion: null,
                                hora_agendada: null,
                                comunicador: { nombre: "Ana" }
                            }
                        ]
                    }
                ]
            }
        ]);

        const resultado = await getHistorialPaciente("12345678-5");

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        expect(resultado.data.paciente).toEqual({ rut: "12345678-5", nombre: "Juana Perez" });

        const solicitud = resultado.data.solicitudes[0];
        expect(solicitud.fecha_cierre).toEqual(d2);

        const cita = solicitud.citas[0];
        expect(cita.cerrada).toBe(true);
        expect(cita.fecha_cierre).toEqual(d2);
        expect(cita.llamadas[1].comunicador).toBe("Ana");
    });

    it("audita la busqueda", async () => {
        await getHistorialPaciente("12345678-5");

        expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
            "SEARCH",
            true,
            expect.anything(),
            "HISTORIAL_PACIENTE",
            expect.objectContaining({ details: expect.stringContaining("rut=12345678-5") })
        );
    });
});
