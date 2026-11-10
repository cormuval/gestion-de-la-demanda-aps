// lib
import { acortarId } from "@/shared/lib/acortarId";

export interface SolicitudEnCurso {
    id_solicitud: string;
    fecha_inicio: Date | string;
    tipo_solicitud_id: number;
    motivo_id: number | null;
}

export interface CriterioDuplicado {
    tipo_solicitud_id: number;
    motivo_id: number | null;
}

function normalizarNombreTipoSolicitud(nombreTipoSolicitud: string): string {
    return nombreTipoSolicitud
        .trim()
        .toLocaleLowerCase("es-CL")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

const NOMBRES_TIPOS_SOLICITUD_MULTIPLES = new Set([
    normalizarNombreTipoSolicitud("Control cronico respiratorio"),
    normalizarNombreTipoSolicitud("Control de salud mental")
]);

export function permiteSolicitudesActivasMultiples(nombreTipoSolicitud: string): boolean {
    return NOMBRES_TIPOS_SOLICITUD_MULTIPLES.has(normalizarNombreTipoSolicitud(nombreTipoSolicitud));
}

export function buscarSolicitudDuplicada<T extends SolicitudEnCurso>(solicitudesEnCurso: T[], criterio: CriterioDuplicado): T | null {
    return solicitudesEnCurso.find((solicitud) => solicitud.tipo_solicitud_id === criterio.tipo_solicitud_id && solicitud.motivo_id === criterio.motivo_id) ?? null;
}

export function mensajeSolicitudDuplicada(solicitud: Pick<SolicitudEnCurso, "id_solicitud" | "fecha_inicio">): string {
    const fecha = new Date(solicitud.fecha_inicio).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Santiago"
    });

    return `Ya existe la solicitud ${acortarId(solicitud.id_solicitud)} del ${fecha.replaceAll("/", "-")} en curso para este tipo y motivo. Debe cerrarse antes de ingresar una nueva.`;
}
