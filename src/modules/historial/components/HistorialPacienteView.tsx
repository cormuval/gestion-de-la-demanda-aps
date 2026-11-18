"use client";

import { useRef, useState, type FormEvent } from "react";
import { Printer } from "lucide-react";
// actions
import { getHistorialPaciente } from "../actions/getHistorialPaciente.action";
import { getVoucherSolicitud } from "@/modules/solicitudes/actions/getVoucherSolicitud.action";
// types
import type { HistorialPaciente, SolicitudHistorial } from "../types/historial";
import type { VoucherSolicitud } from "@/modules/solicitudes/types/voucher";
// components
import { NombrePaciente } from "@/shared/components/pacientes/nombre-paciente";
import { VoucherSolicitudModal } from "@/modules/solicitudes/components/VoucherSolicitudModal";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { SolicitudTarjeta } from "@/shared/components/pacientes/tarjetas/solicitud-tarjeta";
import { CitaTarjeta } from "@/shared/components/pacientes/tarjetas/cita-tarjeta";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
// lib
import { toast } from "sonner";

const ERROR_GENERICO = "No fue posible cargar el historial";

function resumenSolicitudes(solicitudes: SolicitudHistorial[]): string {
    const enCurso = solicitudes.filter((s) => s.estado_solicitud === "En Curso").length;
    const realizadas = solicitudes.filter((s) => s.estado_solicitud === "Realizado").length;
    const rechazadas = solicitudes.filter((s) => s.estado_solicitud === "Rechazado").length;
    return `${solicitudes.length} solicitudes · ${enCurso} en curso · ${realizadas} realizadas · ${rechazadas} rechazadas`;
}

export function HistorialPacienteView() {
    const [rut, setRut] = useState("");
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [historial, setHistorial] = useState<HistorialPaciente | null>(null);
    const [voucherSolicitud, setVoucherSolicitud] = useState<VoucherSolicitud | null>(null);
    const [idsVoucherCargando, setIdsVoucherCargando] = useState<Set<string>>(new Set());
    // Contador de la ultima busqueda disparada: si una respuesta llega cuando ya no es la mas
    // reciente (se lanzo otra busqueda despues), se descarta en vez de pisar el resultado vigente.
    const idUltimaBusqueda = useRef(0);
    const idsVoucherEnVuelo = useRef<Set<string>>(new Set());
    const intencionVoucherRef = useRef(0);

    async function buscar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const idBusqueda = ++idUltimaBusqueda.current;
        intencionVoucherRef.current += 1;
        setCargando(true);
        setError(null);
        setHistorial(null);
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

                    <div key={idUltimaBusqueda.current} className="flex flex-col gap-4">
                        {historial.solicitudes.map((solicitud) => {
                            const cargandoVoucher = idsVoucherCargando.has(solicitud.id_solicitud);
                            const etiqueta = cargandoVoucher ? "Reimprimiendo voucher" : "Reimprimir voucher";
                            return (
                                <SolicitudTarjeta
                                    key={solicitud.id_solicitud}
                                    solicitud={solicitud}
                                    cantidadCitas={solicitud.citas.length}
                                    citasAbiertasInicial={false}
                                    textoSinCitas="Sin citas registradas."
                                    acciones={solicitud.estado_solicitud === "En Curso" && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={cargandoVoucher}
                                            onClick={() => reimprimirVoucher(solicitud.id_solicitud)}
                                            aria-label={`${etiqueta} ${solicitud.id_solicitud}`}
                                        >
                                            <Printer data-icon="inline-start" />{etiqueta}
                                        </Button>
                                    )}
                                >
                                    {solicitud.citas.map((cita) => <CitaTarjeta key={cita.id_cita} cita={cita} />)}
                                </SolicitudTarjeta>
                            );
                        })}
                    </div>
                </>
            )}

            {voucherSolicitud && <VoucherSolicitudModal voucher={voucherSolicitud} onClose={() => setVoucherSolicitud(null)} />}
        </div>
    );
}
