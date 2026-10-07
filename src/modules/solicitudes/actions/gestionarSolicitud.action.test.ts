import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        $transaction: vi.fn(),
        funcionario: { findUnique: vi.fn() },
        solicitud: {
            findFirst: vi.fn(),
            update: vi.fn()
        },
        prestacion: {
            findFirst: vi.fn()
        },
        profesional: {
            findFirst: vi.fn()
        },
        cita: {
            createMany: vi.fn()
        }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({
    AuditLogger: { logDataAccess: vi.fn() }
}));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { gestionarSolicitud } from "./gestionarSolicitud.action";

// La accion rechaza fechas anteriores a hoy, asi que la fecha del fixture se
// calcula relativa al dia de ejecucion en vez de fijarla en el calendario.
const fechaEstimada = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function expectNoSuccessEffects() {
    expect(prisma.solicitud.update).not.toHaveBeenCalled();
    expect(prisma.cita.createMany).not.toHaveBeenCalled();
    expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
}

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "o@demo.local",
        nombre: "Gestor",
        centro_id: "650",
        centro_nombre: "CESFAM",
        rol: { id: 2, nombre: "Orientador" }
    });
    (prisma.$queryRaw as any).mockResolvedValue([{ nombre_centro: "Centro De Salud Familiar Esperanza" }]);
    (prisma.$transaction as any).mockImplementation(async (callback: any) => callback(prisma));
    (prisma.solicitud.findFirst as any).mockResolvedValue({
        id_solicitud: "SOL-1",
        rut_usuario: "12345678-5",
        tipoSolicitud: { nombre_tipo_solicitud: "Atencion" },
        motivo: { nombre_motivo: "Control" },
        usuario: { priorizacion_administrativa: 10 }
    });
    (prisma.solicitud.update as any).mockResolvedValue({ id_solicitud: "SOL-1", rut_usuario: "12345678-5", accion: "Realizar solicitud", razon_rechazo: null, observacion_rechazo: null });
    (prisma.profesional.findFirst as any).mockResolvedValue({ id_profesional: 17, nombre: "Examenes" });
    (prisma.cita.createMany as any).mockResolvedValue({ count: 1 });
});

