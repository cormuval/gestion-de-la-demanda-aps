import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh })
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args)
    }
}));

const cambiarCentroActivo = vi.fn();
vi.mock("@/modules/configuracion/actions/cambiarCentroActivo.action", () => ({
    cambiarCentroActivo: (...args: unknown[]) => cambiarCentroActivo(...args)
}));

import { SelectorCentroActivo, type CentroOpcion } from "./selector-centro-activo";

const centros: CentroOpcion[] = [
    { id_centro: "501", nombre_centro: "CESFAM Placeres" },
    { id_centro: "655", nombre_centro: "CESFAM Reina Isabel II" }
];

function renderSelector(centroId: string | null) {
    return render(<SelectorCentroActivo centroId={centroId} centros={centros} />);
}

describe("SelectorCentroActivo", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("cambia el centro, avisa y refresca", async () => {
        let resolver!: (value: Awaited<ReturnType<typeof cambiarCentroActivo>>) => void;
        cambiarCentroActivo.mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            })
        );

        renderSelector("501");
        const select = screen.getByRole("combobox", { name: "Centro activo" });

        fireEvent.change(select, { target: { value: "655" } });

        expect(cambiarCentroActivo).toHaveBeenCalledWith("655");
        expect(select).toBeDisabled();

        resolver({ ok: true, data: { centro_id: "655", centro_nombre: "CESFAM Reina Isabel II" } });

        await waitFor(() => expect(select).not.toBeDisabled());
        expect(toastSuccess).toHaveBeenCalledWith("Centro cambiado a CESFAM Reina Isabel II");
        expect(refresh).toHaveBeenCalled();
    });

    it("vuelve al centro anterior ante un error de negocio", async () => {
        cambiarCentroActivo.mockResolvedValue({ ok: false, error: "Solo un administrador puede cambiar su centro" });

        renderSelector("501");
        const select = screen.getByRole("combobox", { name: "Centro activo" }) as HTMLSelectElement;

        fireEvent.change(select, { target: { value: "655" } });

        await waitFor(() => expect(toastError).toHaveBeenCalledWith("Solo un administrador puede cambiar su centro"));
        expect(select.value).toBe("501");
        expect(refresh).not.toHaveBeenCalled();
    });

    it("vuelve al centro anterior ante una excepcion sin exponer el detalle", async () => {
        cambiarCentroActivo.mockRejectedValue(new Error("detalle sensible"));

        renderSelector("501");
        const select = screen.getByRole("combobox", { name: "Centro activo" }) as HTMLSelectElement;

        fireEvent.change(select, { target: { value: "655" } });

        await waitFor(() => expect(toastError).toHaveBeenCalledWith("No fue posible cambiar el centro"));
        expect(select.value).toBe("501");
    });

    it("sin centro asignado muestra el placeholder", () => {
        renderSelector(null);
        const select = screen.getByRole("combobox", { name: "Centro activo" }) as HTMLSelectElement;

        expect(select.value).toBe("");
        expect(screen.getByText("Sin centro")).toBeInTheDocument();
    });

    it("usa el id del centro como respaldo cuando nombre_centro es null", async () => {
        const centrosSinNombre: CentroOpcion[] = [
            { id_centro: "501", nombre_centro: null },
            { id_centro: "655", nombre_centro: "CESFAM Reina Isabel II" }
        ];
        cambiarCentroActivo.mockResolvedValue({ ok: true, data: { centro_id: "501", centro_nombre: null } });

        render(<SelectorCentroActivo centroId="655" centros={centrosSinNombre} />);
        const select = screen.getByRole("combobox", { name: "Centro activo" });

        expect(screen.getByText("501")).toBeInTheDocument();

        fireEvent.change(select, { target: { value: "501" } });

        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Centro cambiado a 501"));
    });

    it("se sincroniza cuando el centro de la sesion cambia por fuera del componente", () => {
        const { rerender } = renderSelector("501");
        const select = screen.getByRole("combobox", { name: "Centro activo" }) as HTMLSelectElement;
        expect(select.value).toBe("501");

        rerender(<SelectorCentroActivo centroId="655" centros={centros} />);

        expect(select.value).toBe("655");
    });
});
