"use server";

import { z } from "zod";
// lib
import { requirePermiso } from "@/shared/lib/permisos";
import { prisma } from "@/shared/lib/prisma";
// types
import { ESTADOS_PENDIENTES, TEMPORALIDAD, TEMPORALIDADES } from "@/modules/comunicador/types/comunicador";

const RANGOS_DIAS = [30, 60, 90] as const;
const ACCION_REALIZAR_SOLICITUD = "Realizar solicitud";
const ACCION_RECHAZAR_SOLICITUD = "Rechazar solicitud";
const ACCION_ESPERA_VALIDACION = "En espera de validación";

const filtrosSomeSchema = z.object({
    rangoDias: z.coerce.number().optional(),
    centroId: z.string().trim().optional(),
    funcionarioRut: z.string().trim().optional(),
    demandaTemporalidad: z.string().trim().optional()
});

export type SomeRangoDias = (typeof RANGOS_DIAS)[number];

export interface SomeCentroOption {
    id_centro: string;
    nombre_centro: string | null;
}

export interface SomeFuncionarioOption {
    rut: string;
    nombre: string;
}

export interface SomeTotales {
    solicitudesIngresadas: number;
    gestiones: number;
    solicitudesRealizadas: number;
    solicitudesRechazadas: number;
    citasCreadas: number;
    llamadasRealizadas: number;
}

export interface SomeDiaSerie extends SomeTotales {
    fecha: string;
    dia: number;
}

export interface SomeFuncionarioProductividad extends SomeFuncionarioOption, SomeTotales {}

export interface SomeDemandaConteos {
    prestacion: string;
    total: number;
    temporalidades: Record<string, number>;
    estados: Record<string, number>;
}

export interface SomeDemandaProfesional extends SomeDemandaConteos {
    profesional: string;
    prestaciones: SomeDemandaConteos[];
}

export interface SomeSolicitudPendienteMotivo {
    motivo: string;
    total: number;
}

export interface SomeSolicitudPendienteTipo {
    tipoSolicitud: string;
    total: number;
    motivos: SomeSolicitudPendienteMotivo[];
}

export interface SomePanelData {
    esAdministrador: boolean;
    rangoDias: SomeRangoDias;
    desde: Date;
    hasta: Date;
    centroSeleccionado: string;
    funcionarioSeleccionado: string;
    demandaTemporalidad: string;
    centros: SomeCentroOption[];
    funcionarios: SomeFuncionarioOption[];
    totales: SomeTotales;
    serie: SomeDiaSerie[];
    productividad: SomeFuncionarioProductividad[];
    demandaClinica: SomeDemandaProfesional[];
    solicitudesPendientes: SomeSolicitudPendienteTipo[];
}

function parseRangoDias(input?: number): SomeRangoDias {
    return RANGOS_DIAS.includes(input as SomeRangoDias) ? (input as SomeRangoDias) : 30;
}

function dateKey(value: Date): string {
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0")
    ].join("-");
}

function buildRango(input?: number): { rangoDias: SomeRangoDias; desde: Date; hasta: Date } {
    const rangoDias = parseRangoDias(input);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - (rangoDias - 1));
    const hasta = new Date(hoy);
    hasta.setDate(hoy.getDate() + 1);
    return { rangoDias, desde, hasta };
}

function emptyTotales(): SomeTotales {
    return {
        solicitudesIngresadas: 0,
        gestiones: 0,
        solicitudesRealizadas: 0,
        solicitudesRechazadas: 0,
        citasCreadas: 0,
        llamadasRealizadas: 0
    };
}

function buildSerie(desde: Date, rangoDias: SomeRangoDias): SomeDiaSerie[] {
    return Array.from({ length: rangoDias }, (_, index) => {
        const fecha = new Date(desde);
        fecha.setDate(desde.getDate() + index);
        return { fecha: dateKey(fecha), dia: fecha.getDate(), ...emptyTotales() };
    });
}

function addTotal(target: SomeTotales, key: keyof SomeTotales, amount = 1) {
    target[key] += amount;
}

