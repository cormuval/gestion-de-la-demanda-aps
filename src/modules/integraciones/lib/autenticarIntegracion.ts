import { timingSafeEqual } from "node:crypto";

// types
import type { ClienteIntegracion } from "../types/integraciones";

const VARIABLE_POR_CLIENTE: Record<ClienteIntegracion, string> = {
    GI: "INTEGRACION_KEY_GI",
    GAS: "INTEGRACION_KEY_GAS"
};

// Valida el header `api-key` contra la key del cliente. Variable ausente o vacia = rechazo.
export function autenticarIntegracion(request: Request, cliente: ClienteIntegracion): boolean {
    const esperada = process.env[VARIABLE_POR_CLIENTE[cliente]];
    if (!esperada) return false;
    const recibida = request.headers.get("api-key");
    if (!recibida) return false;
    const a = Buffer.from(recibida);
    const b = Buffer.from(esperada);
    return a.length === b.length && timingSafeEqual(a, b);
}
