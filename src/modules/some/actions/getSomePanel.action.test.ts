import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        centro: { findMany: vi.fn() },
        funcionario: { findMany: vi.fn() },
        solicitud: { findMany: vi.fn(), groupBy: vi.fn() },
        tipoSolicitud: { findMany: vi.fn() },
        motivo: { findMany: vi.fn() },
        cita: { findMany: vi.fn(), groupBy: vi.fn() },
        profesional: { findMany: vi.fn() },
        prestacion: { findMany: vi.fn() },
        llamada: { findMany: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { getSomePanel, type SomePanelData } from "./getSomePanel.action";

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

async function getPanelData(input?: unknown): Promise<SomePanelData> {
    const result = await getSomePanel(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.data;
}

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue(funcionarioSome);
    (prisma.centro.findMany as any).mockResolvedValue([{ id_centro: "501", nombre_centro: "Centro 501" }]);
    (prisma.funcionario.findMany as any).mockResolvedValue([
        { rut: "44.444.444-4", nombre: "SOME Demo" },
        { rut: "22.222.222-2", nombre: "Orientador Demo" }
    ]);
    (prisma.solicitud.findMany as any).mockResolvedValue([]);
    (prisma.solicitud.groupBy as any).mockResolvedValue([]);
    (prisma.tipoSolicitud.findMany as any).mockResolvedValue([]);
    (prisma.motivo.findMany as any).mockResolvedValue([]);
    (prisma.cita.findMany as any).mockResolvedValue([]);
    (prisma.cita.groupBy as any).mockResolvedValue([]);
    (prisma.profesional.findMany as any).mockResolvedValue([]);
    (prisma.prestacion.findMany as any).mockResolvedValue([]);
    (prisma.llamada.findMany as any).mockResolvedValue([]);
});

