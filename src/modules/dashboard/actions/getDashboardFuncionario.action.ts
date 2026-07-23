"use server";

// lib
import { requirePermiso } from "@/shared/lib/permisos";
import { prisma } from "@/shared/lib/prisma";

const ACCION_REALIZAR_SOLICITUD = "Realizar solicitud";
const ACCION_RECHAZAR_SOLICITUD = "Rechazar solicitud";
const RANGOS_DIAS = [30, 60, 90] as const;

export type DashboardRangoDias = (typeof RANGOS_DIAS)[number];

export interface DashboardDiaSerie {
    fecha: string;
    dia: number;
    solicitudesIngresadas: number;
    solicitudesRechazadas: number;
    solicitudesRealizadas: number;
    citasCreadas: number;
    llamadasRealizadas: number;
}

export interface DashboardSolicitudDetalle {
    id_solicitud: string;
    fecha_inicio: Date;
    rut_usuario: string;
    tipo_solicitud: string;
    motivo: string | null;
    estado_solicitud: string;
}

export interface DashboardCitaGestionada {
    id_cita: string;
    fecha_estimada_atencion: Date | null;
    tipo_prestacion: string;
    estado_cita: string | null;
    priorizacion_clinica: string | null;
    estamento: string | null;
    prestacion: string | null;
}

export interface DashboardGestionDetalle {
    id_solicitud: string;
    fecha_validacion: Date | null;
    rut_usuario: string;
    accion: string | null;
    razon_rechazo: string | null;
    citas_creadas: number;
    citas: DashboardCitaGestionada[];
}

export interface DashboardLlamadaDetalle {
    id_llamada: string;
    fecha_llamada: Date | null;
    rut_usuario: string;
    cita_id: string;
    respuesta_usuario: string;
    observacion: string | null;
    estamento: string | null;
    prestacion: string | null;
    tipo_prestacion: string | null;
}

export interface DashboardFuncionarioData {
    rangoDias: DashboardRangoDias;
    desde: Date;
    hasta: Date;
    funcionario: {
        rut: string;
        nombre: string;
        rol: string;
        centro: string | null;
    };
    totales: {
        solicitudesIngresadas: number;
        solicitudesRechazadas: number;
        solicitudesRealizadas: number;
        citasCreadas: number;
        llamadasRealizadas: number;
    };
    serie: DashboardDiaSerie[];
    detalles: {
        solicitudesIngresadas: DashboardSolicitudDetalle[];
        gestiones: DashboardGestionDetalle[];
        llamadas: DashboardLlamadaDetalle[];
    };
}

function parseRangoDias(input?: number): DashboardRangoDias {
    return RANGOS_DIAS.includes(input as DashboardRangoDias) ? (input as DashboardRangoDias) : 30;
}

function dateKey(value: Date): string {
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0")
    ].join("-");
}

function fechaKey(value: Date | null): string | null {
    if (!value) return null;
    return dateKey(value);
}

function buildRango(rangoDiasInput?: number): { rangoDias: DashboardRangoDias; desde: Date; hasta: Date } {
    const rangoDias = parseRangoDias(rangoDiasInput);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - (rangoDias - 1));
    const hasta = new Date(hoy);
    hasta.setDate(hoy.getDate() + 1);
    return { rangoDias, desde, hasta };
}

function buildSerie(desde: Date, rangoDias: DashboardRangoDias): DashboardDiaSerie[] {
    return Array.from({ length: rangoDias }, (_, index) => {
        const fecha = new Date(desde);
        fecha.setDate(desde.getDate() + index);
        return {
            fecha: dateKey(fecha),
            dia: fecha.getDate(),
            solicitudesIngresadas: 0,
            solicitudesRechazadas: 0,
            solicitudesRealizadas: 0,
            citasCreadas: 0,
            llamadasRealizadas: 0
        };
    });
}

