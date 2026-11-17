// components
import { EstadoBadge } from "./estado-badge";
// lib
import { tonoRespuestaLlamada } from "@/shared/lib/semaforoEstado";
import { formatearFechaHora } from "@/shared/lib/formatoFecha";
// types
import type { LlamadaTarjetaDatos } from "@/shared/types/tarjetasPaciente";

export function LlamadaTarjeta({ llamada }: { llamada: LlamadaTarjetaDatos }) {
    return <div className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="min-w-0"><p>Comunicador/a: {llamada.comunicador ?? "—"}</p><p className="whitespace-pre-line break-words">Observación de la llamada: {llamada.observacion ?? "—"}</p></div>
        <div className="flex flex-col gap-1 sm:items-end"><EstadoBadge rotulo="Resultado de la llamada" estado={llamada.respuesta_usuario} tono={tonoRespuestaLlamada(llamada.respuesta_usuario)} /><p>Fecha y hora de la llamada: {formatearFechaHora(llamada.fecha_llamada)}</p></div>
    </div>;
}
