export type ClienteIntegracion = "GI" | "GAS" | "SAPU" | "CONTRARREFERENCIA";

export type CodigoErrorIntegracion = "DUPLICADO" | "CATALOGO" | "INTERNO";

export type ResultadoIntegracion =
    | { ok: true; data: { id_solicitud: string } }
    | { ok: false; codigo: CodigoErrorIntegracion; error: string };

export type EstadoFilaIntegracion = "creada" | "duplicada" | "rechazada";

export interface ResultadoFilaIntegracion {
    indice: number;
    id_solicitud: string | null;
    estado: EstadoFilaIntegracion;
    error?: string;
}

export interface ResultadoCargaIntegracion {
    resultados: ResultadoFilaIntegracion[];
    totales: { creadas: number; duplicadas: number; rechazadas: number };
}
