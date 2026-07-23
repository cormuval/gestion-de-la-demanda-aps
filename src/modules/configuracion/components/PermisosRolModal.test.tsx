import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/modules/configuracion/actions/mantenedores.action", () => ({
    guardarPermisosRol: vi.fn()
}));
vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() }
}));

import { PermisosRolModal, type RolConPermisos } from "./PermisosRolModal";
import { guardarPermisosRol } from "@/modules/configuracion/actions/mantenedores.action";
import { toast } from "sonner";

const rol: RolConPermisos = {
    id_rol: 3,
    nombre_rol: "Orientador",
    permisos: [{ permiso: "solicitudes.ver" }, { permiso: "comunicador.ver" }]
};

function renderModal(onClose = vi.fn(), onSaved = vi.fn()) {
    render(<PermisosRolModal rol={rol} onClose={onClose} onSaved={onSaved} />);
    return { onClose, onSaved };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("PermisosRolModal", () => {
    it("estado inicial: marca los permisos del rol y deja los demas desmarcados", () => {
        renderModal();

        const verSolicitudes = screen.getByLabelText("Ver solicitudes") as HTMLInputElement;
        const verCitas = screen.getByLabelText("Ver citas y llamados") as HTMLInputElement;
        const editarRoles = screen.getByLabelText("Editar roles y permisos") as HTMLInputElement;

        expect(verSolicitudes.checked).toBe(true);
        expect(verCitas.checked).toBe(true);
        expect(editarRoles.checked).toBe(false);
    });

    it("guardar la seleccion: desmarcar un permiso lo saca del array enviado y conserva los demas", async () => {
        (guardarPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        renderModal();

        fireEvent.click(screen.getByLabelText("Ver solicitudes"));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(guardarPermisosRol).toHaveBeenCalledTimes(1));

        const args = (guardarPermisosRol as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(args.rol_id).toBe(3);
        expect(args.permisos).not.toContain("solicitudes.ver");
        expect(args.permisos).toContain("comunicador.ver");
    });

    it("marcar un permiso nuevo: el array enviado incluye la clave recien marcada", async () => {
        (guardarPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        renderModal();

        fireEvent.click(screen.getByLabelText("Editar roles y permisos"));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(guardarPermisosRol).toHaveBeenCalledTimes(1));

        const args = (guardarPermisosRol as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(args.permisos).toContain("config.roles");
        expect(args.permisos).toContain("solicitudes.ver");
        expect(args.permisos).toContain("comunicador.ver");
    });

    it("exito: llama a toast.success y al callback onSaved", async () => {
        (guardarPermisosRol as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        const { onSaved } = renderModal();

        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Permisos actualizados"));
        expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("error: llama a toast.error con el mensaje, no invoca onSaved y el boton vuelve a decir Guardar", async () => {
        const mensaje = "No puedes quitar el permiso de editar roles a tu propio rol";
        (guardarPermisosRol as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(mensaje));
        const { onSaved } = renderModal();

        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(mensaje));
        expect(onSaved).not.toHaveBeenCalled();
        expect(await screen.findByRole("button", { name: "Guardar" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Guardando..." })).not.toBeInTheDocument();
    });

    it("cancelar: invoca onClose sin llamar a la action", () => {
        const { onClose } = renderModal();

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(guardarPermisosRol).not.toHaveBeenCalled();
    });
});
