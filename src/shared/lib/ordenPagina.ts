export type DireccionOrden = "asc" | "desc";

export interface OrdenPagina<K extends string> {
    columna: K;
    direccion: DireccionOrden;
}

export function siguienteOrden<K extends string>(actual: OrdenPagina<K> | null, columna: K): OrdenPagina<K> | null {
    if (actual?.columna !== columna) return { columna, direccion: "asc" };
    return actual.direccion === "asc" ? { columna, direccion: "desc" } : null;
}

const comparadorTexto = new Intl.Collator("es");

// Cada columna selecciona valores homogéneos: números (p. ej. instantes) o texto.
export function ordenarPagina<T>(filas: readonly T[], valor: (fila: T) => string | number | null, direccion: DireccionOrden): T[] {
    const factor = direccion === "asc" ? 1 : -1;
    return filas.map((fila, indice) => ({ fila, indice, valor: valor(fila) }))
        .sort((a, b) => {
            if (a.valor === null && b.valor === null) return a.indice - b.indice;
            if (a.valor === null) return 1;
            if (b.valor === null) return -1;

            let comparacion = 0;
            if (typeof a.valor === "number" && typeof b.valor === "number") {
                comparacion = a.valor - b.valor;
            } else if (typeof a.valor === "string" && typeof b.valor === "string") {
                comparacion = comparadorTexto.compare(a.valor, b.valor);
            }
            return comparacion * factor || a.indice - b.indice;
        })
        .map(({ fila }) => fila);
}
