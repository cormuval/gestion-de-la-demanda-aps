"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Filter, X } from "lucide-react";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/components/ui/sheet";

interface PanelFiltrosProps {
    descripcion: string;
    activos: number;
    onAplicar: () => void;
    onLimpiar: () => void;
    aplicando?: boolean;
    // Contenido opcional sobre los campos (p. ej. un error de catalogos).
    aviso?: ReactNode;
    children: ReactNode;
}

// Filtros en un panel lateral derecho: la tabla conserva el foco y el boton muestra cuantos hay activos.
export function PanelFiltros({ descripcion, activos, onAplicar, onLimpiar, aplicando = false, aviso, children }: PanelFiltrosProps) {
    const [abierto, setAbierto] = useState(false);

    function aplicar(event: FormEvent) {
        event.preventDefault();
        onAplicar();
        setAbierto(false);
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {activos > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={onLimpiar}>
                    <X size={16} />
                    Limpiar filtros
                </Button>
            )}
            <Sheet open={abierto} onOpenChange={setAbierto}>
                <SheetTrigger asChild>
                    <Button type="button" variant="outline" size="sm" aria-label={activos > 0 ? `Filtros (${activos} activos)` : "Filtros"}>
                        <Filter size={16} />
                        Filtros
                        {activos > 0 && <Badge>{activos}</Badge>}
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Filtros</SheetTitle>
                        <SheetDescription>{descripcion}</SheetDescription>
                    </SheetHeader>
                    <form className="mt-6 flex flex-1 flex-col gap-4" onSubmit={aplicar}>
                        {aviso}
                        {children}
                        <SheetFooter className="mt-auto pt-4">
                            <Button type="submit" disabled={aplicando}>
                                <Filter size={16} />
                                {aplicando ? "Consultando..." : "Aplicar filtros"}
                            </Button>
                        </SheetFooter>
                    </form>
                </SheetContent>
            </Sheet>
        </div>
    );
}

// Cuenta los campos con valor; `ignorar` excluye claves que no son filtros (p. ej. la pagina).
export function contarFiltrosActivos<T extends object>(valores: T, ignorar: (keyof T)[] = [], base?: Partial<T>): number {
    return (Object.keys(valores) as (keyof T)[]).filter((clave) => {
        if (ignorar.includes(clave)) return false;
        const valor = valores[clave];
        if (base && base[clave] === valor) return false;
        return valor !== "" && valor !== null && valor !== undefined;
    }).length;
}