export async function getDashboardFuncionario(rangoDiasInput?: number): Promise<DashboardFuncionarioData> {
    const user = await requirePermiso("dashboard.ver");
    const { rangoDias, desde, hasta } = buildRango(rangoDiasInput);

    const [solicitudesIngresadas, gestiones, llamadas] = await Promise.all([
        prisma.solicitud.findMany({
            where: {
                rut_orientador: user.rut,
                fecha_inicio: { gte: desde, lt: hasta }
            },
            orderBy: { fecha_inicio: "desc" },
            select: {
                id_solicitud: true,
                fecha_inicio: true,
                rut_usuario: true,
                estado_solicitud: true,
                tipoSolicitud: { select: { nombre_tipo_solicitud: true } },
                motivo: { select: { nombre_motivo: true } }
            }
        }),
        prisma.solicitud.findMany({
            where: {
                rut_gestor: user.rut,
                accion: { in: [ACCION_RECHAZAR_SOLICITUD, ACCION_REALIZAR_SOLICITUD] },
                fecha_validacion: { gte: desde, lt: hasta }
            },
            orderBy: { fecha_validacion: "desc" },
            select: {
                id_solicitud: true,
                fecha_validacion: true,
                rut_usuario: true,
                accion: true,
                razon_rechazo: true,
                citas: {
                    orderBy: { fecha_creacion: "asc" },
                    select: {
                        id_cita: true,
                        fecha_estimada_atencion: true,
                        tipo_prestacion: true,
                        estado_cita: true,
                        priorizacion_clinica: true,
                        profesional: { select: { nombre: true } },
                        prestacion: { select: { nombre_prestacion: true } }
                    }
                }
            }
        }),
        prisma.llamada.findMany({
            where: {
                rut_comunicador: user.rut,
                fecha_llamada: { gte: desde, lt: hasta }
            },
            orderBy: { fecha_llamada: "desc" },
            select: {
                id_llamada: true,
                fecha_llamada: true,
                rut_usuario: true,
                cita_id: true,
                respuesta_usuario: true,
                observacion: true,
                cita: {
                    select: {
                        tipo_prestacion: true,
                        profesional: { select: { nombre: true } },
                        prestacion: { select: { nombre_prestacion: true } }
                    }
                }
            }
        })
    ]);

    const serie = buildSerie(desde, rangoDias);
    const seriePorFecha = new Map(serie.map((dia) => [dia.fecha, dia]));

    for (const solicitud of solicitudesIngresadas) {
        const dia = seriePorFecha.get(fechaKey(solicitud.fecha_inicio) ?? "");
        if (dia) dia.solicitudesIngresadas += 1;
    }

    for (const gestion of gestiones) {
        const dia = seriePorFecha.get(fechaKey(gestion.fecha_validacion) ?? "");
        if (!dia) continue;
        if (gestion.accion === ACCION_RECHAZAR_SOLICITUD) dia.solicitudesRechazadas += 1;
        if (gestion.accion === ACCION_REALIZAR_SOLICITUD) {
            dia.solicitudesRealizadas += 1;
            dia.citasCreadas += gestion.citas.length;
        }
    }

    for (const llamada of llamadas) {
        const dia = seriePorFecha.get(fechaKey(llamada.fecha_llamada) ?? "");
        if (dia) dia.llamadasRealizadas += 1;
    }

    const solicitudesRechazadas = gestiones.filter((gestion) => gestion.accion === ACCION_RECHAZAR_SOLICITUD).length;
    const solicitudesRealizadas = gestiones.filter((gestion) => gestion.accion === ACCION_REALIZAR_SOLICITUD).length;
    const citasCreadas = gestiones.reduce((total, gestion) => total + (gestion.accion === ACCION_REALIZAR_SOLICITUD ? gestion.citas.length : 0), 0);

    return {
        rangoDias,
        desde,
        hasta,
        funcionario: {
            rut: user.rut,
            nombre: user.nombre,
            rol: user.rol.nombre,
            centro: user.centro_nombre
        },
        totales: {
            solicitudesIngresadas: solicitudesIngresadas.length,
            solicitudesRechazadas,
            solicitudesRealizadas,
            citasCreadas,
            llamadasRealizadas: llamadas.length
        },
        serie,
        detalles: {
            solicitudesIngresadas: solicitudesIngresadas.map((solicitud) => ({
                id_solicitud: solicitud.id_solicitud,
                fecha_inicio: solicitud.fecha_inicio,
                rut_usuario: solicitud.rut_usuario,
                tipo_solicitud: solicitud.tipoSolicitud.nombre_tipo_solicitud,
                motivo: solicitud.motivo?.nombre_motivo ?? null,
                estado_solicitud: solicitud.estado_solicitud
            })),
            gestiones: gestiones.map((gestion) => ({
                id_solicitud: gestion.id_solicitud,
                fecha_validacion: gestion.fecha_validacion,
                rut_usuario: gestion.rut_usuario,
                accion: gestion.accion,
                razon_rechazo: gestion.razon_rechazo,
                citas_creadas: gestion.accion === ACCION_REALIZAR_SOLICITUD ? gestion.citas.length : 0,
                citas:
                    gestion.accion === ACCION_REALIZAR_SOLICITUD
                        ? gestion.citas.map((cita) => ({
                              id_cita: cita.id_cita,
                              fecha_estimada_atencion: cita.fecha_estimada_atencion,
                              tipo_prestacion: cita.tipo_prestacion,
                              estado_cita: cita.estado_cita,
                              priorizacion_clinica: cita.priorizacion_clinica,
                              estamento: cita.profesional?.nombre ?? null,
                              prestacion: cita.prestacion?.nombre_prestacion ?? null
                          }))
                        : []
            })),
            llamadas: llamadas.map((llamada) => ({
                id_llamada: llamada.id_llamada,
                fecha_llamada: llamada.fecha_llamada,
                rut_usuario: llamada.rut_usuario,
                cita_id: llamada.cita_id,
                respuesta_usuario: llamada.respuesta_usuario,
                observacion: llamada.observacion,
                estamento: llamada.cita.profesional?.nombre ?? null,
                prestacion: llamada.cita.prestacion?.nombre_prestacion ?? null,
                tipo_prestacion: llamada.cita.tipo_prestacion
            }))
        }
    };
}
