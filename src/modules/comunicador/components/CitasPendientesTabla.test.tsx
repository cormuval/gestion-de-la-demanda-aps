import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// types
import { ESTADO_CITA } from "@/modules/comunicador/types/comunicador";
import type { CitaFila } from "../actions/getCitasPendientes.action";
import { CitasPendientesTabla } from "./CitasPendientesTabla";

const cita: CitaFila = {
    id_cita: "cita-comunicador-1",
    priorizacion: 9,
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

describe("CitasPendientesTabla", () => {
    it("compacta columnas, conserva acciones y no usa ancho minimo fijo", () => {
        const onGestionar = vi.fn();
        const onPagina = vi.fn();
        const { container } = render(
            <CitasPendientesTabla
                filas={[cita]}
                total={1}
                pagina={1}
                porPagina={100}
                onPagina={onPagina}
                onGestionar={onGestionar}
                renderAcciones={() => <button type="button">Accion secundaria</button>}
            />
        );

        expect(container.querySelector('table[class*="min-w-["]')).toBeNull();
        expect(container.querySelector("table.table-fixed")).toBeNull();
        expect(screen.getByText("22.222.222-2")).toBeInTheDocument();
        expect(screen.getByText("Consulta medica")).toBeInTheDocument();
        expect(screen.getByText("Medicina")).toBeInTheDocument();
        expect(screen.getByText("Lunes AM")).toBeInTheDocument();
        expect(screen.getByText("10-10-2026")).toBeInTheDocument();
        expect(screen.getByText("Accion secundaria")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Llamar/i }));
        expect(onGestionar).toHaveBeenCalledWith(cita);
    });
});
