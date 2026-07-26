/**
 * Acorta un ID largo (prefijo + UUID) a "prefijo-ultimos5" para mostrar en el
 * front. El ID completo NO cambia en la BD; esta es solo la representacion
 * visible. Es la unica fuente de verdad del formato corto.
 *
 * Ej: "SOL-550e8400-e29b-41d4-a716-446655440000" -> "SOL-40000".
 * Si el id no tiene prefijo, o ya es corto, se devuelve tal cual.
 */
export function acortarId(id: string): string {
    const guion = id.indexOf("-");
    if (guion === -1) return id; // sin prefijo -> tal cual
    const prefijo = id.slice(0, guion);
    if (id.length <= prefijo.length + 6) return id; // ya es corto -> nada que acortar
    return `${prefijo}-${id.slice(-5)}`;
}
