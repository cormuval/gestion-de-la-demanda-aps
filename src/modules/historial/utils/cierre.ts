// types
import { esEstadoTerminal } from "@/modules/comunicador/types/comunicador";

function mayorFecha(fechas: (Date | null)[]): Date | null {
    const validas = fechas.filter((fecha): fecha is Date => fecha !== null);
    if (validas.length === 0) return null;
    return validas.reduce((mayor, actual) => (actual.getTime() > mayor.getTime() ? actual : mayor));
}

/**
 * Fecha de cierre de una cita: si su estado es terminal, la mayor `fecha_llamada`
 * de sus llamadas (o null si no tiene). Si esta pendiente, no tiene fecha de cierre.
 */
export function fechaCierreCita(estadoCita: string | null, fechasLlamadas: (Date | null)[]): Date | null {
    if (!esEstadoTerminal(estadoCita)) return null;
    return mayorFecha(fechasLlamadas);
}

/**
 * Fecha de cierre de una solicitud: "Rechazado" usa su fecha de validacion,
 * "Realizado" usa la mayor fecha de cierre de sus citas, y cualquier otro
 * estado (ej. "En Curso") no tiene fecha de cierre.
 */
export function fechaCierreSolicitud(
    estadoSolicitud: string,
    fechaValidacion: Date | null,
    fechasCierreCitas: (Date | null)[]
): Date | null {
    if (estadoSolicitud === "Rechazado") return fechaValidacion;
    if (estadoSolicitud === "Realizado") return mayorFecha(fechasCierreCitas);
    return null;
}
