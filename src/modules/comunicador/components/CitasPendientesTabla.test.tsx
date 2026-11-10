import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// types
import { ESTADO_CITA } from "@/modules/comunicador/types/comunicador";
import type { CitaFila } from "../actions/getCitasPendientes.action";
import { CitasPendientesTabla } from "./CitasPendientesTabla";

const cita: CitaFila = {
    id_cita: "cita-comunicador-1",
    priorizacion_clinica: "Urgente",
    priorizacion: 85,
    disponibilidad: "Lunes AM",
    rut_usuario: "22.222.222-2",
    nombre_usuario: "Paciente Demo",
    profesion: "Medicina",
    prestacion: "Consulta medica",
    fecha_estimada_atencion: new Date("2026-10-10T00:00:00"),
    estado_cita: ESTADO_CITA.SIN_LLAMADAS,
    intentos: 0,
    observacion: null,
    tiene_llamada_hoy: true
};

const citaSinPrioridad: CitaFila = {
    ...cita,
    id_cita: "cita-comunicador-2",
    priorizacion_clinica: null,
    priorizacion: null,
    disponibilidad: null,
    rut_usuario: "33.333.333-3",
    nombre_usuario: "Segundo Paciente",
    profesion: "Odontología",
    prestacion: "Control dental",
    tiene_llamada_hoy: false
};

describe("CitasPendientesTabla", () => {
    it("compacta columnas, muestra ID / Fecha Estimada, nombre + RUT, simbologia y badge de prioridad coloreado", () => {
        const onGestionar = vi.fn();
        const onPagina = vi.fn();
        const { container } = render(
            <CitasPendientesTabla
                filas={[cita, citaSinPrioridad]}
                total={2}
                pagina={1}
                porPagina={100}
                onPagina={onPagina}
                onGestionar={onGestionar}
                renderAcciones={() => <button type="button">Accion secundaria</button>}
            />
        );

        expect(container.querySelector('table[class*="min-w-["]')).toBeNull();
        expect(container.querySelector("table.table-fixed")).toBeNull();
        expect(screen.getByRole("columnheader", { name: "ID / Fecha Estimada" })).toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "Cita" })).not.toBeInTheDocument();

        // Paciente: nombre y RUT
        expect(screen.getByText("Paciente Demo")).toBeInTheDocument();
        expect(screen.getByText("22.222.222-2")).toBeInTheDocument();

        // Simbologia de prioridad
        expect(screen.getByText("Simbología de prioridad:")).toBeInTheDocument();
        expect(screen.getByText("Urgente (80–100)")).toBeInTheDocument();
        expect(screen.getByText("Alta (60–79)")).toBeInTheDocument();
        expect(screen.getByText("Media (40–59)")).toBeInTheDocument();
        expect(screen.getByText("Baja (< 40)")).toBeInTheDocument();

        // Badge de prioridad coloreado
        const badgePrioridad = screen.getByText("Urgente · 85");
        expect(badgePrioridad.closest("span")).toHaveClass("bg-red-100");

        expect(screen.getByText("Consulta medica")).toBeInTheDocument();
        expect(screen.getByText("Medicina")).toBeInTheDocument();
        expect(screen.getByText("Lunes AM")).toBeInTheDocument();
        expect(screen.getAllByText("10-10-2026")).toHaveLength(2);
        expect(screen.getAllByText("Accion secundaria")).toHaveLength(2);

        fireEvent.click(screen.getAllByRole("button", { name: /Llamar/i })[0]);
        expect(onGestionar).toHaveBeenCalledWith(cita);
    });

    it("destaca la fila de citaSiguienteId con badge Siguiente, scrollIntoView y foco en su boton Llamar", () => {
        const scrollSpy = vi.fn();
        Element.prototype.scrollIntoView = scrollSpy;

        const { container } = render(
            <CitasPendientesTabla
                filas={[cita, citaSinPrioridad]}
                total={2}
                pagina={1}
                porPagina={100}
                citaSiguienteId="cita-comunicador-2"
                onPagina={vi.fn()}
                onGestionar={vi.fn()}
            />
        );

        const filaSiguiente = container.querySelector('tr[data-cita-siguiente="true"]') as HTMLElement | null;
        expect(filaSiguiente).not.toBeNull();
        expect(within(filaSiguiente!).getByText("Siguiente")).toBeInTheDocument();
        expect(within(filaSiguiente!).getByText("Segundo Paciente")).toBeInTheDocument();
        expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });

        const botonLlamarSiguiente = within(filaSiguiente!).getByRole("button", { name: "Llamar" });
        expect(document.activeElement).toBe(botonLlamarSiguiente);
    });

    it("mantiene las acciones en una sola linea sin flex-wrap, celdas compactas y clasifica puntaje 60 como Alta · 60", () => {
        const citaPuntaje60Media: CitaFila = {
            ...cita,
            id_cita: "PLA-66b62",
            priorizacion_clinica: "Media",
            priorizacion: 60,
            tiene_llamada_hoy: false
        };

        render(
            <CitasPendientesTabla
                filas={[citaPuntaje60Media]}
                total={1}
                pagina={1}
                porPagina={100}
                onPagina={vi.fn()}
                onGestionar={vi.fn()}
                renderAcciones={() => <button type="button">Mas acciones</button>}
            />
        );

        expect(screen.getByText("Alta · 60")).toBeInTheDocument();
        expect(screen.queryByText("Media · 60")).not.toBeInTheDocument();

        const botonLlamar = screen.getByRole("button", { name: "Llamar" });
        const contenedorAcciones = botonLlamar.parentElement;
        expect(contenedorAcciones).not.toHaveClass("flex-wrap");
        expect(contenedorAcciones).toHaveClass("whitespace-nowrap");

        expect(screen.getByText("Paciente Demo")).toHaveClass("line-clamp-1");
        expect(screen.getByText("Consulta medica")).toHaveClass("line-clamp-1");
    });
});
