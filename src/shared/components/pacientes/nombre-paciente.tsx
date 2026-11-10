// lib
import { cn } from "@/shared/lib/utils";
// types
import type { JSX } from "react";

export interface NombrePacienteProps {
    nombreLegal: string | null;
    nombreSocial?: string | null;
    className?: string;
}

export function NombrePaciente({ nombreLegal, nombreSocial, className }: NombrePacienteProps): JSX.Element {
    const social = nombreSocial?.trim();

    return (
        <span className={cn("block min-w-0 break-words", className)}>
            <span className="block">{nombreLegal ?? "—"}</span>
            {social ? <span className="block break-words text-sm font-normal text-muted-foreground">Nombre social: {social}</span> : null}
        </span>
    );
}
