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
    it("muestra el error de negocio sin presentar una lista vacia como resultado", async () => {
        vi.mocked(getCitasPendientesPaciente).mockResolvedValue({ ok: false, error: "Centro no configurado" } as never);

        render(<OtrasCitasPacienteModal rutUsuario="12.345.678-5" citaActualId="CITA-1" onCerrar={vi.fn()} />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro no configurado"));
        expect(screen.queryByText("Sin otras citas próximas.")).not.toBeInTheDocument();
    });
});
