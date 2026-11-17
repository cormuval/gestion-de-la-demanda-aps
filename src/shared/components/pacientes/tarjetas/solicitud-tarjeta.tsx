"use client";

import { useState, type ReactNode } from "react";
// components
import { Button } from "@/shared/components/ui/button";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { EstadoBadge } from "./estado-badge";
// lib
import { tonoEstadoSolicitud } from "@/shared/lib/semaforoEstado";
import { formatearFecha } from "@/shared/lib/formatoFecha";
// types
import type { SolicitudTarjetaDatos } from "@/shared/types/tarjetasPaciente";

export function SolicitudTarjeta({ solicitud, cantidadCitas, citasAbiertasInicial, textoSinCitas, acciones, children }: { solicitud: SolicitudTarjetaDatos; cantidadCitas: number; citasAbiertasInicial: boolean; textoSinCitas: string; acciones?: ReactNode; children?: ReactNode }) {
    const [abiertas, setAbiertas] = useState(citasAbiertasInicial);
    return <article aria-labelledby={`solicitud-${solicitud.id_solicitud}`} className="rounded-md border p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0"><p id={`solicitud-${solicitud.id_solicitud}`}>Solicitud: <CodigoId id={solicitud.id_solicitud} /></p><p className="text-lg font-semibold">Motivo: {solicitud.motivo ?? "—"}</p><p className="whitespace-pre-line break-words">Descripción del paciente: {solicitud.descripcion ?? "—"}</p>{solicitud.estado_solicitud === "Rechazado" && <p className="whitespace-pre-line break-words">Razón de rechazo: {solicitud.razon_rechazo ?? "—"}</p>}</div>
            <div className="flex flex-col gap-1 sm:items-end"><EstadoBadge rotulo="Estado de la solicitud" estado={solicitud.estado_solicitud} tono={tonoEstadoSolicitud(solicitud.estado_solicitud)} /><p>Orientador/a: {solicitud.orientador ?? "—"}</p><p>Gestor/a: {solicitud.gestor ?? "—"}</p><p>Fecha de creación: {formatearFecha(solicitud.fecha_inicio)}</p><p>Fecha de cierre: {formatearFecha(solicitud.fecha_cierre)}</p>{acciones}</div>
        </div>
        {cantidadCitas === 0 ? <p>{textoSinCitas}</p> : <><div><Button type="button" variant="outline" aria-expanded={abiertas} aria-controls={`citas-${solicitud.id_solicitud}`} onClick={() => setAbiertas(!abiertas)}>Ver citas ({cantidadCitas})</Button></div>{abiertas && <div id={`citas-${solicitud.id_solicitud}`} className="border-l-4 border-primary/40 pl-3 flex flex-col gap-3">{children}</div>}</>}
    </article>;
}
