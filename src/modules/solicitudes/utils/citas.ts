// schemas
import { PRIORIZACION_CLINICA_NUMERICA, type PRIORIDADES_CLINICAS } from "../schemas/revision.schema";
// types
import { ESTADO_CITA } from "@/modules/comunicador/types/comunicador";

export type PrioridadClinica = (typeof PRIORIDADES_CLINICAS)[number];

export function esCitaEditable(cita: { estado_cita: string | null; cantidadLlamadas: number }): boolean {
    return cita.estado_cita === ESTADO_CITA.SIN_LLAMADAS && cita.cantidadLlamadas === 0;
}

export function evaluarFechaEstimada(value: string): { ok: true; fecha: Date } | { ok: false; error: string } {
    const fecha = new Date(`${value}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return { ok: false, error: "Fecha estimada invalida" };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const maxima = new Date(hoy);
    maxima.setFullYear(maxima.getFullYear() + 2);

    if (fecha < hoy) return { ok: false, error: "La fecha estimada no puede ser anterior a hoy" };
    if (fecha > maxima) return { ok: false, error: "La fecha estimada no puede superar los 2 años" };
    return { ok: true, fecha };
}

export function calcularPriorizacionCita(priorizacionClinica: PrioridadClinica, priorizacionAdministrativa: number | null | undefined): number {
    return Math.min(100, PRIORIZACION_CLINICA_NUMERICA[priorizacionClinica] + (priorizacionAdministrativa ?? 0));
}