describe("getSomePanel", () => {
    it("devuelve un error de negocio sin consultar datos dependientes cuando no hay centro", async () => {
        (requirePermiso as any).mockResolvedValue({ ...funcionarioSome, centro_id: null });

        const result = await getSomePanel();

        expect(result).toEqual({ ok: false, error: "No hay centro disponible para consultar productividad SOME" });
        expect(prisma.funcionario.findMany).not.toHaveBeenCalled();
        expect(prisma.solicitud.findMany).not.toHaveBeenCalled();
        expect(prisma.cita.findMany).not.toHaveBeenCalled();
        expect(prisma.llamada.findMany).not.toHaveBeenCalled();
    });

    it("exige permiso some.ver", async () => {
        await getSomePanel();
        expect(requirePermiso).toHaveBeenCalledWith("some.ver");
    });

    it("propaga el rechazo de permisos", async () => {
        (requirePermiso as any).mockRejectedValueOnce(new Error("No autorizado"));

        await expect(getSomePanel()).rejects.toThrow("No autorizado");
    });

    it("rechaza filtros con una forma invalida", async () => {
        await expect(getSomePanel("filtros-invalidos")).rejects.toThrow();
    });

    it("propaga errores de Prisma", async () => {
        (prisma.funcionario.findMany as any).mockRejectedValueOnce(new Error("Base de datos no disponible"));

        await expect(getSomePanel()).rejects.toThrow("Base de datos no disponible");
    });

    it("para rol SOME ignora centro solicitado y usa su centro_id", async () => {
        const result = await getPanelData({ centroId: "999", rangoDias: 60 });

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

        const result = await getPanelData({ centroId: "650" });

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
        const result = await getPanelData({ rangoDias: 999 });
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

        const result = await getPanelData({ funcionarioRut: "22.222.222-2" });

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

        const result = await getPanelData({ centroId: "605" });

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
        (prisma.cita.groupBy as any)
            .mockResolvedValueOnce([{ profesional_id: 1, prestacion_id: 10, estado_cita: "Sin llamadas", _count: { _all: 1 } }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ profesional_id: 1, prestacion_id: 20, estado_cita: "No contesta (2)", _count: { _all: 1 } }]);
        (prisma.profesional.findMany as any).mockResolvedValue([{ id_profesional: 1, nombre: "Medico" }]);
        (prisma.prestacion.findMany as any).mockResolvedValue([
            { id_prestacion: 10, nombre_prestacion: "Control" },
            { id_prestacion: 20, nombre_prestacion: "Morbilidad" }
        ]);

        const result = await getPanelData({ funcionarioRut: "22.222.222-2" });
        const [row] = result.demandaClinica;

        expect(prisma.cita.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.cita.groupBy).toHaveBeenCalledTimes(3);
        expect(prisma.cita.groupBy).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                by: ["profesional_id", "prestacion_id", "estado_cita"],
                where: expect.objectContaining({ centro_id: "501", estado_cita: { in: ["Sin llamadas", "No contesta (1)", "No contesta (2)", "Solo llamada de aviso"] } }),
                _count: { _all: true }
            })
        );
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
        (prisma.cita.groupBy as any).mockResolvedValueOnce([{ profesional_id: 1, prestacion_id: 20, estado_cita: "No contesta (2)", _count: { _all: 1 } }]);
        (prisma.profesional.findMany as any).mockResolvedValue([{ id_profesional: 1, nombre: "Medico" }]);
        (prisma.prestacion.findMany as any).mockResolvedValue([{ id_prestacion: 20, nombre_prestacion: "Morbilidad" }]);

        const result = await getPanelData({ demandaTemporalidad: "Agendamientos futuros" });
        const [row] = result.demandaClinica;

        expect(prisma.cita.groupBy).toHaveBeenCalledTimes(1);
        expect(prisma.cita.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    fecha_estimada_atencion: expect.objectContaining({ gte: expect.any(Date) })
                })
            })
        );
        expect(result.demandaTemporalidad).toBe("Agendamientos futuros");
        expect(row.total).toBe(1);
        expect(row.temporalidades["Agendamientos futuros"]).toBe(1);
        expect(row.prestaciones).toEqual([expect.objectContaining({ prestacion: "Morbilidad", total: 1 })]);
    });

    it("clasifica citas sin fecha estimada como proximos al agrupar demanda clinica", async () => {
        (prisma.cita.groupBy as any).mockResolvedValueOnce([{ profesional_id: null, prestacion_id: null, estado_cita: "Sin llamadas", _count: { _all: 4 } }]);

        const result = await getSomePanel({ demandaTemporalidad: "Agendamientos próximos" });

        expect(prisma.cita.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    OR: expect.arrayContaining([{ fecha_estimada_atencion: null }])
                })
            })
        );
        expect(result.demandaClinica).toEqual([
            expect.objectContaining({
                profesional: "-",
                total: 4,
                temporalidades: expect.objectContaining({ "Agendamientos próximos": 4 }),
                prestaciones: [expect.objectContaining({ prestacion: "-", total: 4 })]
            })
        ]);
    });

    it("agrupa solicitudes pendientes por tipo y motivo", async () => {
        (requirePermiso as any).mockResolvedValue(funcionarioAdmin);
        (prisma.centro.findMany as any).mockResolvedValue([{ id_centro: "605", nombre_centro: "Centro 605" }]);
        (prisma.funcionario.findMany as any).mockResolvedValue([{ rut: "08712946-2", nombre: "Andrea Alarcon" }]);
        (prisma.solicitud.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        (prisma.solicitud.groupBy as any).mockResolvedValue([
            { tipo_solicitud_id: 1, motivo_id: 10, _count: { _all: 1 } },
            { tipo_solicitud_id: 1, motivo_id: null, _count: { _all: 1 } },
            { tipo_solicitud_id: 2, motivo_id: 20, _count: { _all: 1 } }
        ]);
        (prisma.tipoSolicitud.findMany as any).mockResolvedValue([
            { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Consulta medica" },
            { id_tipo_solicitud: 2, nombre_tipo_solicitud: "Examenes" }
        ]);
        (prisma.motivo.findMany as any).mockResolvedValue([
            { id_motivo: 10, nombre_motivo: "Control" },
            { id_motivo: 20, nombre_motivo: "Laboratorio" }
        ]);
        (prisma.cita.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        (prisma.llamada.findMany as any).mockResolvedValueOnce([]);

        const result = await getPanelData({ centroId: "605" });

        expect(prisma.solicitud.groupBy).toHaveBeenCalledWith({
            by: ["tipo_solicitud_id", "motivo_id"],
            where: { centro_id: "605", accion: "En espera de validación" },
            _count: { _all: true }
        });
        expect(prisma.solicitud.findMany).toHaveBeenCalledTimes(2);
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

    it("usa fallback cuando solicitudes pendientes tienen catalogos faltantes", async () => {
        (prisma.solicitud.groupBy as any).mockResolvedValue([
            { tipo_solicitud_id: 99, motivo_id: 88, _count: { _all: 3 } },
            { tipo_solicitud_id: 99, motivo_id: null, _count: { _all: 2 } }
        ]);

        const result = await getSomePanel();

        expect(result.solicitudesPendientes).toEqual([
            {
                tipoSolicitud: "-",
                total: 5,
                motivos: [
                    { motivo: "-", total: 3 },
                    { motivo: "Sin motivo", total: 2 }
                ]
            }
        ]);
    });
});
