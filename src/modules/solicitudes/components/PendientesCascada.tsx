"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Printer } from "lucide-react";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CodigoId } from "@/shared/components/ui/codigo-id";
// types
import type { CitaCascada, SolicitudCascada } from "../types/pendientes";

interface PendientesCascadaData {
    solicitudesPendientes: SolicitudCascada[];
    citasPendientes: CitaCascada[];
}

function formatFecha(value: Date | string): string {
    return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function CitaRow<C extends CitaCascada>({ cita, accionesCita }: { cita: C; accionesCita?: (cita: C) => ReactNode }) {
    return (
        <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium"><CodigoId id={cita.id_cita} /></p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {[cita.profesional?.nombre, cita.prestacion?.nombre_prestacion].filter(Boolean).join(" · ") || "Sin detalle"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {cita.priorizacion_clinica && <Badge>{cita.priorizacion_clinica}</Badge>}
                        {cita.fecha_estimada_atencion && <Badge variant="muted">Fecha estimada: {formatFecha(cita.fecha_estimada_atencion)}</Badge>}
                    </div>
                    {cita.observacion && <p className="mt-2 text-sm text-muted-foreground">{cita.observacion}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant="warning">
                        <AlertTriangle data-icon="inline-start" />
                        {cita.estado_cita ?? "Sin estado"}
                    </Badge>
                    {accionesCita?.(cita)}
                </div>
            </div>
        </div>
    );
}

export interface ListaPendientesProps<S extends SolicitudCascada, C extends CitaCascada> {
    solicitudes: S[];
    citas: C[];
    accionesSolicitud?: (solicitud: S) => ReactNode;
    accionesCita?: (cita: C) => ReactNode;
}

export function ListaPendientes<S extends SolicitudCascada, C extends CitaCascada>({
    solicitudes,
    citas,
    accionesSolicitud,
    accionesCita
}: ListaPendientesProps<S, C>) {
    const idsSolicitudes = new Set(solicitudes.map((s) => s.id_solicitud));
    const citasPorSolicitud = new Map<string, C[]>();
    const huerfanas: C[] = [];

    for (const cita of citas) {
        if (cita.solicitud_id && idsSolicitudes.has(cita.solicitud_id)) {
            const lista = citasPorSolicitud.get(cita.solicitud_id) ?? [];
            lista.push(cita);
            citasPorSolicitud.set(cita.solicitud_id, lista);
        } else {
            huerfanas.push(cita);
        }
    }

    if (solicitudes.length === 0 && citas.length === 0) {
        return <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">No hay solicitudes ni citas en curso.</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            {solicitudes.map((solicitud: S) => {
                const citasSolicitud = citasPorSolicitud.get(solicitud.id_solicitud) ?? [];
                return (
                    <div key={solicitud.id_solicitud} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium"><CodigoId id={solicitud.id_solicitud} /></p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {[
                                        `Inicio: ${formatFecha(solicitud.fecha_inicio)}`,
                                        `Tipo: ${solicitud.tipoSolicitud?.nombre_tipo_solicitud || "-"}`,
                                        `Motivo: ${solicitud.motivo?.nombre_motivo || "-"}`
                                    ].join(" · ")}
                                </p>
                                {solicitud.descripcion && <p className="mt-1 text-sm text-muted-foreground">{solicitud.descripcion}</p>}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                                <Badge variant="warning">
                                    <AlertTriangle data-icon="inline-start" />
                                    {solicitud.estado_solicitud}
                                </Badge>
                                {accionesSolicitud?.(solicitud)}
                            </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-l-2 border-muted pl-3">
                            {citasSolicitud.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin citas pendientes en esta solicitud.</p>
                            ) : (
                                citasSolicitud.map((cita) => <CitaRow key={cita.id_cita} cita={cita} accionesCita={accionesCita} />)
                            )}
                        </div>
                    </div>
                );
            })}

            {huerfanas.length > 0 && (
                <div className="rounded-md border border-dashed p-3">
                    <p className="text-sm font-medium">Otras citas</p>
                    <p className="mt-1 text-sm text-muted-foreground">Citas pendientes sin una solicitud En Curso asociada.</p>
                    <div className="mt-3 flex flex-col gap-2">
                        {huerfanas.map((cita) => <CitaRow key={cita.id_cita} cita={cita} accionesCita={accionesCita} />)}
                    </div>
                </div>
            )}
        </div>
    );
}

export function PendientesCascada({
    pendientes,
    onReimprimirVoucher,
    idsVoucherCargando,
    reimpresionDeshabilitada = false
}: {
    pendientes: PendientesCascadaData;
    onReimprimirVoucher?: (idSolicitud: string) => void;
    idsVoucherCargando?: ReadonlySet<string>;
    reimpresionDeshabilitada?: boolean;
}) {
    const { solicitudesPendientes, citasPendientes } = pendientes;

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
            <CardContent>
                <ListaPendientes
                    solicitudes={solicitudesPendientes}
                    citas={citasPendientes}
                    accionesSolicitud={onReimprimirVoucher ? (solicitud) => {
                        const cargando = idsVoucherCargando?.has(solicitud.id_solicitud) ?? false;
                        const etiqueta = cargando ? "Reimprimiendo voucher" : "Reimprimir voucher";

                        return (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={cargando || reimpresionDeshabilitada}
                                onClick={() => onReimprimirVoucher(solicitud.id_solicitud)}
                                aria-label={`${etiqueta} ${solicitud.id_solicitud}`}
                            >
                                <Printer data-icon="inline-start" />
                                {etiqueta}
                            </Button>
                        );
                    } : undefined}
                />
            </CardContent>
        </Card>
    );
}
