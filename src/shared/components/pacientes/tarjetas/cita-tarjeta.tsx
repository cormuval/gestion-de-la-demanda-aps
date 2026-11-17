"use client";

import { useState, type ReactNode } from "react";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { EstadoBadge } from "./estado-badge";
import { LlamadaTarjeta } from "./llamada-tarjeta";
// lib
import { tonoEstadoCita } from "@/shared/lib/semaforoEstado";
import { formatearFecha, formatearFechaCalendario, formatearFechaHora } from "@/shared/lib/formatoFecha";
import { ESTADO_CITA } from "@/modules/comunicador/types/comunicador";
// types
import type { CitaTarjetaDatos } from "@/shared/types/tarjetasPaciente";

export function CitaTarjeta({ cita, detallePendiente = false, acciones }: { cita: CitaTarjetaDatos; detallePendiente?: boolean; acciones?: ReactNode }) {
    const [abiertas, setAbiertas] = useState(false);
    return <div className="rounded-md border p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0"><p>Cita: <CodigoId id={cita.id_cita} /></p><p>{cita.estamento ?? "—"} · {cita.prestacion ?? "—"}</p><p className="whitespace-pre-line break-words">Observación del gestor/a: {cita.observacion ?? "—"}</p>{detallePendiente && <><Badge variant="secondary">{cita.priorizacion_clinica ?? "—"}</Badge><p>Fecha estimada: {formatearFechaCalendario(cita.fecha_estimada_atencion)}</p></>}</div>
            <div className="flex flex-col gap-1 sm:items-end"><EstadoBadge rotulo="Estado de la cita" estado={cita.estado_cita} tono={tonoEstadoCita(cita.estado_cita)} suave /><p>Gestor/a: {cita.gestor ?? "—"}</p><p>Cierre de la cita: {formatearFecha(cita.fecha_cierre)}</p>{cita.estado_cita === ESTADO_CITA.ACEPTADA && <p>Fecha y hora agendadas: {cita.hora_agendada ? formatearFechaHora(cita.hora_agendada) : "Fecha y hora no registradas"}</p>}{acciones}</div>
        </div>
        <div><Button type="button" variant="outline" aria-expanded={abiertas} aria-controls={`llamadas-${cita.id_cita}`} onClick={() => setAbiertas(!abiertas)}>Ver llamadas ({cita.llamadas.length})</Button></div>
        {abiertas && <div id={`llamadas-${cita.id_cita}`} className="flex flex-col gap-2">{cita.llamadas.length ? cita.llamadas.map((llamada) => <LlamadaTarjeta key={llamada.id_llamada} llamada={llamada} />) : <p>Sin llamadas registradas.</p>}</div>}
    </div>;
}
