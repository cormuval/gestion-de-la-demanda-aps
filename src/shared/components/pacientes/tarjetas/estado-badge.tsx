// components
import { Badge } from "@/shared/components/ui/badge";
// types
import type { TonoSemaforo } from "@/shared/lib/semaforoEstado";

const colores: Record<TonoSemaforo, string> = {
    amarillo: "bg-secondary text-secondary-foreground",
    verde: "bg-accent text-accent-foreground",
    rojo: "bg-destructive text-destructive-foreground",
    gris: "bg-muted text-muted-foreground"
};
export function EstadoBadge({ rotulo, estado, tono, suave = false }: { rotulo: string; estado: string | null; tono: TonoSemaforo; suave?: boolean }) {
    return <Badge data-tono={tono} className={`${colores[tono]} ${suave ? "opacity-75" : ""}`}>{rotulo}: {estado ?? "Sin estado"}</Badge>;
}
