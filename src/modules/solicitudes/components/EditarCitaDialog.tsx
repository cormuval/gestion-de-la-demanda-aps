"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
// actions
import { editarCita } from "../actions/editarCita.action";
// schemas
import { PRIORIDADES_CLINICAS } from "../schemas/revision.schema";
// components
import { Button } from "@/shared/components/ui/button";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
// types
import type { CitaCascadaConEdicion } from "../types/pendientes";

type PrioridadClinica = (typeof PRIORIDADES_CLINICAS)[number];

function toDateInput(value: Date | string | null): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function dateInputFromTodayPlusYears(years: number): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setFullYear(date.getFullYear() + years);
    return toDateInput(date);
}

function isPrioridadClinica(value: string): value is PrioridadClinica {
    return (PRIORIDADES_CLINICAS as readonly string[]).includes(value);
}

export function EditarCitaDialog({
    cita,
    open,
    onOpenChange,
    onActualizada
}: {
    cita: CitaCascadaConEdicion;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onActualizada: () => Promise<void> | void;
}) {
    const [priorizacionClinica, setPriorizacionClinica] = useState(cita.priorizacion_clinica ?? "");
    const [fechaEstimada, setFechaEstimada] = useState(toDateInput(cita.fecha_estimada_atencion));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setPriorizacionClinica(cita.priorizacion_clinica ?? "");
        setFechaEstimada(toDateInput(cita.fecha_estimada_atencion));
    }, [cita]);

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        if (!isPrioridadClinica(priorizacionClinica)) {
            toast.error("Selecciona priorizacion clinica");
            return;
        }

        setSaving(true);
        try {
            const result = await editarCita({
                id_cita: cita.id_cita,
                priorizacion_clinica: priorizacionClinica,
                fecha_estimada_atencion: fechaEstimada
            });
            if (!result.ok) {
                toast.error(result.error);
                await onActualizada();
                return;
            }

            toast.success("Cita actualizada");
            onOpenChange(false);
            await onActualizada();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al editar cita");
        } finally {
            setSaving(false);
        }
    }

    const detalle = [cita.profesional?.nombre, cita.prestacion?.nombre_prestacion].filter(Boolean).join(" · ") || "Sin detalle";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar cita <CodigoId id={cita.id_cita} /></DialogTitle>
                    <DialogDescription>{detalle}</DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="editar-cita-priorizacion">Priorizacion clinica</Label>
                        <Select
                            id="editar-cita-priorizacion"
                            aria-label="Priorizacion clinica"
                            value={priorizacionClinica}
                            onChange={(event) => setPriorizacionClinica(event.target.value)}
                            required
                        >
                            <option value="">Seleccionar</option>
                            {PRIORIDADES_CLINICAS.map((prioridad) => (
                                <option key={prioridad} value={prioridad}>
                                    {prioridad}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="editar-cita-fecha">Fecha estimada</Label>
                        <Input
                            id="editar-cita-fecha"
                            aria-label="Fecha estimada"
                            type="date"
                            min={dateInputFromTodayPlusYears(0)}
                            max={dateInputFromTodayPlusYears(2)}
                            value={fechaEstimada}
                            onChange={(event) => setFechaEstimada(event.target.value)}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>
                            <Save data-icon="inline-start" />
                            {saving ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
