export const CENTRO_TIPO_SOLICITUD_COLUMNAS = [
    "esperanza",
    "placeres",
    "padre_damian",
    "baron",
    "rodelillo",
    "reina_isabel",
    "placilla",
    "las_canas",
    "mena",
    "cordillera",
    "quebrada_verde",
    "cecosf_porvenir_bajo",
    "puertas_negras",
    "cecosf_laguna_verde",
    "cecosf_juan_pablo_ii",
    "desarrollo"
] as const;

export type CentroTipoSolicitudColumna = (typeof CENTRO_TIPO_SOLICITUD_COLUMNAS)[number];

function normalizarTexto(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

export function getColumnaTipoSolicitudPorCentro(nombreCentro: string | null | undefined): CentroTipoSolicitudColumna | null {
    if (!nombreCentro) return null;
    const normalized = normalizarTexto(nombreCentro);

    if (normalized.includes("esperanza")) return "esperanza";
    if (normalized.includes("placeres")) return "placeres";
    if (normalized.includes("padre damian")) return "padre_damian";
    if (normalized.includes("baron")) return "baron";
    if (normalized.includes("rodelillo")) return "rodelillo";
    if (normalized.includes("reina isabel")) return "reina_isabel";
    if (normalized.includes("placilla")) return "placilla";
    if (normalized.includes("las canas")) return "las_canas";
    if (normalized.includes("mena")) return "mena";
    if (normalized.includes("cordillera")) return "cordillera";
    if (normalized.includes("quebrada verde")) return "quebrada_verde";
    if (normalized.includes("porvenir bajo")) return "cecosf_porvenir_bajo";
    if (normalized.includes("puertas negras")) return "puertas_negras";
    if (normalized.includes("laguna verde")) return "cecosf_laguna_verde";
    if (normalized.includes("juan pablo ii")) return "cecosf_juan_pablo_ii";
    if (normalized.includes("desarrollo")) return "desarrollo";

    return null;
}
