import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
// components
import { ListaPendientes, PendientesCascada } from "./PendientesCascada";

const solicitud = {
    id_solicitud: "SOL-1",
    fecha_inicio: new Date("2026-09-01T00:00:00"),
    descripcion: "Control pendiente",
    estado_solicitud: "En Curso",
    accion: "En espera de validación",
    tipoSolicitud: { nombre_tipo_solicitud: "Atencion" },
    motivo: { nombre_motivo: "Control" }
};

const cita = {
    id_cita: "CITA-1",
    solicitud_id: "SOL-1",
    estado_cita: "Sin llamadas",
    observacion: "Traer examenes",
    priorizacion_clinica: "Alta",
    fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
    profesional: { nombre: "Medico" },
    prestacion: { nombre_prestacion: "Consulta" }
};

describe("ListaPendientes", () => {
    it("anida citas y muestra priorizacion y fecha estimada", () => {
        render(<ListaPendientes solicitudes={[solicitud]} citas={[cita]} />);

        expect(screen.getByTitle("SOL-1")).toBeInTheDocument();
        expect(screen.getByTitle("CITA-1")).toBeInTheDocument();
        expect(screen.getByText("Alta")).toBeInTheDocument();
        expect(screen.getByText(/Fecha estimada:/)).toHaveTextContent("01-10-2026");
    });

    it("renderiza acciones por solicitud y cita", () => {
        render(
            <ListaPendientes
                solicitudes={[solicitud]}
                citas={[{ ...cita, editable: true }]}
                accionesSolicitud={(item) => <button>Solicitud {item.id_solicitud}</button>}
                accionesCita={(item) => <button>Cita {item.id_cita}</button>}
            />
        );

        expect(screen.getByRole("button", { name: "Solicitud SOL-1" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cita CITA-1" })).toBeInTheDocument();
    });
});

describe("PendientesCascada", () => {
    it("mantiene el wrapper Card para Ingresar", () => {
        render(<PendientesCascada pendientes={{ solicitudesPendientes: [solicitud], citasPendientes: [cita] }} />);

        expect(screen.getByText("Pendientes del paciente")).toBeInTheDocument();
        expect(screen.getByText("Solicitudes En Curso con sus citas pendientes anidadas.")).toBeInTheDocument();
    });

    it("reimprime cada solicitud por su ID y solo deshabilita la que esta cargando", () => {
        const onReimprimirVoucher = vi.fn();
        const segundaSolicitud = { ...solicitud, id_solicitud: "SOL-2" };

        render(
            <PendientesCascada
                pendientes={{ solicitudesPendientes: [solicitud, segundaSolicitud], citasPendientes: [] }}
                onReimprimirVoucher={onReimprimirVoucher}
                idVoucherCargando="SOL-1"
            />
        );

        const botonSolicitudUno = screen.getByRole("button", { name: "Reimprimiendo voucher SOL-1" });
        const botonSolicitudDos = screen.getByRole("button", { name: "Reimprimir voucher SOL-2" });

        expect(botonSolicitudUno).toBeDisabled();
        expect(botonSolicitudDos).not.toBeDisabled();

        fireEvent.click(botonSolicitudDos);

        expect(onReimprimirVoucher).toHaveBeenCalledWith("SOL-2");
    });
});
