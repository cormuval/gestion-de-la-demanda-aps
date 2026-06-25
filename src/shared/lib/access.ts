export const ROLES_SOLICITUDES = ["Administrador", "Orientador", "SOME", "Orientador y Comunicador", "Full"] as const;

export function puedeAccederSolicitudes(rol: string): boolean {
    return (ROLES_SOLICITUDES as readonly string[]).includes(rol);
}
