import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// La vista carga datos al montar via getMantenedoresConfig; se mockea con datos vacios
// para que el render no dependa de la BD. Lo que se prueba aqui es el filtrado de
// pestanas por permiso, no la carga de datos.
vi.mock("@/modules/configuracion/actions/mantenedores.action", () => ({
    getMantenedoresConfig: vi.fn(),
    guardarRol: vi.fn(),
    guardarFuncionario: vi.fn(),
    guardarMotivo: vi.fn(),
    guardarPrestacion: vi.fn(),
    guardarProfesional: vi.fn(),
    guardarTipoSolicitud: vi.fn()
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { UsuariosRolesView } from "./UsuariosRolesView";
import { getMantenedoresConfig, guardarFuncionario, guardarRol } from "@/modules/configuracion/actions/mantenedores.action";
import type { Permiso } from "@/config/permisos";
import { toast } from "sonner";

const TODAS_LAS_PESTANAS = ["Tipo solicitud", "Motivos", "Roles", "Profesionales", "Prestaciones", "Funcionarios"];
const rolSome = { id_rol: 2, nombre_rol: "SOME", estado: "Activo", permisos: [{ permiso: "config.ver" }, { permiso: "config.funcionarios" }] };
const rolAdmin = { id_rol: 1, nombre_rol: "Administrador", estado: "Activo", permisos: [{ permiso: "config.ver" }, { permiso: "config.funcionarios" }, { permiso: "config.roles" }] };

const dataBase = {
    tiposSolicitud: [],
    motivos: [],
    roles: [rolAdmin, rolSome],
    profesionales: [],
    prestaciones: [],
    funcionarios: [
        {
            rut: "11.111.111-1",
            email: "admin@demo.local",
            nombre: "Admin Demo",
            rol_id: 1,
            estado: "Activo",
            codigo: null,
            rut_consulta: null,
            centro_id: "CESFAM-1",
            programa_asociado: "SOME",
            invitacion_app: null,
            password_hash: null,
            role: { id_rol: 1, nombre_rol: "Administrador" }
        },
        {
            rut: "22.222.222-2",
            email: "some@demo.local",
            nombre: "Some Demo",
            rol_id: 2,
            estado: "Activo",
            codigo: null,
            rut_consulta: null,
            centro_id: "CESFAM-1",
            programa_asociado: "SOME",
            invitacion_app: null,
            password_hash: null,
            role: { id_rol: 2, nombre_rol: "SOME" }
        }
    ],
    centros: [{ id_centro: "CESFAM-1", nombre_centro: "CESFAM Uno", Telefono: null }]
};

async function montar(permisos: Permiso[]) {
    render(<UsuariosRolesView permisos={permisos} actor={{ rut: "11.111.111-1", rolId: 2 }} />);
    // Espera a que termine la carga inicial (evita warnings de act()).
    await waitFor(() => expect(screen.queryByText("Cargando...")).not.toBeInTheDocument());
}

beforeEach(() => {
    vi.clearAllMocks();
    (getMantenedoresConfig as ReturnType<typeof vi.fn>).mockResolvedValue(dataBase);
    (guardarRol as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: rolSome });
    (guardarFuncionario as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: dataBase.funcionarios[1] });
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

    it("deshabilita editar y activar/desactivar funcionarios superiores", async () => {
        render(<UsuariosRolesView permisos={["config.ver", "config.funcionarios"]} actor={{ rut: "22.222.222-2", rolId: 2 }} />);

        await screen.findByText("Administrador");
        const filaAdmin = screen.getByText("admin@demo.local").closest("tr") as HTMLElement;

        expect(within(filaAdmin).getByRole("button", { name: "Editar" })).toBeDisabled();
        expect(within(filaAdmin).getByRole("button", { name: "Desactivar" })).toBeDisabled();
    });

    it("deshabilita funcionarios cuando la busqueda no trae permisos de su rol", async () => {
        (getMantenedoresConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ...dataBase,
            roles: [rolSome],
            funcionarios: [dataBase.funcionarios[0]]
        });

        render(<UsuariosRolesView permisos={["config.ver", "config.funcionarios"]} actor={{ rut: "22.222.222-2", rolId: 2 }} />);

        await screen.findByText("Administrador");
        const filaAdmin = screen.getByText("admin@demo.local").closest("tr") as HTMLElement;

        expect(within(filaAdmin).getByRole("button", { name: "Editar" })).toBeDisabled();
        expect(within(filaAdmin).getByRole("button", { name: "Desactivar" })).toBeDisabled();
    });

    it("en edicion propia deshabilita rol, centro y estado con aviso", async () => {
        render(<UsuariosRolesView permisos={["config.ver", "config.funcionarios"]} actor={{ rut: "22.222.222-2", rolId: 2 }} />);

        await screen.findByText("some@demo.local");
        const filaPropia = screen.getByText("some@demo.local").closest("tr") as HTMLElement;
        fireEvent.click(within(filaPropia).getByRole("button", { name: "Editar" }));

        expect(screen.getByText("No puedes cambiar tu propio rol, estado o centro")).toBeInTheDocument();
        expect(screen.getByLabelText("Rol")).toBeDisabled();
        expect(screen.getByLabelText("Centro")).toBeDisabled();
        expect(screen.getByLabelText("Estado")).toBeDisabled();
    });

    it("deshabilita roles no asignables al crear funcionario", async () => {
        render(<UsuariosRolesView permisos={["config.ver", "config.funcionarios"]} actor={{ rut: "22.222.222-2", rolId: 2 }} />);

        await screen.findByText("some@demo.local");
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        const rolSelect = screen.getByLabelText("Rol") as HTMLSelectElement;
        const adminOption = within(rolSelect).getByRole("option", { name: "Administrador (requiere mas permisos)" }) as HTMLOptionElement;
        const someOption = within(rolSelect).getByRole("option", { name: "SOME" }) as HTMLOptionElement;

        expect(adminOption).toBeDisabled();
        expect(someOption).not.toBeDisabled();
    });

    it("muestra toast y no recarga cuando guardarRol retorna ok false", async () => {
        (guardarRol as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "El nombre «Administrador» esta reservado" });
        render(<UsuariosRolesView permisos={["config.ver", "config.roles"]} actor={{ rut: "11.111.111-1", rolId: 2 }} />);

        await screen.findByText("Roles");
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
        fireEvent.change(screen.getByLabelText("Nombre rol"), { target: { value: "Administrador" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El nombre «Administrador» esta reservado"));
        expect(getMantenedoresConfig).toHaveBeenCalledTimes(1);
    });
});
