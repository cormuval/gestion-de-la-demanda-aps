export type ClienteIntegracion = "GI" | "GAS" | "SAPU" | "CONTRARREFERENCIA";

export type CodigoErrorIntegracion = "DUPLICADO" | "CATALOGO" | "INTERNO";

export type ResultadoIntegracion =
    | { ok: true; data: { id_solicitud: string } }
    | { ok: false; codigo: CodigoErrorIntegracion; error: string };
