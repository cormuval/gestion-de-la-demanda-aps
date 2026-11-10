import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
// types
import type { ContextoPermisos } from "@/shared/lib/permisos";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ refresh: vi.fn() }), redirect: vi.fn() }));
vi.mock("@/shared/lib/permisos", () => ({ getSessionPermisos: vi.fn(), requirePermiso: vi.fn(), requirePermisoPagina: vi.fn() }));
vi.mock("@/shared/lib/prisma", () => ({ prisma: { centro: { findMany: vi.fn() } } }));
vi.mock("@/modules/solicitudes/actions/getSolicitudes.action", () => ({ getSolicitudes: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getRevisionCatalogos.action", () => ({ getRevisionCatalogos: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getCentros.action", () => ({ getCentros: vi.fn() }));
vi.mock("@/modules/comunicador/actions/getCitasPendientes.action", () => ({ getCitasPendientes: vi.fn() }));
vi.mock("@/modules/comunicador/actions/getFiltrosComunicador.action", () => ({ getFiltrosComunicador: vi.fn() }));
// components
import AuthenticatedLayout from "./layout";
import { RevisarSolicitudesView } from "@/modules/solicitudes/components/RevisarSolicitudesView";
import { ComunicadorView } from "@/modules/comunicador/components/ComunicadorView";
// actions
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
import { getRevisionCatalogos } from "@/modules/solicitudes/actions/getRevisionCatalogos.action";
import { getCentros } from "@/modules/solicitudes/actions/getCentros.action";
import { getCitasPendientes } from "@/modules/comunicador/actions/getCitasPendientes.action";
import { getFiltrosComunicador } from "@/modules/comunicador/actions/getFiltrosComunicador.action";
// lib
import { getSessionPermisos } from "@/shared/lib/permisos";

function contexto(centro: string): ContextoPermisos {
    return {
        user: { rut: "1-9", email: "prueba@example.test", nombre: "Funcionario", centro_id: centro, centro_nombre: centro, rol: { id: 2, nombre: "Gestor" } },
        permisos: new Set()
    };
}

function solicitudes(id: string): Awaited<ReturnType<typeof getSolicitudes>> {
    const centroId = id.startsWith("NEW") ? "651" : "650";
    return {
        ok: true,
        data: {
            solicitudes: [{
                id_solicitud: id,
                fecha_inicio: new Date("2026-11-01"),
                rut_usuario: "1-9",
                descripcion: "Solicitud pendiente",
                estado_solicitud: "En Curso",
                accion: "En espera de validación",
                priorizacion_admin: 1,
                rut_orientador: null,
                tipo_solicitud_id: 1,
                motivo_id: null,
                ultimo_control: null,
                disponibilidad_llamada: null,
                rut_gestor: null,
                razon_rechazo: null,
                fecha_validacion: null,
                centro_id: centroId,
                observacion_rechazo: null,
                usuario: {
                    rut: "1-9", nombre: "Paciente", apellido: "Prueba", nombre_social: null,
                    genero: null, otro_genero: null, fecha_nacimiento: null, sector: null,
                    telefono: null, telefono_alternativo: null, correo_contacto: null,
                    gestante: null, discapacidad: null, priorizacion_administrativa: null,
                    centro_id: centroId, policonsultante: null
                },
                tipoSolicitud: {
                    id_tipo_solicitud: 1, nombre_tipo_solicitud: "Atención", estado: "Activo",
                    esperanza: null, placeres: null, padre_damian: null, baron: null,
                    rodelillo: null, reina_isabel: null, placilla: null, las_canas: null,
                    mena: null, cordillera: null, quebrada_verde: null, cecosf_porvenir_bajo: null,
                    puertas_negras: null, cecosf_laguna_verde: null, cecosf_juan_pablo_ii: null,
                    desarrollo: null
                },
                motivo: null,
                orientador: null,
                gestor: null
            }],
            total: 1, page: 1, pageSize: 100, totalPages: 1
        }
    };
}

function citas(id: string): Awaited<ReturnType<typeof getCitasPendientes>> {
    return {
        ok: true,
        data: {
            filas: [{
                id_cita: id, rut_usuario: "1-9", nombre_usuario: "Paciente", nombre_social: null,
                priorizacion_clinica: null, priorizacion: null, disponibilidad: null,
                profesion: null, prestacion: null, fecha_estimada_atencion: null,
                estado_cita: "Sin llamadas", observacion: null, intentos: 0, tiene_llamada_hoy: false
            }],
            total: 1, pagina: 1, porPagina: 100
        }
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSolicitudes).mockReset();
    vi.mocked(getCitasPendientes).mockReset();
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    vi.mocked(getSessionPermisos).mockResolvedValue(contexto("650"));
    vi.mocked(getRevisionCatalogos).mockResolvedValue({ ok: true, data: { tiposSolicitud: [], motivos: [], profesionales: [], prestaciones: [], centros: [] } });
    vi.mocked(getCentros).mockResolvedValue([]);
    vi.mocked(getFiltrosComunicador).mockResolvedValue({ profesionales: [], prestaciones: [] });
});

describe("AuthenticatedLayout cambio de centro", () => {
    it.each(["solicitudes", "comunicador"] as const)("reinicia la búsqueda de %s y no muestra respuestas del centro anterior", async (bandeja) => {
        const esGestor = bandeja === "solicitudes";
        const vista = esGestor ? <RevisarSolicitudesView /> : <ComunicadorView />;
        const accion = esGestor ? vi.mocked(getSolicitudes) : vi.mocked(getCitasPendientes);
        const respuesta = esGestor ? solicitudes : citas;
        const etiqueta = esGestor ? "Buscar en descripción" : "Buscar en observación clínica";
        let resolverAnterior!: (resultado: never) => void;
        let resolverNuevo!: (resultado: never) => void;
        accion.mockResolvedValueOnce(respuesta("OLD-1") as never)
            .mockResolvedValueOnce(respuesta("OLD-2") as never)
            .mockReturnValueOnce(new Promise((resolve) => { resolverAnterior = resolve; }) as never)
            .mockReturnValueOnce(new Promise((resolve) => { resolverNuevo = resolve; }) as never);

        const { rerender } = render(await AuthenticatedLayout({ children: vista }));
        await screen.findByText("OLD-1");
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        let panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getByRole("textbox", { name: etiqueta }), { target: { value: "texto centro anterior" } });
        fireEvent.click(within(panel).getByRole("button", { name: "Buscar" }));
        await screen.findByText("OLD-2");
        fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
        panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getByRole("textbox", { name: etiqueta }), { target: { value: "petición pendiente anterior" } });
        fireEvent.click(within(panel).getByRole("button", { name: "Buscar" }));
        await waitFor(() => expect(accion).toHaveBeenCalledTimes(3));

        vi.mocked(getSessionPermisos).mockResolvedValue(contexto("651"));
        rerender(await AuthenticatedLayout({ children: vista }));
        await waitFor(() => expect(accion).toHaveBeenCalledTimes(4));
        expect(screen.queryByText("OLD-2")).not.toBeInTheDocument();
        expect(screen.queryByText(/Observación clínica:/)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
        expect(accion).toHaveBeenLastCalledWith(expect.objectContaining(esGestor ? { texto: "", page: 1 } : { texto: undefined, pagina: 1 }));
        await act(async () => resolverAnterior(respuesta("OLD-3") as never));
        expect(screen.queryByText("OLD-3")).not.toBeInTheDocument();
        await act(async () => resolverNuevo(respuesta("NEW-1") as never));
        expect(await screen.findByText("NEW-1")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        panel = await screen.findByRole("dialog", { name: "Filtros" });
        expect(within(panel).getByRole("textbox", { name: etiqueta })).toHaveValue("");
    });
});
