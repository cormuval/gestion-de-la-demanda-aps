import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions/getHistorialPaciente.action", () => ({ getHistorialPaciente: vi.fn() }));

import { getHistorialPaciente } from "../actions/getHistorialPaciente.action";
import type { HistorialPaciente } from "../types/historial";
import { HistorialPacienteView } from "./HistorialPacienteView";

beforeEach(() => {
    vi.clearAllMocks();
});

function escribirRut(valor: string) {
    fireEvent.change(screen.getByLabelText("RUT"), { target: { value: valor } });
}

function buscar() {
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
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

const HISTORIAL_COMPLETO: HistorialPaciente = {
    paciente: { rut: "12345678-5", nombre: "Juana Perez" },
    solicitudes: [SOLICITUD_EN_CURSO, SOLICITUD_REALIZADA, SOLICITUD_RECHAZADA]
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
        expect(screen.getByText("No cumple criterios")).toBeInTheDocument();
        expect(screen.getAllByText(/20-01-2026|20\/01\/2026/).length).toBeGreaterThan(0);
        // La cita CITA-2 esta cerrada pero sin llamadas: su fecha de cierre es "—".
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });

    it("despliega las llamadas de una cita", async () => {
        vi.mocked(getHistorialPaciente).mockResolvedValue({ ok: true, data: HISTORIAL_COMPLETO });

        render(<HistorialPacienteView />);
        escribirRut("12345678-5");
        buscar();

        const botonLlamadas = await screen.findByRole("button", { name: "Ver llamadas (2)" });
        fireEvent.click(botonLlamadas);

        expect(screen.getByText("Comunicador: Comunicador Uno")).toBeInTheDocument();
        expect(screen.getByText("Observacion de la llamada 1")).toBeInTheDocument();
        expect(screen.getByText("Comunicador: Comunicador Dos")).toBeInTheDocument();
        expect(screen.getByText("Observacion de la llamada 2")).toBeInTheDocument();
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
});
