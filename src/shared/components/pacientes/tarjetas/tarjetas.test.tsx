import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// components
import { SolicitudTarjeta } from "./solicitud-tarjeta";
import { CitaTarjeta } from "./cita-tarjeta";
import { LlamadaTarjeta } from "./llamada-tarjeta";
// types
import type { SolicitudTarjetaDatos, CitaTarjetaDatos } from "@/shared/types/tarjetasPaciente";

const solicitud: SolicitudTarjetaDatos = {
    id_solicitud: "solicitud-123", motivo: "Consulta", tipo: null, descripcion: "Texto largo",
    estado_solicitud: "Realizado", razon_rechazo: null, orientador: "Ana", gestor: "Luis",
    fecha_inicio: "2025-12-30T15:00:00Z", fecha_cierre: null
};
const cita: CitaTarjetaDatos = {
    id_cita: "cita-123", estamento: "Médico", prestacion: "Control", estado_cita: "Cita Aceptada",
    gestor: "Gestor", observacion: "Observación", fecha_cierre: null,
    hora_agendada: "2026-01-15T13:45:00Z", fecha_estimada_atencion: "2026-03-26T00:00:00Z",
    priorizacion_clinica: "Alta", llamadas: [{ id_llamada: "llamada-123", fecha_llamada: null,
        respuesta_usuario: "Cita Aceptada", comunicador: null, observacion: null }]
};
const tarjetaSolicitud = (datos = solicitud, cantidad = 1, abierta = false) => (
    <SolicitudTarjeta solicitud={datos} cantidadCitas={cantidad} citasAbiertasInicial={abierta} textoSinCitas="Sin citas registradas.">
        <p>cita-hija</p>
    </SolicitudTarjeta>
);

describe("tarjetas", () => {
    it("solicitud: rótulos, motivo destacado, tono y fechas", () => {
        render(tarjetaSolicitud());
        expect(screen.getByText(/Estado de la solicitud:/).closest("[data-tono]")).toHaveAttribute("data-tono", "verde");
        expect(screen.getByText(/Motivo:/).parentElement).toHaveTextContent("Motivo: Consulta");
        expect(screen.getByText(/Orientador\/a:/).parentElement).toHaveTextContent("Ana");
        expect(screen.getByText(/Gestor\/a:/).parentElement).toHaveTextContent("Luis");
        expect(screen.getByText(/Fecha de creación:/).parentElement).toHaveTextContent("30-12-2025");
        expect(screen.getByText(/Descripción del paciente:/)).toBeInTheDocument();
    });
    it("solicitud: Ver citas parte cerrado y alterna", () => {
        render(tarjetaSolicitud());
        const boton = screen.getByRole("button", { name: "Ver citas (1)" });
        expect(boton).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByText("cita-hija")).not.toBeInTheDocument();
        fireEvent.click(boton);
        expect(boton).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("cita-hija")).toBeInTheDocument();
        fireEvent.click(boton);
        expect(screen.queryByText("cita-hija")).not.toBeInTheDocument();
    });
    it("solicitud: citasAbiertasInicial muestra las citas", () => {
        render(tarjetaSolicitud(solicitud, 1, true));
        expect(screen.getByText("cita-hija")).toBeInTheDocument();
    });
    it("solicitud sin citas muestra texto sin botón", () => {
        render(tarjetaSolicitud(solicitud, 0));
        expect(screen.getByText("Sin citas registradas.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Ver citas/ })).not.toBeInTheDocument();
    });
    it("solicitud rechazada muestra razón y tono rojo", () => {
        render(tarjetaSolicitud({ ...solicitud, estado_solicitud: "Rechazado", razon_rechazo: "Razón" }));
        expect(screen.getByText(/Razón de rechazo:/).parentElement).toHaveTextContent("Razón");
        expect(screen.getByText(/Estado de la solicitud:/).closest("[data-tono]")).toHaveAttribute("data-tono", "rojo");
    });
    it("descripción larga mantiene salto y ajuste de palabras", () => {
        render(tarjetaSolicitud());
        expect(screen.getByText(/Descripción del paciente:/).closest("p")).toHaveClass("break-words", "whitespace-pre-line");
    });
    it("cita aceptada muestra agenda y llamadas colapsadas", () => {
        render(<CitaTarjeta cita={cita} />);
        expect(screen.getByText(/Estado de la cita:/).closest("[data-tono]")).toHaveAttribute("data-tono", "verde");
        expect(screen.getByText(/Fecha y hora agendadas:/).parentElement).toHaveTextContent("15-01-2026 10:45");
        expect(screen.getByText(/Observación del gestor\/a:/)).toBeInTheDocument();
        const boton = screen.getByRole("button", { name: "Ver llamadas (1)" });
        expect(boton).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(boton);
        expect(screen.getByText(/Comunicador\/a:/)).toBeInTheDocument();
        expect(screen.getByText(/Resultado de la llamada:/).parentElement).toHaveTextContent("Cita Aceptada");
    });
    it("cita sin estado usa gris y Sin estado", () => {
        render(<CitaTarjeta cita={{ ...cita, estado_cita: null }} />);
        expect(screen.getByText(/Estado de la cita:/).closest("[data-tono]")).toHaveAttribute("data-tono", "gris");
        expect(screen.getByText(/Estado de la cita:/).parentElement).toHaveTextContent("Sin estado");
    });
    it("cita pendiente muestra fecha calendario sin desplazamiento", () => {
        render(<CitaTarjeta cita={cita} detallePendiente />);
        expect(screen.getByText(/Fecha estimada:/).parentElement).toHaveTextContent("26-03-2026");
    });
    it("cita sin detalle pendiente oculta fecha y prioridad", () => {
        render(<CitaTarjeta cita={cita} />);
        expect(screen.queryByText(/Fecha estimada:/)).not.toBeInTheDocument();
        expect(screen.queryByText("Alta")).not.toBeInTheDocument();
    });
    it("llamada con persona y fecha nulas muestra guiones", () => {
        render(<LlamadaTarjeta llamada={cita.llamadas[0]} />);
        expect(screen.getByText(/Comunicador\/a:/).parentElement).toHaveTextContent("Comunicador/a: —");
        expect(screen.getByText(/Fecha y hora de la llamada:/).parentElement).toHaveTextContent("Fecha y hora de la llamada: —");
    });
    it("cita sin llamadas muestra mensaje al abrir", () => {
        render(<CitaTarjeta cita={{ ...cita, llamadas: [] }} />);
        fireEvent.click(screen.getByRole("button", { name: "Ver llamadas (0)" }));
        expect(screen.getByText("Sin llamadas registradas.")).toBeInTheDocument();
    });
    it("renderiza las acciones", () => {
        render(<CitaTarjeta cita={cita} acciones={<button>Cerrar cita</button>} />);
        expect(screen.getByRole("button", { name: "Cerrar cita" })).toBeInTheDocument();
    });
    it("omite textos libres y prioridad ausentes", () => {
        render(<><SolicitudTarjeta solicitud={{ ...solicitud, descripcion: "", estado_solicitud: "Rechazado", razon_rechazo: null }} cantidadCitas={0} citasAbiertasInicial={false} textoSinCitas="Sin citas" /><CitaTarjeta cita={{ ...cita, observacion: null, priorizacion_clinica: null }} detallePendiente /><LlamadaTarjeta llamada={cita.llamadas[0]} /></>);
        expect(screen.queryByText(/Descripción del paciente:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Razón de rechazo:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Observación del gestor\/a:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Observación de la llamada:/)).not.toBeInTheDocument();
    });
});
