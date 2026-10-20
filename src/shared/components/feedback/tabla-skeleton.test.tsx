import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// components
import { TablaSkeleton } from "./tabla-skeleton";

describe("TablaSkeleton", () => {
    it("anuncia la carga y dibuja las filas y columnas pedidas", () => {
        const { container } = render(<TablaSkeleton columnas={4} filas={3} etiqueta="Cargando citaciones..." />);

        expect(screen.getByRole("status")).toHaveTextContent("Cargando citaciones...");
        expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
        expect(container.querySelectorAll("thead th")).toHaveLength(4);
    });
});
