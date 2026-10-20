/**
 * Deduplica el registro de auditoria de busquedas idénticas repetidas (p. ej. por el
 * refresco automatico). Memoria del proceso (un solo proceso pm2); un reinicio solo
 * provoca una fila extra.
 */

export const VENTANA_DEDUP_BUSQUEDA_MS = 5 * 60_000;

const ultimoRegistroPorClave = new Map<string, number>();

function podarVencidas(ahora: number): void {
    for (const [clave, momento] of ultimoRegistroPorClave) {
        if (ahora - momento >= VENTANA_DEDUP_BUSQUEDA_MS) ultimoRegistroPorClave.delete(clave);
    }
}

export function debeRegistrarBusqueda(clave: string, ahora: number = Date.now()): boolean {
    podarVencidas(ahora);

    const ultimoRegistro = ultimoRegistroPorClave.get(clave);
    if (ultimoRegistro !== undefined && ahora - ultimoRegistro < VENTANA_DEDUP_BUSQUEDA_MS) return false;

    ultimoRegistroPorClave.set(clave, ahora);
    return true;
}

export function limpiarDedupBusquedas(): void {
    ultimoRegistroPorClave.clear();
}
