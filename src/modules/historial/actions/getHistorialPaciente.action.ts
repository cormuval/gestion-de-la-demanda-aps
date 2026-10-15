"use server";

// lib
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

const ERROR_CENTRO = "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion.";

const SOLICITUD_HISTORIAL_INCLUDE = {
    tipoSolicitud: true,
    motivo: true,
    orientador: true,
    gestor: true,
    citas: {
        orderBy: { fecha_creacion: "asc" },
        include: {
            profesional: true,
            prestacion: true,
            llamadas: {
                orderBy: { fecha_llamada: "asc" },
                include: { comunicador: true }
            }
        }
    }
} satisfies Prisma.SolicitudInclude;

type SolicitudConRelaciones = Prisma.SolicitudGetPayload<{ include: typeof SOLICITUD_HISTORIAL_INCLUDE }>;
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

    const rut = normalizarRut(rutPaciente);
    if (!esRutChilenoValido(rut)) return { ok: false, error: "RUT invalido" };

    const centroId = user.centro_id;
    if (!centroId) return { ok: false, error: ERROR_CENTRO };

    const usuario = await prisma.usuario.findUnique({
        where: { rut },
        select: { rut: true, nombre: true, apellido: true }
    });

    if (!usuario) {
        return { ok: true, data: { paciente: null, solicitudes: [] } };
    }

    const solicitudes = await prisma.solicitud.findMany({
        where: { rut_usuario: rut, centro_id: centroId },
        include: SOLICITUD_HISTORIAL_INCLUDE,
        orderBy: { fecha_inicio: "desc" }
    });

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "HISTORIAL_PACIENTE", {
        details: `rut=${rut}`
    });

    return {
        ok: true,
        data: {
            paciente: { rut: usuario.rut, nombre: `${usuario.nombre} ${usuario.apellido}` },
            solicitudes: solicitudes.map(mapSolicitud)
        }
    };
}
