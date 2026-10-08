import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../actions/registrarLlamada.action", () => ({ registrarLlamada: vi.fn() }));

import { toast } from "sonner";
import { registrarLlamada } from "../actions/registrarLlamada.action";
import { RegistrarLlamadaModal } from "./RegistrarLlamadaModal";

const cita = {
    id_cita: "CITA-1",
    priorizacion: null,
    disponibilidad: null,
    rut_usuario: "11.111.111-1",
    nombre_usuario: "Paciente de prueba",
    profesion: null,
    prestacion: null,
    fecha_estimada_atencion: null,
    estado_cita: "Sin llamadas",
    intentos: 0,
    tiene_llamada_hoy: false
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("RegistrarLlamadaModal", () => {
    it("muestra el error de negocio y mantiene el modal sin notificar exito", async () => {
        vi.mocked(registrarLlamada).mockResolvedValue({ ok: false, error: "La cita ya está cerrada" } as never);
        const onRegistrado = vi.fn();

        render(<RegistrarLlamadaModal cita={cita} telefonos="9 1234 5678" correo="paciente@example.com" onCerrar={vi.fn()} onRegistrado={onRegistrado} />);
        fireEvent.submit(screen.getByRole("button", { name: "Registrar" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita ya está cerrada"));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(onRegistrado).not.toHaveBeenCalled();
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
});
