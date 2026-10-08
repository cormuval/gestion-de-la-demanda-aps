import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../actions/getSomePanel.action", () => ({ getSomePanel: vi.fn() }));
vi.mock("@/shared/components/ui/chart", () => ({
    ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ChartTooltip: () => null,
    ChartTooltipContent: () => null
}));

import { toast } from "sonner";
import { getSomePanel, type SomePanelData } from "../actions/getSomePanel.action";
import { ESTADO_CITA, TEMPORALIDAD } from "@/modules/comunicador/types/comunicador";
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

const panelData: SomePanelData = {
    esAdministrador: true,
    rangoDias: 30,
    desde: new Date("2026-10-01T00:00:00"),
    hasta: new Date("2026-10-08T00:00:00"),
    centroSeleccionado: "501",
    funcionarioSeleccionado: "",
    demandaTemporalidad: "Todas",
    centros: [
        { id_centro: "501", nombre_centro: "Centro 501" },
        { id_centro: "650", nombre_centro: "Centro 650" }
    ],
    funcionarios: [],
    totales: {
        solicitudesIngresadas: 0,
        gestiones: 0,
        solicitudesRealizadas: 0,
        solicitudesRechazadas: 0,
        citasCreadas: 0,
        llamadasRealizadas: 0
    },
    serie: [],
    productividad: [],
    demandaClinica: [],
    solicitudesPendientes: []
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSomePanel).mockResolvedValue({ ok: true, data: someData } as never);
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

describe("SomeView", () => {
    it("muestra el error de negocio sin presentar un panel vacio", async () => {
        vi.mocked(getSomePanel).mockResolvedValue({ ok: false, error: "No hay centro disponible para consultar productividad SOME" } as never);

        render(<SomeView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No hay centro disponible para consultar productividad SOME"));
        expect(screen.queryByText("Serie diaria")).not.toBeInTheDocument();
    });

    it("consume data al cargar un panel valido", async () => {
        vi.mocked(getSomePanel).mockResolvedValue({ ok: true, data: panelData } as never);

        render(<SomeView />);

        expect(await screen.findByText("Centro 501")).toBeInTheDocument();
        expect(screen.getByText("Serie diaria")).toBeInTheDocument();
    });

    it("conserva los datos previos cuando una recarga falla", async () => {
        vi.mocked(getSomePanel)
            .mockResolvedValueOnce({ ok: true, data: panelData } as never)
            .mockResolvedValueOnce({ ok: false, error: "No fue posible actualizar el panel" } as never);

        render(<SomeView />);
        await screen.findByText("Centro 501");

        fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "650" } });

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No fue posible actualizar el panel"));
        expect(screen.getByText("Centro 501")).toBeInTheDocument();
        expect(screen.getByText("Serie diaria")).toBeInTheDocument();
        expect(screen.getAllByRole("combobox")[1]).toHaveValue("501");
    });

    it("muestra un mensaje generico ante un error tecnico", async () => {
        vi.mocked(getSomePanel).mockRejectedValue(new Error("detalle tecnico"));

        render(<SomeView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo cargar el panel SOME"));
    });
});
