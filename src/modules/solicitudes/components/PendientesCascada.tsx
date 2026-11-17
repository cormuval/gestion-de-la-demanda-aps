"use client";

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { SolicitudTarjeta } from "@/shared/components/pacientes/tarjetas/solicitud-tarjeta";
import { CitaTarjeta } from "@/shared/components/pacientes/tarjetas/cita-tarjeta";
// types
import { esEstadoPendiente } from "@/modules/comunicador/types/comunicador";
import type { CitaCascada, SolicitudCascada } from "../types/pendientes";
// utils
import { aCitaTarjeta, aSolicitudTarjeta } from "../utils/tarjetasPendientes";

interface PendientesCascadaData {
    solicitudesPendientes: (SolicitudCascada & { centro_id: string | null })[];
    citasPendientes: CitaCascada[];
}

export interface ListaPendientesProps<C extends CitaCascada, S extends SolicitudCascada<C>> {
    solicitudes: S[];
    citasSueltas?: C[];
    accionesSolicitud?: (solicitud: S) => ReactNode;
    accionesCita?: (cita: C) => ReactNode;
}

export function ListaPendientes<C extends CitaCascada, S extends SolicitudCascada<C>>({
    solicitudes, citasSueltas = [], accionesSolicitud, accionesCita
}: ListaPendientesProps<C, S>) {
    if (solicitudes.length === 0 && citasSueltas.length === 0) {
        return <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">No hay solicitudes ni citas en curso.</div>;
    }
    return (
        <div className="flex flex-col gap-4">
            {solicitudes.map((solicitud) => (
                <SolicitudTarjeta
                    key={solicitud.id_solicitud}
                    solicitud={aSolicitudTarjeta(solicitud)}
                    cantidadCitas={solicitud.citas.length}
                    citasAbiertasInicial
                    textoSinCitas="Sin citas en esta solicitud."
                    acciones={accionesSolicitud?.(solicitud)}
                >
                    {solicitud.citas.map((cita) => (
                        <CitaTarjeta
                            key={cita.id_cita}
                            cita={aCitaTarjeta(cita)}
                            detallePendiente={esEstadoPendiente(cita.estado_cita)}
                            acciones={esEstadoPendiente(cita.estado_cita) ? accionesCita?.(cita) : undefined}
                        />
                    ))}
                </SolicitudTarjeta>
            ))}
            {citasSueltas.length > 0 && (
                <div className="rounded-md border border-dashed p-3">
                    <p className="text-sm font-medium">Otras citas</p>
                    <p className="mt-1 text-sm text-muted-foreground">Citas pendientes sin una solicitud En Curso asociada.</p>
                    <div className="mt-3 flex flex-col gap-2">
                        {citasSueltas.map((cita) => (
                            <CitaTarjeta
                                key={cita.id_cita}
                                cita={aCitaTarjeta(cita)}
                                detallePendiente={esEstadoPendiente(cita.estado_cita)}
                                acciones={esEstadoPendiente(cita.estado_cita) ? accionesCita?.(cita) : undefined}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function PendientesCascada({
    pendientes,
    centroActivoId,
    onReimprimirVoucher,
    idsVoucherCargando,
    reimpresionDeshabilitada = false
}: {
    pendientes: PendientesCascadaData;
    centroActivoId: string | null;
    onReimprimirVoucher?: (idSolicitud: string) => void;
    idsVoucherCargando?: ReadonlySet<string>;
    reimpresionDeshabilitada?: boolean;
}) {
    const { solicitudesPendientes, citasPendientes } = pendientes;
    const idsSolicitudesEnCurso = new Set(solicitudesPendientes.map((solicitud) => solicitud.id_solicitud));
    const citasSueltas = citasPendientes.filter((cita) => !cita.solicitud_id || !idsSolicitudesEnCurso.has(cita.solicitud_id));

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
                    citasSueltas={citasSueltas}
                    accionesSolicitud={onReimprimirVoucher ? (solicitud) => {
                        if (!centroActivoId || solicitud.centro_id !== centroActivoId) return undefined;

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
