import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions/editarCita.action", () => ({ editarCita: vi.fn() }));

import { toast } from "sonner";
import { editarCita } from "../actions/editarCita.action";
import { EditarCitaDialog } from "./EditarCitaDialog";

const cita = {
    id_cita: "CITA-1",
    solicitud_id: "SOL-1",
    estado_cita: "Sin llamadas",
    observacion: null,
    priorizacion_clinica: "Alta",
    fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
    profesional: { nombre: "Medico" },
    prestacion: { nombre_prestacion: "Consulta" },
    editable: true
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("EditarCitaDialog", () => {
    it("precarga campos y envia cambios", async () => {
        (editarCita as any).mockResolvedValue({
            ok: true,
            data: { id_cita: "CITA-1", priorizacion_clinica: "Media", priorizacion: 50, fecha_estimada_atencion: new Date("2026-10-10T00:00:00") }
        });
        const onActualizada = vi.fn();
        const onOpenChange = vi.fn();

        render(<EditarCitaDialog cita={cita} open onOpenChange={onOpenChange} onActualizada={onActualizada} />);

        fireEvent.change(screen.getByLabelText("Priorizacion clinica"), { target: { value: "Media" } });
        fireEvent.change(screen.getByLabelText("Fecha estimada"), { target: { value: "2026-10-10" } });
        fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

        await waitFor(() => expect(editarCita).toHaveBeenCalledWith({ id_cita: "CITA-1", priorizacion_clinica: "Media", fecha_estimada_atencion: "2026-10-10" }));
        expect(toast.success).toHaveBeenCalledWith("Cita actualizada");
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onActualizada).toHaveBeenCalledTimes(1);
    });

    it("muestra error y recarga contexto si el servidor bloquea", async () => {
        (editarCita as any).mockResolvedValue({ ok: false, error: "La cita ya tiene llamadas registradas y no se puede modificar" });
        const onActualizada = vi.fn();

        render(<EditarCitaDialog cita={cita} open onOpenChange={vi.fn()} onActualizada={onActualizada} />);
        fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita ya tiene llamadas registradas y no se puede modificar"));
        expect(onActualizada).toHaveBeenCalledTimes(1);
    });
});
