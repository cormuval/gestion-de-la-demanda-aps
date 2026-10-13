import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../actions/getCitasPendientes.action", () => ({ getCitasPendientes: vi.fn() }));
vi.mock("../actions/getFiltrosComunicador.action", () => ({ getFiltrosComunicador: vi.fn() }));
vi.mock("../actions/getContactoPaciente.action", () => ({ getContactoPaciente: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getCentros.action", () => ({ getCentros: vi.fn() }));
vi.mock("@/modules/comunicador/hooks/useUsuarioEdit", () => ({ useUsuarioEdit: () => ({ open: false, form: {}, saving: false, abrir: vi.fn(), cerrar: vi.fn(), onChange: vi.fn(), onSubmit: vi.fn() }) }));
vi.mock("./CitasFiltros", () => ({ CitasFiltros: () => <div /> , FILTROS_INICIALES: { temporalidad: "", estado: "", profesional_id: "", prestacion: "", edadMin: "", edadMax: "", fechaDesde: "", fechaHasta: "", rut: "", sector: "" } }));
vi.mock("./CitasPendientesTabla", () => ({
    CitasPendientesTabla: ({ total, onPagina }: { total: number; onPagina: (pagina: number) => void }) => (
        <div>
            <p>Tabla con {total} citas</p>
            <button type="button" onClick={() => onPagina(2)}>
                Pagina 2
            </button>
        </div>
    )
}));
vi.mock("./RegistrarLlamadaModal", () => ({ RegistrarLlamadaModal: () => null }));
vi.mock("./CitaAccionesMenu", () => ({ CitaAccionesMenu: () => null }));
vi.mock("./HistorialLlamadasModal", () => ({ HistorialLlamadasModal: () => null }));
vi.mock("./OtrasCitasPacienteModal", () => ({ OtrasCitasPacienteModal: () => null }));
vi.mock("@/modules/solicitudes/components/UsuarioEditModal", () => ({ UsuarioEditModal: () => null }));

import { toast } from "sonner";
import { getCitasPendientes } from "../actions/getCitasPendientes.action";
import { getFiltrosComunicador } from "../actions/getFiltrosComunicador.action";
import { getCentros } from "@/modules/solicitudes/actions/getCentros.action";
import { ComunicadorView } from "./ComunicadorView";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCitasPendientes).mockResolvedValue({ ok: false, error: "Centro no configurado" } as never);
    vi.mocked(getFiltrosComunicador).mockResolvedValue({ profesionales: [], prestaciones: [] } as never);
    vi.mocked(getCentros).mockResolvedValue([] as never);
});

describe("ComunicadorView", () => {
    it("oculta el detalle tecnico cuando falla la carga de la cola", async () => {
        vi.mocked(getCitasPendientes).mockRejectedValue(new Error("detalle sensible"));

        render(<ComunicadorView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al cargar la cola"));
        expect(toast.error).not.toHaveBeenCalledWith("detalle sensible");
    });

    it("informa el error de negocio y no presenta una tabla vacia como carga exitosa", async () => {
        render(<ComunicadorView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro no configurado"));
        expect(screen.queryByText("Tabla con 0 citas")).not.toBeInTheDocument();
    });

    it("ofrece reintentar cuando falla la primera carga", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce({ ok: false, error: "Centro no configurado" } as never)
            .mockResolvedValueOnce({ ok: true, data: { filas: [], total: 3, pagina: 1, porPagina: 25 } } as never);

        render(<ComunicadorView />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Centro no configurado");
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

        expect(await screen.findByText("Tabla con 3 citas")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("conserva la ultima cola cargada cuando una recarga falla", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce({ ok: true, data: { filas: [], total: 3, pagina: 1, porPagina: 25 } } as never)
            .mockResolvedValueOnce({ ok: false, error: "No fue posible cargar la pagina" } as never);

        render(<ComunicadorView />);
        await screen.findByText("Tabla con 3 citas");

        fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Se muestra la última cola cargada");
        expect(screen.getByText("Tabla con 3 citas")).toBeInTheDocument();
    });
});
