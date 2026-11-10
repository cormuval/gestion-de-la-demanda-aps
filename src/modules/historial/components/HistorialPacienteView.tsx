"use client";

import { useRef, useState, type FormEvent } from "react";
import { Printer } from "lucide-react";
// actions
import { getHistorialPaciente } from "../actions/getHistorialPaciente.action";
import { getVoucherSolicitud } from "@/modules/solicitudes/actions/getVoucherSolicitud.action";
// utils
import { formatearAgendaCita } from "../utils/agendaCita";
// types
import { ESTADO_CITA } from "@/modules/comunicador/types/comunicador";
import type { CitaHistorial, HistorialPaciente, SolicitudHistorial } from "../types/historial";
import type { VoucherSolicitud } from "@/modules/solicitudes/types/voucher";
// components
import { NombrePaciente } from "@/shared/components/pacientes/nombre-paciente";
import { VoucherSolicitudModal } from "@/modules/solicitudes/components/VoucherSolicitudModal";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
// lib
import { toast } from "sonner";

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
    const idLlamadas = `llamadas-${cita.id_cita}`;

    return (
        <div className="rounded-md border bg-muted/20 p-3" data-testid={`cita-${cita.id_cita}`}>
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
            {cita.estado_cita === ESTADO_CITA.ACEPTADA && (
                <div className="mt-2 text-sm">
                    <p className="font-medium">Fecha y hora agendadas</p>
                    <p className="text-muted-foreground">
                        {cita.hora_agendada ? formatearAgendaCita(cita.hora_agendada) : "Fecha y hora no registradas"}
                    </p>
                </div>
            )}
            <div className="mt-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onToggle}
                    aria-expanded={expandida}
                    aria-controls={idLlamadas}
                >
                    {`Ver llamadas (${cita.llamadas.length})`}
                </Button>
            </div>
            {expandida && (
                <div id={idLlamadas} className="mt-2 flex flex-col gap-2">
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
    onToggleCita,
    onReimprimirVoucher,
    idsVoucherCargando
}: {
    solicitud: SolicitudHistorial;
    citasExpandidas: Set<string>;
    onToggleCita: (idCita: string) => void;
    onReimprimirVoucher: (idSolicitud: string) => void;
    idsVoucherCargando: Set<string>;
}) {
    const idTitulo = `solicitud-titulo-${solicitud.id_solicitud}`;
    const reimprimiendoVoucher = idsVoucherCargando.has(solicitud.id_solicitud);
    const etiquetaVoucher = reimprimiendoVoucher ? "Reimprimiendo voucher" : "Reimprimir voucher";

    return (
        <Card data-testid={`solicitud-${solicitud.id_solicitud}`} aria-labelledby={idTitulo}>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle id={idTitulo} className="text-base"><CodigoId id={solicitud.id_solicitud} /></CardTitle>
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
                {solicitud.estado_solicitud === "En Curso" && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={reimprimiendoVoucher}
                        onClick={() => onReimprimirVoucher(solicitud.id_solicitud)}
                        aria-label={`${etiquetaVoucher} ${solicitud.id_solicitud}`}
                    >
                        <Printer data-icon="inline-start" />
                        {etiquetaVoucher}
                    </Button>
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
    const [voucherSolicitud, setVoucherSolicitud] = useState<VoucherSolicitud | null>(null);
    const [idsVoucherCargando, setIdsVoucherCargando] = useState<Set<string>>(new Set());
    // Contador de la ultima busqueda disparada: si una respuesta llega cuando ya no es la mas
    // reciente (se lanzo otra busqueda despues), se descarta en vez de pisar el resultado vigente.
    const idUltimaBusqueda = useRef(0);
    const idsVoucherEnVuelo = useRef<Set<string>>(new Set());
    const intencionVoucherRef = useRef(0);

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
        const idBusqueda = ++idUltimaBusqueda.current;
        intencionVoucherRef.current += 1;
        setCargando(true);
        setError(null);
        setHistorial(null);
        setCitasExpandidas(new Set());
        setVoucherSolicitud(null);
        idsVoucherEnVuelo.current.clear();
        setIdsVoucherCargando(new Set());

        try {
            const resultado = await getHistorialPaciente(rut);
            // Si mientras esperabamos se disparo una busqueda mas nueva, esta respuesta quedo
            // obsoleta: se descarta por completo (ni error, ni datos, ni el fin de carga).
            if (idBusqueda !== idUltimaBusqueda.current) return;
            if (!resultado.ok) {
                setError(resultado.error);
                return;
            }
            setHistorial(resultado.data);
        } catch {
            if (idBusqueda !== idUltimaBusqueda.current) return;
            setError(ERROR_GENERICO);
        } finally {
            if (idBusqueda === idUltimaBusqueda.current) setCargando(false);
        }
    }

    async function reimprimirVoucher(idSolicitud: string) {
        const idBusqueda = idUltimaBusqueda.current;
        if (idsVoucherEnVuelo.current.has(idSolicitud)) return;

        const intencion = ++intencionVoucherRef.current;
        idsVoucherEnVuelo.current.add(idSolicitud);
        setIdsVoucherCargando((actuales) => new Set(actuales).add(idSolicitud));
        try {
            const resultado = await getVoucherSolicitud(idSolicitud);
            if (idBusqueda !== idUltimaBusqueda.current || intencion !== intencionVoucherRef.current) return;
            if (!resultado.ok) {
                toast.error(resultado.error);
                return;
            }

            setVoucherSolicitud(resultado.data);
        } catch {
            if (idBusqueda !== idUltimaBusqueda.current || intencion !== intencionVoucherRef.current) return;
            toast.error("Error al reimprimir voucher");
        } finally {
            if (idBusqueda !== idUltimaBusqueda.current) return;
            idsVoucherEnVuelo.current.delete(idSolicitud);
            setIdsVoucherCargando((actuales) => {
                const siguientes = new Set(actuales);
                siguientes.delete(idSolicitud);
                return siguientes;
            });
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
                                onChange={(e) => {
                                    setRut(e.target.value);
                                    intencionVoucherRef.current += 1;
                                    setVoucherSolicitud(null);
                                }}
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
                            <CardTitle>
                                <NombrePaciente nombreLegal={historial.paciente?.nombre ?? null} nombreSocial={historial.paciente?.nombre_social} />
                            </CardTitle>
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
                                onReimprimirVoucher={reimprimirVoucher}
                                idsVoucherCargando={idsVoucherCargando}
                            />
                        ))}
                    </div>
                </>
            )}

            {voucherSolicitud && <VoucherSolicitudModal voucher={voucherSolicitud} onClose={() => setVoucherSolicitud(null)} />}
        </div>
    );
}
