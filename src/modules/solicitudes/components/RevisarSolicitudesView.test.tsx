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
vi.mock("@/shared/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
    DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <div role="group">{children}</div>,
    DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: (event: Event) => void }) => (
        <button type="button" role="menuitem" onClick={(event) => onSelect?.(event.nativeEvent)}>
            {children}
        </button>
    )
}));

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

async function openGestionMenu() {
    fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
    await screen.findByRole("menuitem", { name: /Realizar solicitud/i });
}

describe("RevisarSolicitudesView contexto de citas", () => {
    it("abre otras solicitudes y citas con acciones condicionales", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));

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
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));

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
                citas: [
                    {
                        id_cita: "CITA-RESUMEN-1",
                        profesional: "Medico resumen",
                        prestacion: "Consulta resumen",
                        fecha_estimada_atencion: new Date("2026-10-15T00:00:00")
                    }
                ]
            }
        } as unknown as Awaited<ReturnType<typeof gestionarSolicitud>>);

        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));

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
        expect(modalResumen.querySelector('table[class*="min-w-["]')).toBeNull();
        expect(within(modalResumen).getByText("Medico resumen")).toBeInTheDocument();
        expect(within(modalResumen).getByText("Consulta resumen")).toBeInTheDocument();
        expect(within(modalResumen).getByText("15-10-2026")).toBeInTheDocument();

        fireEvent.click(within(modalResumen).getAllByRole("button", { name: "Cerrar" })[0]);
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Resumen de gestion" })).not.toBeInTheDocument());
        expect(modalContexto).toBeInTheDocument();
        expect(botonRechazar).toHaveFocus();
    });
});

describe("RevisarSolicitudesView tabla compacta", () => {
    it("muestra una fila agrupando solicitud, paciente y tipo con motivo", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");

        expect(screen.getByRole("columnheader", { name: "Solicitud" })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "Paciente" })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "Tipo / Motivo" })).toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "RUT" })).not.toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "Nombre usuario" })).not.toBeInTheDocument();

        expect(screen.getByText("Juan Perez")).toBeInTheDocument();
        expect(screen.getByText("12345678-5")).toBeInTheDocument();
        expect(screen.getByText("Atencion")).toBeInTheDocument();
        expect(screen.getByText("Control")).toBeInTheDocument();
    });

    it("muestra Sin motivo cuando la solicitud no tiene motivo", async () => {
        vi.mocked(getSolicitudes).mockResolvedValueOnce({
            solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-3", motivo: null }],
            total: 1,
            page: 1,
            pageSize: 100,
            totalPages: 1
        } as Awaited<ReturnType<typeof getSolicitudes>>);

        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-3");
        expect(screen.getByText("Sin motivo")).toBeInTheDocument();
    });

    it("abre Gestionar como menu con las cuatro acciones", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        await openGestionMenu();

        expect(screen.getByRole("menuitem", { name: /Realizar solicitud/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Rechazar solicitud/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Otras solicitudes y citas" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Editar usuario/i })).toBeInTheDocument();
    });

    it("cada opcion de Gestionar abre su flujo principal", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Realizar solicitud/i }));
        expect(await screen.findByRole("dialog", { name: "Realizar solicitud" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Rechazar solicitud/i }));
        expect(await screen.findByRole("dialog", { name: "Rechazar solicitud" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));
        await waitFor(() => expect(getOtrasSolicitudes).toHaveBeenCalledWith("12345678-5", "SOL-1"));
        const modalContexto = await screen.findByRole("dialog", { name: "Solicitudes y citas en curso" });
        fireEvent.click(within(modalContexto).getByRole("button", { name: "Cerrar" }));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Solicitudes y citas en curso" })).not.toBeInTheDocument());

        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Editar usuario/i }));
        expect(await screen.findByRole("dialog", { name: /Editar usuario/i })).toBeInTheDocument();
    });
});
