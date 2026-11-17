export interface LlamadaTarjetaDatos {
    id_llamada: string;
    fecha_llamada: Date | string | null;
    respuesta_usuario: string;
    comunicador: string | null;
    observacion: string | null;
}
export interface CitaTarjetaDatos {
    id_cita: string;
    estamento: string | null;
    prestacion: string | null;
    estado_cita: string | null;
    gestor: string | null;
    observacion: string | null;
    fecha_cierre: Date | string | null;
    hora_agendada: Date | string | null;
    fecha_estimada_atencion: Date | string | null;
    priorizacion_clinica: string | null;
    llamadas: LlamadaTarjetaDatos[];
}
export interface SolicitudTarjetaDatos {
    id_solicitud: string;
    motivo: string | null;
    tipo: string | null;
    descripcion: string | null;
    estado_solicitud: string;
    razon_rechazo: string | null;
    orientador: string | null;
    gestor: string | null;
    fecha_inicio: Date | string;
    fecha_cierre: Date | string | null;
}
