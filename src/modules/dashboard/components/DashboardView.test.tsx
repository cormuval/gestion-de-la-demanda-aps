import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { DashboardFuncionarioData } from "@/modules/dashboard/actions/getDashboardFuncionario.action";

vi.mock("@/modules/dashboard/actions/getDashboardFuncionario.action", () => ({
    getDashboardFuncionario: vi.fn()
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { getDashboardFuncionario } from "@/modules/dashboard/actions/getDashboardFuncionario.action";
import { DashboardView } from "./DashboardView";

const dashboardData: DashboardFuncionarioData = {
    rangoDias: 30,
    desde: new Date("2026-09-07T00:00:00"),
    hasta: new Date("2026-10-07T00:00:00"),
    funcionario: { rut: "11.111.111-1", nombre: "Funcionario Demo", rol: "SOME", centro: "CESFAM Uno" },
    totales: {
        solicitudesIngresadas: 1,
        solicitudesRechazadas: 1,
        solicitudesRealizadas: 1,
        citasCreadas: 1,
        llamadasRealizadas: 1
    },
    serie: [],
    detalles: {
        solicitudesIngresadas: [
            {
                id_solicitud: "solicitud-1",
                fecha_inicio: new Date("2026-10-01T00:00:00"),
                rut_usuario: "22.222.222-2",
                tipo_solicitud: "Control de salud cardiovascular de seguimiento",
                motivo: null,
                estado_solicitud: "En Curso"
            }
        ],
        gestiones: [
            {
                id_solicitud: "solicitud-2",
                fecha_validacion: new Date("2026-10-02T00:00:00"),
                rut_usuario: "33.333.333-3",
                accion: "Rechazar solicitud",
                razon_rechazo: "La solicitud requiere antecedentes adicionales para continuar con la gestion.",
                citas_creadas: 1,
                citas: [
                    {
                        id_cita: "cita-1",
                        fecha_estimada_atencion: new Date("2026-10-10T00:00:00"),
                        tipo_prestacion: "Atencion profesional",
                        estado_cita: "Pendiente",
                        priorizacion_clinica: "Alta",
                        estamento: "Medicina",
                        prestacion: "Consulta medica"
                    }
                ]
            }
        ],
        llamadas: [
            {
                id_llamada: "llamada-1",
                fecha_llamada: new Date("2026-10-03T10:30:00"),
                rut_usuario: "44.444.444-4",
                cita_id: "cita-2",
                respuesta_usuario: "Acepta",
                observacion: "Confirma disponibilidad para la fecha propuesta.",
                estamento: "Enfermeria",
                prestacion: "Control de enfermeria",
                tipo_prestacion: "Control"
            }
        ]
    }
};

beforeEach(() => {
    vi.clearAllMocks();
    (getDashboardFuncionario as ReturnType<typeof vi.fn>).mockResolvedValue(dashboardData);
});

describe("DashboardView: tablas de detalle", () => {
    it("compacta las cuatro tablas y conserva datos agrupados y acciones", async () => {
        const { container } = render(<DashboardView />);

        await waitFor(() => expect(screen.queryByText("Actualizando...")).not.toBeInTheDocument());

        expect(container.querySelector('table[class*="min-w-["]')).toBeNull();
        expect(container.querySelector("table.table-fixed")).toBeNull();
        expect(container.querySelector('table[class*="w-["]')).toBeNull();

        const solicitudesTitulo = screen.getAllByText("Solicitudes ingresadas").find((element) => element.className.includes("font-semibold"));
        const solicitudes = solicitudesTitulo?.closest("div")?.parentElement?.parentElement;
        expect(solicitudes).toBeTruthy();
        expect(within(solicitudes as HTMLElement).getByText("Control de salud cardiovascular de seguimiento")).toBeInTheDocument();
        expect(within(solicitudes as HTMLElement).getByText("En Curso")).toBeInTheDocument();

        const gestiones = screen.getByText("Gestiones").closest("div")?.parentElement?.parentElement;
        expect(within(gestiones as HTMLElement).getByText("Rechazar solicitud")).toBeInTheDocument();
        fireEvent.click(within(gestiones as HTMLElement).getByRole("button", { name: /Visualizar/i }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Consulta medica")).toBeInTheDocument();

        const llamadasTitulo = screen.getAllByText("Llamadas realizadas").find((element) => element.className.includes("font-semibold"));
        const llamadas = llamadasTitulo?.closest("div")?.parentElement?.parentElement;
        expect(within(llamadas as HTMLElement).getByText("Acepta")).toBeInTheDocument();
        fireEvent.click(within(llamadas as HTMLElement).getByRole("button", { name: /^Ver$/i }));
        expect(screen.getByText("Detalle llamada")).toBeInTheDocument();
    });
});
