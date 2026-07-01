export interface Catalogos {
    tiposSolicitud: TipoSolicitudCatalogo[];
    motivos: MotivoCatalogo[];
}

export interface TipoSolicitudCatalogo {
    id_tipo_solicitud: number;
    nombre_tipo_solicitud: string;
}

export interface MotivoCatalogo {
    id_motivo: number;
    tipo_solicitud_id: number;
    nombre_motivo: string;
}
