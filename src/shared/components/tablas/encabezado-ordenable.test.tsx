import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// components
import { Table, TableHeader, TableRow } from "@/shared/components/ui/table";
import { EncabezadoOrdenable } from "./encabezado-ordenable";
// types
import type { OrdenPagina } from "@/shared/lib/ordenPagina";

function TablaOrdenable() {
    const [orden, setOrden] = useState<OrdenPagina<"fecha" | "tipo"> | null>(null);
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <EncabezadoOrdenable columna="fecha" orden={orden} onOrden={setOrden}>Fecha</EncabezadoOrdenable>
                    <EncabezadoOrdenable columna="tipo" orden={orden} onOrden={setOrden}>Tipo</EncabezadoOrdenable>
                </TableRow>
            </TableHeader>
        </Table>
    );
}

describe("EncabezadoOrdenable", () => {
    it("expone estado de orden, indicador visible y botones nativos enfocables", () => {
        render(<TablaOrdenable />);
        const fecha = screen.getByRole("columnheader", { name: "Fecha" });
        const tipo = screen.getByRole("columnheader", { name: "Tipo" });
        const boton = within(fecha).getByRole("button", { name: "Fecha" });
        expect(boton.tagName).toBe("BUTTON");
        expect(boton).toHaveAttribute("type", "button");
        expect(boton.tabIndex).toBe(0);
        boton.focus();
        expect(boton).toHaveFocus();
        expect(fecha).toHaveAttribute("aria-sort", "none");
        expect(boton.querySelector("svg")).toBeVisible();

        fireEvent.click(boton);
        expect(fecha).toHaveAttribute("aria-sort", "ascending");
        expect(boton.querySelector("svg")).toHaveClass("lucide-arrow-up");
        fireEvent.click(boton);
        expect(fecha).toHaveAttribute("aria-sort", "descending");
        expect(boton.querySelector("svg")).toHaveClass("lucide-arrow-down");
        fireEvent.click(boton);
        expect(fecha).toHaveAttribute("aria-sort", "none");

        fireEvent.click(boton);
        fireEvent.click(within(tipo).getByRole("button", { name: "Tipo" }));
        expect(fecha).toHaveAttribute("aria-sort", "none");
        expect(tipo).toHaveAttribute("aria-sort", "ascending");
    });

    it("usa colores neutros en hover, foco y activacion, sin el acento verde ni el anillo del tema", () => {
        render(<TablaOrdenable />);
        const boton = within(screen.getByRole("columnheader", { name: "Fecha" })).getByRole("button", { name: "Fecha" });
        expect(boton.className).not.toMatch(/bg-accent/);
        expect(boton.className).not.toMatch(/accent-foreground/);
        expect(boton.className).toContain("hover:bg-muted");
        expect(boton.className).toContain("hover:text-foreground");
        expect(boton.className).toContain("active:bg-muted");
        // Foco neutro de contraste suficiente (foreground), sin el anillo teal del tema y siempre visible.
        expect(boton.className).toContain("focus-visible:ring-foreground");
        expect(boton.className).not.toMatch(/ring-ring/);
    });
});
