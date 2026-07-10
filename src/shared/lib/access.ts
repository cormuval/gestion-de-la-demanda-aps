export const ROLES_SOLICITUDES = ["Administrador", "Orientador", "SOME", "Orientador y Comunicador", "Full"] as const;

export const ESTADOS_ACTIVOS = ["Activo", "1"] as const;

export function puedeAccederSolicitudes(rol: string): boolean {
    return (ROLES_SOLICITUDES as readonly string[]).includes(rol);
}

export function esEstadoActivo(estado: string | null | undefined): boolean {
    if (!estado) return false;
    return (ESTADOS_ACTIVOS as readonly string[]).includes(estado.trim());
}

export const ROLES_COMUNICADOR = ["Administrador", "Comunicador", "SOME", "Orientador y Comunicador", "Gestor y Comunicador", "Full"] as const;

export function puedeAccederComunicador(rol: string): boolean {
    return (ROLES_COMUNICADOR as readonly string[]).includes(rol);
}
