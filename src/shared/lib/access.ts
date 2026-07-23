export const ESTADOS_ACTIVOS = ["Activo", "1"] as const;

export function esEstadoActivo(estado: string | null | undefined): boolean {
    if (!estado) return false;
    return (ESTADOS_ACTIVOS as readonly string[]).includes(estado.trim());
}
