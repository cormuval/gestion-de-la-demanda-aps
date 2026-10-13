import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
// config
import type { Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

vi.mock("next/navigation", () => ({
    usePathname: () => "/comunicador",
    useRouter: () => ({ refresh: vi.fn() })
}));
vi.mock("next-auth/react", () => ({
    signOut: vi.fn()
}));
vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() }
}));
vi.mock("@/modules/configuracion/actions/cambiarCentroActivo.action", () => ({
    cambiarCentroActivo: vi.fn()
}));

import { AppShell } from "./app-shell";
import type { CentroOpcion } from "./selector-centro-activo";

const usuario: SessionUser = {
    rut: "1-9",
    email: "o@x.cl",
    nombre: "Orientador de Prueba",
    centro_id: "501",
    centro_nombre: "CESFAM Placeres",
    rol: { id: 2, nombre: "Orientador" }
};

const centros: CentroOpcion[] = [
    { id_centro: "501", nombre_centro: "CESFAM Placeres" },
    { id_centro: "655", nombre_centro: "CESFAM Reina Isabel II" }
];

function renderShell(permisos: Permiso[], defaultOpen = true, opciones?: { centros?: CentroOpcion[] }) {
    return render(
        <AppShell user={usuario} permisos={permisos} defaultOpen={defaultOpen} centros={opciones?.centros}>
            <div>Contenido de prueba</div>
        </AppShell>
    );
}

describe("AppShell", () => {
    it("filtra el nav por permisos: solo comunicador.ver muestra Llamadas una vez", () => {
        renderShell(["comunicador.ver"]);

        expect(screen.getAllByText("Llamadas")).toHaveLength(1);
        expect(screen.queryAllByText("Solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Revisar solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Dashboard")).toHaveLength(0);
        expect(screen.queryAllByText("Configuracion")).toHaveLength(0);
    });

    it("muestra multiples links cuando hay multiples permisos sin duplicarlos en header movil", () => {
        renderShell(["solicitudes.ver", "solicitudes.gestionar"]);

        expect(screen.getAllByText("Solicitudes")).toHaveLength(1);
        expect(screen.getAllByText("Revisar solicitudes")).toHaveLength(1);
        expect(screen.queryAllByText("Llamadas")).toHaveLength(0);
    });

    it("sin permisos no renderiza links, pero el shell sigue montando", () => {
        renderShell([]);

        expect(screen.queryAllByText("Solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Revisar solicitudes")).toHaveLength(0);
        expect(screen.queryAllByText("Llamadas")).toHaveLength(0);
        expect(screen.queryAllByText("Dashboard")).toHaveLength(0);
        expect(screen.queryAllByText("Configuracion")).toHaveLength(0);

        expect(screen.getByText("Orientador de Prueba")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument();
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

    it("renderiza colapsado cuando defaultOpen es false", () => {
        renderShell(["comunicador.ver"], false);

        expect(screen.getByTestId("app-sidebar-wrapper")).toHaveAttribute("data-state", "collapsed");
    });

    it("el trigger alterna el estado expanded y collapsed", () => {
        renderShell(["comunicador.ver"]);

        const wrapper = screen.getByTestId("app-sidebar-wrapper");
        expect(wrapper).toHaveAttribute("data-state", "expanded");

        fireEvent.click(screen.getByRole("button", { name: "Alternar menu lateral" }));

        expect(wrapper).toHaveAttribute("data-state", "collapsed");
    });

    it("marca el item activo segun usePathname", () => {
        renderShell(["comunicador.ver"]);

        const link = screen.getByRole("link", { name: /Llamadas/i });
        expect(link.closest("[data-active]")).toHaveAttribute("data-active", "true");
    });

    it("con centros muestra el selector de centro activo", () => {
        renderShell(["dashboard.ver"], true, { centros });

        expect(screen.getByRole("combobox", { name: "Centro activo" })).toBeInTheDocument();
        expect(screen.queryByText("CESFAM Placeres", { selector: "p" })).not.toBeInTheDocument();
    });

    it("sin centros mantiene el texto del centro", () => {
        renderShell(["dashboard.ver"]);

        expect(screen.getByText("CESFAM Placeres")).toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Centro activo" })).not.toBeInTheDocument();
    });
});
