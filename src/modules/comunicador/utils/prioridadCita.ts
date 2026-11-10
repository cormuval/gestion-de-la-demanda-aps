export type NivelPrioridadCita = "Urgente" | "Alta" | "Media" | "Baja";

export interface ItemSimbologiaPrioridad {
    nivel: NivelPrioridadCita;
    rango: string;
    textoSimbologia: string;
    badgeClassName: string;
    dotClassName: string;
}

export interface PrioridadCitaResuelta {
    nivel: NivelPrioridadCita;
    etiqueta: string;
    badgeClassName: string;
    dotClassName: string;
}

export const SIMBOLOGIA_PRIORIDAD: readonly ItemSimbologiaPrioridad[] = [
    {
        nivel: "Urgente",
        rango: "80–100",
        textoSimbologia: "Urgente (80–100)",
        badgeClassName: "border-red-200 bg-red-100 text-red-800",
        dotClassName: "bg-red-600"
    },
    {
        nivel: "Alta",
        rango: "60–79",
        textoSimbologia: "Alta (60–79)",
        badgeClassName: "border-amber-200 bg-amber-100 text-amber-900",
        dotClassName: "bg-amber-500"
    },
    {
        nivel: "Media",
        rango: "40–59",
        textoSimbologia: "Media (40–59)",
        badgeClassName: "border-sky-200 bg-sky-100 text-sky-800",
        dotClassName: "bg-sky-500"
    },
    {
        nivel: "Baja",
        rango: "< 40",
        textoSimbologia: "Baja (< 40)",
        badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-800",
        dotClassName: "bg-emerald-500"
    }
] as const;

const MAPA_NIVELES: Record<NivelPrioridadCita, ItemSimbologiaPrioridad> = {
    Urgente: SIMBOLOGIA_PRIORIDAD[0],
    Alta: SIMBOLOGIA_PRIORIDAD[1],
    Media: SIMBOLOGIA_PRIORIDAD[2],
    Baja: SIMBOLOGIA_PRIORIDAD[3]
};

function esNivelPrioridadCita(valor: string | null | undefined): valor is NivelPrioridadCita {
    return valor === "Urgente" || valor === "Alta" || valor === "Media" || valor === "Baja";
}

function inferirNivelPorPuntaje(priorizacion: number): NivelPrioridadCita {
    if (priorizacion >= 80) return "Urgente";
    if (priorizacion >= 60) return "Alta";
    if (priorizacion >= 40) return "Media";
    return "Baja";
}

export function resolverPrioridadCita(
    priorizacionClinica: string | null | undefined,
    priorizacion: number | null | undefined
): PrioridadCitaResuelta | null {
    const tienePuntaje = typeof priorizacion === "number" && Number.isFinite(priorizacion);
    const nivel: NivelPrioridadCita | null = esNivelPrioridadCita(priorizacionClinica)
        ? priorizacionClinica
        : tienePuntaje
          ? inferirNivelPorPuntaje(priorizacion)
          : null;

    if (!nivel) return null;

    const config = MAPA_NIVELES[nivel];
    const etiqueta = tienePuntaje ? `${nivel} · ${priorizacion}` : nivel;

    return {
        nivel,
        etiqueta,
        badgeClassName: config.badgeClassName,
        dotClassName: config.dotClassName
    };
}
