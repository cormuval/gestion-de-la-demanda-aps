import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SolicitudTarjeta } from "./solicitud-tarjeta";
import { CitaTarjeta } from "./cita-tarjeta";
import type { SolicitudTarjetaDatos, CitaTarjetaDatos } from "@/shared/types/tarjetasPaciente";

const solicitud: SolicitudTarjetaDatos = { id_solicitud: "solicitud-123", motivo: "Consulta", tipo: null, descripcion: "Texto largo", estado_solicitud: "Realizado", razon_rechazo: null, orientador: null, gestor: null, fecha_inicio: "2025-12-30T15:00:00Z", fecha_cierre: null };
const cita: CitaTarjetaDatos = { id_cita: "cita-123", estamento: "Médico", prestacion: "Control", estado_cita: "Cita Aceptada", gestor: "Gestor", observacion: "Observación", fecha_cierre: null, hora_agendada: "2026-01-15T13:45:00Z", fecha_estimada_atencion: "2026-03-26T00:00:00Z", priorizacion_clinica: "Alta", llamadas: [{ id_llamada: "llamada-123", fecha_llamada: null, respuesta_usuario: "Cita Aceptada", comunicador: null, observacion: null }] };

describe("tarjetas", () => {
    it("muestra solicitud y alterna citas", () => {
        render(<SolicitudTarjeta solicitud={solicitud} cantidadCitas={1} citasAbiertasInicial={false} textoSinCitas="Sin citas registradas."><p>cita-hija</p></SolicitudTarjeta>);
        expect(screen.getByText("Estado de la solicitud: Realizado")).toHaveAttribute("data-tono", "verde");
        expect(screen.getByText(/Motivo: Consulta/)).toBeInTheDocument();
        expect(screen.getByText(/Fecha de creación: 30-12-2025/)).toBeInTheDocument();
        expect(screen.getByText(/Descripción del paciente:/)).toHaveClass("break-words", "whitespace-pre-line");
        expect(screen.queryByText("cita-hija")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Ver citas (1)" }));
        expect(screen.getByText("cita-hija")).toBeInTheDocument();
    });
    it("muestra el texto sin citas", () => {
        render(<SolicitudTarjeta solicitud={solicitud} cantidadCitas={0} citasAbiertasInicial={true} textoSinCitas="Sin citas registradas." />);
        expect(screen.getByText("Sin citas registradas.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Ver citas/ })).not.toBeInTheDocument();
    });
    it("muestra cita, fecha calendario y llamada", () => {
        render(<CitaTarjeta cita={cita} detallePendiente acciones={<button>Cerrar cita</button>} />);
        expect(screen.getByText("Estado de la cita: Cita Aceptada")).toHaveAttribute("data-tono", "verde");
        expect(screen.getByText("Fecha estimada: 26-03-2026")).toBeInTheDocument();
        expect(screen.getByText("Fecha y hora agendadas: 15-01-2026 10:45")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Ver llamadas (1)" }));
        expect(screen.getByText("Comunicador/a: —")).toBeInTheDocument();
        expect(screen.getByText("Fecha y hora de la llamada: —")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cerrar cita" })).toBeInTheDocument();
    });
});
