import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions/editarCita.action", () => ({ editarCita: vi.fn() }));

// actions
import { editarCita } from "../actions/editarCita.action";
// components
import { EditarFechaEstimadaCitaDialog } from "./EditarFechaEstimadaCitaDialog";
// lib
import { toast } from "sonner";

function fechaDesdeHoy(dias: number): string {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    fecha.setDate(fecha.getDate() + dias);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function fechaDesdeHoyMasAnios(anios: number): string {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    fecha.setFullYear(fecha.getFullYear() + anios);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const fechaVigente = fechaDesdeHoy(7);
const fechaNueva = fechaDesdeHoy(14);
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

describe("EditarFechaEstimadaCitaDialog", () => {
    it("muestra solo fecha con sus limites y conserva la prioridad vigente al guardar", async () => {
        vi.mocked(editarCita).mockResolvedValue({
            ok: true,
            data: {
                id_cita: "CITA-1",
                priorizacion_clinica: "Alta",
                priorizacion: 70,
                fecha_estimada_atencion: new Date(`${fechaNueva}T00:00:00`)
            }
        });
        const onActualizada = vi.fn();
        const onOpenChange = vi.fn();

        render(<EditarFechaEstimadaCitaDialog cita={cita} open onOpenChange={onOpenChange} onActualizada={onActualizada} />);

        const dialog = screen.getByRole("dialog", { name: /^Editar fecha estimada/ });
        const inputFecha = within(dialog).getByLabelText("Fecha estimada");
        expect(inputFecha).toHaveValue(fechaVigente);
        expect(inputFecha).toHaveAttribute("min", fechaDesdeHoy(0));
        expect(inputFecha).toHaveAttribute("max", fechaDesdeHoyMasAnios(2));
        expect(within(dialog).queryByLabelText("Prioridad clinica")).not.toBeInTheDocument();

        fireEvent.change(inputFecha, { target: { value: fechaNueva } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(editarCita).toHaveBeenCalledWith({
            id_cita: "CITA-1",
            priorizacion_clinica: "Alta",
            fecha_estimada_atencion: fechaNueva
        }));
        expect(toast.success).toHaveBeenCalledWith("Cita actualizada");
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onActualizada).toHaveBeenCalledTimes(1);
    });

    it("mantiene abierto y recarga el contexto cuando el servidor bloquea el cambio", async () => {
        vi.mocked(editarCita).mockResolvedValue({ ok: false, error: "La cita ya tiene llamadas registradas y no se puede modificar" });
        const onActualizada = vi.fn();
        const onOpenChange = vi.fn();

        render(<EditarFechaEstimadaCitaDialog cita={cita} open onOpenChange={onOpenChange} onActualizada={onActualizada} />);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cita ya tiene llamadas registradas y no se puede modificar"));
        expect(screen.getByRole("dialog", { name: /^Editar fecha estimada/ })).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(onActualizada).toHaveBeenCalledTimes(1);
    });

    it("no envia una prioridad vigente invalida", async () => {
        render(
            <EditarFechaEstimadaCitaDialog
                cita={{ ...cita, priorizacion_clinica: "Desconocida" }}
                open
                onOpenChange={vi.fn()}
                onActualizada={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La prioridad clinica vigente no es valida"));
        expect(editarCita).not.toHaveBeenCalled();
    });
});