function addRow(rows: Map<string, SomeFuncionarioProductividad>, rut: string | null | undefined, key: keyof SomeTotales, amount = 1) {
    if (!rut) return;
    const row = rows.get(rut);
    if (row) addTotal(row, key, amount);
}

function addSerie(seriePorFecha: Map<string, SomeDiaSerie>, fecha: Date | null | undefined, key: keyof SomeTotales, amount = 1) {
    if (!fecha) return;
    const row = seriePorFecha.get(dateKey(fecha));
    if (row) addTotal(row, key, amount);
}

function temporalidadCita(fecha: Date | null): string {
    if (!fecha) return TEMPORALIDAD.PROXIMOS;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const atrasadosHasta = new Date(hoy);
    atrasadosHasta.setDate(hoy.getDate() - 15);
    const futurosDesde = new Date(hoy);
    futurosDesde.setDate(hoy.getDate() + 31);
    if (fecha < atrasadosHasta) return TEMPORALIDAD.ATRASADOS;
    if (fecha >= futurosDesde) return TEMPORALIDAD.FUTUROS;
    return TEMPORALIDAD.PROXIMOS;
}

function parseDemandaTemporalidad(input?: string): string {
    return input && (TEMPORALIDADES as readonly string[]).includes(input) ? input : TEMPORALIDAD.TODAS;
}

function emptyDemandaConteos(prestacion: string): SomeDemandaConteos {
    return {
        prestacion,
        total: 0,
        temporalidades: { [TEMPORALIDAD.ATRASADOS]: 0, [TEMPORALIDAD.PROXIMOS]: 0, [TEMPORALIDAD.FUTUROS]: 0 },
        estados: Object.fromEntries(ESTADOS_PENDIENTES.map((item) => [item, 0])) as Record<string, number>
    };
}

function sumarDemanda(target: SomeDemandaConteos, temporalidad: string, estado: string) {
    target.total += 1;
    target.temporalidades[temporalidad] = (target.temporalidades[temporalidad] ?? 0) + 1;
    target.estados[estado] = (target.estados[estado] ?? 0) + 1;
}

