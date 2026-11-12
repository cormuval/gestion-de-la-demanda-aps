import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../actions/getCitasPendientesPaciente.action", () => ({ getCitasPendientesPaciente: vi.fn() }));

import { toast } from "sonner";
import { getCitasPendientesPaciente } from "../actions/getCitasPendientesPaciente.action";
import { OtrasCitasPacienteModal } from "./OtrasCitasPacienteModal";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("OtrasCitasPacienteModal", () => {
    it("oculta el detalle tecnico cuando falla la carga", async () => {
        vi.mocked(getCitasPendientesPaciente).mockRejectedValue(new Error("detalle sensible"));

        render(<OtrasCitasPacienteModal rutUsuario="12.345.678-5" citaActualId="CITA-1" onCerrar={vi.fn()} />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al cargar otras citas"));
        expect(toast.error).not.toHaveBeenCalledWith("detalle sensible");
    });

    it("no conserva citas del paciente anterior cuando la nueva consulta falla", async () => {
        vi.mocked(getCitasPendientesPaciente)
            .mockResolvedValueOnce({
                ok: true,
                data: [{
                    id_cita: "CITA-ANTERIOR",
                    estado_cita: "Sin llamadas",
                    priorizacion: 1,
                    profesion: "Kinesiología",
                    prestacion: "Consulta",
                    fecha_estimada_atencion: null,
                    atrasada: false,
                    intentos: 0
                }]
            } as never)
            .mockResolvedValueOnce({ ok: false, error: "Centro no configurado" } as never);

        const { rerender } = render(<OtrasCitasPacienteModal rutUsuario="12.345.678-5" citaActualId="CITA-1" onCerrar={vi.fn()} />);
        await screen.findByText("Kinesiología · Consulta");

        rerender(<OtrasCitasPacienteModal rutUsuario="1.000.003-3" citaActualId="CITA-2" onCerrar={vi.fn()} />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro no configurado"));
        expect(screen.queryByText("Kinesiología · Consulta")).not.toBeInTheDocument();
    });

    it("marca las citas atrasadas", async () => {
        vi.mocked(getCitasPendientesPaciente).mockResolvedValue({
            ok: true,
            data: [{
                id_cita: "CITA-VIEJA",
                estado_cita: "Sin llamadas",
                priorizacion: 40,
                profesion: "Médico",
                prestacion: "Control Cronico",
                fecha_estimada_atencion: new Date("2024-05-14T12:00:00Z"),
                atrasada: true,
                intentos: 0
            }]
        });

        render(<OtrasCitasPacienteModal rutUsuario="1000007-6" citaActualId="CITA-1" onCerrar={vi.fn()} />);

        await screen.findByText("Médico · Control Cronico");
        expect(screen.getByText("Atrasada")).toBeInTheDocument();
    });

    it("muestra el error de negocio sin presentar una lista vacia como resultado", async () => {
        vi.mocked(getCitasPendientesPaciente).mockResolvedValue({ ok: false, error: "Centro no configurado" } as never);

        render(<OtrasCitasPacienteModal rutUsuario="12.345.678-5" citaActualId="CITA-1" onCerrar={vi.fn()} />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro no configurado"));
        expect(screen.queryByText("Sin otras citas pendientes.")).not.toBeInTheDocument();
    });
});
