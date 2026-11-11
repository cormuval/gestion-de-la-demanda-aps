"use client";

import { useState } from "react";
// actions
import { registrarLlamada } from "../actions/registrarLlamada.action";
// components
import { NombrePaciente } from "@/shared/components/pacientes/nombre-paciente";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
// lib
import { acortarId } from "@/shared/lib/acortarId";
// schemas
import { ORIGEN_LLAMADA } from "../schemas/llamada.schema";
// types
import { ERROR_CITA_CERRADA, RESPUESTAS_LLAMADA, RESPUESTA_LLAMADA } from "../types/comunicador";
import { toast } from "sonner";

export interface CitaParaLlamada {
    id_cita: string;
    rut_usuario: string;
    estado_cita: string | null;
    nombre_usuario: string | null;
    nombre_social: string | null;
    profesion: string | null;
    prestacion: string | null;
    fecha_estimada_atencion: Date | string | null;
    observacion: string | null;
}

export interface RegistrarLlamadaModalProps {
    cita: CitaParaLlamada;
    telefonos: string;
    correo: string;
    modo?: "comunicador" | "gestion_solicitudes";
    onCerrar: () => void;
    onRegistrado: (mensaje: string) => void;
    onCitaCerrada?: () => void;
}

function formatearFechaEstimada(fecha: Date | string | null): string | null {
    if (!fecha) return null;
    const date = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("es-CL");
}

function DatoCita({ etiqueta, valor, className }: { etiqueta: string; valor: string | null; className?: string }) {
    return (
        <div className={className}>
            <dt className="text-muted-foreground">{etiqueta}</dt>
            <dd className="whitespace-pre-wrap break-words">{valor || "—"}</dd>
        </div>
    );
}

export function RegistrarLlamadaModal({ cita, telefonos, correo, modo = "comunicador", onCerrar, onRegistrado, onCitaCerrada }: RegistrarLlamadaModalProps) {
    const esGestionSolicitudes = modo === "gestion_solicitudes";
    const [respuesta, setRespuesta] = useState<string>(RESPUESTA_LLAMADA.NO_CONTESTA);
    const [observacion, setObservacion] = useState("");
    const [horaAgendada, setHoraAgendada] = useState("");
    const [enviando, setEnviando] = useState(false);

    const respuestaRegistrada = esGestionSolicitudes ? RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA : respuesta;
    const requiereHora = !esGestionSolicitudes && respuestaRegistrada === RESPUESTA_LLAMADA.ACEPTADA;

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setEnviando(true);
        try {
            const resultado = await registrarLlamada({
                cita_id: cita.id_cita,
                origen: esGestionSolicitudes ? ORIGEN_LLAMADA.GESTION_SOLICITUDES : ORIGEN_LLAMADA.COMUNICADOR,
                respuesta: respuestaRegistrada,
                observacion: observacion.trim(),
                hora_agendada: requiereHora ? horaAgendada : ""
            });
            if (!resultado.ok) {
                toast.error(resultado.error);
                if (resultado.error === ERROR_CITA_CERRADA) onCitaCerrada?.();
                return;
            }
            const { estadoCita, solicitudRealizada } = resultado.data;
            onRegistrado(solicitudRealizada ? `Cita ${estadoCita}. Solicitud cerrada (Realizado).` : `Cita ${estadoCita}.`);
        } catch {
            toast.error("Error al registrar la llamada");
        } finally {
            setEnviando(false);
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onCerrar()}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Registrar llamada</DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-col gap-1">
                            <p>Cita {acortarId(cita.id_cita)}<NombrePaciente nombreLegal={cita.nombre_usuario} nombreSocial={cita.nombre_social} /></p>
                            <p>Teléfonos: {telefonos}</p>
                            <p>Correo: {correo}</p>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <dl className="grid gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                    <DatoCita etiqueta="RUT paciente" valor={cita.rut_usuario} />
                    <DatoCita etiqueta="Estado de la cita" valor={cita.estado_cita} />
                    <DatoCita etiqueta="Estamento" valor={cita.profesion} />
                    <DatoCita etiqueta="Prestación" valor={cita.prestacion} />
                    <DatoCita etiqueta="Fecha estimada de atención" valor={formatearFechaEstimada(cita.fecha_estimada_atencion)} />
                    <DatoCita etiqueta="Observación del personal clínico" valor={cita.observacion} className="sm:col-span-2" />
                </dl>
                <form onSubmit={onSubmit}>
                    <FieldGroup>
                        {esGestionSolicitudes ? (
                            <Field>
                                <FieldLabel>Respuesta registrada</FieldLabel>
                                <p className="text-sm">{RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA}</p>
                            </Field>
                        ) : (
                            <Field>
                                <FieldLabel htmlFor="respuesta-llamada">Respuesta</FieldLabel>
                                <Select id="respuesta-llamada" value={respuesta} onChange={(event) => setRespuesta(event.target.value)} required>
                                    {RESPUESTAS_LLAMADA.map((item) => <option key={item} value={item}>{item}</option>)}
                                </Select>
                            </Field>
                        )}
                        {requiereHora && (
                            <Field>
                                <FieldLabel htmlFor="hora-agendada">Hora agendada</FieldLabel>
                                <Input id="hora-agendada" type="datetime-local" value={horaAgendada} onChange={(event) => setHoraAgendada(event.target.value)} required />
                            </Field>
                        )}
                        <Field>
                            <FieldLabel htmlFor="observacion-llamada">Observación</FieldLabel>
                            <Textarea id="observacion-llamada" maxLength={350} value={observacion} onChange={(event) => setObservacion(event.target.value)} />
                            <FieldDescription className="text-right">{observacion.length}/350</FieldDescription>
                        </Field>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={onCerrar}>Cancelar</Button>
                            <Button type="submit" disabled={enviando}>{enviando ? "Registrando..." : "Registrar"}</Button>
                        </div>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
