import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// La vista carga datos al montar via getMantenedoresConfig; se mockea con datos vacios
// para que el render no dependa de la BD. Lo que se prueba aqui es el filtrado de
// pestanas por permiso, no la carga de datos.
vi.mock("@/modules/configuracion/actions/mantenedores.action", () => ({
    getMantenedoresConfig: vi.fn().mockResolvedValue({
        tiposSolicitud: [],
        motivos: [],
        roles: [],
        profesionales: [],
        prestaciones: [],
        funcionarios: [],
        centros: []
    })
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { UsuariosRolesView } from "./UsuariosRolesView";
import type { Permiso } from "@/config/permisos";

const TODAS_LAS_PESTANAS = ["Tipo solicitud", "Motivos", "Roles", "Profesionales", "Prestaciones", "Funcionarios"];

async function montar(permisos: Permiso[]) {
    render(<UsuariosRolesView permisos={permisos} />);
    // Espera a que termine la carga inicial (evita warnings de act()).
    await waitFor(() => expect(screen.queryByText("Cargando...")).not.toBeInTheDocument());
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("UsuariosRolesView: pestanas segun permisos", () => {
    it("un rol con todos los permisos de configuracion ve todas las pestanas", async () => {
        await montar(["config.ver", "config.catalogos", "config.roles", "config.funcionarios"]);
        for (const etiqueta of TODAS_LAS_PESTANAS) {
            expect(screen.getByRole("button", { name: etiqueta })).toBeInTheDocument();
        }
    });

    it("un rol con solo config.funcionarios ve unicamente la pestana Funcionarios", async () => {
        await montar(["config.ver", "config.funcionarios"]);
        expect(screen.getByRole("button", { name: "Funcionarios" })).toBeInTheDocument();
        for (const etiqueta of ["Tipo solicitud", "Motivos", "Roles", "Profesionales", "Prestaciones"]) {
            expect(screen.queryByRole("button", { name: etiqueta })).not.toBeInTheDocument();
        }
    });

    it("config.catalogos habilita los catalogos pero no Roles ni Funcionarios", async () => {
        await montar(["config.ver", "config.catalogos"]);
        for (const etiqueta of ["Tipo solicitud", "Motivos", "Profesionales", "Prestaciones"]) {
            expect(screen.getByRole("button", { name: etiqueta })).toBeInTheDocument();
        }
        expect(screen.queryByRole("button", { name: "Roles" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Funcionarios" })).not.toBeInTheDocument();
    });

    it("un rol con solo config.ver no ve ninguna pestana ni contenido editable", async () => {
        await montar(["config.ver"]);
        for (const etiqueta of TODAS_LAS_PESTANAS) {
            expect(screen.queryByRole("button", { name: etiqueta })).not.toBeInTheDocument();
        }
        expect(screen.getByText("No tienes secciones de configuracion disponibles.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Agregar" })).not.toBeInTheDocument();
    });
});
