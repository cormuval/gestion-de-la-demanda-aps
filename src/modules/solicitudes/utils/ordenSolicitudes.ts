// lib
import { ordenarPagina } from "@/shared/lib/ordenPagina";
// types
import type { OrdenPagina } from "@/shared/lib/ordenPagina";

export type ColumnaSolicitud = "fecha" | "tipo";

export interface SolicitudOrdenable {
    fecha_inicio: Date | string;
    tipoSolicitud: { nombre_tipo_solicitud: string } | null;
}

export function ordenarSolicitudes<T extends SolicitudOrdenable>(filas: readonly T[], orden: OrdenPagina<ColumnaSolicitud> | null): T[] {
    if (!orden) return [...filas];
    if (orden.columna === "tipo") {
        return ordenarPagina(filas, (fila) => fila.tipoSolicitud?.nombre_tipo_solicitud ?? null, orden.direccion);
    }
    return ordenarPagina(filas, (fila) => {
        const instante = new Date(fila.fecha_inicio).getTime();
        return Number.isNaN(instante) ? null : instante;
    }, orden.direccion);
}
