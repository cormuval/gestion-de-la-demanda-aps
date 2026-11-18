// utils
import { fechaCierreCita, fechaCierreSolicitud } from "@/modules/historial/utils/cierre";
import { resolverAgendaCita } from "@/modules/historial/utils/agendaCita";
// types
import type { CitaCascada, SolicitudCascada } from "../types/pendientes";
import type { CitaTarjetaDatos, SolicitudTarjetaDatos } from "@/shared/types/tarjetasPaciente";

export function aCitaTarjeta(cita: CitaCascada): CitaTarjetaDatos {
    const llamadas = cita.llamadas.map((llamada) => ({ ...llamada, comunicador: llamada.comunicador?.nombre ?? null }));
    return {
        id_cita: cita.id_cita,
        estamento: cita.profesional?.nombre ?? null,
        prestacion: cita.prestacion?.nombre_prestacion ?? null,
        estado_cita: cita.estado_cita,
        gestor: cita.gestor?.nombre ?? null,
        observacion: cita.observacion,
        fecha_cierre: fechaCierreCita(cita.estado_cita, llamadas.map((llamada) => llamada.fecha_llamada)),
        hora_agendada: resolverAgendaCita(cita.estado_cita, llamadas),
        fecha_estimada_atencion: cita.fecha_estimada_atencion,
        priorizacion_clinica: cita.priorizacion_clinica,
        llamadas
    };
}

export function aSolicitudTarjeta(solicitud: SolicitudCascada): SolicitudTarjetaDatos {
    return {
        id_solicitud: solicitud.id_solicitud,
        motivo: solicitud.motivo?.nombre_motivo ?? null,
        tipo: solicitud.tipoSolicitud?.nombre_tipo_solicitud ?? null,
        descripcion: solicitud.descripcion,
        estado_solicitud: solicitud.estado_solicitud,
        razon_rechazo: solicitud.razon_rechazo,
        orientador: solicitud.orientador?.nombre ?? null,
        gestor: solicitud.gestor?.nombre ?? null,
        fecha_inicio: solicitud.fecha_inicio,
        fecha_cierre: fechaCierreSolicitud(solicitud.estado_solicitud, solicitud.fecha_validacion ? new Date(solicitud.fecha_validacion) : null, solicitud.citas.map((cita) => fechaCierreCita(cita.estado_cita, cita.llamadas.map((llamada) => llamada.fecha_llamada))))
    };
}
