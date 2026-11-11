import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions/editarCita.action", () => ({ editarCita: vi.fn() }));

// actions
import { editarCita } from "../actions/editarCita.action";
// components
import { EditarPrioridadCitaDialog } from "./EditarPrioridadCitaDialog";
// lib
import { toast } from "sonner";

function fechaFutura(dias: number): string {
    const fecha = new Date();
    fecha.setHours(12, 0, 0, 0);
    fecha.setDate(fecha.getDate() + dias);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const fechaVigente = fechaFutura(7);
const cita = {
    id_cita: "CITA-1",
    solicitud_id: "SOL-1",
    estado_cita: "Sin llamadas",
    observacion: null,
    priorizacion_clinica: "Alta",
    fecha_estimada_atencion: new Date(`${fechaVigente}T00:00:00`),
    profesional: { nombre: "Medico" },
    prestacion: { nombre_prestacion: "Consulta" },
    editable: true
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("EditarPrioridadCitaDialog", () => {
    it("muestra solo prioridad y conserva la fecha vigente al guardar", async () => {
        vi.mocked(editarCita).mockResolvedValue({
            ok: true,
            data: {
                id_cita: "CITA-1",
                priorizacion_clinica: "Media",
                priorizacion: 50,
                fecha_estimada_atencion: new Date(`${fechaVigente}T00:00:00`)
            }
        });
        const onActualizada = vi.fn();
        const onOpenChange = vi.fn();

        render(<EditarPrioridadCitaDialog cita={cita} open onOpenChange={onOpenChange} onActualizada={onActualizada} />);

        const dialog = screen.getByRole("dialog", { name: /^Editar prioridad/ });
        expect(within(dialog).getByRole("combobox", { name: "Prioridad clinica" })).toHaveValue("Alta");
        expect(within(dialog).queryByLabelText("Fecha estimada")).not.toBeInTheDocument();

        fireEvent.change(within(dialog).getByRole("combobox", { name: "Prioridad clinica" }), { target: { value: "Media" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(editarCita).toHaveBeenCalledWith({
            id_cita: "CITA-1",
            priorizacion_clinica: "Media",
            fecha_estimada_atencion: fechaVigente
        }));
        expect(toast.success).toHaveBeenCalledWith("Cita actualizada");
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onActualizada).toHaveBeenCalledTimes(1);
    });

    it("mantiene abierto y recarga el contexto cuando el servidor bloquea el cambio", async () => {
        vi.mocked(editarCita).mockResolvedValue({ ok: false, error: "La cita ya tiene llamadas registradas y no se puede modificar" });
        const onActualizada = vi.fn();
        const onOpenChange = vi.fn();

        render(<EditarPrioridadCitaDialog cita={cita} open onOpenChange={onOpenChange} onActualizada={onActualizada} />);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita ya tiene llamadas registradas y no se puede modificar"));
        expect(screen.getByRole("dialog", { name: /^Editar prioridad/ })).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(onActualizada).toHaveBeenCalledTimes(1);
    });
});
