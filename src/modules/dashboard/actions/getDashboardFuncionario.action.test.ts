import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        solicitud: { findMany: vi.fn() },
        llamada: { findMany: vi.fn() }
    }
}));

vi.mock("@/shared/lib/auth", () => ({
    requireSessionUser: vi.fn()
}));

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { getDashboardFuncionario } from "./getDashboardFuncionario.action";

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T12:00:00"));
    (requireSessionUser as any).mockResolvedValue({
        rut: "22.222.222-2",
        email: "gestor@demo.local",
        nombre: "Gestor Demo",
        centro_id: "501",
        centro_nombre: "Centro Demo",
        rol: { id: 1, nombre: "Full" },
        menu: []
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("getDashboardFuncionario", () => {
    it("filtra métricas de los últimos 30 días por RUT del funcionario activo", async () => {
        (prisma.solicitud.findMany as any)
            .mockResolvedValueOnce([
                {
                    id_solicitud: "SOL-ING-1",
                    fecha_inicio: new Date("2026-07-03T10:00:00"),
                    rut_usuario: "12.345.678-9",
                    estado_solicitud: "En Curso",
                    tipoSolicitud: { nombre_tipo_solicitud: "Consulta general" },
                    motivo: { nombre_motivo: "Control" }
                }
            ])
            .mockResolvedValueOnce([
                {
                    id_solicitud: "SOL-GES-1",
                    fecha_validacion: new Date("2026-07-05T11:00:00"),
                    rut_usuario: "12.345.678-9",
                    accion: "Realizar solicitud",
                    razon_rechazo: null,
                    citas: [
                        {
                            id_cita: "CITA-1",
                            fecha_estimada_atencion: new Date("2026-08-03T00:00:00"),
                            tipo_prestacion: "Agendar una hora con profesional",
                            estado_cita: "Sin llamadas",
                            priorizacion_clinica: "Alta",
                            profesional: { nombre: "Médico" },
                            prestacion: { nombre_prestacion: "Consulta De Morbilidad" }
                        },
                        {
                            id_cita: "CITA-2",
                            fecha_estimada_atencion: new Date("2026-08-04T00:00:00"),
                            tipo_prestacion: "Agendar una hora de exámenes",
                            estado_cita: "Sin llamadas",
                            priorizacion_clinica: "Media",
                            profesional: { nombre: "Examenes" },
                            prestacion: null
                        }
                    ]
                },
                {
                    id_solicitud: "SOL-GES-2",
                    fecha_validacion: new Date("2026-07-06T12:00:00"),
                    rut_usuario: "11.111.111-1",
                    accion: "Rechazar solicitud",
                    razon_rechazo: "No corresponde",
                    citas: []
                }
            ]);
        (prisma.llamada.findMany as any).mockResolvedValue([
            {
                id_llamada: "LLAM-1",
                fecha_llamada: new Date("2026-07-07T09:00:00"),
                rut_usuario: "12.345.678-9",
                cita_id: "CITA-1",
                respuesta_usuario: "No contesta",
                observacion: null,
                cita: {
                    tipo_prestacion: "Agendar una hora con profesional",
                    profesional: { nombre: "Médico" },
                    prestacion: { nombre_prestacion: "Consulta De Morbilidad" }
                }
            }
        ]);

        const result = await getDashboardFuncionario(30);

        expect(prisma.solicitud.findMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: {
                    rut_orientador: "22.222.222-2",
                    fecha_inicio: { gte: new Date("2026-06-23T00:00:00"), lt: new Date("2026-07-23T00:00:00") }
                }
            })
        );
        expect(prisma.solicitud.findMany).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                where: {
                    rut_gestor: "22.222.222-2",
                    accion: { in: ["Rechazar solicitud", "Realizar solicitud"] },
                    fecha_validacion: { gte: new Date("2026-06-23T00:00:00"), lt: new Date("2026-07-23T00:00:00") }
                }
            })
        );
        expect(prisma.llamada.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    rut_comunicador: "22.222.222-2",
                    fecha_llamada: { gte: new Date("2026-06-23T00:00:00"), lt: new Date("2026-07-23T00:00:00") }
                }
            })
        );

        expect(result.rangoDias).toBe(30);
        expect(result.desde).toEqual(new Date("2026-06-23T00:00:00"));
        expect(result.hasta).toEqual(new Date("2026-07-23T00:00:00"));
        expect(result.totales).toEqual({
            solicitudesIngresadas: 1,
            solicitudesRechazadas: 1,
            solicitudesRealizadas: 1,
            citasCreadas: 2,
            llamadasRealizadas: 1
        });
        expect(result.detalles.gestiones[0]).toEqual(
            expect.objectContaining({
                id_solicitud: "SOL-GES-1",
                citas_creadas: 2,
                citas: [
                    expect.objectContaining({
                        id_cita: "CITA-1",
                        estamento: "Médico",
                        prestacion: "Consulta De Morbilidad"
                    }),
                    expect.objectContaining({
                        id_cita: "CITA-2",
                        estamento: "Examenes",
                        prestacion: null
                    })
                ]
            })
        );
        expect(result.detalles.llamadas[0]).toEqual(
            expect.objectContaining({
                id_llamada: "LLAM-1",
                estamento: "Médico",
                prestacion: "Consulta De Morbilidad",
                tipo_prestacion: "Agendar una hora con profesional"
            })
        );
        expect(result.serie.find((dia) => dia.fecha === "2026-07-05")?.solicitudesRealizadas).toBe(1);
        expect(result.serie.find((dia) => dia.fecha === "2026-07-05")?.citasCreadas).toBe(2);
        expect(result.serie.find((dia) => dia.fecha === "2026-07-07")?.llamadasRealizadas).toBe(1);
    });

    it.each([
        { dias: 60, desde: "2026-05-24T00:00:00" },
        { dias: 90, desde: "2026-04-24T00:00:00" }
    ])("construye serie diaria continua para $dias días", async ({ dias, desde }) => {
        (prisma.solicitud.findMany as any).mockResolvedValue([]);
        (prisma.llamada.findMany as any).mockResolvedValue([]);

        const result = await getDashboardFuncionario(dias);

        expect(result.rangoDias).toBe(dias);
        expect(result.desde).toEqual(new Date(desde));
        expect(result.hasta).toEqual(new Date("2026-07-23T00:00:00"));
        expect(result.serie).toHaveLength(dias);
        expect(result.serie[0].fecha).toBe(desde.slice(0, 10));
        expect(result.serie.at(-1)?.fecha).toBe("2026-07-22");
    });

    it("usa 30 días cuando el input no está permitido", async () => {
        (prisma.solicitud.findMany as any).mockResolvedValue([]);
        (prisma.llamada.findMany as any).mockResolvedValue([]);

        const result = await getDashboardFuncionario(45);

        expect(result.rangoDias).toBe(30);
        expect(result.serie).toHaveLength(30);
        expect(result.totales.llamadasRealizadas).toBe(0);
    });
});
