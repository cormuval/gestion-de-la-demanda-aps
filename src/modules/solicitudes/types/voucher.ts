export interface VoucherSolicitud {
    id_solicitud: string;
    fecha_inicio: Date;
    rut: string;
    usuario: {
        rut: string;
        telefono: string | null;
        telefono_alternativo: string | null;
    };
    tipoSolicitud: { id_tipo_solicitud: number; nombre_tipo_solicitud: string };
    motivo: { id_motivo: number; nombre_motivo: string } | null;
    centro: string;
    disponibilidad_llamada: string | null;
}
