// types
import type { TipoSolicitudPublico } from "../types/solicitudWeb";

// El formulario web no ofrece estos tipos. El ingreso interno no cambia.
export const TIPOS_EXCLUIDOS_WEB: ReadonlySet<number> = new Set([7, 8]);

// Etiquetas propias del formulario web. La base y el ingreso interno no cambian.
export const ETIQUETAS_TIPOS_WEB: Readonly<Record<number, string>> = {
    14: "Control de ciclo vital (5 a 19 años)"
};

export function aplicarCatalogoWeb(tipos: TipoSolicitudPublico[]): TipoSolicitudPublico[] {
    return tipos
        .filter((tipo) => !TIPOS_EXCLUIDOS_WEB.has(tipo.id))
        .map((tipo) => ({ ...tipo, nombre: ETIQUETAS_TIPOS_WEB[tipo.id] ?? tipo.nombre }));
}
