export interface LlamadaCascada {
    id_llamada: string;
    fecha_llamada: Date | null;
    respuesta_usuario: string;
    observacion: string | null;
    hora_agendada: Date | null;
    comunicador: { nombre: string } | null;
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
    gestor: { nombre: string } | null;
    llamadas: LlamadaCascada[];
}

export interface SolicitudCascada<C extends CitaCascada = CitaCascada> {
    id_solicitud: string;
    fecha_inicio: Date | string;
    descripcion: string | null;
    estado_solicitud: string;
    accion: string | null;
    razon_rechazo: string | null;
    fecha_validacion: Date | string | null;
    tipoSolicitud: { nombre_tipo_solicitud: string } | null;
    motivo: { nombre_motivo: string } | null;
    orientador: { nombre: string } | null;
    gestor: { nombre: string } | null;
    citas: C[];
}

export interface CitaCascadaConEdicion extends CitaCascada {
    editable: boolean;
}

export interface CitaCascadaContexto extends CitaCascadaConEdicion {
    puedeRegistrarRechazo: boolean;
}
