// lib
import { ordenarPagina } from "@/shared/lib/ordenPagina";
// types
import type { CitaFila } from "../actions/getCitasPendientes.action";
import type { OrdenPagina } from "@/shared/lib/ordenPagina";

export type ColumnaCita = "fecha" | "estado";

export function ordenarCitas(filas: readonly CitaFila[], orden: OrdenPagina<ColumnaCita> | null): CitaFila[] {
    if (!orden) return [...filas];
    if (orden.columna === "estado") {
        return ordenarPagina(filas, (fila) => fila.estado_cita, orden.direccion);
    }
    return ordenarPagina(filas, (fila) => {
        if (!fila.fecha_estimada_atencion) return null;
        const instante = new Date(fila.fecha_estimada_atencion).getTime();
        return Number.isNaN(instante) ? null : instante;
    }, orden.direccion);
}
