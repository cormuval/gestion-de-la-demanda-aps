import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
// components
import { PanelFiltros, contarFiltrosActivos } from "./panel-filtros";

function renderPanel(props: Partial<Parameters<typeof PanelFiltros>[0]> = {}) {
    const onAplicar = vi.fn();
    const onLimpiar = vi.fn();
    render(
        <PanelFiltros descripcion="Filtra la tabla" activos={0} onAplicar={onAplicar} onLimpiar={onLimpiar} {...props}>
            <label>
                RUT
                <input />
            </label>
        </PanelFiltros>
    );
    return { onAplicar, onLimpiar };
}

describe("PanelFiltros", () => {
    it("abre el panel, aplica y se cierra", async () => {
        const { onAplicar } = renderPanel();

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        expect(within(panel).getByLabelText("RUT")).toBeInTheDocument();

        fireEvent.click(within(panel).getByRole("button", { name: /Aplicar filtros/ }));

        expect(onAplicar).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("permite enviar el formulario con una etiqueta propia", async () => {
        const { onAplicar } = renderPanel({ etiquetaAplicar: "Buscar" });
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        const boton = within(panel).getByRole("button", { name: "Buscar" });
        expect(boton).toHaveAttribute("type", "submit");
        fireEvent.submit(boton.closest("form")!);
        expect(onAplicar).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("muestra el contador y Limpiar solo con filtros activos", () => {
        const { onLimpiar } = renderPanel({ activos: 3 });

        expect(screen.getByRole("button", { name: "Filtros (3 activos)" })).toHaveTextContent("3");
        fireEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }));
        expect(onLimpiar).toHaveBeenCalledTimes(1);
    });

    it("sin filtros activos no ofrece limpiar", () => {
        renderPanel();
        expect(screen.queryByRole("button", { name: /Limpiar filtros/ })).not.toBeInTheDocument();
    });

    it("sin detalle no muestra chips", () => {
        renderPanel({ activos: 2 });
        expect(screen.queryByText(/Estado:/)).not.toBeInTheDocument();
    });

    it("muestra un chip por filtro activo con etiqueta y valor", () => {
        renderPanel({
            activos: 2,
            activosDetalle: [
                { etiqueta: "Estado", valor: "Sin llamadas" },
                { etiqueta: "RUT", valor: "12345678-5" }
            ]
        });

        expect(screen.getByText("Estado: Sin llamadas")).toBeInTheDocument();
        expect(screen.getByText("RUT: 12345678-5")).toBeInTheDocument();
    });

    it("abre el panel al hacer clic en un chip", async () => {
        renderPanel({
            activos: 1,
            activosDetalle: [{ etiqueta: "Estado", valor: "Sin llamadas" }]
        });

        fireEvent.click(screen.getByText("Estado: Sin llamadas"));
        await waitFor(() => expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument());
    });

    it("mantiene el detalle y Limpiar a la izquierda del boton Filtros en el orden de lectura", () => {
        renderPanel({
            activos: 2,
            activosDetalle: [{ etiqueta: "Estado", valor: "Sin llamadas" }]
        });

        const boton = screen.getByRole("button", { name: /Filtros/ });
        const chip = screen.getByText("Estado: Sin llamadas");
        const limpiar = screen.getByRole("button", { name: /Limpiar filtros/ });
        // El chip y Limpiar preceden al boton Filtros (quedan a su izquierda); el boton no se desplaza.
        expect(chip.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(limpiar.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe("contarFiltrosActivos", () => {
    it("cuenta campos con valor, ignora claves y valores iguales a la base", () => {
        expect(contarFiltrosActivos({ rut: "1-9", sector: "", page: 2 }, ["page"])).toBe(1);
        expect(contarFiltrosActivos({ temporalidad: "Todas", estado: "Sin llamadas" }, [], { temporalidad: "Todas", estado: "" })).toBe(1);
    });
});
