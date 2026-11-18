// types
import type { Prisma } from "@prisma/client";

export const LLAMADA_CASCADA_SELECT = {
    id_llamada: true,
    fecha_llamada: true,
    respuesta_usuario: true,
    observacion: true,
    hora_agendada: true,
    comunicador: { select: { nombre: true } }
} satisfies Prisma.LlamadaSelect;

export const CITA_CASCADA_SELECT = {
    id_cita: true,
    solicitud_id: true,
    estado_cita: true,
    observacion: true,
    priorizacion_clinica: true,
    fecha_estimada_atencion: true,
    profesional: { select: { nombre: true } },
    prestacion: { select: { nombre_prestacion: true } },
    gestor: { select: { nombre: true } },
    llamadas: { orderBy: { fecha_llamada: "asc" }, select: LLAMADA_CASCADA_SELECT }
} satisfies Prisma.CitaSelect;

export const SOLICITUD_CASCADA_SELECT = {
    id_solicitud: true,
    fecha_inicio: true,
    descripcion: true,
    estado_solicitud: true,
    accion: true,
    razon_rechazo: true,
    fecha_validacion: true,
    tipo_solicitud_id: true,
    motivo_id: true,
    centro_id: true,
    tipoSolicitud: { select: { nombre_tipo_solicitud: true } },
    motivo: { select: { nombre_motivo: true } },
    orientador: { select: { nombre: true } },
    gestor: { select: { nombre: true } },
    citas: { orderBy: { fecha_creacion: "asc" }, select: CITA_CASCADA_SELECT }
} satisfies Prisma.SolicitudSelect;
