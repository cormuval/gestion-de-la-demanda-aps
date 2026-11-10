import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/modules/solicitudes/actions/getRevisionCatalogos.action", () => ({
    getRevisionCatalogos: vi.fn()
}));
vi.mock("@/modules/solicitudes/actions/getSolicitudes.action", () => ({ getSolicitudes: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/gestionarSolicitud.action", () => ({ gestionarSolicitud: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/guardarUsuario.action", () => ({ actualizarUsuario: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getOtrasSolicitudes.action", () => ({ getOtrasSolicitudes: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/editarCita.action", () => ({ editarCita: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/verificarSolicitudPendiente.action", () => ({ verificarSolicitudPendiente: vi.fn() }));
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
import { getRevisionCatalogos } from "@/modules/solicitudes/actions/getRevisionCatalogos.action";
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
import { gestionarSolicitud } from "@/modules/solicitudes/actions/gestionarSolicitud.action";
import { actualizarUsuario } from "@/modules/solicitudes/actions/guardarUsuario.action";
import { verificarSolicitudPendiente } from "@/modules/solicitudes/actions/verificarSolicitudPendiente.action";
// types
import { ERROR_SOLICITUD_NO_PENDIENTE } from "@/modules/solicitudes/types/gestion";
// components
import { RevisarSolicitudesView } from "./RevisarSolicitudesView";
// lib
import { toast } from "sonner";

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
        nombre_social: "Social Perez",
        genero: "Masculino",
        gestante: "No aplica",
        discapacidad: "El usuario no poseé una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
        centro_id: "650"
    },
    tipoSolicitud: { nombre_tipo_solicitud: "Atencion" },
    motivo: { nombre_motivo: "Control" }
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRevisionCatalogos).mockResolvedValue({
        ok: true,
        data: { tiposSolicitud: [], motivos: [], profesionales: [], prestaciones: [], centros: [] }
    } as Awaited<ReturnType<typeof getRevisionCatalogos>>);
    vi.mocked(getSolicitudes).mockResolvedValue({
        ok: true,
        data: { solicitudes: [solicitudBase], total: 1, page: 1, pageSize: 100, totalPages: 1 }
    } as Awaited<ReturnType<typeof getSolicitudes>>);
    vi.mocked(getOtrasSolicitudes).mockResolvedValue({
        ok: true,
        data: {
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
        }
    } as Awaited<ReturnType<typeof getOtrasSolicitudes>>);
    vi.mocked(verificarSolicitudPendiente).mockResolvedValue({ ok: true, data: { pendiente: true, estado: "En Curso" } });
});

async function openGestionMenu() {
    fireEvent.click(screen.getByRole("button", { name: /Gestionar/i }));
    await screen.findByRole("menuitem", { name: /Realizar solicitud/i });
}


function abrirFiltros() {
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
}

describe("RevisarSolicitudesView contexto de citas", () => {
    it("identifica al paciente con sus nombres legal y social", async () => {
        render(<RevisarSolicitudesView />);
        expect(await screen.findByText("Juan Perez")).toBeVisible();
        expect(screen.getByText("Nombre social: Social Perez")).toBeVisible();
    });

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
            ok: true,
            data: { solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-2", accion: "En espera de validación" }], citas: [] }
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
            ok: true,
            data: { solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-2", accion: "En espera de validación" }], citas: [] }
        } as unknown as Awaited<ReturnType<typeof getOtrasSolicitudes>>);
        vi.mocked(gestionarSolicitud).mockResolvedValue({
            ok: true,
            data: {
                solicitud: { id_solicitud: "SOL-2" },
                citasCreadas: 0,
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

    it("refresca el contexto de Otras solicitudes si la verificacion encuentra un conflicto", async () => {
        vi.mocked(getOtrasSolicitudes).mockResolvedValue({
            ok: true,
            data: { solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-2", accion: "En espera de validación" }], citas: [] }
        } as unknown as Awaited<ReturnType<typeof getOtrasSolicitudes>>);
        vi.mocked(verificarSolicitudPendiente).mockResolvedValueOnce({ ok: true, data: { pendiente: false, estado: "Rechazado" } });

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));

        const modalContexto = await screen.findByRole("dialog", { name: "Solicitudes y citas en curso" });
        await waitFor(() => expect(getOtrasSolicitudes).toHaveBeenCalledTimes(1));
        fireEvent.click(within(modalContexto).getByRole("button", { name: "Realizar" }));

        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("Otro funcionario ya gestionó esta solicitud (Rechazado)"));
        expect(screen.queryByRole("dialog", { name: "Realizar solicitud" })).not.toBeInTheDocument();
        expect(modalContexto).toBeInTheDocument();
        await waitFor(() => expect(getOtrasSolicitudes).toHaveBeenCalledTimes(2));
    });

    it("refresca el contexto de Otras solicitudes si el guardado encuentra un conflicto", async () => {
        vi.mocked(getOtrasSolicitudes).mockResolvedValue({
            ok: true,
            data: { solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-2", accion: "En espera de validación" }], citas: [] }
        } as unknown as Awaited<ReturnType<typeof getOtrasSolicitudes>>);
        vi.mocked(gestionarSolicitud).mockResolvedValueOnce({ ok: false, error: ERROR_SOLICITUD_NO_PENDIENTE });

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));

        const modalContexto = await screen.findByRole("dialog", { name: "Solicitudes y citas en curso" });
        await waitFor(() => expect(getOtrasSolicitudes).toHaveBeenCalledTimes(1));
        fireEvent.click(within(modalContexto).getByRole("button", { name: "Rechazar" }));

        const modalRechazo = await screen.findByRole("dialog", { name: "Rechazar solicitud" });
        const razon = within(modalRechazo).getByRole("combobox") as HTMLSelectElement;
        fireEvent.change(razon, { target: { value: "Otra" } });
        fireEvent.submit(within(modalRechazo).getByRole("button", { name: "Confirmar rechazo" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(ERROR_SOLICITUD_NO_PENDIENTE));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Rechazar solicitud" })).not.toBeInTheDocument());
        expect(modalContexto).toBeInTheDocument();
        await waitFor(() => expect(getOtrasSolicitudes).toHaveBeenCalledTimes(2));
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
            ok: true,
            data: { solicitudes: [{ ...solicitudBase, id_solicitud: "SOL-3", motivo: null }], total: 1, page: 1, pageSize: 100, totalPages: 1 }
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

    it("muestra la descripcion de la solicitud al realizarla o rechazarla", async () => {
        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Realizar solicitud/i }));
        const realizar = await screen.findByRole("dialog", { name: "Realizar solicitud" });
        expect(within(realizar).getByText("Descripción: Base")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Rechazar solicitud/i }));
        const rechazar = await screen.findByRole("dialog", { name: "Rechazar solicitud" });
        expect(within(rechazar).getByText("Descripción: Base")).toBeInTheDocument();
    });
});

describe("RevisarSolicitudesView guardado de usuario", () => {
    it("mantiene abierto el formulario y no recarga cuando actualizar usuario retorna un error de negocio", async () => {
        vi.mocked(actualizarUsuario).mockResolvedValue({ ok: false, error: "Centro no encontrado" } as Awaited<ReturnType<typeof actualizarUsuario>>);

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Editar usuario/i }));

        const modal = await screen.findByRole("dialog", { name: "Editar usuario" });
        fireEvent.submit(within(modal).getByRole("button", { name: "Guardar usuario" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro no encontrado"));
        expect(screen.getByRole("dialog", { name: "Editar usuario" })).toBeInTheDocument();
        expect(within(modal).getByDisplayValue("Juan")).toBeInTheDocument();
        expect(toast.success).not.toHaveBeenCalled();
        expect(getSolicitudes).toHaveBeenCalledTimes(1);
    });
});

describe("RevisarSolicitudesView errores de acciones", () => {
    it("muestra el estado vacio solo cuando el listado responde con exito", async () => {
        vi.mocked(getSolicitudes).mockResolvedValueOnce({
            ok: true,
            data: { solicitudes: [], total: 0, page: 1, pageSize: 100, totalPages: 1 }
        });

        render(<RevisarSolicitudesView />);

        expect(await screen.findByText("No hay solicitudes en espera de validacion para los filtros actuales.")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("muestra el estado vacio del modal solo cuando el contexto responde con exito", async () => {
        vi.mocked(getOtrasSolicitudes).mockResolvedValueOnce({ ok: true, data: { solicitudes: [], citas: [] } });

        render(<RevisarSolicitudesView />);

        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));

        const modal = await screen.findByRole("dialog", { name: "Solicitudes y citas en curso" });
        expect(within(modal).getByText("No hay otras solicitudes ni citas en curso para este RUT en tu centro.")).toBeInTheDocument();
        expect(within(modal).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("oculta el detalle tecnico cuando falla el listado", async () => {
        vi.mocked(getSolicitudes).mockRejectedValueOnce(new Error("detalle sensible"));

        render(<RevisarSolicitudesView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al consultar solicitudes"));
        expect(toast.error).not.toHaveBeenCalledWith("detalle sensible");
        expect(screen.getByRole("alert")).toHaveTextContent("Error al consultar solicitudes");
        expect(screen.queryByText("No hay solicitudes en espera de validacion para los filtros actuales.")).not.toBeInTheDocument();
    });

    it("muestra un error persistente de catalogos y permite reintentar", async () => {
        vi.mocked(getRevisionCatalogos).mockResolvedValueOnce({ ok: false, error: "Centro sin catalogos" });

        render(<RevisarSolicitudesView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro sin catalogos"));
        expect(await screen.findByText("SOL-1")).toBeInTheDocument();
        abrirFiltros();
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        expect(within(panel).getByRole("alert")).toHaveTextContent("No fue posible cargar los catalogos");
        expect(within(panel).getByRole("alert")).toHaveTextContent("Centro sin catalogos");

        fireEvent.click(screen.getByRole("button", { name: "Reintentar catalogos" }));

        await waitFor(() => expect(getRevisionCatalogos).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByText("No fue posible cargar los catalogos")).not.toBeInTheDocument());
    });

    it("mantiene el formulario de filtros usable cuando fallan los catalogos", async () => {
        vi.mocked(getRevisionCatalogos).mockResolvedValueOnce({ ok: false, error: "Centro sin catalogos" });

        render(<RevisarSolicitudesView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro sin catalogos"));
        abrirFiltros();
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        expect(within(panel).getByRole("button", { name: /Aplicar filtros/i })).toBeEnabled();
        expect(within(panel).getByText("RUT")).toBeInTheDocument();
    });

    it("mantiene la tabla visible mientras se recarga el listado", async () => {
        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");

        let responder: (valor: Awaited<ReturnType<typeof getSolicitudes>>) => void = () => undefined;
        vi.mocked(getSolicitudes).mockReturnValueOnce(new Promise((resolve) => (responder = resolve)));
        abrirFiltros();
        fireEvent.click(await screen.findByRole("button", { name: /Aplicar filtros/i }));

        await waitFor(() => expect(screen.getByText("SOL-1").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true"));
        expect(screen.queryByText("Consultando solicitudes...")).not.toBeInTheDocument();

        responder({ ok: true, data: { solicitudes: [], total: 0, page: 1, pageSize: 100, totalPages: 1 } });
        expect(await screen.findByText("No hay solicitudes en espera de validacion para los filtros actuales.")).toBeInTheDocument();
    });

    it("conserva la tabla y muestra el error cuando una recarga falla", async () => {
        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");

        vi.mocked(getSolicitudes).mockResolvedValueOnce({ ok: false, error: "No se pudo listar" });
        abrirFiltros();
        fireEvent.click(await screen.findByRole("button", { name: /Aplicar filtros/i }));

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se pudo listar"));
        expect(screen.getByText("SOL-1")).toBeInTheDocument();
    });

    it("muestra un error persistente del listado, nunca el vacio, y permite reintentar", async () => {
        vi.mocked(getSolicitudes).mockResolvedValueOnce({ ok: false, error: "No se pudo listar" });

        render(<RevisarSolicitudesView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo listar"));
        expect(screen.getByRole("alert")).toHaveTextContent("No fue posible cargar las solicitudes");
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudo listar");
        expect(screen.queryByText("No hay solicitudes en espera de validacion para los filtros actuales.")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Reintentar solicitudes" }));

        expect(await screen.findByText("SOL-1")).toBeInTheDocument();
        expect(getSolicitudes).toHaveBeenCalledTimes(2);
    });

    it("muestra el error de relacionadas en el modal, nunca el vacio, y permite reintentar", async () => {
        vi.mocked(getOtrasSolicitudes).mockResolvedValueOnce({ ok: false, error: "No se pudo cargar el contexto" });

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Otras solicitudes/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo cargar el contexto"));
        const modal = screen.getByRole("dialog", { name: "Solicitudes y citas en curso" });
        expect(within(modal).getByRole("alert")).toHaveTextContent("No se pudo cargar el contexto");
        expect(within(modal).queryByText("No hay otras solicitudes ni citas en curso para este RUT en tu centro.")).not.toBeInTheDocument();
        expect(getSolicitudes).toHaveBeenCalledTimes(1);

        fireEvent.click(within(modal).getByRole("button", { name: "Reintentar contexto" }));

        expect(await within(modal).findByText("CITA-1")).toBeInTheDocument();
        expect(getOtrasSolicitudes).toHaveBeenCalledTimes(2);
    });

    it("mantiene el formulario de rechazo y no recarga cuando la gestion retorna error", async () => {
        vi.mocked(gestionarSolicitud).mockResolvedValueOnce({ ok: false, error: "Solicitud ya gestionada" });

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Rechazar solicitud/i }));
        const modal = await screen.findByRole("dialog", { name: "Rechazar solicitud" });
        const razon = within(modal).getByRole("combobox") as HTMLSelectElement;
        fireEvent.change(razon, { target: { value: "Otra" } });
        fireEvent.submit(within(modal).getByRole("button", { name: "Confirmar rechazo" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Solicitud ya gestionada"));
        expect(screen.getByRole("dialog", { name: "Rechazar solicitud" })).toBeInTheDocument();
        expect(razon).toHaveValue("Otra");
        expect(toast.success).not.toHaveBeenCalled();
        expect(getSolicitudes).toHaveBeenCalledTimes(1);
    });

    it("mantiene el formulario de realizacion y no recarga cuando la gestion retorna error", async () => {
        vi.mocked(gestionarSolicitud).mockResolvedValueOnce({ ok: false, error: "Fecha fuera de rango" });
        const fecha = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Realizar solicitud/i }));
        const modal = await screen.findByRole("dialog", { name: "Realizar solicitud" });
        const fechaInput = modal.querySelector('input[type="date"]') as HTMLInputElement;
        const selects = within(modal).getAllByRole("combobox") as HTMLSelectElement[];
        fireEvent.change(fechaInput, { target: { value: fecha } });
        fireEvent.change(selects[1], { target: { value: "Media" } });
        fireEvent.submit(within(modal).getByRole("button", { name: "Guardar gestion" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Fecha fuera de rango"));
        expect(screen.getByRole("dialog", { name: "Realizar solicitud" })).toBeInTheDocument();
        expect(fechaInput).toHaveValue(fecha);
        expect(selects[1]).toHaveValue("Media");
        expect(toast.success).not.toHaveBeenCalled();
        expect(getSolicitudes).toHaveBeenCalledTimes(1);
    });
});

type RespuestaSolicitudes = Awaited<ReturnType<typeof getSolicitudes>>;

function respuestaCon(idSolicitud: string): RespuestaSolicitudes {
    return {
        ok: true,
        data: { solicitudes: [{ ...solicitudBase, id_solicitud: idSolicitud }], total: 1, page: 1, pageSize: 100, totalPages: 1 }
    } as RespuestaSolicitudes;
}

describe("RevisarSolicitudesView verificacion antes de gestionar", () => {
    it("no abre Realizar si otro funcionario ya la gestiono", async () => {
        vi.mocked(verificarSolicitudPendiente).mockResolvedValueOnce({ ok: true, data: { pendiente: false, estado: "Rechazado" } });

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Realizar solicitud/i }));

        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("Otro funcionario ya gestionó esta solicitud (Rechazado)"));
        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(2));
        expect(verificarSolicitudPendiente).toHaveBeenCalledWith("SOL-1");
        expect(screen.queryByRole("dialog", { name: "Realizar solicitud" })).not.toBeInTheDocument();
    });

    it("avisa cuando ya no esta disponible en el centro", async () => {
        vi.mocked(verificarSolicitudPendiente).mockResolvedValueOnce({ ok: true, data: { pendiente: false, estado: null } });

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Rechazar solicitud/i }));

        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("Esta solicitud ya no está disponible en tu centro"));
        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole("dialog", { name: "Rechazar solicitud" })).not.toBeInTheDocument();
    });

    it.each([
        ["ok: false", () => vi.mocked(verificarSolicitudPendiente).mockResolvedValueOnce({ ok: false, error: "x" })],
        ["un rechazo", () => vi.mocked(verificarSolicitudPendiente).mockRejectedValueOnce(new Error("red"))]
    ])("abre igual si la verificacion falla (%s)", async (_caso, preparar) => {
        preparar();

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Realizar solicitud/i }));

        expect(await screen.findByRole("dialog", { name: "Realizar solicitud" })).toBeInTheDocument();
        expect(toast.warning).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
        expect(getSolicitudes).toHaveBeenCalledTimes(1);
    });

    it("ignora una segunda pulsacion mientras verifica", async () => {
        let responder: (valor: Awaited<ReturnType<typeof verificarSolicitudPendiente>>) => void = () => undefined;
        vi.mocked(verificarSolicitudPendiente).mockReturnValueOnce(new Promise((resolve) => (responder = resolve)));

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        const rechazar = screen.getByRole("menuitem", { name: /Rechazar solicitud/i });
        fireEvent.click(rechazar);
        fireEvent.click(rechazar);

        expect(verificarSolicitudPendiente).toHaveBeenCalledTimes(1);

        await act(async () => responder({ ok: true, data: { pendiente: true, estado: "En Curso" } }));
        expect(await screen.findAllByRole("dialog", { name: "Rechazar solicitud" })).toHaveLength(1);
        expect(verificarSolicitudPendiente).toHaveBeenCalledTimes(1);

        // Tras la verificacion se libera el bloqueo.
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        fireEvent.click(rechazar);
        await waitFor(() => expect(verificarSolicitudPendiente).toHaveBeenCalledTimes(2));
    });

    it("recarga con los filtros aplicados al responder la verificacion", async () => {
        let responder: (valor: Awaited<ReturnType<typeof verificarSolicitudPendiente>>) => void = () => undefined;
        vi.mocked(verificarSolicitudPendiente).mockReturnValueOnce(new Promise((resolve) => (responder = resolve)));

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Realizar solicitud/i }));

        abrirFiltros();
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getAllByRole("textbox")[0], { target: { value: "99999999-9" } });
        fireEvent.click(within(panel).getByRole("button", { name: /Aplicar filtros/i }));
        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.getByText("SOL-1").closest("[aria-busy]")).toHaveAttribute("aria-busy", "false"));

        await act(async () => responder({ ok: true, data: { pendiente: false, estado: "Rechazado" } }));

        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(3));
        expect(vi.mocked(getSolicitudes).mock.calls[2][0]).toMatchObject({ rut: "99999999-9" });
    });

    it("cierra el modal y recarga si al guardar otro se adelanto", async () => {
        vi.mocked(gestionarSolicitud).mockResolvedValueOnce({ ok: false, error: ERROR_SOLICITUD_NO_PENDIENTE });

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Rechazar solicitud/i }));
        const modal = await screen.findByRole("dialog", { name: "Rechazar solicitud" });
        const razon = within(modal).getByRole("combobox") as HTMLSelectElement;
        fireEvent.change(razon, { target: { value: "Otra" } });
        fireEvent.submit(within(modal).getByRole("button", { name: "Confirmar rechazo" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(ERROR_SOLICITUD_NO_PENDIENTE));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Rechazar solicitud" })).not.toBeInTheDocument());
        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(2));
        expect(toast.success).not.toHaveBeenCalled();
    });

    it("cierra Realizar y recarga si al guardar otro se adelanto", async () => {
        vi.mocked(gestionarSolicitud).mockResolvedValueOnce({ ok: false, error: ERROR_SOLICITUD_NO_PENDIENTE });
        const fecha = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: /Realizar solicitud/i }));
        const modal = await screen.findByRole("dialog", { name: "Realizar solicitud" });
        const selects = within(modal).getAllByRole("combobox") as HTMLSelectElement[];
        fireEvent.change(modal.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: fecha } });
        fireEvent.change(selects[1], { target: { value: "Media" } });
        fireEvent.submit(within(modal).getByRole("button", { name: "Guardar gestion" }).closest("form")!);

        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Realizar solicitud" })).not.toBeInTheDocument());
        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(2));
    });
});

