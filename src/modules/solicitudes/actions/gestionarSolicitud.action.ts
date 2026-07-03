"use server";

import crypto from "node:crypto";
// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
import { CentroTipoSolicitudColumna, getColumnaTipoSolicitudPorCentro } from "@/modules/catalogos/utils/centroTipoSolicitud";
// schemas
import {
    ACCION_ESPERA_VALIDACION,
    ACCION_REALIZAR_SOLICITUD,
    ACCION_RECHAZAR_SOLICITUD,
    ESTADO_CITA_INICIAL,
    GestionarSolicitudInput,
    PRIORIZACION_CLINICA_NUMERICA,
    TIPO_PRESTACION_EXAMENES,
    TIPO_PRESTACION_PROFESIONAL,
    gestionarSolicitudSchema
} from "../schemas/revision.schema";

const PROFESIONAL_EXAMENES_ID = 17;

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    if (!funcionario?.centro_id) throw new Error("El funcionario activo no tiene centro asignado");
    return funcionario.centro_id;
}

async function getNombreCentro(centroId: string): Promise<string | null> {
    const centros = await prisma.$queryRaw<{ nombre_centro: string | null }[]>`
        SELECT nombre_centro
        FROM centros
        WHERE id_centro = ${centroId}
        LIMIT 1
    `;
    return centros[0]?.nombre_centro ?? null;
}

function buildCentroWhere(centroColumna: CentroTipoSolicitudColumna | null) {
    return centroColumna ? { [centroColumna]: "1" } : {};
}

function validarFechaEstimada(value: string): Date {
    const fecha = new Date(`${value}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) throw new Error("Fecha estimada invalida");

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const maxima = new Date(hoy);
    maxima.setFullYear(maxima.getFullYear() + 2);

    if (fecha < hoy) throw new Error("La fecha estimada no puede ser anterior a hoy");
    if (fecha > maxima) throw new Error("La fecha estimada no puede superar los 2 años");
    return fecha;
}

function calcularPriorizacionCita(priorizacionClinica: keyof typeof PRIORIZACION_CLINICA_NUMERICA, priorizacionAdministrativa: number | null | undefined): number {
    return Math.min(100, PRIORIZACION_CLINICA_NUMERICA[priorizacionClinica] + (priorizacionAdministrativa ?? 0));
}

export async function gestionarSolicitud(input: GestionarSolicitudInput) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const data = gestionarSolicitudSchema.parse(input);
    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    const nombreCentro = await getNombreCentro(centroId);
    const centroColumna = getColumnaTipoSolicitudPorCentro(nombreCentro);
    const fechaValidacion = new Date();

    const result = await prisma.$transaction(async (tx) => {
        const solicitud = await tx.solicitud.findFirst({
            where: {
                id_solicitud: data.id_solicitud,
                accion: ACCION_ESPERA_VALIDACION,
                estado_solicitud: "En Curso",
                centro_id: centroId
            },
            select: {
                id_solicitud: true,
                rut_usuario: true,
                usuario: { select: { priorizacion_administrativa: true } }
            }
        });
        if (!solicitud) throw new Error("La solicitud no esta pendiente de validacion o no pertenece a tu centro");

        if (data.accion === ACCION_RECHAZAR_SOLICITUD) {
            const solicitudActualizada = await tx.solicitud.update({
                where: { id_solicitud: solicitud.id_solicitud },
                data: {
                    rut_gestor: user.rut,
                    accion: ACCION_RECHAZAR_SOLICITUD,
                    fecha_validacion: fechaValidacion,
                    razon_rechazo: data.razon_rechazo,
                    observacion_rechazo: data.observacion_rechazo || null,
                    estado_solicitud: "Rechazado"
                },
                select: { id_solicitud: true, accion: true }
            });
            return { solicitud: solicitudActualizada, citasCreadas: 0 };
        }

        const centroWhere = buildCentroWhere(centroColumna);
        const citas = [];

        for (const cita of data.citas) {
            const fechaEstimada = validarFechaEstimada(cita.fecha_estimada_atencion);
            let profesionalId: number | null = null;
            let prestacionId: number | null = null;

            if (cita.tipo_prestacion === TIPO_PRESTACION_PROFESIONAL) {
                const prestacion = await tx.prestacion.findFirst({
                    where: {
                        id_prestacion: cita.prestacion_id ?? 0,
                        profesional_id: cita.profesional_id ?? 0,
                        estado: { in: ["Activo", "1"] },
                        profesional: { estado: { in: ["Activo", "1"] }, ...centroWhere }
                    },
                    select: { id_prestacion: true, profesional_id: true }
                });
                if (!prestacion) throw new Error("La prestacion no pertenece a un profesional activo del centro");
                profesionalId = prestacion.profesional_id;
                prestacionId = prestacion.id_prestacion;
            } else {
                const profesionalExamenes = await tx.profesional.findFirst({
                    where: { id_profesional: PROFESIONAL_EXAMENES_ID, estado: { in: ["Activo", "1"] } },
                    select: { id_profesional: true }
                });
                if (!profesionalExamenes) throw new Error("El profesional de examenes no existe o no esta activo");
                profesionalId = PROFESIONAL_EXAMENES_ID;
            }

            citas.push({
                id_cita: `CITA-${crypto.randomUUID()}`,
                solicitud_id: solicitud.id_solicitud,
                rut_usuario: solicitud.rut_usuario,
                rut_gestor: user.rut,
                tipo_prestacion: cita.tipo_prestacion === TIPO_PRESTACION_EXAMENES ? TIPO_PRESTACION_EXAMENES : TIPO_PRESTACION_PROFESIONAL,
                profesional_id: profesionalId,
                prestacion_id: prestacionId,
                fecha_estimada_atencion: fechaEstimada,
                observacion: cita.observacion || null,
                estado_cita: ESTADO_CITA_INICIAL,
                priorizacion_clinica: cita.priorizacion_clinica,
                priorizacion: calcularPriorizacionCita(cita.priorizacion_clinica, solicitud.usuario.priorizacion_administrativa),
                centro_id: centroId,
                fecha_creacion: fechaValidacion,
                razon_rechazo: null
            });
        }

        const solicitudActualizada = await tx.solicitud.update({
            where: { id_solicitud: solicitud.id_solicitud },
            data: {
                rut_gestor: user.rut,
                accion: ACCION_REALIZAR_SOLICITUD,
                fecha_validacion: fechaValidacion,
                razon_rechazo: null,
                observacion_rechazo: null
            },
            select: { id_solicitud: true, accion: true }
        });

        await tx.cita.createMany({ data: citas });
        return { solicitud: solicitudActualizada, citasCreadas: citas.length };
    });

    await AuditLogger.logDataAccess("UPDATE", true, { id: user.email, name: user.nombre, rut: user.rut }, data.id_solicitud, {
        details: `Solicitud gestionada con accion ${data.accion}`
    });

    return result;
}
