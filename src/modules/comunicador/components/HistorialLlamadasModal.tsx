"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
// actions
import { getHistorialLlamadas, type HistorialLlamada } from "../actions/getHistorialLlamadas.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

function formatFechaHora(value: Date | null): string {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function HistorialLlamadasModal({ citaId, onCerrar }: { citaId: string; onCerrar: () => void }) {
    const [llamadas, setLlamadas] = useState<HistorialLlamada[]>([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        getHistorialLlamadas(citaId)
            .then(setLlamadas)
            .catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar el historial"))
            .finally(() => setCargando(false));
    }, [citaId]);

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">Historial de llamadas</h2>
                        <p className="text-sm text-muted-foreground">Cita {citaId}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <div className="mt-4 space-y-3">
                    {cargando ? (
                        <p className="text-sm text-muted-foreground">Cargando historial...</p>
                    ) : llamadas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin llamadas registradas.</p>
                    ) : (
                        llamadas.map((l) => (
                            <div key={l.id_llamada} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{formatFechaHora(l.fecha_llamada)}</span>
                                    <Badge variant="muted">{l.respuesta_usuario ?? "Sin respuesta"}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">Comunicador: {l.comunicador ?? "—"}</p>
                                {l.observacion && <p className="mt-1 text-muted-foreground">Obs: {l.observacion}</p>}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
