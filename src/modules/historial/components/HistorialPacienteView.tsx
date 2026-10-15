"use client";

import { useState, type FormEvent } from "react";
// actions
import { getHistorialPaciente } from "../actions/getHistorialPaciente.action";
// types
import type { CitaHistorial, HistorialPaciente, SolicitudHistorial } from "../types/historial";
// components
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const ERROR_GENERICO = "No fue posible cargar el historial";

function formatFecha(value: Date | string | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatFechaHora(value: Date | string | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function resumenSolicitudes(solicitudes: SolicitudHistorial[]): string {
    const enCurso = solicitudes.filter((s) => s.estado_solicitud === "En Curso").length;
    const realizadas = solicitudes.filter((s) => s.estado_solicitud === "Realizado").length;
    const rechazadas = solicitudes.filter((s) => s.estado_solicitud === "Rechazado").length;
    return `${solicitudes.length} solicitudes · ${enCurso} en curso · ${realizadas} realizadas · ${rechazadas} rechazadas`;
}

function CitaItem({ cita, expandida, onToggle }: { cita: CitaHistorial; expandida: boolean; onToggle: () => void }) {
    return (
        <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium"><CodigoId id={cita.id_cita} /></p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {[cita.estamento || "—", cita.prestacion || "—"].join(" · ")}
                    </p>
                    {cita.observacion && <p className="mt-2 text-sm text-muted-foreground">{cita.observacion}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant="muted">{cita.estado_cita ?? "Sin estado"}</Badge>
                    <p className="text-xs text-muted-foreground">Cierre: <span>{formatFecha(cita.fecha_cierre)}</span></p>
                </div>
            </div>
            <div className="mt-2">
                <Button type="button" variant="outline" size="sm" onClick={onToggle}>
                    {`Ver llamadas (${cita.llamadas.length})`}
                </Button>
            </div>
            {expandida && (
                <div className="mt-2 flex flex-col gap-2">
                    {cita.llamadas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin llamadas registradas.</p>
                    ) : (
                        cita.llamadas.map((llamada) => (
                            <div key={llamada.id_llamada} className="rounded-md border bg-background p-2 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{formatFechaHora(llamada.fecha_llamada)}</span>
                                    <Badge variant="muted">{llamada.respuesta_usuario}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">Comunicador: {llamada.comunicador ?? "—"}</p>
                                {llamada.observacion && <p className="mt-1 text-muted-foreground">{llamada.observacion}</p>}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function SolicitudItem({
    solicitud,
    citasExpandidas,
    onToggleCita
}: {
    solicitud: SolicitudHistorial;
    citasExpandidas: Set<string>;
    onToggleCita: (idCita: string) => void;
}) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-base"><CodigoId id={solicitud.id_solicitud} /></CardTitle>
                        <CardDescription>
                            {[solicitud.tipo || "—", solicitud.motivo || "—"].join(" · ")}
                        </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge>{solicitud.estado_solicitud}</Badge>
                        <p className="text-xs text-muted-foreground">Cierre: <span>{formatFecha(solicitud.fecha_cierre)}</span></p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {solicitud.descripcion && <p className="text-sm text-muted-foreground">{solicitud.descripcion}</p>}
                <p className="text-sm text-muted-foreground">
                    {[
                        `Inicio: ${formatFecha(solicitud.fecha_inicio)}`,
                        `Orientador: ${solicitud.orientador ?? "—"}`,
                        `Gestor: ${solicitud.gestor ?? "—"}`
                    ].join(" · ")}
                </p>
                {solicitud.estado_solicitud === "Rechazado" && solicitud.razon_rechazo && (
                    <p className="text-sm text-muted-foreground">Razón de rechazo: <span>{solicitud.razon_rechazo}</span></p>
                )}

                <div className="flex flex-col gap-3 border-l-2 border-muted pl-3">
                    {solicitud.citas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin citas registradas.</p>
                    ) : (
                        solicitud.citas.map((cita) => (
                            <CitaItem
                                key={cita.id_cita}
                                cita={cita}
                                expandida={citasExpandidas.has(cita.id_cita)}
                                onToggle={() => onToggleCita(cita.id_cita)}
                            />
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export function HistorialPacienteView() {
    const [rut, setRut] = useState("");
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [historial, setHistorial] = useState<HistorialPaciente | null>(null);
    const [citasExpandidas, setCitasExpandidas] = useState<Set<string>>(new Set());

    function toggleCita(idCita: string) {
        setCitasExpandidas((previo) => {
            const siguiente = new Set(previo);
            if (siguiente.has(idCita)) {
                siguiente.delete(idCita);
            } else {
                siguiente.add(idCita);
            }
            return siguiente;
        });
    }

    async function buscar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setCargando(true);
        setError(null);
        setHistorial(null);
        setCitasExpandidas(new Set());

        try {
            const resultado = await getHistorialPaciente(rut);
            if (!resultado.ok) {
                setError(resultado.error);
                return;
            }
            setHistorial(resultado.data);
        } catch {
            setError(ERROR_GENERICO);
        } finally {
            setCargando(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Historial del paciente</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Busca un paciente por RUT para ver sus solicitudes, citas y llamadas en tu centro, sin límite de antigüedad.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Buscar paciente</CardTitle>
                    <CardDescription>Solo lectura: no se puede editar ni gestionar desde esta pantalla.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={buscar} className="flex items-end gap-3">
                        <div className="flex-1 space-y-1.5">
                            <Label htmlFor="rut-historial">RUT</Label>
                            <Input
                                id="rut-historial"
                                value={rut}
                                onChange={(e) => setRut(e.target.value)}
                                placeholder="12.345.678-5"
                            />
                        </div>
                        <Button type="submit" disabled={cargando}>
                            {cargando ? "Buscando..." : "Buscar"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {historial && historial.solicitudes.length === 0 && (
                <Alert>
                    <AlertDescription>Sin solicitudes en tu centro para este RUT</AlertDescription>
                </Alert>
            )}

            {historial && historial.solicitudes.length > 0 && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>{historial.paciente?.nombre}</CardTitle>
                            <CardDescription>RUT {historial.paciente?.rut}</CardDescription>
                            <p className="text-sm text-muted-foreground">{resumenSolicitudes(historial.solicitudes)}</p>
                        </CardHeader>
                    </Card>

                    <div className="flex flex-col gap-4">
                        {historial.solicitudes.map((solicitud) => (
                            <SolicitudItem
                                key={solicitud.id_solicitud}
                                solicitud={solicitud}
                                citasExpandidas={citasExpandidas}
                                onToggleCita={toggleCita}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
