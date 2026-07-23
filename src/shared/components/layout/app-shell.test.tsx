import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
// config
import type { Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

vi.mock("next/navigation", () => ({
    usePathname: () => "/comunicador"
}));
vi.mock("next-auth/react", () => ({
    signOut: vi.fn()
}));

import { AppShell } from "./app-shell";

const usuario: SessionUser = {
    rut: "1-9",
    email: "o@x.cl",
    nombre: "Orientador de Prueba",
    centro_id: "501",
    centro_nombre: "CESFAM Placeres",
    rol: { id: 2, nombre: "Orientador" }
};

function renderShell(permisos: Permiso[]) {
    return render(
        <AppShell user={usuario} permisos={permisos}>
            <div>Contenido de prueba</div>
        </AppShell>
    );
}

describe("AppShell", () => {
    it("filtra el nav por permisos: solo comunicador.ver muestra Llamadas", () => {
        renderShell(["comunicador.ver"]);

        expect(screen.getAllByText("Llamadas")).toHaveLength(2);
        expect(screen.queryAllByText("Solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Revisar solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Dashboard")).toHaveLength(0);
        expect(screen.queryAllByText("Configuracion")).toHaveLength(0);
    });

    it("muestra multiples links cuando hay multiples permisos", () => {
        renderShell(["solicitudes.ver", "solicitudes.gestionar"]);

        expect(screen.getAllByText("Solicitudes")).toHaveLength(2);
        expect(screen.getAllByText("Revisar solicitudes")).toHaveLength(2);
        expect(screen.queryAllByText("Llamadas")).toHaveLength(0);
    });

    it("sin permisos no renderiza ningun link de navegacion, pero el shell sigue montando", () => {
        renderShell([]);

        expect(screen.queryAllByText("Solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Revisar solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Llamadas")).toHaveLength(0);
        expect(screen.queryAllByText("Dashboard")).toHaveLength(0);
        expect(screen.queryAllByText("Configuracion")).toHaveLength(0);

        expect(screen.getByText("Orientador de Prueba")).toBeInTheDocument();
        expect(screen.getAllByText("Salir")).toHaveLength(2);
    });

    it("muestra los datos del usuario: nombre, centro y rol", () => {
        renderShell(["dashboard.ver"]);

        expect(screen.getByText("Orientador de Prueba")).toBeInTheDocument();
        expect(screen.getByText("CESFAM Placeres")).toBeInTheDocument();
        expect(screen.getByText("Orientador")).toBeInTheDocument();
    });

    it("renderiza el contenido pasado como children", () => {
        renderShell(["dashboard.ver"]);

        expect(screen.getByText("Contenido de prueba")).toBeInTheDocument();
    });
});
