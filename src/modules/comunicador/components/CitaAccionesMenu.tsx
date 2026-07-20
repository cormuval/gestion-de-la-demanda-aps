"use client";

import { CalendarClock, History, MoreVertical, Pencil } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import type { CitaFila } from "../actions/getCitasPendientes.action";

export function CitaAccionesMenu({ cita, onVerHistorial, onVerOtrasCitas, onEditarPaciente }: {
    cita: CitaFila;
    onVerHistorial: (cita: CitaFila) => void;
    onVerOtrasCitas: (cita: CitaFila) => void;
    onEditarPaciente: (cita: CitaFila) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                    <MoreVertical size={16} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onVerHistorial(cita)}>
                    <History size={14} />
                    Ver historial de llamadas
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onVerOtrasCitas(cita)}>
                    <CalendarClock size={14} />
                    Otras citas del paciente
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEditarPaciente(cita)}>
                    <Pencil size={14} />
                    Editar paciente
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
