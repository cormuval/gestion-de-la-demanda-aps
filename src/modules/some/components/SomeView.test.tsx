import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// actions
import type { SomePanelData } from "@/modules/some/actions/getSomePanel.action";
import { ESTADO_CITA, TEMPORALIDAD } from "@/modules/comunicador/types/comunicador";

vi.mock("@/modules/some/actions/getSomePanel.action", () => ({
    getSomePanel: vi.fn()
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { getSomePanel } from "@/modules/some/actions/getSomePanel.action";
import { SomeView } from "./SomeView";

const someData: SomePanelData = {
    esAdministrador: true,
    rangoDias: 30,
    desde: new Date("2026-09-07T00:00:00"),
    hasta: new Date("2026-10-07T00:00:00"),
    centroSeleccionado: "centro-1",
    funcionarioSeleccionado: "",
    demandaTemporalidad: TEMPORALIDAD.TODAS,
    centros: [{ id_centro: "centro-1", nombre_centro: "CESFAM Uno" }],
    funcionarios: [{ rut: "11.111.111-1", nombre: "Funcionaria SOME" }],
    totales: {
        solicitudesIngresadas: 3,
        gestiones: 2,
        solicitudesRealizadas: 1,
        solicitudesRechazadas: 1,
        citasCreadas: 4,
        llamadasRealizadas: 5
    },
    serie: [],
    productividad: [
        {
            rut: "11.111.111-1",
            nombre: "Funcionaria SOME",
            solicitudesIngresadas: 3,
            gestiones: 2,
            solicitudesRealizadas: 1,
            solicitudesRechazadas: 1,
            citasCreadas: 4,
            llamadasRealizadas: 5
        }
    ],
    demandaClinica: [
        {
            profesional: "Profesional Clinico",
            prestacion: "Todas",
            total: 6,
            temporalidades: {
                [TEMPORALIDAD.ATRASADOS]: 1,
                [TEMPORALIDAD.PROXIMOS]: 2,
                [TEMPORALIDAD.FUTUROS]: 3
            },
            estados: {
                [ESTADO_CITA.SIN_LLAMADAS]: 3,
                [ESTADO_CITA.NO_CONTESTA_1]: 2,
                [ESTADO_CITA.NO_CONTESTA_2]: 1,
                [ESTADO_CITA.SOLO_AVISO]: 0
            },
            prestaciones: [
                {
                    prestacion: "Consulta medica",
                    total: 4,
                    temporalidades: {
                        [TEMPORALIDAD.ATRASADOS]: 1,
                        [TEMPORALIDAD.PROXIMOS]: 1,
                        [TEMPORALIDAD.FUTUROS]: 2
                    },
                    estados: {
                        [ESTADO_CITA.SIN_LLAMADAS]: 2,
                        [ESTADO_CITA.NO_CONTESTA_1]: 1,
                        [ESTADO_CITA.NO_CONTESTA_2]: 1,
                        [ESTADO_CITA.SOLO_AVISO]: 0
                    }
                }
            ]
        }
    ],
    solicitudesPendientes: [
        {
            tipoSolicitud: "Control cardiovascular",
            total: 7,
            motivos: [{ motivo: "Ingreso a programa", total: 7 }]
        }
    ]
};

beforeEach(() => {
    vi.clearAllMocks();
    (getSomePanel as ReturnType<typeof vi.fn>).mockResolvedValue(someData);
});

describe("SomeView: tablas compactas", () => {
    it("compacta productividad, demanda clinica y solicitudes pendientes sin anchos fijos", async () => {
        const { container } = render(<SomeView />);

        await waitFor(() => expect(screen.getAllByText("Funcionaria SOME").length).toBeGreaterThan(0));

        expect(container.querySelector('table[class*="min-w-["]')).toBeNull();
        expect(container.querySelector("table.table-fixed")).toBeNull();
        expect(container.querySelector('table[class*="w-["]')).toBeNull();
        expect(screen.getByText("11.111.111-1")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Demanda Clinica/i }));
        expect(screen.getByText("Profesional Clinico")).toBeInTheDocument();
        expect(screen.getAllByText("Temporalidad").length).toBeGreaterThan(0);
        expect(screen.getAllByText(TEMPORALIDAD.ATRASADOS).length).toBeGreaterThan(0);
        expect(screen.getByText(ESTADO_CITA.SIN_LLAMADAS)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Profesional Clinico/i }));
        expect(screen.getByText("Consulta medica")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Solicitudes Pendientes/i }));
        expect(screen.getByText("Control cardiovascular")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Control cardiovascular/i }));
        expect(screen.getByText("Ingreso a programa")).toBeInTheDocument();
    });
});