describe("RevisarSolicitudesView refresco automatico", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    });

    afterEach(() => {
        vi.useRealTimers();
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    });

    async function avanzar(ms: number) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(ms);
        });
    }

    it("refresca en silencio cada 60 s sin mostrar errores", async () => {
        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");

        abrirFiltros();
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getAllByRole("textbox")[0], { target: { value: "12345678-5" } });
        fireEvent.click(within(panel).getByRole("button", { name: /Aplicar filtros/i }));
        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument());
        const filtrosAplicados = vi.mocked(getSolicitudes).mock.calls[1][0];
        expect(filtrosAplicados).toMatchObject({ rut: "12345678-5" });

        vi.mocked(getSolicitudes).mockClear();
        vi.mocked(getSolicitudes).mockResolvedValueOnce({ ok: false, error: "Fallo silencioso" });
        await avanzar(60_000);

        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(1));
        expect(getSolicitudes).toHaveBeenCalledWith(filtrosAplicados);
        expect(toast.error).not.toHaveBeenCalled();
        expect(screen.getByText("SOL-1")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByText("SOL-1").closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");

        vi.mocked(getSolicitudes).mockResolvedValueOnce(respuestaCon("SOL-9"));
        await avanzar(60_000);
        expect(await screen.findByText("SOL-9")).toBeInTheDocument();
    });

    it.each([
        ["rechazo", "Rechazar solicitud", "Rechazar solicitud"],
        ["otras solicitudes", "Otras solicitudes y citas", "Solicitudes y citas en curso"],
        ["editar usuario", "Editar usuario", "Editar usuario"]
    ])("no refresca con el modal de %s abierto", async (_nombre, menuItem, dialogo) => {
        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");
        await openGestionMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: menuItem }));
        await screen.findByRole("dialog", { name: dialogo });

        await avanzar(60_000 * 3);
        expect(getSolicitudes).toHaveBeenCalledTimes(1);
    });

    it("no adelanta una carga normal en curso con una recarga silenciosa", async () => {
        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");

        let responderNormal: (valor: RespuestaSolicitudes) => void = () => undefined;
        vi.mocked(getSolicitudes).mockReturnValueOnce(new Promise((resolve) => (responderNormal = resolve)));
        abrirFiltros();
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getAllByRole("textbox")[0], { target: { value: "99999999-9" } });
        fireEvent.click(within(panel).getByRole("button", { name: /Aplicar filtros/i }));
        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument());

        // La recarga silenciosa no parte mientras la carga normal esta pendiente.
        await avanzar(60_000);
        expect(getSolicitudes).toHaveBeenCalledTimes(2);
        await act(async () => responderNormal(respuestaCon("SOL-NUEVA")));

        expect(await screen.findByText("SOL-NUEVA")).toBeInTheDocument();
        expect(screen.getByText("SOL-NUEVA").closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");

        // La siguiente recarga silenciosa usa los filtros nuevos.
        await avanzar(60_000);
        await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(3));
        expect(vi.mocked(getSolicitudes).mock.calls[2][0]).toMatchObject({ rut: "99999999-9" });
    });

    it.each(["silenciosa primero", "normal primero"])(
        "una carga normal iniciada durante una silenciosa gana y apaga la carga (%s)",
        async (orden) => {
            render(<RevisarSolicitudesView />);
            await screen.findByText("SOL-1");

            let responderSilenciosa: (valor: RespuestaSolicitudes) => void = () => undefined;
            vi.mocked(getSolicitudes).mockReturnValueOnce(new Promise((resolve) => (responderSilenciosa = resolve)));
            await avanzar(60_000);
            expect(getSolicitudes).toHaveBeenCalledTimes(2);

            let responderNormal: (valor: RespuestaSolicitudes) => void = () => undefined;
            vi.mocked(getSolicitudes).mockReturnValueOnce(new Promise((resolve) => (responderNormal = resolve)));
            abrirFiltros();
            fireEvent.click(await screen.findByRole("button", { name: /Aplicar filtros/i }));
            await waitFor(() => expect(getSolicitudes).toHaveBeenCalledTimes(3));

            if (orden === "silenciosa primero") {
                await act(async () => responderSilenciosa(respuestaCon("SOL-VIEJA")));
                await act(async () => responderNormal(respuestaCon("SOL-NUEVA")));
            } else {
                await act(async () => responderNormal(respuestaCon("SOL-NUEVA")));
                await act(async () => responderSilenciosa(respuestaCon("SOL-VIEJA")));
            }

            expect(await screen.findByText("SOL-NUEVA")).toBeInTheDocument();
            expect(screen.queryByText("SOL-VIEJA")).not.toBeInTheDocument();
            expect(screen.getByText("SOL-NUEVA").closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");
        }
    );

    it("descarta una recarga silenciosa obsoleta", async () => {
        render(<RevisarSolicitudesView />);
        await screen.findByText("SOL-1");

        let responderSilenciosa: (valor: RespuestaSolicitudes) => void = () => undefined;
        vi.mocked(getSolicitudes).mockReturnValueOnce(new Promise((resolve) => (responderSilenciosa = resolve)));
        await avanzar(60_000);
        expect(getSolicitudes).toHaveBeenCalledTimes(2);

        vi.mocked(getSolicitudes).mockResolvedValueOnce(respuestaCon("SOL-NUEVA"));
        abrirFiltros();
        fireEvent.click(await screen.findByRole("button", { name: /Aplicar filtros/i }));
        expect(await screen.findByText("SOL-NUEVA")).toBeInTheDocument();

        await act(async () => responderSilenciosa(respuestaCon("SOL-VIEJA")));
        expect(screen.queryByText("SOL-VIEJA")).not.toBeInTheDocument();
        expect(screen.getByText("SOL-NUEVA")).toBeInTheDocument();
    });
});
