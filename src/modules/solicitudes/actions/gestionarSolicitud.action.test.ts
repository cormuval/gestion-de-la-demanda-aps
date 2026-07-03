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
        cita: {
            createMany: vi.fn()
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
import { gestionarSolicitud } from "./gestionarSolicitud.action";

beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionUser as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "o@demo.local",
        nombre: "Gestor",
        centro_id: "650",
        rol: { id: 2, nombre: "Orientador" },
        menu: []
    });
    (prisma.$queryRaw as any).mockResolvedValue([{ nombre_centro: "Centro De Salud Familiar Esperanza" }]);
    (prisma.$transaction as any).mockImplementation(async (callback: any) => callback(prisma));
    (prisma.solicitud.findFirst as any).mockResolvedValue({ id_solicitud: "SOL-1", rut_usuario: "12345678-5" });
    (prisma.solicitud.update as any).mockResolvedValue({ id_solicitud: "SOL-1", accion: "Realizar solicitud" });
    (prisma.cita.createMany as any).mockResolvedValue({ count: 1 });
});

describe("gestionarSolicitud", () => {
    it("rechaza solicitud en transaccion guardando razon y observacion", async () => {
        await gestionarSolicitud({
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
                    observacion_rechazo: "Ya fue ingresada"
                })
            })
        );
        expect(prisma.cita.createMany).not.toHaveBeenCalled();
    });

    it("realiza solicitud e inserta citas con prioridad numerica", async () => {
        await gestionarSolicitud({
            id_solicitud: "SOL-1",
            accion: "Realizar solicitud",
            citas: [
                {
                    tipo_prestacion: "Agendar una hora de exámenes",
                    profesional_id: null,
                    prestacion_id: null,
                    fecha_estimada_atencion: "2026-07-03",
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
                    estado_cita: "Sin llamadas",
                    priorizacion_clinica: "Alta",
                    priorizacion: 60,
                    centro_id: "650"
                })
            ]
        });
    });

    it("valida prestacion activa perteneciente al profesional", async () => {
        (prisma.prestacion.findFirst as any).mockResolvedValue({ id_prestacion: 3, profesional_id: 2 });

        await gestionarSolicitud({
            id_solicitud: "SOL-1",
            accion: "Realizar solicitud",
            citas: [
                {
                    tipo_prestacion: "Agendar una hora con profesional",
                    profesional_id: 2,
                    prestacion_id: 3,
                    fecha_estimada_atencion: "2026-07-03",
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
        expect((prisma.cita.createMany as any).mock.calls[0][0].data[0].priorizacion).toBe(80);
    });

    it("rechaza solicitudes que no esten pendientes para el centro", async () => {
        (prisma.solicitud.findFirst as any).mockResolvedValue(null);

        await expect(
            gestionarSolicitud({
                id_solicitud: "SOL-1",
                accion: "Rechazar solicitud",
                razon_rechazo: "Otra",
                observacion_rechazo: ""
            })
        ).rejects.toThrow("pendiente de validacion");
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
                    fecha_estimada_atencion: "2026-07-03",
                    observacion: "",
                    priorizacion_clinica: "Media"
                }))
            })
        ).rejects.toThrow("No puedes agregar mas de 5 citas");
    });
});
