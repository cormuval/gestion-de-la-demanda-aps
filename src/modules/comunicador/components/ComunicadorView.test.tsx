import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../actions/getCitasPendientes.action", () => ({ getCitasPendientes: vi.fn() }));
vi.mock("../actions/getFiltrosComunicador.action", () => ({ getFiltrosComunicador: vi.fn() }));
vi.mock("../actions/getContactoPaciente.action", () => ({ getContactoPaciente: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getCentros.action", () => ({ getCentros: vi.fn() }));
vi.mock("@/modules/comunicador/hooks/useUsuarioEdit", () => ({ useUsuarioEdit: () => ({ open: false, form: {}, saving: false, abrir: vi.fn(), cerrar: vi.fn(), onChange: vi.fn(), onSubmit: vi.fn() }) }));
vi.mock("./CitasFiltros", () => ({ CitasFiltros: () => <div /> , FILTROS_INICIALES: { temporalidad: "", estado: "", profesional_id: "", prestacion: "", edadMin: "", edadMax: "", fechaDesde: "", fechaHasta: "", rut: "", sector: "" } }));
vi.mock("./CitasPendientesTabla", () => ({ CitasPendientesTabla: ({ total }: { total: number }) => <p>Tabla con {total} citas</p> }));
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
    it("informa el error de negocio y no presenta una tabla vacia como carga exitosa", async () => {
        render(<ComunicadorView />);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro no configurado"));
        expect(screen.queryByText("Tabla con 0 citas")).not.toBeInTheDocument();
    });
});
