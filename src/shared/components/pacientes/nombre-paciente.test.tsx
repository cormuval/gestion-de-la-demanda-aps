import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// components
import { NombrePaciente } from "./nombre-paciente";

describe("NombrePaciente", () => {
    it("identifica al paciente con nombre legal y social", () => {
        render(<NombrePaciente nombreLegal="Nombre Legal" nombreSocial="Nombre Social" />);
        expect(screen.getByText("Nombre Legal")).toBeVisible();
        expect(screen.getByText("Nombre social: Nombre Social")).toBeVisible();
    });

    it.each([null, undefined, "", "   "])("omite nombre social sin contenido: %s", (nombreSocial) => {
        render(<NombrePaciente nombreLegal="Nombre Legal" nombreSocial={nombreSocial} />);
        expect(screen.getByText("Nombre Legal")).toBeVisible();
        expect(screen.queryByText(/Nombre social:/)).not.toBeInTheDocument();
    });

    it("muestra guion cuando falta el nombre legal", () => {
        render(<NombrePaciente nombreLegal={null} nombreSocial="Social" />);
        expect(screen.getByText("—")).toBeVisible();
        expect(screen.getByText("Nombre social: Social")).toBeVisible();
    });

    it("conserva nombre social extenso en lineas completas dentro de un titulo", () => {
        const { container } = render(
            <h2><NombrePaciente nombreLegal="Legal" nombreSocial="Nombre social extenso con multiples apellidos y denominaciones" className="font-medium" /></h2>
        );
        const nombre = screen.getByText("Nombre social: Nombre social extenso con multiples apellidos y denominaciones");
        expect(nombre).toBeVisible();
        expect(nombre).toHaveClass("block", "break-words");
        expect(nombre).not.toHaveClass("truncate", "line-clamp-1");
        expect(container.querySelector("h2 div, h2 p")).toBeNull();
        expect(nombre.parentElement).toHaveClass("font-medium");
    });
});