describe("gestionarSolicitud", () => {
    it("rechaza solicitud en transaccion guardando razon y observacion", async () => {
        (prisma.solicitud.update as any).mockResolvedValueOnce({
            id_solicitud: "SOL-1",
            rut_usuario: "12345678-5",
            accion: "Rechazar solicitud",
            razon_rechazo: "Solicitud repetida",
            observacion_rechazo: "Ya fue ingresada"
        });

        const result = await gestionarSolicitud({
            id_solicitud: "SOL-1",
            accion: "Rechazar solicitud",
            razon_rechazo: "Solicitud repetida",
            observacion_rechazo: "Ya fue ingresada"
        });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.solicitud.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    rut_gestor: "22.222.222-2",
                    accion: "Rechazar solicitud",
                    razon_rechazo: "Solicitud repetida",
                    observacion_rechazo: "Ya fue ingresada",
                    estado_solicitud: "Rechazado"
                })
            })
        );
        expect(prisma.cita.createMany).not.toHaveBeenCalled();
        expect(result).toEqual({
            ok: true,
            data: {
                solicitud: expect.objectContaining({ id_solicitud: "SOL-1" }),
                citasCreadas: 0,
                resumen: {
                    id_solicitud: "SOL-1",
                    rut_usuario: "12345678-5",
                    accion: "Rechazar solicitud",
                    razon_rechazo: "Solicitud repetida",
                    observacion_rechazo: "Ya fue ingresada",
                    citas: []
                }
            }
        });
    });

    it("realiza solicitud e inserta citas con prioridad numerica", async () => {
        const result = await gestionarSolicitud({
            id_solicitud: "SOL-1",
            accion: "Realizar solicitud",
            citas: [
                {
                    tipo_prestacion: "Agendar una hora de exámenes",
                    profesional_id: null,
                    prestacion_id: null,
                    fecha_estimada_atencion: fechaEstimada,
                    observacion: "Control",
                    priorizacion_clinica: "Alta"
                }
            ]
        });

        expect(prisma.solicitud.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    rut_gestor: "22.222.222-2",
                    accion: "Realizar solicitud",
                    razon_rechazo: null,
                    observacion_rechazo: null
                })
            })
        );
        expect(prisma.cita.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({
                    solicitud_id: "SOL-1",
                    rut_usuario: "12345678-5",
                    rut_gestor: "22.222.222-2",
                    tipo_prestacion: "Agendar una hora de exámenes",
                    profesional_id: 17,
                    estado_cita: "Sin llamadas",
                    priorizacion_clinica: "Alta",
                    priorizacion: 70,
                    centro_id: "650"
                })
            ]
        });
        expect(result).toEqual(
            expect.objectContaining({
                ok: true,
                data: expect.objectContaining({
                    citasCreadas: 1,
                    resumen: expect.objectContaining({
                        id_solicitud: "SOL-1",
                        rut_usuario: "12345678-5",
                        accion: "Realizar solicitud",
                        citas: [
                            expect.objectContaining({
                                profesional: "Examenes",
                                prestacion: null,
                                fecha_estimada_atencion: expect.any(Date)
                            })
                        ]
                    })
                })
            })
        );
    });

    it("valida prestacion activa perteneciente al profesional", async () => {
        (prisma.prestacion.findFirst as any).mockResolvedValue({ id_prestacion: 3, profesional_id: 2, nombre_prestacion: "Control medico", profesional: { nombre: "Medico" } });

        await gestionarSolicitud({
            id_solicitud: "SOL-1",
            accion: "Realizar solicitud",
            citas: [
                {
                    tipo_prestacion: "Agendar una hora con profesional",
                    profesional_id: 2,
                    prestacion_id: 3,
                    fecha_estimada_atencion: fechaEstimada,
                    observacion: "",
                    priorizacion_clinica: "Urgente"
                }
            ]
        });

        expect(prisma.prestacion.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id_prestacion: 3, profesional_id: 2 })
            })
        );
        expect((prisma.cita.createMany as any).mock.calls[0][0].data[0].priorizacion).toBe(90);
    });

    it("devuelve error si la solicitud no esta pendiente o pertenece a otro centro", async () => {
        (prisma.solicitud.findFirst as any).mockResolvedValue(null);

        await expect(
            gestionarSolicitud({ id_solicitud: "SOL-1", accion: "Rechazar solicitud", razon_rechazo: "Otra", observacion_rechazo: "" })
        ).resolves.toEqual({ ok: false, error: "La solicitud no esta pendiente de validacion o no pertenece a tu centro" });
        expectNoSuccessEffects();
    });

    it.each([
        ["invalida", "no-es-fecha", "Fecha estimada invalida"],
        ["anterior a hoy", "2000-01-01", "La fecha estimada no puede ser anterior a hoy"]
    ])("devuelve error para fecha %s sin efectos de exito", async (_caso, fecha, error) => {
        const result = await gestionarSolicitud({
            id_solicitud: "SOL-1",
            accion: "Realizar solicitud",
            citas: [
                {
                    tipo_prestacion: "Agendar una hora de exámenes",
                    profesional_id: null,
                    prestacion_id: null,
                    fecha_estimada_atencion: fecha,
                    observacion: "",
                    priorizacion_clinica: "Media"
                }
            ]
        });

        expect(result).toEqual({ ok: false, error });
        expectNoSuccessEffects();
    });

    it("devuelve error si la prestacion no pertenece a un profesional activo del centro", async () => {
        (prisma.prestacion.findFirst as any).mockResolvedValueOnce(null);

        const result = await gestionarSolicitud({
            id_solicitud: "SOL-1",
            accion: "Realizar solicitud",
            citas: [
                {
                    tipo_prestacion: "Agendar una hora con profesional",
                    profesional_id: 2,
                    prestacion_id: 3,
                    fecha_estimada_atencion: fechaEstimada,
                    observacion: "",
                    priorizacion_clinica: "Media"
                }
            ]
        });

        expect(result).toEqual({ ok: false, error: "La prestacion no pertenece a un profesional activo del centro" });
        expectNoSuccessEffects();
    });

    it("devuelve error si el profesional de examenes esta inactivo", async () => {
        (prisma.profesional.findFirst as any).mockResolvedValueOnce(null);

        const result = await gestionarSolicitud({
            id_solicitud: "SOL-1",
            accion: "Realizar solicitud",
            citas: [
                {
                    tipo_prestacion: "Agendar una hora de exámenes",
                    profesional_id: null,
                    prestacion_id: null,
                    fecha_estimada_atencion: fechaEstimada,
                    observacion: "",
                    priorizacion_clinica: "Media"
                }
            ]
        });

        expect(result).toEqual({ ok: false, error: "El profesional de examenes no existe o no esta activo" });
        expectNoSuccessEffects();
    });

    it("devuelve error de configuracion cuando el funcionario no tiene centro", async () => {
        (requirePermiso as any).mockResolvedValueOnce({ rut: "22.222.222-2", centro_id: null });
        (prisma.funcionario.findUnique as any).mockResolvedValueOnce(null);

        await expect(
            gestionarSolicitud({ id_solicitud: "SOL-1", accion: "Rechazar solicitud", razon_rechazo: "Otra", observacion_rechazo: "" })
        ).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expectNoSuccessEffects();
    });

    it("mantiene los errores de permiso como rechazos", async () => {
        (requirePermiso as any).mockRejectedValueOnce(new Error("Sin permiso"));

        await expect(
            gestionarSolicitud({ id_solicitud: "SOL-1", accion: "Rechazar solicitud", razon_rechazo: "Otra", observacion_rechazo: "" })
        ).rejects.toThrow("Sin permiso");
    });

    it("mantiene los errores de Prisma como rechazos", async () => {
        (prisma.solicitud.findFirst as any).mockRejectedValueOnce(new Error("DB caida"));

        await expect(
            gestionarSolicitud({ id_solicitud: "SOL-1", accion: "Rechazar solicitud", razon_rechazo: "Otra", observacion_rechazo: "" })
        ).rejects.toThrow("DB caida");
        expectNoSuccessEffects();
    });

    it("rechaza mas de 5 citas", async () => {
        await expect(
            gestionarSolicitud({
                id_solicitud: "SOL-1",
                accion: "Realizar solicitud",
                citas: Array.from({ length: 6 }, () => ({
                    tipo_prestacion: "Agendar una hora de exámenes",
                    profesional_id: null,
                    prestacion_id: null,
                    fecha_estimada_atencion: fechaEstimada,
                    observacion: "",
                    priorizacion_clinica: "Media"
                }))
            })
        ).rejects.toThrow("No puedes agregar mas de 5 citas");
    });
});
