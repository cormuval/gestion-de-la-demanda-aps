import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/modules/solicitudes/actions/getRevisionCatalogos.action", () => ({
    getRevisionCatalogos: vi.fn().mockResolvedValue({ tiposSolicitud: [], motivos: [], profesionales: [], prestaciones: [], centros: [] })
}));
vi.mock("@/modules/solicitudes/actions/getSolicitudes.action", () => ({ getSolicitudes: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/gestionarSolicitud.action", () => ({ gestionarSolicitud: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/guardarUsuario.action", () => ({ actualizarUsuario: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getOtrasSolicitudes.action", () => ({ getOtrasSolicitudes: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/editarCita.action", () => ({ editarCita: vi.fn() }));

// actions
import { getOtrasSolicitudes } from "@/modules/solicitudes/actions/getOtrasSolicitudes.action";
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
import { gestionarSolicitud } from "@/modules/solicitudes/actions/gestionarSolicitud.action";
// components
import { RevisarSolicitudesView } from "./RevisarSolicitudesView";

const solicitudBase = {
    id_solicitud: "SOL-1",
    fecha_inicio: new Date("2026-09-01T00:00:00"),
    rut_usuario: "12345678-5",
    descripcion: "Base",
    estado_solicitud: "En Curso",
    accion: "En espera de validación",
    priorizacion_admin: 10,
    usuario: {
        rut: "12345678-5",
        nombre: "Juan",
        apellido: "Perez",
        genero: "Masculino",
        gestante: "No aplica",
        discapacidad: "No",
        centro_id: "650"
    },
    tipoSolicitud: { nombre_tipo_solicitud: "Atencion" },
    motivo: { nombre_motivo: "Control" }
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSolicitudes).mockResolvedValue({
        solicitudes: [solicitudBase],
        total: 1,
        page: 1,
        pageSize: 100,
        totalPages: 1
    } as Awaited<ReturnType<typeof getSolicitudes>>);
    vi.mocked(getOtrasSolicitudes).mockResolvedValue({
        solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-2", accion: "Realizar solicitud" }],
        citas: [
            {
                id_cita: "CITA-1",
                solicitud_id: "SOL-2",
                estado_cita: "Sin llamadas",
                observacion: null,
                priorizacion_clinica: "Alta",
                fecha_estimada_atencion: new Date("2026-10-01T00:00:00"),
                profesional: { nombre: "Medico" },
                prestacion: { nombre_prestacion: "Consulta" },
                editable: true
            }
        ]
    } as Awaited<ReturnType<typeof getOtrasSolicitudes>>);
});

describe("RevisarSolicitudesView contexto de citas", () => {
    it("abre otras solicitudes y citas con acciones condicionales", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
        fireEvent.click(screen.getByRole("button", { name: /Otras solicitudes y citas/i }));

        await waitFor(() => expect(getOtrasSolicitudes).toHaveBeenCalledWith("12345678-5", "SOL-1"));
        expect(screen.getByText("Solicitudes y citas en curso")).toBeInTheDocument();
        expect(screen.getByText("CITA-1")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Editar$/i })).toBeInTheDocument();
        expect(screen.getByText("Validada")).toBeInTheDocument();
    });

    it.each([
        ["Realizar", "Realizar solicitud"],
        ["Rechazar", "Rechazar solicitud"],
        ["Usuario", "Editar usuario"]
    ])("abre %s sobre el modal de contexto y restaura el foco al cerrar", async (accion, titulo) => {
        vi.mocked(getOtrasSolicitudes).mockResolvedValue({
            solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-2", accion: "En espera de validación" }],
            citas: []
        } as unknown as Awaited<ReturnType<typeof getOtrasSolicitudes>>);

        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
        fireEvent.click(screen.getByRole("button", { name: /Otras solicitudes y citas/i }));

        const modalContexto = await screen.findByRole("dialog", { name: "Solicitudes y citas en curso" });
        const botonAccion = within(modalContexto).getByRole("button", { name: accion });
        botonAccion.focus();
        fireEvent.click(botonAccion);

        const modalAccion = await screen.findByRole("dialog", { name: titulo });
        expect(modalContexto).toBeInTheDocument();
        expect(modalAccion).toHaveClass("z-[70]");
        expect(Array.from(document.querySelectorAll("[data-state='open']")).some((element) => element.classList.contains("z-[60]"))).toBe(true);

        fireEvent.click(within(modalAccion).getByRole("button", { name: "Cerrar" }));

        await waitFor(() => expect(screen.queryByRole("dialog", { name: titulo })).not.toBeInTheDocument());
        expect(modalContexto).toBeInTheDocument();
        expect(botonAccion).toHaveFocus();
    });

    it("mantiene el resumen de una gestión exitosa sobre el modal de contexto", async () => {
        vi.mocked(getOtrasSolicitudes).mockResolvedValue({
            solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-2", accion: "En espera de validación" }],
            citas: []
        } as unknown as Awaited<ReturnType<typeof getOtrasSolicitudes>>);
        vi.mocked(gestionarSolicitud).mockResolvedValue({
            resumen: {
                id_solicitud: "SOL-2",
                rut_usuario: "12345678-5",
                accion: "Rechazar solicitud",
                razon_rechazo: "Otro",
                observacion_rechazo: "Sin cupos",
                citas: []
            }
        } as unknown as Awaited<ReturnType<typeof gestionarSolicitud>>);

        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
        fireEvent.click(screen.getByRole("button", { name: /Otras solicitudes y citas/i }));

        const modalContexto = await screen.findByRole("dialog", { name: "Solicitudes y citas en curso" });
        const botonRechazar = within(modalContexto).getByRole("button", { name: "Rechazar" });
        botonRechazar.focus();
        fireEvent.click(botonRechazar);

        const modalRechazo = await screen.findByRole("dialog", { name: "Rechazar solicitud" });
        const razon = within(modalRechazo).getByRole("combobox") as HTMLSelectElement;
        fireEvent.change(razon, { target: { value: razon.options[1].value } });
        fireEvent.click(within(modalRechazo).getByRole("button", { name: "Confirmar rechazo" }));

        const modalResumen = await screen.findByRole("dialog", { name: "Resumen de gestion" });
        expect(modalContexto).toBeInTheDocument();
        expect(modalResumen).toHaveClass("z-[70]");

        fireEvent.click(within(modalResumen).getAllByRole("button", { name: "Cerrar" })[0]);
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Resumen de gestion" })).not.toBeInTheDocument());
        expect(modalContexto).toBeInTheDocument();
        expect(botonRechazar).toHaveFocus();
    });
});
