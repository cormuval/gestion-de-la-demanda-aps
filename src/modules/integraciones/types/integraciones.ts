export type ClienteIntegracion = "GI" | "GAS";

export type CodigoErrorIntegracion = "DUPLICADO" | "CATALOGO" | "INTERNO";

export type ResultadoIntegracion =
    | { ok: true; data: { id_solicitud: string } }
    | { ok: false; codigo: CodigoErrorIntegracion; error: string };
