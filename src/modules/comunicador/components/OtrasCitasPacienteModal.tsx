"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
// actions
import { getCitasPendientesPaciente, type CitaPacienteFila } from "../actions/getCitasPendientesPaciente.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
// lib
import { acortarId } from "@/shared/lib/acortarId";

function formatFecha(value: Date | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("es-CL");
}

export function OtrasCitasPacienteModal({ rutUsuario, citaActualId, onCerrar }: {
    rutUsuario: string;
    citaActualId: string;
    onCerrar: () => void;
}) {
    const [citas, setCitas] = useState<CitaPacienteFila[] | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let activo = true;
        setCargando(true);
        setCitas(null);

        async function cargarCitas() {
            try {
                const resultado = await getCitasPendientesPaciente(rutUsuario, citaActualId);
                if (!activo) return;
                if (!resultado.ok) {
                    toast.error(resultado.error);
                    return;
                }
                setCitas(resultado.data);
            } catch {
                if (activo) toast.error("Error al cargar otras citas");
            } finally {
                if (activo) setCargando(false);
            }
        }

        cargarCitas();
        return () => {
            activo = false;
        };
    }, [rutUsuario, citaActualId]);

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">Otras citas del paciente</h2>
                        <p className="text-sm text-muted-foreground">Citas pendientes · RUT {rutUsuario}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <div className="mt-4 space-y-3">
                    {cargando ? (
                        <p className="text-sm text-muted-foreground">Cargando otras citas...</p>
                    ) : citas?.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin otras citas próximas.</p>
                    ) : citas ? (
                        citas.map((c) => (
                            <div key={c.id_cita} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{c.profesion || "—"} · {c.prestacion || "—"}</span>
                                    <div className="flex shrink-0 gap-2">
                                        {c.atrasada && <Badge variant="muted">Atrasada</Badge>}
                                        <Badge variant="warning">{c.estado_cita ?? "Sin estado"}</Badge>
                                    </div>
                                </div>
                                <p className="mt-1 text-muted-foreground">
                                    Fecha estimada: {formatFecha(c.fecha_estimada_atencion)} · Cita {acortarId(c.id_cita)}
                                </p>
                            </div>
                        ))
                    ) : null}
                </div>
            </div>
        </div>
    );
}
