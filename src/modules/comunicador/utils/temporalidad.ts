// types
import { TEMPORALIDAD } from "../types/comunicador";

export interface RangoFechas {
    gte?: Date;
    lte?: Date;
    lt?: Date;
}

export function addDays(fecha: Date, dias: number): Date {
    const resultado = new Date(fecha);
    resultado.setDate(resultado.getDate() + dias);
    return resultado;
}

/**
 * Traduce la opción de temporalidad a un rango sobre `fecha_estimada_atencion`.
 * Devuelve null para "Todas" (sin filtro de fecha).
 * Particiones contiguas: atrasados < hoy-15 <= proximos <= hoy+30 < futuros >= hoy+31.
 */
export function rangoTemporalidad(opcion: string, hoy: Date): RangoFechas | null {
    switch (opcion) {
        case TEMPORALIDAD.PROXIMOS:
            return { gte: addDays(hoy, -15), lte: addDays(hoy, 30) };
        case TEMPORALIDAD.FUTUROS:
            return { gte: addDays(hoy, 31) };
        case TEMPORALIDAD.ATRASADOS:
            return { lt: addDays(hoy, -15) };
        case TEMPORALIDAD.TODAS:
        default:
            return null;
    }
}
