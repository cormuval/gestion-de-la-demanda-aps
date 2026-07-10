"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
// actions
import { getCitasPendientesPaciente, CitaPacienteFila } from "../actions/getCitasPendientesPaciente.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

export function MultiCitaPanel({ rutUsuario, citaActualId, onGestionar }: { rutUsuario: string; citaActualId: string; onGestionar: (citaId: string) => void }) {
    const [citas, setCitas] = useState<CitaPacienteFila[]>([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        getCitasPendientesPaciente(rutUsuario, citaActualId)
            .then(setCitas)
            .catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar otras citas"))
            .finally(() => setCargando(false));
    }, [rutUsuario, citaActualId]);

    if (cargando) return <p className="text-sm text-muted-foreground">Cargando otras citas...</p>;
    if (citas.length === 0) return <p className="text-sm text-muted-foreground">El paciente no tiene otras citas pendientes.</p>;

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">Otras citas pendientes del paciente</p>
            {citas.map((c) => (
                <div key={c.id_cita} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                        <p className="font-medium">{c.profesion || "—"} · {c.prestacion || "—"}</p>
                        <p className="text-muted-foreground">
                            <Badge variant="warning">{c.estado_cita}</Badge> · Prioridad {c.priorizacion ?? "—"}
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onGestionar(c.id_cita)}>
                        Gestionar
                    </Button>
                </div>
            ))}
        </div>
    );
}
