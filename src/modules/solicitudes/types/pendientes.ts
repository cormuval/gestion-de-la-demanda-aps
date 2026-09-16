export interface SolicitudCascada {
    id_solicitud: string;
    fecha_inicio: Date | string;
    descripcion: string | null;
    estado_solicitud: string;
    accion: string | null;
    tipoSolicitud: { nombre_tipo_solicitud: string } | null;
    motivo: { nombre_motivo: string } | null;
}

export interface CitaCascada {
    id_cita: string;
    solicitud_id: string | null;
    estado_cita: string | null;
    observacion: string | null;
    priorizacion_clinica: string | null;
    fecha_estimada_atencion: Date | string | null;
    profesional: { nombre: string } | null;
    prestacion: { nombre_prestacion: string } | null;
}

export interface CitaCascadaConEdicion extends CitaCascada {
    editable: boolean;
}
