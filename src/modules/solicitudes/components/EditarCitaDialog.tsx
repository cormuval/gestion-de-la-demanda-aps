"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
// actions
import { editarCita } from "../actions/editarCita.action";
// schemas
import { PRIORIDADES_CLINICAS, type EditarCitaInput } from "../schemas/revision.schema";
// components
import { Button } from "@/shared/components/ui/button";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
// types
import type { CitaCascadaConEdicion } from "../types/pendientes";

type PrioridadClinica = (typeof PRIORIDADES_CLINICAS)[number];

interface EditarCitaDialogBaseProps {
    cita: CitaCascadaConEdicion;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onActualizada: () => Promise<void> | void;
    titulo: string;
    children: ReactNode;
    crearInput: () => EditarCitaInput | null;
}

export interface EditarPrioridadCitaDialogProps {
    cita: CitaCascadaConEdicion;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onActualizada: () => Promise<void> | void;
}

export interface EditarFechaEstimadaCitaDialogProps {
    cita: CitaCascadaConEdicion;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onActualizada: () => Promise<void> | void;
}

function toDateInput(value: Date | string | null): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function isPrioridadClinica(value: string): value is PrioridadClinica {
    return (PRIORIDADES_CLINICAS as readonly string[]).includes(value);
}

function dateInputFromTodayPlusYears(years: number): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setFullYear(date.getFullYear() + years);
    return toDateInput(date);
}

function EditarCitaDialogBase({
    cita,
    open,
    onOpenChange,
    onActualizada,
    titulo,
    children,
    crearInput
}: EditarCitaDialogBaseProps) {
    const [saving, setSaving] = useState(false);

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        const input = crearInput();
        if (!input) return;

        setSaving(true);
        try {
            const result = await editarCita(input);
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
                    <DialogTitle>{titulo} <CodigoId id={cita.id_cita} /></DialogTitle>
                    <DialogDescription>{detalle}</DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <FieldGroup>{children}</FieldGroup>
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

export function EditarPrioridadCitaDialog({
    cita,
    open,
    onOpenChange,
    onActualizada
}: EditarPrioridadCitaDialogProps) {
    const [priorizacionClinica, setPriorizacionClinica] = useState(cita.priorizacion_clinica ?? "");

    useEffect(() => {
        setPriorizacionClinica(cita.priorizacion_clinica ?? "");
    }, [cita]);

    function crearInput(): EditarCitaInput | null {
        if (!isPrioridadClinica(priorizacionClinica)) {
            toast.error("Selecciona prioridad clinica");
            return null;
        }

        return {
            id_cita: cita.id_cita,
            priorizacion_clinica: priorizacionClinica,
            fecha_estimada_atencion: toDateInput(cita.fecha_estimada_atencion)
        };
    }

    return (
        <EditarCitaDialogBase
            cita={cita}
            open={open}
            onOpenChange={onOpenChange}
            onActualizada={onActualizada}
            titulo="Editar prioridad"
            crearInput={crearInput}
        >
            <Field>
                <FieldLabel htmlFor="editar-prioridad-cita">Prioridad clinica</FieldLabel>
                <Select
                    id="editar-prioridad-cita"
                    aria-label="Prioridad clinica"
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
            </Field>
        </EditarCitaDialogBase>
    );
}

export function EditarFechaEstimadaCitaDialog({
    cita,
    open,
    onOpenChange,
    onActualizada
}: EditarFechaEstimadaCitaDialogProps) {
    const [fechaEstimada, setFechaEstimada] = useState(toDateInput(cita.fecha_estimada_atencion));

    useEffect(() => {
        setFechaEstimada(toDateInput(cita.fecha_estimada_atencion));
    }, [cita]);

    function crearInput(): EditarCitaInput | null {
        const prioridadVigente = cita.priorizacion_clinica ?? "";
        if (!isPrioridadClinica(prioridadVigente)) {
            toast.error("La prioridad clinica vigente no es valida");
            return null;
        }

        return {
            id_cita: cita.id_cita,
            priorizacion_clinica: prioridadVigente,
            fecha_estimada_atencion: fechaEstimada
        };
    }

    return (
        <EditarCitaDialogBase
            cita={cita}
            open={open}
            onOpenChange={onOpenChange}
            onActualizada={onActualizada}
            titulo="Editar fecha estimada"
            crearInput={crearInput}
        >
            <Field>
                <FieldLabel htmlFor="editar-fecha-estimada-cita">Fecha estimada</FieldLabel>
                <Input
                    id="editar-fecha-estimada-cita"
                    aria-label="Fecha estimada"
                    type="date"
                    min={dateInputFromTodayPlusYears(0)}
                    max={dateInputFromTodayPlusYears(2)}
                    value={fechaEstimada}
                    onChange={(event) => setFechaEstimada(event.target.value)}
                    required
                />
            </Field>
        </EditarCitaDialogBase>
    );
}
