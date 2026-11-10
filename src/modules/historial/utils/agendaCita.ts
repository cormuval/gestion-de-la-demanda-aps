// types
import { ESTADO_CITA, RESPUESTA_LLAMADA } from "@/modules/comunicador/types/comunicador";
import type { LlamadaHistorial } from "../types/historial";

const formatoAgenda = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
});

export function resolverAgendaCita(estado: string | null, llamadas: readonly LlamadaHistorial[]): Date | null {
    if (estado !== ESTADO_CITA.ACEPTADA) return null;

    let ultimaAceptacion: LlamadaHistorial | null = null;
    for (const llamada of llamadas) {
        if (llamada.respuesta_usuario !== RESPUESTA_LLAMADA.ACEPTADA) continue;

        const fecha = llamada.fecha_llamada?.getTime() ?? -Infinity;
        const fechaUltima = ultimaAceptacion?.fecha_llamada?.getTime() ?? -Infinity;
        if (!ultimaAceptacion || fecha > fechaUltima || (fecha === fechaUltima && llamada.id_llamada > ultimaAceptacion.id_llamada)) {
            ultimaAceptacion = llamada;
        }
    }

    // Una aceptacion posterior sin agenda no hereda una hora previamente registrada.
    return ultimaAceptacion?.hora_agendada ?? null;
}

export function formatearAgendaCita(fecha: Date): string {
    return formatoAgenda.format(fecha);
}
