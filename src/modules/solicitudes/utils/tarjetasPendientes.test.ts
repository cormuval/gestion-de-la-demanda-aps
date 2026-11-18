import { describe, expect, it } from "vitest";
import { aCitaTarjeta, aSolicitudTarjeta } from "./tarjetasPendientes";

const fecha = new Date("2026-01-15T12:00:00Z");
const cita = {
    id_cita: "C1", solicitud_id: "S1", estado_cita: "Cita Aceptada", observacion: null,
    priorizacion_clinica: null, fecha_estimada_atencion: null, profesional: { nombre: "Médico" },
    prestacion: { nombre_prestacion: "Consulta" }, gestor: { nombre: "Gestor" },
    llamadas: [{ id_llamada: "L1", fecha_llamada: fecha, respuesta_usuario: "Cita Aceptada", observacion: null, hora_agendada: fecha, comunicador: { nombre: "Ana" } }]
};

describe("adaptadores de tarjetas pendientes", () => {
    it("adapta nombres, cierre y agenda de la cita", () => {
        expect(aCitaTarjeta(cita)).toMatchObject({ estamento: "Médico", prestacion: "Consulta", gestor: "Gestor", fecha_cierre: fecha, hora_agendada: fecha, llamadas: [{ comunicador: "Ana" }] });
    });
    it("adapta nombres y fecha de cierre de solicitud rechazada", () => {
        expect(aSolicitudTarjeta({ id_solicitud: "S1", fecha_inicio: fecha, descripcion: null, estado_solicitud: "Rechazado", accion: null, razon_rechazo: null, fecha_validacion: fecha, tipoSolicitud: { nombre_tipo_solicitud: "Tipo" }, motivo: { nombre_motivo: "Motivo" }, orientador: { nombre: "Orientador" }, gestor: { nombre: "Gestor" }, citas: [cita] })).toMatchObject({ fecha_cierre: fecha, tipo: "Tipo", motivo: "Motivo", orientador: "Orientador", gestor: "Gestor" });
    });
});
