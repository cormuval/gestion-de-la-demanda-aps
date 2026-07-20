"use client";

import { AlertTriangle } from "lucide-react";
// actions
import type { getPendientes } from "../actions/getPendientes.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

type Pendientes = Awaited<ReturnType<typeof getPendientes>>;
type SolicitudPendiente = Pendientes["solicitudesPendientes"][number];
type CitaPendiente = Pendientes["citasPendientes"][number];

function formatFecha(value: Date | string): string {
    return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function CitaRow({ cita }: { cita: CitaPendiente }) {
    return (
        <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">{cita.id_cita}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {[cita.profesional?.nombre, cita.prestacion?.nombre_prestacion].filter(Boolean).join(" · ") || "Sin detalle"}
                    </p>
                    {cita.observacion && <p className="mt-1 text-sm text-muted-foreground">{cita.observacion}</p>}
                </div>
                <Badge variant="warning">
                    <AlertTriangle size={12} />
                    {cita.estado_cita ?? "Sin estado"}
                </Badge>
            </div>
        </div>
    );
}

export function PendientesCascada({ pendientes }: { pendientes: Pendientes }) {
    const { solicitudesPendientes, citasPendientes } = pendientes;

    const idsSolicitudes = new Set(solicitudesPendientes.map((s) => s.id_solicitud));
    const citasPorSolicitud = new Map<string, CitaPendiente[]>();
    const huerfanas: CitaPendiente[] = [];

    for (const cita of citasPendientes) {
        if (cita.solicitud_id && idsSolicitudes.has(cita.solicitud_id)) {
            const lista = citasPorSolicitud.get(cita.solicitud_id) ?? [];
            lista.push(cita);
            citasPorSolicitud.set(cita.solicitud_id, lista);
        } else {
            huerfanas.push(cita);
        }
    }

    if (solicitudesPendientes.length === 0 && citasPendientes.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Pendientes del paciente</CardTitle>
                    <CardDescription>No hay solicitudes En Curso ni citas pendientes para este RUT.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Pendientes del paciente</CardTitle>
                <CardDescription>Solicitudes En Curso con sus citas pendientes anidadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {solicitudesPendientes.map((solicitud: SolicitudPendiente) => {
                    const citas = citasPorSolicitud.get(solicitud.id_solicitud) ?? [];
                    return (
                        <div key={solicitud.id_solicitud} className="rounded-md border p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium">{solicitud.id_solicitud}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {[
                                            `Inicio: ${formatFecha(solicitud.fecha_inicio)}`,
                                            `Tipo: ${solicitud.tipoSolicitud?.nombre_tipo_solicitud || "-"}`,
                                            `Motivo: ${solicitud.motivo?.nombre_motivo || "-"}`
                                        ].join(" · ")}
                                    </p>
                                    {solicitud.descripcion && <p className="mt-1 text-sm text-muted-foreground">{solicitud.descripcion}</p>}
                                </div>
                                <Badge variant="warning">
                                    <AlertTriangle size={12} />
                                    {solicitud.estado_solicitud}
                                </Badge>
                            </div>
                            <div className="mt-3 space-y-2 border-l-2 border-muted pl-3">
                                {citas.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin citas pendientes en esta solicitud.</p>
                                ) : (
                                    citas.map((cita) => <CitaRow key={cita.id_cita} cita={cita} />)
                                )}
                            </div>
                        </div>
                    );
                })}

                {huerfanas.length > 0 && (
                    <div className="rounded-md border border-dashed p-3">
                        <p className="text-sm font-medium">Otras citas</p>
                        <p className="mt-1 text-sm text-muted-foreground">Citas pendientes sin una solicitud En Curso asociada.</p>
                        <div className="mt-3 space-y-2">
                            {huerfanas.map((cita) => <CitaRow key={cita.id_cita} cita={cita} />)}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
