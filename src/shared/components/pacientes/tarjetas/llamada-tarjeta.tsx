// components
import { EstadoBadge } from "./estado-badge";
// lib
import { tonoRespuestaLlamada } from "@/shared/lib/semaforoEstado";
import { formatearFechaHora } from "@/shared/lib/formatoFecha";
// types
import type { LlamadaTarjetaDatos } from "@/shared/types/tarjetasPaciente";

export function LlamadaTarjeta({ llamada }: { llamada: LlamadaTarjetaDatos }) {
    return (
        <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:justify-between">
            <div className="min-w-0">
                <p><span className="font-medium">Comunicador/a:</span> {llamada.comunicador ?? "—"}</p>
                {llamada.observacion?.trim() && (
                    <p className="whitespace-pre-line break-words"><span className="font-medium">Observación de la llamada:</span> {llamada.observacion}</p>
                )}
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
                <EstadoBadge rotulo="Resultado de la llamada" estado={llamada.respuesta_usuario} tono={tonoRespuestaLlamada(llamada.respuesta_usuario)} />
                <p><span className="font-medium">Fecha y hora de la llamada:</span> {formatearFechaHora(llamada.fecha_llamada)}</p>
            </div>
        </div>
    );
}
