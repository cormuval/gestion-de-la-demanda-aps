// components
import { Badge } from "@/shared/components/ui/badge";
// types
import type { TonoSemaforo } from "@/shared/lib/semaforoEstado";

const colores: Record<TonoSemaforo, string> = {
    amarillo: "bg-secondary text-secondary-foreground",
    verde: "bg-accent text-foreground",
    rojo: "bg-destructive text-destructive-foreground",
    gris: "bg-muted text-muted-foreground"
};

const coloresSuaves: Record<TonoSemaforo, string> = {
    amarillo: "bg-secondary/25 text-foreground",
    verde: "bg-accent/25 text-foreground",
    rojo: "bg-destructive/25 text-foreground",
    gris: "bg-muted/25 text-foreground"
};

export function EstadoBadge({ rotulo, estado, tono, suave = false }: {
    rotulo: string;
    estado: string | null;
    tono: TonoSemaforo;
    suave?: boolean;
}) {
    return (
        <Badge data-tono={tono} className={suave ? coloresSuaves[tono] : colores[tono]}>
            <span>
                <span className="font-semibold">{rotulo}:</span>{" "}
                <span className="font-normal">{estado ?? "Sin estado"}</span>
            </span>
        </Badge>
    );
}
