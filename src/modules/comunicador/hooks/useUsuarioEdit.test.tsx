import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../actions/actualizarUsuarioComunicador.action", () => ({ actualizarUsuarioComunicador: vi.fn() }));
vi.mock("../actions/getUsuarioParaEdicion.action", () => ({ getUsuarioParaEdicion: vi.fn() }));

// actions
import { actualizarUsuarioComunicador } from "../actions/actualizarUsuarioComunicador.action";
import { getUsuarioParaEdicion } from "../actions/getUsuarioParaEdicion.action";
// hooks
import { useUsuarioEdit } from "./useUsuarioEdit";
// lib
import { toast } from "sonner";

const usuarioEditable = {
    rut: "12345678-5",
    nombre: "Paciente",
    apellido: "Demo",
    nombre_social: null,
    correo_contacto: "paciente@demo.local",
    sector: "1",
    genero: "Masculino",
    fecha_nacimiento: new Date("1990-01-01T00:00:00"),
    telefono: "+56911111111",
    telefono_alternativo: "+56922222222",
    gestante: "No aplica",
    discapacidad: "El usuario no poseé una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
    centro_id: "650",
    priorizacion_administrativa: null
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUsuarioParaEdicion).mockResolvedValue({ ok: true, data: { usuario: usuarioEditable } } as Awaited<ReturnType<typeof getUsuarioParaEdicion>>);
});

describe("useUsuarioEdit", () => {
    it("oculta el detalle tecnico cuando falla la carga del paciente", async () => {
        vi.mocked(getUsuarioParaEdicion).mockRejectedValue(new Error("detalle sensible"));
        const { result } = renderHook(() => useUsuarioEdit());

        await act(async () => {
            await result.current.abrir("12.345.678-5");
        });

        expect(toast.error).toHaveBeenCalledWith("Error al cargar el paciente");
        expect(toast.error).not.toHaveBeenCalledWith("detalle sensible");
        expect(result.current.open).toBe(false);
    });

    it("no abre el formulario cuando la lectura retorna un error de negocio", async () => {
        vi.mocked(getUsuarioParaEdicion).mockResolvedValue({ ok: false, error: "RUT invalido" } as Awaited<ReturnType<typeof getUsuarioParaEdicion>>);
        const { result } = renderHook(() => useUsuarioEdit());

        await act(async () => {
            await result.current.abrir("12.345.678-9");
        });

        expect(toast.error).toHaveBeenCalledWith("RUT invalido");
        expect(result.current.open).toBe(false);
    });

    it("mantiene abierto el formulario y no ejecuta callback cuando actualizar retorna un error de negocio", async () => {
        const onActualizado = vi.fn();
        vi.mocked(actualizarUsuarioComunicador).mockResolvedValue({ ok: false, error: "Centro no encontrado" } as Awaited<ReturnType<typeof actualizarUsuarioComunicador>>);
        const { result } = renderHook(() => useUsuarioEdit(onActualizado));

        await act(async () => {
            await result.current.abrir("12.345.678-5");
        });

        expect(getUsuarioParaEdicion).toHaveBeenCalledWith("12.345.678-5");
        expect(result.current.open).toBe(true);
        expect(result.current.form.nombre).toBe("Paciente");

        await act(async () => {
            await result.current.onSubmit({ preventDefault: vi.fn() } as any);
        });

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro no encontrado"));
        expect(result.current.open).toBe(true);
        expect(result.current.form.nombre).toBe("Paciente");
        expect(onActualizado).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });
});
