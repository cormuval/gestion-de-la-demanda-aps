"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { TableHead } from "@/shared/components/ui/table";
// lib
import { siguienteOrden } from "@/shared/lib/ordenPagina";
// types
import type { OrdenPagina } from "@/shared/lib/ordenPagina";

interface EncabezadoOrdenableProps<K extends string> {
    columna: K;
    orden: OrdenPagina<K> | null;
    onOrden: (orden: OrdenPagina<K> | null) => void;
    children: ReactNode;
    className?: string;
}

export function EncabezadoOrdenable<K extends string>({ columna, orden, onOrden, children, className }: EncabezadoOrdenableProps<K>) {
    const direccion = orden?.columna === columna ? orden.direccion : null;
    const Icono = direccion === "asc" ? ArrowUp : direccion === "desc" ? ArrowDown : ArrowUpDown;
    return (
        <TableHead className={className} aria-sort={direccion === "asc" ? "ascending" : direccion === "desc" ? "descending" : "none"}>
            <Button type="button" variant="ghost" size="sm" className="-ml-3" onClick={() => onOrden(siguienteOrden(orden, columna))}>
                {children}
                <Icono aria-hidden="true" data-icon="inline-end" />
            </Button>
        </TableHead>
    );
}
