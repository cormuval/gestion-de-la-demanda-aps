export interface LlamadaHistorial {
    id_llamada: string;
    fecha_llamada: Date | null;
    respuesta_usuario: string;
    comunicador: string | null;
    observacion: string | null;
    hora_agendada: Date | null;
}

export interface CitaHistorial {
    id_cita: string;
    estamento: string | null;
    prestacion: string | null;
    estado_cita: string | null;
    cerrada: boolean;
    fecha_cierre: Date | null;
    fecha_estimada_atencion: Date | null;
    hora_agendada: Date | null;
    observacion: string | null;
    llamadas: LlamadaHistorial[];
}

export interface SolicitudHistorial {
    id_solicitud: string;
    fecha_inicio: Date;
    tipo: string | null;
    motivo: string | null;
    descripcion: string | null;
    estado_solicitud: string;
    accion: string | null;
    razon_rechazo: string | null;
    fecha_cierre: Date | null;
    orientador: string | null;
    gestor: string | null;
    citas: CitaHistorial[];
}

export interface HistorialPaciente {
    paciente: { rut: string; nombre: string; nombre_social: string | null } | null;
    solicitudes: SolicitudHistorial[];
}
