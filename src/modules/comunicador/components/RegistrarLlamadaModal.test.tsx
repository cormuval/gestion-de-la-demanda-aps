import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../actions/registrarLlamada.action", () => ({ registrarLlamada: vi.fn() }));

import { toast } from "sonner";
import { registrarLlamada } from "../actions/registrarLlamada.action";
import { RegistrarLlamadaModal } from "./RegistrarLlamadaModal";
import { ORIGEN_LLAMADA } from "../schemas/llamada.schema";
import { RESPUESTA_LLAMADA } from "../types/comunicador";

const cita = {
    id_cita: "CITA-1",
    priorizacion_clinica: null,
    priorizacion: null,
    disponibilidad: null,
    rut_usuario: "11.111.111-1",
    nombre_usuario: "Paciente de prueba",
    nombre_social: "Social de prueba",
    profesion: null,
    prestacion: null,
    fecha_estimada_atencion: null,
    estado_cita: "Sin llamadas",
    observacion: null,
    intentos: 0,
    tiene_llamada_hoy: false
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("RegistrarLlamadaModal", () => {
    it("en Gestion registra el rechazo fijo con la observacion recortada y sin controles del Comunicador", async () => {
        vi.mocked(registrarLlamada).mockResolvedValue({
            ok: true,
            data: { estadoCita: "Cita Rechazada (No necesaria)", solicitudRealizada: false }
        } as never);

        render(
            <RegistrarLlamadaModal
                cita={cita}
                telefonos="9 1234 5678"
                correo="paciente@example.com"
                modo="gestion_solicitudes"
                onCerrar={vi.fn()}
                onRegistrado={vi.fn()}
            />
        );

        const observacion = screen.getByRole("textbox", { name: "Observación" });
        expect(observacion).toHaveAttribute("maxlength", "350");
        expect(screen.getByText("0/350")).toBeInTheDocument();
        expect(screen.getByText(RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA)).toBeInTheDocument();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Hora agendada")).not.toBeInTheDocument();

        fireEvent.change(observacion, { target: { value: "  Ya no requiere esta prestacion  " } });
        fireEvent.submit(screen.getByRole("button", { name: "Registrar" }).closest("form")!);

        await waitFor(() => expect(registrarLlamada).toHaveBeenCalledWith({
            cita_id: "CITA-1",
            origen: ORIGEN_LLAMADA.GESTION_SOLICITUDES,
            respuesta: RESPUESTA_LLAMADA.RECHAZADA_NO_NECESARIA,
            observacion: "Ya no requiere esta prestacion",
            hora_agendada: ""
        }));
    });

    it("conserva en Comunicador el selector de respuestas", () => {
        render(
            <RegistrarLlamadaModal
                cita={cita}
                telefonos="9 1234 5678"
                correo="paciente@example.com"
                onCerrar={vi.fn()}
                onRegistrado={vi.fn()}
            />
        );

        expect(screen.getByRole("combobox", { name: "Respuesta" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: RESPUESTA_LLAMADA.NO_CONTESTA })).toBeInTheDocument();
    });

    it("muestra el contexto de la cita: RUT, estado, estamento, prestacion, fecha estimada y observacion clinica", () => {
        render(
            <RegistrarLlamadaModal
                cita={{
                    ...cita,
                    profesion: "Médico",
                    prestacion: "Control Cronico",
                    estado_cita: "No contesta (1)",
                    fecha_estimada_atencion: new Date("2026-10-15T00:00:00"),
                    observacion: "Control PSM con Dr. Veas en junio"
                }}
                telefonos="9 1234 5678"
                correo="paciente@example.com"
                onCerrar={vi.fn()}
                onRegistrado={vi.fn()}
            />
        );

        expect(screen.getByText("Paciente de prueba")).toBeVisible();
        expect(screen.getByText("Nombre social: Social de prueba")).toBeVisible();
        expect(screen.getByText("11.111.111-1")).toBeInTheDocument();
        expect(screen.getByText("No contesta (1)")).toBeInTheDocument();
        expect(screen.getByText("Médico")).toBeInTheDocument();
        expect(screen.getByText("Control Cronico")).toBeInTheDocument();
        expect(screen.getByText("Fecha estimada de atención")).toBeInTheDocument();
        expect(screen.getByText("15-10-2026")).toBeInTheDocument();
        expect(screen.getByText("Control PSM con Dr. Veas en junio")).toBeInTheDocument();
    });

    it("muestra guion largo cuando la fecha estimada de atencion es nula", () => {
        render(
            <RegistrarLlamadaModal
                cita={{ ...cita, fecha_estimada_atencion: null }}
                telefonos="9 1234 5678"
                correo="paciente@example.com"
                onCerrar={vi.fn()}
                onRegistrado={vi.fn()}
            />
        );

        const termino = screen.getByText("Fecha estimada de atención");
        expect(termino.parentElement?.querySelector("dd")).toHaveTextContent("—");
    });

    it("muestra el error de negocio y mantiene el modal sin notificar exito", async () => {
        vi.mocked(registrarLlamada).mockResolvedValue({ ok: false, error: "La cita ya está cerrada" } as never);
        const onRegistrado = vi.fn();

        render(<RegistrarLlamadaModal cita={cita} telefonos="9 1234 5678" correo="paciente@example.com" onCerrar={vi.fn()} onRegistrado={onRegistrado} />);
        fireEvent.submit(screen.getByRole("button", { name: "Registrar" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita ya está cerrada"));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(onRegistrado).not.toHaveBeenCalled();
    });

    it("avisa al padre si la cita ya estaba cerrada", async () => {
        vi.mocked(registrarLlamada).mockResolvedValue({ ok: false, error: "La cita ya está cerrada" } as never);
        const onCitaCerrada = vi.fn();

        render(<RegistrarLlamadaModal cita={cita} telefonos="9 1234 5678" correo="paciente@example.com" onCerrar={vi.fn()} onRegistrado={vi.fn()} onCitaCerrada={onCitaCerrada} />);
        fireEvent.submit(screen.getByRole("button", { name: "Registrar" }).closest("form")!);

        await waitFor(() => expect(onCitaCerrada).toHaveBeenCalledTimes(1));
        expect(toast.error).toHaveBeenCalledWith("La cita ya está cerrada");
    });

    it("no avisa al padre ante otro error de negocio", async () => {
        vi.mocked(registrarLlamada).mockResolvedValue({ ok: false, error: "Debe indicar la hora agendada" } as never);
        const onCitaCerrada = vi.fn();

        render(<RegistrarLlamadaModal cita={cita} telefonos="9 1234 5678" correo="paciente@example.com" onCerrar={vi.fn()} onRegistrado={vi.fn()} onCitaCerrada={onCitaCerrada} />);
        fireEvent.submit(screen.getByRole("button", { name: "Registrar" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Debe indicar la hora agendada"));
        expect(onCitaCerrada).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("usa data del resultado exitoso al notificar el registro", async () => {
        vi.mocked(registrarLlamada).mockResolvedValue({
            ok: true,
            data: { estadoCita: "No contesta (1)", solicitudRealizada: false }
        } as never);
        const onRegistrado = vi.fn();

        render(<RegistrarLlamadaModal cita={cita} telefonos="9 1234 5678" correo="paciente@example.com" onCerrar={vi.fn()} onRegistrado={onRegistrado} />);
        fireEvent.submit(screen.getByRole("button", { name: "Registrar" }).closest("form")!);

        await waitFor(() => expect(onRegistrado).toHaveBeenCalledWith("Cita No contesta (1)."));
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("oculta el detalle de un fallo técnico y mantiene el modal abierto", async () => {
        vi.mocked(registrarLlamada).mockRejectedValue(new Error("detalle sensible"));
        const onRegistrado = vi.fn();

        render(<RegistrarLlamadaModal cita={cita} telefonos="9 1234 5678" correo="paciente@example.com" onCerrar={vi.fn()} onRegistrado={onRegistrado} />);
        fireEvent.submit(screen.getByRole("button", { name: "Registrar" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al registrar la llamada"));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(onRegistrado).not.toHaveBeenCalled();
    });
});
