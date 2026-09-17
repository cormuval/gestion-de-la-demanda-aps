import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
