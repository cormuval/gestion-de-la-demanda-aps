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
            {/* Estilo neutro local: sobrescribe el hover verde del variante ghost (bg-accent) y el
                anillo del tema, sin tocar Button global; el foco de teclado sigue visible con un
                anillo neutro de contraste suficiente (foreground). */}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-3 hover:bg-muted hover:text-foreground active:bg-muted/60 focus-visible:ring-foreground"
                onClick={() => onOrden(siguienteOrden(orden, columna))}
            >
                {children}
                <Icono aria-hidden="true" data-icon="inline-end" />
            </Button>
        </TableHead>
    );
}
