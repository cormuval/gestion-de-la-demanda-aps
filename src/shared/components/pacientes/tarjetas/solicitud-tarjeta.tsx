"use client";

import { useState, type ReactNode } from "react";
// components
import { Button } from "@/shared/components/ui/button";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { EstadoBadge } from "./estado-badge";
// lib
import { acortarId } from "@/shared/lib/acortarId";
import { tonoEstadoSolicitud } from "@/shared/lib/semaforoEstado";
import { formatearFecha } from "@/shared/lib/formatoFecha";
// types
import type { SolicitudTarjetaDatos } from "@/shared/types/tarjetasPaciente";

export function SolicitudTarjeta({ solicitud, cantidadCitas, citasAbiertasInicial, textoSinCitas, acciones, children }: {
    solicitud: SolicitudTarjetaDatos;
    cantidadCitas: number;
    citasAbiertasInicial: boolean;
    textoSinCitas: string;
    acciones?: ReactNode;
    children?: ReactNode;
}) {
    const [abiertas, setAbiertas] = useState(citasAbiertasInicial);
    return (
        <article data-testid={`solicitud-${solicitud.id_solicitud}`} aria-label={`Solicitud ${acortarId(solicitud.id_solicitud)}`} className="flex flex-col gap-3 rounded-md border p-4">
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:gap-6">
                <div className="min-w-0">
                    <p id={`solicitud-${solicitud.id_solicitud}`}>
                        <span className="font-medium">Solicitud:</span>{" "}
                        <CodigoId id={solicitud.id_solicitud} />
                    </p>
                    <p className="text-lg">
                        <span className="font-semibold">Tipo y motivo:</span>{" "}
                        {[solicitud.tipo, solicitud.motivo].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {solicitud.descripcion?.trim() && (
                        <p className="whitespace-pre-line break-words">
                            <span className="font-medium">Descripción del paciente:</span>{" "}
                            {solicitud.descripcion}
                        </p>
                    )}
                    {solicitud.estado_solicitud === "Rechazado" && solicitud.razon_rechazo?.trim() && (
                        <p className="whitespace-pre-line break-words">
                            <span className="font-medium">Razón de rechazo:</span>{" "}
                            {solicitud.razon_rechazo}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-1 sm:items-end sm:text-right">
                    <EstadoBadge rotulo="Estado de la solicitud" estado={solicitud.estado_solicitud} tono={tonoEstadoSolicitud(solicitud.estado_solicitud)} />
                    <p>
                        <span className="font-medium">Orientador/a:</span>{" "}
                        {solicitud.orientador ?? "—"}
                    </p>
                    <p>
                        <span className="font-medium">Gestor/a:</span>{" "}
                        {solicitud.gestor ?? "—"}
                    </p>
                    <p>
                        <span className="font-medium">Fecha de creación:</span>{" "}
                        {formatearFecha(solicitud.fecha_inicio)}
                    </p>
                    <p>
                        <span className="font-medium">Fecha de cierre:</span>{" "}
                        {formatearFecha(solicitud.fecha_cierre)}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {cantidadCitas === 0 ? (
                    <p>{textoSinCitas}</p>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        aria-expanded={abiertas}
                        aria-controls={`citas-${solicitud.id_solicitud}`}
                        onClick={() => setAbiertas(!abiertas)}
                    >
                        Ver citas ({cantidadCitas})
                    </Button>
                )}
                {acciones}
            </div>
            {cantidadCitas > 0 && (
                <>
                    {abiertas && (
                        <div id={`citas-${solicitud.id_solicitud}`} className="flex flex-col gap-3 border-l-4 border-primary/40 pl-3">
                            {children}
                        </div>
                    )}
                </>
            )}
        </article>
    );
}
