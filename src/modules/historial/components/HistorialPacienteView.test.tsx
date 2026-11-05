import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions/getHistorialPaciente.action", () => ({ getHistorialPaciente: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getVoucherSolicitud.action", () => ({ getVoucherSolicitud: vi.fn() }));

import { getHistorialPaciente } from "../actions/getHistorialPaciente.action";
import { getVoucherSolicitud } from "@/modules/solicitudes/actions/getVoucherSolicitud.action";
import type { VoucherSolicitud } from "@/modules/solicitudes/types/voucher";
import { toast } from "sonner";
import type { HistorialPaciente } from "../types/historial";
import { HistorialPacienteView } from "./HistorialPacienteView";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHistorialPaciente).mockReset();
    vi.mocked(getVoucherSolicitud).mockReset();
});

function escribirRut(valor: string) {
    fireEvent.change(screen.getByLabelText("RUT"), { target: { value: valor } });
}

function buscar() {
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

function obtenerVoucherVisible(): HTMLElement {
    return screen.getByText("Voucher de solicitud").closest(".fixed") as HTMLElement;
}

const SOLICITUD_EN_CURSO = {
    id_solicitud: "SOL-1",
    fecha_inicio: new Date("2026-01-10T12:00:00Z"),
    tipo: "Tipo A",
    motivo: "Motivo A",
    descripcion: "Descripcion A",
    estado_solicitud: "En Curso",
    accion: null,
    razon_rechazo: null,
    fecha_cierre: null,
    orientador: "Orientador Uno",
    gestor: "Gestor Uno",
    citas: []
};

const SOLICITUD_REALIZADA = {
    id_solicitud: "SOL-2",
    fecha_inicio: new Date("2026-01-05T12:00:00Z"),
    tipo: "Tipo B",
    motivo: "Motivo B",
    descripcion: "Descripcion B",
    estado_solicitud: "Realizado",
    accion: null,
    razon_rechazo: null,
    fecha_cierre: new Date("2026-01-20T12:00:00Z"),
    orientador: "Orientador Dos",
    gestor: "Gestor Dos",
    citas: [
        {
            id_cita: "CITA-1",
            estamento: "Medicina",
            prestacion: "Consulta",
            estado_cita: "Cita Aceptada",
            cerrada: true,
            fecha_cierre: new Date("2026-01-20T12:00:00Z"),
            fecha_estimada_atencion: null,
            observacion: null,
            llamadas: [
                {
                    id_llamada: "LLAM-1",
                    fecha_llamada: new Date("2026-01-19T15:30:00Z"),
                    respuesta_usuario: "Cita Aceptada",
                    comunicador: "Comunicador Uno",
                    observacion: "Observacion de la llamada 1",
                    hora_agendada: null
                },
                {
                    id_llamada: "LLAM-2",
                    fecha_llamada: new Date("2026-01-18T15:30:00Z"),
                    respuesta_usuario: "No contesta",
                    comunicador: "Comunicador Dos",
                    observacion: "Observacion de la llamada 2",
                    hora_agendada: null
                }
            ]
        },
        {
            id_cita: "CITA-2",
            estamento: "Kinesiologia",
            prestacion: "Control",
            estado_cita: "Cita Aceptada",
            cerrada: true,
            fecha_cierre: null,
            fecha_estimada_atencion: null,
            observacion: null,
            llamadas: []
        }
    ]
};

const SOLICITUD_RECHAZADA = {
    id_solicitud: "SOL-3",
    fecha_inicio: new Date("2026-01-01T12:00:00Z"),
    tipo: "Tipo C",
    motivo: "Motivo C",
    descripcion: "Descripcion C",
    estado_solicitud: "Rechazado",
    accion: null,
    razon_rechazo: "No cumple criterios",
    fecha_cierre: new Date("2026-01-03T12:00:00Z"),
    orientador: "Orientador Tres",
    gestor: "Gestor Tres",
    citas: []
};

const SOLICITUD_EN_CURSO_DOS = {
    ...SOLICITUD_EN_CURSO,
    id_solicitud: "SOL-4",
    tipo: "Tipo D",
    motivo: "Motivo D"
};

const HISTORIAL_COMPLETO: HistorialPaciente = {
    paciente: { rut: "12345678-5", nombre: "Juana Perez" },
    solicitudes: [SOLICITUD_EN_CURSO, SOLICITUD_REALIZADA, SOLICITUD_RECHAZADA]
};

const HISTORIAL_CON_DOS_SOLICITUDES_EN_CURSO: HistorialPaciente = {
    paciente: { rut: "12345678-5", nombre: "Juana Perez" },
    solicitudes: [SOLICITUD_EN_CURSO, SOLICITUD_EN_CURSO_DOS]
};

const VOUCHER_EN_CURSO: VoucherSolicitud = {
    id_solicitud: "SOL-1",
    fecha_inicio: new Date("2026-01-10T12:00:00Z"),
    rut: "12345678-5",
    usuario: {
        rut: "12345678-5",
        nombre: "Juana",
        apellido: "Perez",
        nombre_social: null,
        telefono: "912345678",
        telefono_alternativo: null
    },
    tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Tipo A" },
    motivo: { id_motivo: 1, nombre_motivo: "Motivo A" },
    centro: "CESFAM Esperanza",
    disponibilidad_llamada: null
};

describe("HistorialPacienteView", () => {
    it("busca por RUT y muestra paciente y resumen", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();

        await waitFor(() => expect(getHistorialPaciente).toHaveBeenCalledWith("12345678-5"));
        expect(await screen.findByText("Juana Perez")).toBeInTheDocument();
        expect(screen.getByText("3 solicitudes · 1 en curso · 1 realizadas · 1 rechazadas")).toBeInTheDocument();
    });

    it("muestra estado, fecha de cierre y razon de rechazo", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();

        await screen.findByText("Juana Perez");

        // La solicitud Rechazada (SOL-3) muestra su propia razon de rechazo y su propia fecha
        // de cierre (fecha_validacion = 2026-01-03), dentro de su propia tarjeta: no basta con que
        // esa fecha exista en algun lugar de la pantalla (la Realizada tambien tiene una fecha de
        // cierre, 2026-01-20).
        const tarjetaRechazada = screen.getByTestId("solicitud-SOL-3");
        expect(within(tarjetaRechazada).getByText("No cumple criterios")).toBeInTheDocument();
        expect(within(tarjetaRechazada).getByText("Rechazado")).toBeInTheDocument();
        expect(within(tarjetaRechazada).getByText("03-01-2026")).toBeInTheDocument();

        // La cita CITA-2 (dentro de SOL-2) esta cerrada pero sin llamadas: su fecha de cierre
        // es "—", especificamente dentro de su propia tarjeta (a diferencia de CITA-1, en la
        // misma solicitud, que si tiene fecha de cierre).
        const tarjetaCita2 = screen.getByTestId("cita-CITA-2");
        expect(within(tarjetaCita2).getByText("—")).toBeInTheDocument();
    });

    it("despliega las llamadas de una cita", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();

        const botonLlamadas = await screen.findByRole("button", { name: "Ver llamadas (2)" });
        expect(botonLlamadas).toHaveAttribute("aria-expanded", "false");
        const idLlamadas = botonLlamadas.getAttribute("aria-controls");
        expect(idLlamadas).toBeTruthy();

        fireEvent.click(botonLlamadas);

        expect(botonLlamadas).toHaveAttribute("aria-expanded", "true");
        const listaLlamadas = document.getElementById(idLlamadas as string) as HTMLElement;
        expect(listaLlamadas).not.toBeNull();

        expect(within(listaLlamadas).getByText("Cita Aceptada")).toBeInTheDocument();
        expect(within(listaLlamadas).getByText("No contesta")).toBeInTheDocument();
        expect(within(listaLlamadas).getByText("Comunicador: Comunicador Uno")).toBeInTheDocument();
        expect(within(listaLlamadas).getByText("Observacion de la llamada 1")).toBeInTheDocument();
        expect(within(listaLlamadas).getByText("Comunicador: Comunicador Dos")).toBeInTheDocument();
        expect(within(listaLlamadas).getByText("Observacion de la llamada 2")).toBeInTheDocument();
    });

    it("muestra el vacio solo con exito", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: { paciente: null, solicitudes: [] } });

        render(<HistorialPacienteView />);
        escribirRut("11111111-1");
        buscar();

        expect(await screen.findByText("Sin solicitudes en tu centro para este RUT")).toBeInTheDocument();
    });

    it("muestra el error de negocio", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: false, error: "RUT invalido" });

        render(<HistorialPacienteView />);
        escribirRut("abc");
        buscar();

        expect(await screen.findByText("RUT invalido")).toBeInTheDocument();
    });

    it("muestra un error generico ante una excepcion", async () => {
        vi.mocked(getHistorialPaciente).mockRejectedValue(new Error("detalle sensible de la base de datos"));

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();

        expect(await screen.findByText("No fue posible cargar el historial")).toBeInTheDocument();
        expect(screen.queryByText("detalle sensible de la base de datos")).not.toBeInTheDocument();
    });

    it("no conserva el paciente anterior tras una busqueda fallida", async () => {
        vi.mocked(getHistorialPaciente)
            .mockResolvedValueOnce({ ok: true, data: HISTORIAL_COMPLETO })
            .mockResolvedValueOnce({ ok: false, error: "RUT invalido" });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");

        escribirRut("abc");
        buscar();

        await screen.findByText("RUT invalido");
        expect(screen.queryByText("Juana Perez")).not.toBeInTheDocument();
    });

    it("ignora la respuesta de una busqueda anterior si llega despues de una mas reciente", async () => {
        const pacienteA: HistorialPaciente = {
            paciente: { rut: "11111111-1", nombre: "Paciente A" },
            solicitudes: [SOLICITUD_EN_CURSO]
        };
        const pacienteB: HistorialPaciente = {
            paciente: { rut: "22222222-2", nombre: "Paciente B" },
            solicitudes: [SOLICITUD_REALIZADA]
        };

        let resolverA: (value: { ok: true; data: HistorialPaciente }) => void = () => {};
        let resolverB: (value: { ok: true; data: HistorialPaciente }) => void = () => {};

        vi.mocked(getHistorialPaciente)
            .mockImplementationOnce(() => new Promise((resolve) => { resolverA = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolverB = resolve; }));

        render(<HistorialPacienteView />);
        const form = screen.getByRole("button", { name: "Buscar" }).closest("form") as HTMLFormElement;

        // Se busca el RUT A...
        escribirRut("11111111-1");
        buscar();

        // ...y, antes de que responda, se busca el RUT B. El boton ya quedo deshabilitado
        // ("Buscando...") mientras A esta en vuelo, pero el formulario puede volver a enviarse
        // (p.ej. con Enter) y el handler debe seguir siendo seguro ante envios superpuestos:
        // se dispara el submit directamente sobre el form para cubrir ese caso.
        escribirRut("22222222-2");
        fireEvent.submit(form);

        // La busqueda mas reciente (B) responde primero.
        await act(async () => {
            resolverB({ ok: true, data: pacienteB });
        });
        expect(screen.getByText("Paciente B")).toBeInTheDocument();

        // La busqueda anterior (A), mas lenta, responde despues: su resultado debe descartarse
        // en vez de pisar el de B.
        await act(async () => {
            resolverA({ ok: true, data: pacienteA });
        });
        expect(screen.queryByText("Paciente A")).not.toBeInTheDocument();
        expect(screen.getByText("Paciente B")).toBeInTheDocument();
    });

    it("indica la carga", async () => {
        let resolver: (value: { ok: true; data: HistorialPaciente }) => void = () => {};
        vi.mocked(getHistorialPaciente).mockImplementation(
            () => new Promise((resolve) => { resolver = resolve; })
        );

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();

        expect(screen.getByText("Buscando...")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Buscando..." })).toBeDisabled();

        resolver({ ok: true, data: HISTORIAL_COMPLETO });
        await screen.findByText("Juana Perez");
    });

    it("solo permite reimprimir el voucher de la solicitud En Curso", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });
        vi.mocked(getVoucherSolicitud).mockResolvedValue({ ok: true, data: VOUCHER_EN_CURSO });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");

        const tarjetaEnCurso = screen.getByTestId("solicitud-SOL-1");
        expect(within(tarjetaEnCurso).getByRole("button", { name: "Reimprimir voucher SOL-1" })).toBeInTheDocument();
        expect(within(screen.getByTestId("solicitud-SOL-2")).queryByRole("button", { name: /Reimprimir voucher/ })).not.toBeInTheDocument();
        expect(within(screen.getByTestId("solicitud-SOL-3")).queryByRole("button", { name: /Reimprimir voucher/ })).not.toBeInTheDocument();

        fireEvent.click(within(tarjetaEnCurso).getByRole("button", { name: "Reimprimir voucher SOL-1" }));

        await waitFor(() => expect(getVoucherSolicitud).toHaveBeenCalledWith("SOL-1"));
    });

    it("deshabilita la reimpresion pendiente y evita una segunda consulta", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });
        let resolver!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        vi.mocked(getVoucherSolicitud).mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");

        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" }));

        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-1" })).toBeDisabled());
        fireEvent.click(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-1" }));
        expect(getVoucherSolicitud).toHaveBeenCalledOnce();

        resolver({ ok: true, data: VOUCHER_EN_CURSO });
        await screen.findByText("Voucher de solicitud");
    });

    it("permite reimprimir otra solicitud mientras conserva la carga de la primera", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_CON_DOS_SOLICITUDES_EN_CURSO });
        let resolverPrimera!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        let resolverSegunda!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        vi.mocked(getVoucherSolicitud)
            .mockReturnValueOnce(new Promise((resolve) => { resolverPrimera = resolve; }))
            .mockReturnValueOnce(new Promise((resolve) => { resolverSegunda = resolve; }));

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");

        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-1" })).toBeDisabled());
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-4" })).not.toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-4" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-4" })).toBeDisabled());
        expect(getVoucherSolicitud).toHaveBeenNthCalledWith(2, "SOL-4");

        await act(async () => {
            resolverPrimera({ ok: false, error: "No disponible" });
        });
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" })).not.toBeDisabled();
        expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-4" })).toBeDisabled();

        await act(async () => {
            resolverSegunda({ ok: false, error: "No disponible" });
        });
        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-4" })).not.toBeDisabled());
    });

    it("conserva el voucher de la reimpresion mas reciente si las respuestas llegan invertidas", async () => {
        const voucherMasReciente = { ...VOUCHER_EN_CURSO, id_solicitud: "SOL-4" };
        let resolverPrimera!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        let resolverSegunda!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_CON_DOS_SOLICITUDES_EN_CURSO });
        vi.mocked(getVoucherSolicitud)
            .mockReturnValueOnce(new Promise((resolve) => { resolverPrimera = resolve; }))
            .mockReturnValueOnce(new Promise((resolve) => { resolverSegunda = resolve; }));

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" }));
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-4" }));

        await act(async () => {
            resolverSegunda({ ok: true, data: voucherMasReciente });
        });
        expect(within(obtenerVoucherVisible()).getByText("SOL-4")).toBeInTheDocument();

        await act(async () => {
            resolverPrimera({ ok: true, data: VOUCHER_EN_CURSO });
        });
        expect(within(obtenerVoucherVisible()).getByText("SOL-4")).toBeInTheDocument();
        expect(within(obtenerVoucherVisible()).queryByText("SOL-1")).not.toBeInTheDocument();
    });

    it("invalida y cierra el voucher activo al editar el RUT", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });
        vi.mocked(getVoucherSolicitud).mockResolvedValue({ ok: true, data: VOUCHER_EN_CURSO });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" }));
        await screen.findByText("Voucher de solicitud");

        escribirRut("22222222-2");

        expect(screen.queryByText("Voucher de solicitud")).not.toBeInTheDocument();
    });

    it("descarta un voucher resuelto despues de iniciar una nueva busqueda", async () => {
        const historialPacienteB: HistorialPaciente = {
            paciente: { rut: "22222222-2", nombre: "Paciente B" },
            solicitudes: [SOLICITUD_REALIZADA]
        };
        let resolverVoucherA!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        vi.mocked(getHistorialPaciente)
            .mockResolvedValueOnce({ ok: true, data: HISTORIAL_COMPLETO })
            .mockResolvedValueOnce({ ok: true, data: historialPacienteB });
        vi.mocked(getVoucherSolicitud).mockReturnValueOnce(new Promise((resolve) => { resolverVoucherA = resolve; }));

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-1" })).toBeDisabled());

        escribirRut("22222222-2");
        buscar();
        expect(await screen.findByText("Paciente B")).toBeInTheDocument();

        await act(async () => {
            resolverVoucherA({ ok: true, data: VOUCHER_EN_CURSO });
            await Promise.resolve();
        });

        expect(screen.queryByText("Voucher de solicitud")).not.toBeInTheDocument();
        expect(screen.getByText("Paciente B")).toBeInTheDocument();
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("abre el voucher con la fecha original y restablece el boton al terminar", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });
        vi.mocked(getVoucherSolicitud).mockResolvedValue({ ok: true, data: VOUCHER_EN_CURSO });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" }));

        expect(await screen.findByText("Voucher de solicitud")).toBeInTheDocument();
        expect(screen.getByText("Fecha:")).toBeInTheDocument();
        expect(screen.getByText("10-01-2026")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" })).not.toBeDisabled();
    });

    it("muestra el error de negocio sin ocultar el historial ni abrir el voucher", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });
        vi.mocked(getVoucherSolicitud).mockResolvedValue({ ok: false, error: "Solicitud no disponible" });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Solicitud no disponible"));
        expect(screen.queryByText("Voucher de solicitud")).not.toBeInTheDocument();
        expect(screen.getByText("Juana Perez")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" })).not.toBeDisabled();
    });

    it("muestra un error generico, conserva el historial y restablece el boton si falla la consulta", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });
        vi.mocked(getVoucherSolicitud).mockRejectedValue(new Error("detalle sensible"));

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();
        await screen.findByText("Juana Perez");
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al reimprimir voucher"));
        expect(screen.queryByText("Voucher de solicitud")).not.toBeInTheDocument();
        expect(screen.getByText("Juana Perez")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-1" })).not.toBeDisabled();
    });
});
