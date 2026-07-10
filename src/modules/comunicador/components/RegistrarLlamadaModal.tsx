"use client";

import { useState } from "react";
// actions
import { registrarLlamada } from "../actions/registrarLlamada.action";
import type { CitaFila } from "../actions/getCitasPendientes.action";
// components
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
// types
import { RESPUESTAS_LLAMADA, RESPUESTA_LLAMADA } from "../types/comunicador";
import { toast } from "sonner";

export function RegistrarLlamadaModal({ cita, telefonos, correo, onCerrar, onRegistrado }: {
    cita: CitaFila;
    telefonos: string;
    correo: string;
    onCerrar: () => void;
    onRegistrado: (mensaje: string) => void;
}) {
    const [respuesta, setRespuesta] = useState<string>(RESPUESTA_LLAMADA.NO_CONTESTA);
    const [observacion, setObservacion] = useState("");
    const [horaAgendada, setHoraAgendada] = useState("");
    const [enviando, setEnviando] = useState(false);

    const requiereHora = respuesta === RESPUESTA_LLAMADA.ACEPTADA;

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setEnviando(true);
        try {
            const r = await registrarLlamada({
                cita_id: cita.id_cita,
                respuesta,
                observacion,
                hora_agendada: requiereHora ? horaAgendada : ""
            });
            onRegistrado(r.solicitudRealizada ? `Cita ${r.estadoCita}. Solicitud cerrada (Realizado).` : `Cita ${r.estadoCita}.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al registrar la llamada");
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-5">
                <div>
                    <h2 className="text-lg font-semibold">Registrar llamada</h2>
                    <p className="text-sm text-muted-foreground">Cita {cita.id_cita} · {cita.nombre_usuario}</p>
                    <p className="mt-1 text-sm">Teléfonos: {telefonos}</p>
                    <p className="text-sm">Correo: {correo}</p>
                </div>
                <form className="space-y-4" onSubmit={onSubmit}>
                    <div className="space-y-2">
                        <Label>Respuesta</Label>
                        <Select value={respuesta} onChange={(e) => setRespuesta(e.target.value)} required>
                            {RESPUESTAS_LLAMADA.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </Select>
                    </div>
                    {requiereHora && (
                        <div className="space-y-2">
                            <Label>Hora agendada</Label>
                            <Input type="datetime-local" value={horaAgendada} onChange={(e) => setHoraAgendada(e.target.value)} required />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Observación</Label>
                        <Textarea maxLength={350} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onCerrar}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={enviando}>
                            {enviando ? "Registrando..." : "Registrar"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