export async function getSomePanel(input?: unknown): Promise<SomePanelData> {
    const user = await requirePermiso("some.ver");
    const filtros = filtrosSomeSchema.parse(input ?? {});
    const esAdministrador = user.rol.nombre === "Administrador";
    const { rangoDias, desde, hasta } = buildRango(filtros.rangoDias);
    const demandaTemporalidad = parseDemandaTemporalidad(filtros.demandaTemporalidad);

    const centros = esAdministrador
        ? await prisma.centro.findMany({ select: { id_centro: true, nombre_centro: true }, orderBy: { nombre_centro: "asc" } })
        : user.centro_id
          ? await prisma.centro.findMany({ where: { id_centro: user.centro_id }, select: { id_centro: true, nombre_centro: true } })
          : [];

    const centroSeleccionado = esAdministrador
        ? filtros.centroId && centros.some((centro) => centro.id_centro === filtros.centroId)
            ? filtros.centroId
            : centros[0]?.id_centro ?? ""
        : user.centro_id ?? "";

    if (!centroSeleccionado) throw new Error("No hay centro disponible para consultar productividad SOME");

    const funcionarios = await prisma.funcionario.findMany({
        where: { centro_id: centroSeleccionado, estado: { in: ["Activo", "1"] } },
        select: { rut: true, nombre: true },
        orderBy: { nombre: "asc" }
    });
    const funcionarioSeleccionado = filtros.funcionarioRut && funcionarios.some((funcionario) => funcionario.rut === filtros.funcionarioRut) ? filtros.funcionarioRut : "";
    const rutsCentro = funcionarios.map((funcionario) => funcionario.rut);
    const rutOrientadorFiltro = funcionarioSeleccionado || { in: rutsCentro };
    const rutGestorFiltro = funcionarioSeleccionado || { in: rutsCentro };
    const rutComunicadorFiltro = funcionarioSeleccionado || { in: rutsCentro };

    const [solicitudesIngresadas, gestiones, citas, llamadas, demandaRaw, solicitudesPendientesRaw] = await Promise.all([
        prisma.solicitud.findMany({
            where: { centro_id: centroSeleccionado, rut_orientador: rutOrientadorFiltro, fecha_inicio: { gte: desde, lt: hasta } },
            select: { rut_orientador: true, fecha_inicio: true }
        }),
        prisma.solicitud.findMany({
            where: {
                centro_id: centroSeleccionado,
                rut_gestor: rutGestorFiltro,
                accion: { in: [ACCION_REALIZAR_SOLICITUD, ACCION_RECHAZAR_SOLICITUD] },
                fecha_validacion: { gte: desde, lt: hasta }
            },
            select: { rut_gestor: true, accion: true, fecha_validacion: true }
        }),
        prisma.cita.findMany({
            where: { centro_id: centroSeleccionado, rut_gestor: rutGestorFiltro, fecha_creacion: { gte: desde, lt: hasta } },
            select: { rut_gestor: true, fecha_creacion: true }
        }),
        prisma.llamada.findMany({
            where: { centro_id: centroSeleccionado, rut_comunicador: rutComunicadorFiltro, fecha_llamada: { gte: desde, lt: hasta } },
            select: { rut_comunicador: true, fecha_llamada: true }
        }),
        prisma.cita.findMany({
            where: { centro_id: centroSeleccionado, estado_cita: { in: [...ESTADOS_PENDIENTES] } },
            select: {
                id_cita: true,
                estado_cita: true,
                fecha_estimada_atencion: true,
                profesional: { select: { nombre: true } },
                prestacion: { select: { nombre_prestacion: true } }
            }
        }),
        prisma.solicitud.groupBy({
            by: ["tipo_solicitud_id", "motivo_id"],
            where: { centro_id: centroSeleccionado, accion: ACCION_ESPERA_VALIDACION },
            _count: { _all: true }
        })
    ]);

    const tipoSolicitudIds = Array.from(new Set(solicitudesPendientesRaw.map((grupo) => grupo.tipo_solicitud_id)));
    const motivoIds = Array.from(new Set(solicitudesPendientesRaw.map((grupo) => grupo.motivo_id).filter((id): id is number => id !== null)));
    const [tiposSolicitudPendiente, motivosSolicitudPendiente] = await Promise.all([
        tipoSolicitudIds.length
            ? prisma.tipoSolicitud.findMany({
                  where: { id_tipo_solicitud: { in: tipoSolicitudIds } },
                  select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true }
              })
            : Promise.resolve([]),
        motivoIds.length
            ? prisma.motivo.findMany({
                  where: { id_motivo: { in: motivoIds } },
                  select: { id_motivo: true, nombre_motivo: true }
              })
            : Promise.resolve([])
    ]);
    const tiposSolicitudPorId = new Map(tiposSolicitudPendiente.map((tipo) => [tipo.id_tipo_solicitud, tipo.nombre_tipo_solicitud]));
    const motivosPorId = new Map(motivosSolicitudPendiente.map((motivo) => [motivo.id_motivo, motivo.nombre_motivo]));

    const totales = emptyTotales();
    const serie = buildSerie(desde, rangoDias);
    const seriePorFecha = new Map(serie.map((dia) => [dia.fecha, dia]));
    const productividad = new Map(funcionarios.map((funcionario) => [funcionario.rut, { ...funcionario, ...emptyTotales() }]));

    for (const solicitud of solicitudesIngresadas) {
        addTotal(totales, "solicitudesIngresadas");
        addRow(productividad, solicitud.rut_orientador, "solicitudesIngresadas");
        addSerie(seriePorFecha, solicitud.fecha_inicio, "solicitudesIngresadas");
    }

    for (const gestion of gestiones) {
        addTotal(totales, "gestiones");
        addRow(productividad, gestion.rut_gestor, "gestiones");
        addSerie(seriePorFecha, gestion.fecha_validacion, "gestiones");
        if (gestion.accion === ACCION_REALIZAR_SOLICITUD) {
            addTotal(totales, "solicitudesRealizadas");
            addRow(productividad, gestion.rut_gestor, "solicitudesRealizadas");
            addSerie(seriePorFecha, gestion.fecha_validacion, "solicitudesRealizadas");
        }
        if (gestion.accion === ACCION_RECHAZAR_SOLICITUD) {
            addTotal(totales, "solicitudesRechazadas");
            addRow(productividad, gestion.rut_gestor, "solicitudesRechazadas");
            addSerie(seriePorFecha, gestion.fecha_validacion, "solicitudesRechazadas");
        }
    }

    for (const cita of citas) {
        addTotal(totales, "citasCreadas");
        addRow(productividad, cita.rut_gestor, "citasCreadas");
        addSerie(seriePorFecha, cita.fecha_creacion, "citasCreadas");
    }

    for (const llamada of llamadas) {
        addTotal(totales, "llamadasRealizadas");
        addRow(productividad, llamada.rut_comunicador, "llamadasRealizadas");
        addSerie(seriePorFecha, llamada.fecha_llamada, "llamadasRealizadas");
    }

    const demandaPorProfesional = new Map<string, SomeDemandaProfesional>();
    for (const cita of demandaRaw) {
        const temporalidad = temporalidadCita(cita.fecha_estimada_atencion);
        if (demandaTemporalidad !== TEMPORALIDAD.TODAS && temporalidad !== demandaTemporalidad) continue;

        const profesional = cita.profesional?.nombre ?? "-";
        const prestacion = cita.prestacion?.nombre_prestacion ?? "-";
        const estado = cita.estado_cita ?? "-";

        const profesionalRow =
            demandaPorProfesional.get(profesional) ??
            {
                profesional,
                ...emptyDemandaConteos("Todas"),
                prestaciones: []
            };
        sumarDemanda(profesionalRow, temporalidad, estado);

        let prestacionRow = profesionalRow.prestaciones.find((row) => row.prestacion === prestacion);
        if (!prestacionRow) {
            prestacionRow = emptyDemandaConteos(prestacion);
            profesionalRow.prestaciones.push(prestacionRow);
        }
        sumarDemanda(prestacionRow, temporalidad, estado);
        demandaPorProfesional.set(profesional, profesionalRow);
    }

    const solicitudesPorTipo = new Map<string, SomeSolicitudPendienteTipo>();
    for (const grupo of solicitudesPendientesRaw) {
        const totalGrupo = grupo._count._all;
        const tipoSolicitud = tiposSolicitudPorId.get(grupo.tipo_solicitud_id) ?? "-";
        const motivo = grupo.motivo_id === null ? "Sin motivo" : (motivosPorId.get(grupo.motivo_id) ?? "-");
        const tipoRow = solicitudesPorTipo.get(tipoSolicitud) ?? { tipoSolicitud, total: 0, motivos: [] };
        tipoRow.total += totalGrupo;
        const motivoRow = tipoRow.motivos.find((row) => row.motivo === motivo);
        if (motivoRow) {
            motivoRow.total += totalGrupo;
        } else {
            tipoRow.motivos.push({ motivo, total: totalGrupo });
        }
        solicitudesPorTipo.set(tipoSolicitud, tipoRow);
    }

    return {
        esAdministrador,
        rangoDias,
        desde,
        hasta,
        centroSeleccionado,
        funcionarioSeleccionado,
        demandaTemporalidad,
        centros,
        funcionarios,
        totales,
        serie,
        productividad: Array.from(productividad.values()),
        demandaClinica: Array.from(demandaPorProfesional.values())
            .map((row) => ({
                ...row,
                prestaciones: row.prestaciones.sort((a, b) => b.total - a.total || a.prestacion.localeCompare(b.prestacion, "es"))
            }))
            .sort((a, b) => b.total - a.total || a.profesional.localeCompare(b.profesional, "es")),
        solicitudesPendientes: Array.from(solicitudesPorTipo.values())
            .map((row) => ({
                ...row,
                motivos: row.motivos.sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo, "es"))
            }))
            .sort((a, b) => b.total - a.total || a.tipoSolicitud.localeCompare(b.tipoSolicitud, "es"))
    };
}
