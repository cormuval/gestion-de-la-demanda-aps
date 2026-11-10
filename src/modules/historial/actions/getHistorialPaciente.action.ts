"use server";

// lib
import { z } from "zod";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
// types
import type { Prisma } from "@prisma/client";
import type { ResultadoAccion } from "@/shared/types/resultado";
import type { CitaHistorial, HistorialPaciente, LlamadaHistorial, SolicitudHistorial } from "../types/historial";
import { esEstadoTerminal } from "@/modules/comunicador/types/comunicador";
// utils
import { esRutChilenoValido, normalizarRut } from "@/modules/solicitudes/utils/rut";
import { fechaCierreCita, fechaCierreSolicitud } from "../utils/cierre";
import { resolverAgendaCita } from "../utils/agendaCita";

const ERROR_RUT = "RUT invalido";
const ERROR_CENTRO = "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion.";

const rutSchema = z.string();

// Solo las columnas escalares que leen los mappers, y de cada relacion solo el campo que
// se muestra (nunca la fila completa: evita traer password_hash/email de Funcionario, etc).
const SOLICITUD_HISTORIAL_SELECT = {
    id_solicitud: true,
    fecha_inicio: true,
    descripcion: true,
    estado_solicitud: true,
    accion: true,
    razon_rechazo: true,
    fecha_validacion: true,
    tipoSolicitud: { select: { nombre_tipo_solicitud: true } },
    motivo: { select: { nombre_motivo: true } },
    orientador: { select: { nombre: true } },
    gestor: { select: { nombre: true } },
    citas: {
        orderBy: { fecha_creacion: "asc" },
        select: {
            id_cita: true,
            estado_cita: true,
            fecha_estimada_atencion: true,
            observacion: true,
            profesional: { select: { nombre: true } },
            prestacion: { select: { nombre_prestacion: true } },
            llamadas: {
                orderBy: { fecha_llamada: "asc" },
                select: {
                    id_llamada: true,
                    fecha_llamada: true,
                    respuesta_usuario: true,
                    observacion: true,
                    hora_agendada: true,
                    comunicador: { select: { nombre: true } }
                }
            }
        }
    }
} satisfies Prisma.SolicitudSelect;

type SolicitudConRelaciones = Prisma.SolicitudGetPayload<{ select: typeof SOLICITUD_HISTORIAL_SELECT }>;
type CitaConRelaciones = SolicitudConRelaciones["citas"][number];
type LlamadaConRelaciones = CitaConRelaciones["llamadas"][number];

function mapLlamada(llamada: LlamadaConRelaciones): LlamadaHistorial {
    return {
        id_llamada: llamada.id_llamada,
        fecha_llamada: llamada.fecha_llamada,
        respuesta_usuario: llamada.respuesta_usuario,
        comunicador: llamada.comunicador?.nombre ?? null,
        observacion: llamada.observacion,
        hora_agendada: llamada.hora_agendada
    };
}

function mapCita(cita: CitaConRelaciones): CitaHistorial {
    const llamadas = cita.llamadas.map(mapLlamada);

    return {
        id_cita: cita.id_cita,
        estamento: cita.profesional?.nombre ?? null,
        prestacion: cita.prestacion?.nombre_prestacion ?? null,
        estado_cita: cita.estado_cita,
        cerrada: esEstadoTerminal(cita.estado_cita),
        fecha_cierre: fechaCierreCita(cita.estado_cita, llamadas.map((llamada) => llamada.fecha_llamada)),
        fecha_estimada_atencion: cita.fecha_estimada_atencion,
        hora_agendada: resolverAgendaCita(cita.estado_cita, llamadas),
        observacion: cita.observacion,
        llamadas
    };
}

function mapSolicitud(solicitud: SolicitudConRelaciones): SolicitudHistorial {
    const citas = solicitud.citas.map(mapCita);

    return {
        id_solicitud: solicitud.id_solicitud,
        fecha_inicio: solicitud.fecha_inicio,
        tipo: solicitud.tipoSolicitud?.nombre_tipo_solicitud ?? null,
        motivo: solicitud.motivo?.nombre_motivo ?? null,
        descripcion: solicitud.descripcion,
        estado_solicitud: solicitud.estado_solicitud,
        accion: solicitud.accion,
        razon_rechazo: solicitud.razon_rechazo,
        fecha_cierre: fechaCierreSolicitud(
            solicitud.estado_solicitud,
            solicitud.fecha_validacion,
            citas.map((cita) => cita.fecha_cierre)
        ),
        orientador: solicitud.orientador?.nombre ?? null,
        gestor: solicitud.gestor?.nombre ?? null,
        citas
    };
}

export async function getHistorialPaciente(rutPaciente: string): Promise<ResultadoAccion<HistorialPaciente>> {
    const user = await requirePermiso("historial.ver");

    const parsedRut = rutSchema.safeParse(rutPaciente);
    if (!parsedRut.success) return { ok: false, error: ERROR_RUT };

    const rut = normalizarRut(parsedRut.data);
    if (!esRutChilenoValido(rut)) return { ok: false, error: ERROR_RUT };

    const centroId = user.centro_id;
    if (!centroId) return { ok: false, error: ERROR_CENTRO };

    // Se audita todo intento de busqueda con RUT y centro validos, incluso cuando el
    // paciente no existe o no tiene solicitudes en este centro.
    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "HISTORIAL_PACIENTE", {
        details: `rut=${rut}`
    });

    const usuario = await prisma.usuario.findUnique({
        where: { rut },
        select: { rut: true, nombre: true, apellido: true, nombre_social: true }
    });

    if (!usuario) {
        return { ok: true, data: { paciente: null, solicitudes: [] } };
    }

    const solicitudes = await prisma.solicitud.findMany({
        where: { rut_usuario: rut, centro_id: centroId },
        select: SOLICITUD_HISTORIAL_SELECT,
        orderBy: { fecha_inicio: "desc" }
    });

    // Sin solicitudes en este centro, no se informa el nombre del paciente: no hay nada
    // que mostrar y evita exponer datos de un paciente ajeno a este centro.
    if (solicitudes.length === 0) {
        return { ok: true, data: { paciente: null, solicitudes: [] } };
    }

    return {
        ok: true,
        data: {
            paciente: { rut: usuario.rut, nombre: `${usuario.nombre} ${usuario.apellido}`, nombre_social: usuario.nombre_social },
            solicitudes: solicitudes.map(mapSolicitud)
        }
    };
}
