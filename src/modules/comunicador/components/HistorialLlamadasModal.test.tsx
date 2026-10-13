import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../actions/getHistorialLlamadas.action", () => ({ getHistorialLlamadas: vi.fn() }));

import { toast } from "sonner";
import { getHistorialLlamadas } from "../actions/getHistorialLlamadas.action";
import { HistorialLlamadasModal } from "./HistorialLlamadasModal";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("HistorialLlamadasModal", () => {
    it("oculta el detalle tecnico cuando falla la carga", async () => {
        vi.mocked(getHistorialLlamadas).mockRejectedValue(new Error("detalle sensible"));

        render(<HistorialLlamadasModal citaId="CITA-1" onCerrar={vi.fn()} />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al cargar el historial"));
        expect(toast.error).not.toHaveBeenCalledWith("detalle sensible");
    });

    it("no conserva llamadas de la cita anterior cuando la nueva consulta falla", async () => {
        vi.mocked(getHistorialLlamadas)
            .mockResolvedValueOnce({
                ok: true,
                data: [{
                    id_llamada: "LLAMADA-ANTERIOR",
                    fecha_llamada: new Date("2026-10-08T10:00:00"),
                    respuesta_usuario: "Contestó",
                    observacion: "Confirmada",
                    comunicador: "Ana"
                }]
            } as never)
            .mockResolvedValueOnce({ ok: false, error: "La cita no pertenece a tu centro" } as never);

        const { rerender } = render(<HistorialLlamadasModal citaId="CITA-1" onCerrar={vi.fn()} />);
        await screen.findByText("Comunicador: Ana");

        rerender(<HistorialLlamadasModal citaId="CITA-2" onCerrar={vi.fn()} />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita no pertenece a tu centro"));
        expect(screen.queryByText("Comunicador: Ana")).not.toBeInTheDocument();
    });

    it("muestra el error de negocio sin presentar un historial vacio como resultado", async () => {
        vi.mocked(getHistorialLlamadas).mockResolvedValue({ ok: false, error: "La cita no pertenece a tu centro" } as never);

        render(<HistorialLlamadasModal citaId="CITA-1" onCerrar={vi.fn()} />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita no pertenece a tu centro"));
        expect(screen.queryByText("Sin llamadas registradas.")).not.toBeInTheDocument();
    });
});
