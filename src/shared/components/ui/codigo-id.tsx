"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
// lib
import { cn } from "@/shared/lib/utils";
import { acortarId } from "@/shared/lib/acortarId";

/**
 * Muestra un ID acortado (prefijo + ultimos 5) y permite copiar el ID completo
 * con un click. El id completo tambien queda en el atributo title (tooltip).
 * Usar donde el ID es un elemento clickeable independiente (celdas, filas,
 * lineas de detalle). Para IDs incrustados en texto usar acortarId() directo.
 */
export function CodigoId({ id, className }: { id: string; className?: string }) {
    async function copiar() {
        try {
            await navigator.clipboard.writeText(id);
            toast.success("Codigo copiado");
        } catch {
            toast.error("No se pudo copiar el codigo");
        }
    }

    return (
        <button
            type="button"
            onClick={copiar}
            title={id}
            aria-label="Copiar codigo completo"
            className={cn(
                "group inline-flex items-center gap-1 font-medium hover:text-primary",
                className
            )}
        >
            {acortarId(id)}
            <Copy size={12} className="opacity-0 transition-opacity group-hover:opacity-70" />
        </button>
    );
}
