import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        centro: { findMany: vi.fn() },
        funcionario: { findMany: vi.fn() },
        solicitud: { findMany: vi.fn() },
        cita: { findMany: vi.fn() },
        llamada: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { getSomePanel } from "./getSomePanel.action";

const funcionarioSome = {
    rut: "44.444.444-4",
    email: "some@demo.local",
    nombre: "SOME Demo",
    centro_id: "501",
    centro_nombre: "Centro 501",
    rol: { id: 4, nombre: "SOME" }
};

const funcionarioAdmin = {
    ...funcionarioSome,
    rut: "11.111.111-1",
    nombre: "Admin Demo",
    rol: { id: 1, nombre: "Administrador" }
};

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue(funcionarioSome);
    (prisma.centro.findMany as any).mockResolvedValue([{ id_centro: "501", nombre_centro: "Centro 501" }]);
    (prisma.funcionario.findMany as any).mockResolvedValue([
        { rut: "44.444.444-4", nombre: "SOME Demo" },
        { rut: "22.222.222-2", nombre: "Orientador Demo" }
    ]);
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
    (prisma.cita.findMany as any).mockResolvedValue([]);
    (prisma.llamada.findMany as any).mockResolvedValue([]);
});

describe("getSomePanel", () => {
    it("exige permiso some.ver", async () => {
        await getSomePanel();
        expect(requirePermiso).toHaveBeenCalledWith("some.ver");
    });

    it("para rol SOME ignora centro solicitado y usa su centro_id", async () => {
        const result = await getSomePanel({ centroId: "999", rangoDias: 60 });

        expect(result.centroSeleccionado).toBe("501");
        expect(result.rangoDias).toBe(60);
        expect(prisma.funcionario.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { centro_id: "501", estado: { in: ["Activo", "1"] } } }));
    });

    it("para administrador permite filtrar por centro_id", async () => {
        (requirePermiso as any).mockResolvedValue(funcionarioAdmin);
        (prisma.centro.findMany as any).mockResolvedValue([
            { id_centro: "501", nombre_centro: "Centro 501" },
            { id_centro: "650", nombre_centro: "Centro 650" }
        ]);
        (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "99.999.999-9", nombre: "Funcionario Centro 650" }]);

        const result = await getSomePanel({ centroId: "650" });

        expect(result.esAdministrador).toBe(true);
        expect(result.centroSeleccionado).toBe("650");
        expect(result.funcionarios).toEqual([{ rut: "99.999.999-9", nombre: "Funcionario Centro 650" }]);
        expect(prisma.funcionario.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { centro_id: "650", estado: { in: ["Activo", "1"] } } }));
        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ centro_id: "650", rut_orientador: { in: ["99.999.999-9"] } })
            })
        );
        expect(prisma.cita.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ centro_id: "650", rut_gestor: { in: ["99.999.999-9"] } })
            })
        );
        expect(prisma.llamada.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ centro_id: "650", rut_comunicador: { in: ["99.999.999-9"] } })
            })
        );
    });

    it("normaliza rango no permitido a 30 dias", async () => {
        const result = await getSomePanel({ rangoDias: 999 });
        expect(result.rangoDias).toBe(30);
        expect(result.serie).toHaveLength(30);
    });

    it("agrupa productividad por funcionario y respeta filtro de funcionario", async () => {
        const hoy = new Date();
        (prisma.solicitud.findMany as any)
            .mockResolvedValueOnce([{ rut_orientador: "22.222.222-2", fecha_inicio: hoy }])
            .mockResolvedValueOnce([{ rut_gestor: "22.222.222-2", accion: "Realizar solicitud", fecha_validacion: hoy }]);
        (prisma.cita.findMany as any)
            .mockResolvedValueOnce([{ rut_gestor: "22.222.222-2", fecha_creacion: hoy }])
            .mockResolvedValueOnce([]);
        (prisma.llamada.findMany as any).mockResolvedValueOnce([]);

        const result = await getSomePanel({ funcionarioRut: "22.222.222-2" });

        expect(result.funcionarioSeleccionado).toBe("22.222.222-2");
        expect(prisma.solicitud.findMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: expect.objectContaining({ rut_orientador: "22.222.222-2" })
            })
        );
        expect(prisma.solicitud.findMany).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                where: expect.objectContaining({ rut_gestor: "22.222.222-2" })
            })
        );
        expect(prisma.cita.findMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: expect.objectContaining({ rut_gestor: "22.222.222-2" })
            })
        );
        expect(prisma.llamada.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ rut_comunicador: "22.222.222-2" })
            })
        );
        expect(result.productividad).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ rut: "44.444.444-4" }),
                expect.objectContaining({ rut: "22.222.222-2" })
            ])
        );
        expect(result.totales.solicitudesIngresadas).toBe(1);
        expect(result.totales.solicitudesRealizadas).toBe(1);
        expect(result.totales.citasCreadas).toBe(1);
        expect(result.totales.llamadasRealizadas).toBe(0);
    });

    it("cuenta solicitudes del centro cuando el funcionario activo usa estado legacy 1", async () => {
        const hoy = new Date();
        (requirePermiso as any).mockResolvedValue(funcionarioAdmin);
        (prisma.centro.findMany as any).mockResolvedValue([{ id_centro: "605", nombre_centro: "Centro 605" }]);
        (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "08712946-2", nombre: "Andrea Alarcon" }]);
        (prisma.solicitud.findMany as any)
            .mockResolvedValueOnce([{ rut_orientador: "08712946-2", fecha_inicio: hoy }])
            .mockResolvedValueOnce([]);
        (prisma.cita.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        (prisma.llamada.findMany as any).mockResolvedValueOnce([]);

        const result = await getSomePanel({ centroId: "605" });

        expect(prisma.funcionario.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { centro_id: "605", estado: { in: ["Activo", "1"] } } }));
        expect(result.centroSeleccionado).toBe("605");
        expect(result.totales.solicitudesIngresadas).toBe(1);
        expect(result.productividad).toEqual([
            expect.objectContaining({
                rut: "08712946-2",
                solicitudesIngresadas: 1
            })
        ]);
    });

    it("demanda clinica ignora filtro de funcionario y agrupa por profesional con prestaciones", async () => {
        const hoy = new Date();
        const atrasada = new Date(hoy);
        atrasada.setDate(hoy.getDate() - 20);
        const futura = new Date(hoy);
        futura.setDate(hoy.getDate() + 40);

        (prisma.cita.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id_cita: "CITA-1",
                    estado_cita: "Sin llamadas",
                    fecha_estimada_atencion: atrasada,
                    profesional: { nombre: "Medico" },
                    prestacion: { nombre_prestacion: "Control" }
                },
                {
                    id_cita: "CITA-2",
                    estado_cita: "No contesta (2)",
                    fecha_estimada_atencion: futura,
                    profesional: { nombre: "Medico" },
                    prestacion: { nombre_prestacion: "Morbilidad" }
                }
            ]);

        const result = await getSomePanel({ funcionarioRut: "22.222.222-2" });
        const [row] = result.demandaClinica;

        expect(row.total).toBe(2);
        expect(row.temporalidades["Agendamientos atrasados"]).toBe(1);
        expect(row.temporalidades["Agendamientos futuros"]).toBe(1);
        expect(row.estados["Sin llamadas"]).toBe(1);
        expect(row.estados["No contesta (2)"]).toBe(1);
        expect(row.prestaciones).toEqual([
            expect.objectContaining({ prestacion: "Control", total: 1 }),
            expect.objectContaining({ prestacion: "Morbilidad", total: 1 })
        ]);
    });

    it("filtra demanda clinica por temporalidad", async () => {
        const hoy = new Date();
        const atrasada = new Date(hoy);
        atrasada.setDate(hoy.getDate() - 20);
        const futura = new Date(hoy);
        futura.setDate(hoy.getDate() + 40);

        (prisma.cita.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id_cita: "CITA-1",
                    estado_cita: "Sin llamadas",
                    fecha_estimada_atencion: atrasada,
                    profesional: { nombre: "Medico" },
                    prestacion: { nombre_prestacion: "Control" }
                },
                {
                    id_cita: "CITA-2",
                    estado_cita: "No contesta (2)",
                    fecha_estimada_atencion: futura,
                    profesional: { nombre: "Medico" },
                    prestacion: { nombre_prestacion: "Morbilidad" }
                }
            ]);

        const result = await getSomePanel({ demandaTemporalidad: "Agendamientos futuros" });
        const [row] = result.demandaClinica;

        expect(result.demandaTemporalidad).toBe("Agendamientos futuros");
        expect(row.total).toBe(1);
        expect(row.temporalidades["Agendamientos futuros"]).toBe(1);
        expect(row.prestaciones).toEqual([expect.objectContaining({ prestacion: "Morbilidad", total: 1 })]);
    });

    it("agrupa solicitudes pendientes por tipo y motivo", async () => {
        (requirePermiso as any).mockResolvedValue(funcionarioAdmin);
        (prisma.centro.findMany as any).mockResolvedValue([{ id_centro: "605", nombre_centro: "Centro 605" }]);
        (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "08712946-2", nombre: "Andrea Alarcon" }]);
        (prisma.solicitud.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id_solicitud: "SOL-1",
                    tipoSolicitud: { nombre_tipo_solicitud: "Consulta medica" },
                    motivo: { nombre_motivo: "Control" }
                },
                {
                    id_solicitud: "SOL-2",
                    tipoSolicitud: { nombre_tipo_solicitud: "Consulta medica" },
                    motivo: null
                },
                {
                    id_solicitud: "SOL-3",
                    tipoSolicitud: { nombre_tipo_solicitud: "Examenes" },
                    motivo: { nombre_motivo: "Laboratorio" }
                }
            ]);
        (prisma.cita.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        (prisma.llamada.findMany as any).mockResolvedValueOnce([]);

        const result = await getSomePanel({ centroId: "605" });

        expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { centro_id: "605", accion: "En espera de validación" }
            })
        );
        expect(result.solicitudesPendientes).toEqual([
            {
                tipoSolicitud: "Consulta medica",
                total: 2,
                motivos: [
                    { motivo: "Control", total: 1 },
                    { motivo: "Sin motivo", total: 1 }
                ]
            },
            {
                tipoSolicitud: "Examenes",
                total: 1,
                motivos: [{ motivo: "Laboratorio", total: 1 }]
            }
        ]);
    });
});
