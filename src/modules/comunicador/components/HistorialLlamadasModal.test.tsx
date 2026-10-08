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
    it("muestra el error de negocio sin presentar un historial vacio como resultado", async () => {
        vi.mocked(getHistorialLlamadas).mockResolvedValue({ ok: false, error: "La cita no pertenece a tu centro" } as never);

        render(<HistorialLlamadasModal citaId="CITA-1" onCerrar={vi.fn()} />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita no pertenece a tu centro"));
        expect(screen.queryByText("Sin llamadas registradas.")).not.toBeInTheDocument();
    });
});
