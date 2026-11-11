import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estadoMocks = vi.hoisted(() => ({ usuarioEditOpen: false, tablaReal: false }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("../actions/getCitasPendientes.action", () => ({ getCitasPendientes: vi.fn() }));
vi.mock("../actions/getFiltrosComunicador.action", () => ({ getFiltrosComunicador: vi.fn() }));
vi.mock("../actions/getContactoPaciente.action", () => ({ getContactoPaciente: vi.fn() }));
vi.mock("../actions/verificarCitaPendiente.action", () => ({ verificarCitaPendiente: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getCentros.action", () => ({ getCentros: vi.fn() }));
vi.mock("@/modules/comunicador/hooks/useUsuarioEdit", () => ({
    useUsuarioEdit: () => ({ open: estadoMocks.usuarioEditOpen, form: {}, saving: false, abrir: vi.fn(), cerrar: vi.fn(), onChange: vi.fn(), onSubmit: vi.fn() })
}));
vi.mock("./CitasPendientesTabla", async (importOriginal) => {
    const { CitasPendientesTabla: TablaReal } = await importOriginal<typeof import("./CitasPendientesTabla")>();
    return {
        CitasPendientesTabla: (props: React.ComponentProps<typeof TablaReal>) => {
            if (estadoMocks.tablaReal) return <TablaReal {...props} />;
            return <TablaSimplificada {...props} />;
        }
    };
});
function TablaSimplificada({ filas, total, pagina, citaSiguienteId, onPagina, onGestionar, renderAcciones }: React.ComponentProps<typeof import("./CitasPendientesTabla").CitasPendientesTabla>) {
    return (
        <div>
            <p>Tabla con {total} citas. Página {pagina}</p>
            <p>Cita siguiente: {citaSiguienteId ?? "ninguna"}</p>
            <button type="button" onClick={() => onPagina(2)}>Pagina 2</button>
            {filas.map((f) => (
                <div key={f.id_cita}>
                    <span>{f.id_cita}</span>
                    <button type="button" onClick={() => onGestionar(f)}>Llamar {f.id_cita}</button>
                    {renderAcciones?.(f)}
                </div>
            ))}
        </div>
    );
}
vi.mock("./RegistrarLlamadaModal", () => ({
    RegistrarLlamadaModal: ({ onCerrar, onRegistrado, onCitaCerrada }: { onCerrar: () => void; onRegistrado: (m: string) => void; onCitaCerrada?: () => void }) => (
        <div role="dialog" aria-label="Registrar llamada">
            <button type="button" onClick={() => onRegistrado("Cita Aceptada.")}>
                Simular llamada registrada
            </button>
            <button type="button" onClick={() => onCitaCerrada?.()}>
                Simular cita cerrada
            </button>
            <button type="button" onClick={onCerrar}>
                Cerrar llamada
            </button>
        </div>
    )
}));
vi.mock("./CitaAccionesMenu", () => ({
    CitaAccionesMenu: ({ cita, onVerHistorial, onVerOtrasCitas }: { cita: { id_cita: string }; onVerHistorial: (c: unknown) => void; onVerOtrasCitas: (c: unknown) => void }) => (
        <>
            <button type="button" onClick={() => onVerHistorial(cita)}>
                Historial {cita.id_cita}
            </button>
            <button type="button" onClick={() => onVerOtrasCitas(cita)}>
                Otras {cita.id_cita}
            </button>
        </>
    )
}));
vi.mock("./HistorialLlamadasModal", () => ({ HistorialLlamadasModal: () => <div role="dialog" aria-label="Historial" /> }));
vi.mock("./OtrasCitasPacienteModal", () => ({ OtrasCitasPacienteModal: () => <div role="dialog" aria-label="Otras citas" /> }));
vi.mock("@/modules/solicitudes/components/UsuarioEditModal", () => ({ UsuarioEditModal: () => null }));

import { toast } from "sonner";
import { getCitasPendientes } from "../actions/getCitasPendientes.action";
import { getFiltrosComunicador } from "../actions/getFiltrosComunicador.action";
import { getContactoPaciente } from "../actions/getContactoPaciente.action";
import { verificarCitaPendiente } from "../actions/verificarCitaPendiente.action";
import { getCentros } from "@/modules/solicitudes/actions/getCentros.action";
import { ComunicadorView } from "./ComunicadorView";

type RespuestaCitas = Awaited<ReturnType<typeof getCitasPendientes>>;
type RespuestaVerificacion = Awaited<ReturnType<typeof verificarCitaPendiente>>;

function respuestaConLista(ids: string[], total = ids.length): RespuestaCitas {
    return {
        ok: true,
        data: {
            filas: ids.map((idCita) => ({
                id_cita: idCita,
                priorizacion_clinica: null,
                priorizacion: null,
                disponibilidad: null,
                rut_usuario: "11.111.111-1",
                nombre_usuario: "Paciente de prueba",
                nombre_social: null,
                profesion: null,
                prestacion: null,
                fecha_estimada_atencion: null,
                estado_cita: "Sin llamadas",
                observacion: null,
                intentos: 0,
                tiene_llamada_hoy: false
            })),
            total,
            pagina: 1,
            porPagina: 25
        }
    } as RespuestaCitas;
}

function respuestaCon(idCita: string, total = 1): RespuestaCitas {
    return respuestaConLista([idCita], total);
}

beforeEach(() => {
    // Reset (no clear) para que respuestas "Once" sin consumir no se filtren al test siguiente.
    vi.resetAllMocks();
    estadoMocks.usuarioEditOpen = false;
    estadoMocks.tablaReal = false;
    vi.mocked(getCitasPendientes).mockResolvedValue({ ok: false, error: "Centro no configurado" } as never);
    vi.mocked(getFiltrosComunicador).mockResolvedValue({ profesionales: [], prestaciones: [] } as never);
    vi.mocked(getCentros).mockResolvedValue([] as never);
    vi.mocked(getContactoPaciente).mockResolvedValue({ telefonos: "9 1234 5678", correo: "p@example.com" } as never);
    vi.mocked(verificarCitaPendiente).mockResolvedValue({ ok: true, data: { pendiente: true, estado: "Sin llamadas" } });
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
        expect(screen.queryByText("Tabla con 0 citas. Página 1")).not.toBeInTheDocument();
    });

    it("ofrece reintentar cuando falla la primera carga", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce({ ok: false, error: "Centro no configurado" } as never)
            .mockResolvedValueOnce({ ok: true, data: { filas: [], total: 3, pagina: 1, porPagina: 25 } } as never);

        render(<ComunicadorView />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Centro no configurado");
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

        expect(await screen.findByText("Tabla con 3 citas. Página 1")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("conserva la ultima cola cargada cuando una recarga falla", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce({ ok: true, data: { filas: [], total: 3, pagina: 1, porPagina: 25 } } as never)
            .mockResolvedValueOnce({ ok: false, error: "No fue posible cargar la pagina" } as never);

        render(<ComunicadorView />);
        await screen.findByText("Tabla con 3 citas. Página 1");

        fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Se muestra la última cola cargada");
        expect(screen.getByText("Tabla con 3 citas. Página 1")).toBeInTheDocument();
    });
});

describe("ComunicadorView verificacion antes de llamar", () => {
    beforeEach(() => {
        vi.mocked(getCitasPendientes).mockResolvedValue(respuestaCon("CITA-1"));
    });

    it("abre Llamar si la cita sigue pendiente", async () => {
        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: "Llamar CITA-1" }));

        expect(await screen.findByRole("dialog", { name: "Registrar llamada" })).toBeInTheDocument();
        expect(verificarCitaPendiente).toHaveBeenCalledWith("CITA-1");
        expect(getContactoPaciente).toHaveBeenCalledWith("11.111.111-1");
        expect(toast.warning).not.toHaveBeenCalled();
    });

    it("no abre Llamar si la cita ya fue cerrada", async () => {
        vi.mocked(verificarCitaPendiente).mockResolvedValueOnce({ ok: true, data: { pendiente: false, estado: "Cita Aceptada" } });

        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: "Llamar CITA-1" }));

        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("Esta cita ya fue cerrada (Cita Aceptada)"));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole("dialog", { name: "Registrar llamada" })).not.toBeInTheDocument();
        expect(getContactoPaciente).not.toHaveBeenCalled();
    });

    it("avisa si la cita ya no esta disponible en el centro", async () => {
        vi.mocked(verificarCitaPendiente).mockResolvedValueOnce({ ok: true, data: { pendiente: false, estado: null } });

        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: "Llamar CITA-1" }));

        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("Esta cita ya no está disponible en tu centro"));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole("dialog", { name: "Registrar llamada" })).not.toBeInTheDocument();
    });

    it("abre igual si la verificacion falla", async () => {
        vi.mocked(verificarCitaPendiente).mockResolvedValueOnce({ ok: false, error: "El funcionario activo no tiene centro asignado." });

        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: "Llamar CITA-1" }));

        expect(await screen.findByRole("dialog", { name: "Registrar llamada" })).toBeInTheDocument();
        expect(toast.warning).not.toHaveBeenCalled();
    });

    it("abre igual si la verificacion lanza", async () => {
        vi.mocked(verificarCitaPendiente).mockRejectedValueOnce(new Error("red"));

        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: "Llamar CITA-1" }));

        expect(await screen.findByRole("dialog", { name: "Registrar llamada" })).toBeInTheDocument();
        expect(toast.warning).not.toHaveBeenCalled();
    });

    it("ignora una segunda pulsacion mientras verifica", async () => {
        let responder: (valor: RespuestaVerificacion) => void = () => undefined;
        vi.mocked(verificarCitaPendiente).mockReturnValueOnce(new Promise((resolve) => (responder = resolve)));

        render(<ComunicadorView />);
        const boton = await screen.findByRole("button", { name: "Llamar CITA-1" });
        fireEvent.click(boton);
        fireEvent.click(boton);
        expect(verificarCitaPendiente).toHaveBeenCalledTimes(1);

        await act(async () => responder({ ok: true, data: { pendiente: true, estado: "Sin llamadas" } }));
        expect(await screen.findAllByRole("dialog", { name: "Registrar llamada" })).toHaveLength(1);
        expect(getContactoPaciente).toHaveBeenCalledTimes(1);

        // Tras la verificacion se libera el bloqueo.
        fireEvent.click(screen.getByRole("button", { name: "Cerrar llamada" }));
        fireEvent.click(screen.getByRole("button", { name: "Llamar CITA-1" }));
        await waitFor(() => expect(verificarCitaPendiente).toHaveBeenCalledTimes(2));
    });

    it("libera el bloqueo aunque la verificacion lance", async () => {
        vi.mocked(verificarCitaPendiente).mockRejectedValueOnce(new Error("red"));

        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: "Llamar CITA-1" }));
        await screen.findByRole("dialog", { name: "Registrar llamada" });
        fireEvent.click(screen.getByRole("button", { name: "Cerrar llamada" }));

        fireEvent.click(screen.getByRole("button", { name: "Llamar CITA-1" }));
        await waitFor(() => expect(verificarCitaPendiente).toHaveBeenCalledTimes(2));
    });

    it("recarga con los filtros aplicados al responder la verificacion", async () => {
        let responder: (valor: RespuestaVerificacion) => void = () => undefined;
        vi.mocked(verificarCitaPendiente).mockReturnValueOnce(new Promise((resolve) => (responder = resolve)));

        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: "Llamar CITA-1" }));

        fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getByPlaceholderText("Ej: 12345678"), { target: { value: "99999999-9" } });
        fireEvent.click(within(panel).getByRole("button", { name: /^Buscar$/i }));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
        await act(async () => undefined);

        await act(async () => responder({ ok: true, data: { pendiente: false, estado: "Cita Aceptada" } }));

        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(3));
        expect(vi.mocked(getCitasPendientes).mock.calls[2][0]).toMatchObject({ rut: "99999999-9", pagina: 1 });
    });

    it("cierra el modal y recarga la cola si la cita ya estaba cerrada al guardar", async () => {
        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: "Llamar CITA-1" }));
        await screen.findByRole("dialog", { name: "Registrar llamada" });

        fireEvent.click(screen.getByRole("button", { name: "Simular cita cerrada" }));

        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Registrar llamada" })).not.toBeInTheDocument());
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
    });
});

describe("ComunicadorView refresco automatico", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        vi.mocked(getCitasPendientes).mockResolvedValue(respuestaCon("CITA-1"));
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

    it("refresca en silencio cada 60 s con los filtros y la pagina aplicados", async () => {
        render(<ComunicadorView />);
        await screen.findByText("CITA-1");

        fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getByPlaceholderText("Ej: 12345678"), { target: { value: "12345678-5" } });
        fireEvent.click(within(panel).getByRole("button", { name: /^Buscar$/i }));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(3));
        const consultaAplicada = vi.mocked(getCitasPendientes).mock.calls[2][0];
        expect(consultaAplicada).toMatchObject({ rut: "12345678-5", pagina: 2 });

        vi.mocked(getCitasPendientes).mockClear();
        vi.mocked(getCitasPendientes).mockResolvedValueOnce({ ok: false, error: "Fallo silencioso" } as never);
        await avanzar(60_000);

        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(1));
        expect(getCitasPendientes).toHaveBeenCalledWith(consultaAplicada);
        expect(toast.error).not.toHaveBeenCalled();
        expect(screen.getByText("CITA-1")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        vi.mocked(getCitasPendientes).mockRejectedValueOnce(new Error("red"));
        await avanzar(60_000);
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
        expect(toast.error).not.toHaveBeenCalled();
        expect(screen.getByText("CITA-1")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        vi.mocked(getCitasPendientes).mockResolvedValueOnce(respuestaCon("CITA-9", 7));
        await avanzar(60_000);
        expect(await screen.findByText("CITA-9")).toBeInTheDocument();
        expect(screen.getByText("Tabla con 7 citas. Página 1")).toBeInTheDocument();
    });

    it("no cambia la alerta de error visible al refrescar en silencio con falla", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaCon("CITA-1"))
            .mockResolvedValueOnce({ ok: false, error: "No fue posible cargar la pagina" } as never)
            .mockResolvedValueOnce({ ok: false, error: "Fallo silencioso" } as never);

        render(<ComunicadorView />);
        await screen.findByText("CITA-1");
        fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible cargar la pagina");

        await avanzar(60_000);
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(3));
        expect(screen.getByRole("alert")).toHaveTextContent("No fue posible cargar la pagina");
        expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it("limpia la alerta cuando el refresco silencioso tiene exito tras una falla", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaCon("CITA-1"))
            .mockResolvedValueOnce({ ok: false, error: "No fue posible cargar la pagina" } as never);

        render(<ComunicadorView />);
        await screen.findByText("CITA-1");
        fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Se muestra la última cola cargada");

        vi.mocked(getCitasPendientes).mockResolvedValueOnce(respuestaCon("CITA-9", 7));
        await avanzar(60_000);

        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
        expect(await screen.findByText("CITA-9")).toBeInTheDocument();
    });

    it.each([
        ["registrar llamada", "Llamar CITA-1", "Registrar llamada"],
        ["historial", "Historial CITA-1", "Historial"],
        ["otras citas", "Otras CITA-1", "Otras citas"]
    ])("no refresca con el modal de %s abierto", async (_nombre, boton, dialogo) => {
        render(<ComunicadorView />);
        fireEvent.click(await screen.findByRole("button", { name: boton }));
        await screen.findByRole("dialog", { name: dialogo });

        await avanzar(60_000 * 3);
        expect(getCitasPendientes).toHaveBeenCalledTimes(1);
    });

    it("no refresca con el modal de editar paciente abierto", async () => {
        estadoMocks.usuarioEditOpen = true;
        render(<ComunicadorView />);
        await screen.findByText("CITA-1");

        await avanzar(60_000 * 3);
        expect(getCitasPendientes).toHaveBeenCalledTimes(1);
    });

    it("no adelanta una carga normal en curso con una recarga silenciosa", async () => {
        render(<ComunicadorView />);
        await screen.findByText("CITA-1");

        let responderNormal: (valor: RespuestaCitas) => void = () => undefined;
        vi.mocked(getCitasPendientes).mockReturnValueOnce(new Promise((resolve) => (responderNormal = resolve)));
        fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));

        await avanzar(60_000);
        expect(getCitasPendientes).toHaveBeenCalledTimes(2);
        await act(async () => responderNormal(respuestaCon("CITA-NUEVA")));

        expect(await screen.findByText("CITA-NUEVA")).toBeInTheDocument();

        await avanzar(60_000);
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(3));
        expect(vi.mocked(getCitasPendientes).mock.calls[2][0]).toMatchObject({ pagina: 2 });
    });

    it.each(["silenciosa primero", "normal primero"])(
        "una carga normal iniciada durante una silenciosa gana y no queda cargando (%s)",
        async (orden) => {
            vi.mocked(getCitasPendientes)
                .mockResolvedValueOnce(respuestaCon("CITA-1"))
                .mockResolvedValueOnce({ ok: false, error: "No fue posible cargar la pagina" } as never);
            render(<ComunicadorView />);
            await screen.findByText("CITA-1");
            // Deja visible la alerta con "Reintentar" para observar el estado de carga.
            fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
            await screen.findByRole("button", { name: "Reintentar" });

            let responderSilenciosa: (valor: RespuestaCitas) => void = () => undefined;
            vi.mocked(getCitasPendientes).mockReturnValueOnce(new Promise((resolve) => (responderSilenciosa = resolve)));
            await avanzar(60_000);
            expect(getCitasPendientes).toHaveBeenCalledTimes(3);

            let responderNormal: (valor: RespuestaCitas) => void = () => undefined;
            vi.mocked(getCitasPendientes).mockReturnValueOnce(new Promise((resolve) => (responderNormal = resolve)));
            fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
            await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(4));

            if (orden === "silenciosa primero") {
                await act(async () => responderSilenciosa(respuestaCon("CITA-VIEJA")));
                await act(async () => responderNormal(respuestaCon("CITA-NUEVA")));
            } else {
                await act(async () => responderNormal(respuestaCon("CITA-NUEVA")));
                await act(async () => responderSilenciosa(respuestaCon("CITA-VIEJA")));
            }

            expect(await screen.findByText("CITA-NUEVA")).toBeInTheDocument();
            expect(screen.queryByText("CITA-VIEJA")).not.toBeInTheDocument();
            expect(screen.queryByText("Reintentando...")).not.toBeInTheDocument();
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        }
    );

    it("una carga normal superada no deja la tabla cargando", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaCon("CITA-1"))
            .mockResolvedValueOnce({ ok: false, error: "No fue posible cargar la pagina" } as never);
        render(<ComunicadorView />);
        await screen.findByText("CITA-1");
        fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
        await screen.findByRole("button", { name: "Reintentar" });

        let responderPrimera: (valor: RespuestaCitas) => void = () => undefined;
        let responderSegunda: (valor: RespuestaCitas) => void = () => undefined;
        vi.mocked(getCitasPendientes)
            .mockReturnValueOnce(new Promise((resolve) => (responderPrimera = resolve)))
            .mockReturnValueOnce(new Promise((resolve) => (responderSegunda = resolve)));
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
        fireEvent.click(await screen.findByRole("button", { name: /^Buscar$/i }));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(4));

        await act(async () => responderSegunda({ ok: false, error: "Falla nueva" } as never));
        await act(async () => responderPrimera(respuestaCon("CITA-VIEJA")));

        expect(await screen.findByRole("button", { name: "Reintentar" })).toBeEnabled();
        expect(screen.queryByText("CITA-VIEJA")).not.toBeInTheDocument();
    });
});

describe("ComunicadorView cita siguiente tras gestionar", () => {
    it("muestra la descripcion de orden por prioridad y destaca la cita siguiente tras registrar llamada", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaConLista(["CITA-1", "CITA-2", "CITA-3"]))
            .mockResolvedValueOnce(respuestaConLista(["CITA-2", "CITA-3"]));

        render(<ComunicadorView />);
        expect(screen.getByText("Ordenadas de mayor a menor prioridad.")).toBeInTheDocument();
        expect(await screen.findByText("Cita siguiente: ninguna")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Llamar CITA-1" }));
        await screen.findByRole("dialog", { name: "Registrar llamada" });
        fireEvent.click(screen.getByRole("button", { name: "Simular llamada registrada" }));

        expect(await screen.findByText("Cita siguiente: CITA-2")).toBeInTheDocument();
    });

    it("salta al siguiente candidato disponible si otro funcionario cerro la cita inmediata", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaConLista(["CITA-1", "CITA-2", "CITA-3"]))
            .mockResolvedValueOnce(respuestaConLista(["CITA-3"]));

        render(<ComunicadorView />);
        await screen.findByText("CITA-1");

        fireEvent.click(screen.getByRole("button", { name: "Llamar CITA-1" }));
        await screen.findByRole("dialog", { name: "Registrar llamada" });
        fireEvent.click(screen.getByRole("button", { name: "Simular llamada registrada" }));

        expect(await screen.findByText("Cita siguiente: CITA-3")).toBeInTheDocument();
    });

    it("usa la fila anterior como respaldo cuando se gestiona la ultima fila de la tabla", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaConLista(["CITA-1", "CITA-2", "CITA-3"]))
            .mockResolvedValueOnce(respuestaConLista(["CITA-1", "CITA-2"]));

        render(<ComunicadorView />);
        await screen.findByText("CITA-3");

        fireEvent.click(screen.getByRole("button", { name: "Llamar CITA-3" }));
        await screen.findByRole("dialog", { name: "Registrar llamada" });
        fireEvent.click(screen.getByRole("button", { name: "Simular llamada registrada" }));

        expect(await screen.findByText("Cita siguiente: CITA-2")).toBeInTheDocument();
    });

    it("limpia citaSiguienteId al cambiar de pagina o aplicar filtros", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaConLista(["CITA-1", "CITA-2"]))
            .mockResolvedValueOnce(respuestaConLista(["CITA-2"]))
            .mockResolvedValueOnce(respuestaConLista(["CITA-9"]));

        render(<ComunicadorView />);
        await screen.findByText("CITA-1");

        fireEvent.click(screen.getByRole("button", { name: "Llamar CITA-1" }));
        await screen.findByRole("dialog", { name: "Registrar llamada" });
        fireEvent.click(screen.getByRole("button", { name: "Simular llamada registrada" }));
        expect(await screen.findByText("Cita siguiente: CITA-2")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
        expect(await screen.findByText("Cita siguiente: ninguna")).toBeInTheDocument();
    });
});

describe("ComunicadorView filtros por defecto y detalle activo", () => {
    it("carga la cola por defecto con la temporalidad Agendamientos proximos", async () => {
        vi.mocked(getCitasPendientes).mockResolvedValue(respuestaConLista([]));

        render(<ComunicadorView />);

        await screen.findByText("Tabla con 0 citas. Página 1");
        expect(vi.mocked(getCitasPendientes).mock.calls[0][0]).toMatchObject({ temporalidad: "Agendamientos próximos" });
    });

    it("muestra siempre el badge de temporalidad y no la cuenta como filtro activo", async () => {
        vi.mocked(getCitasPendientes).mockResolvedValue(respuestaConLista([]));

        render(<ComunicadorView />);

        await screen.findByText("Tabla con 0 citas. Página 1");
        expect(screen.getByText("Temporalidad: Agendamientos próximos")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Filtros (1 activos)" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Limpiar filtros/ })).not.toBeInTheDocument();
    });

    it("un borrador sin aplicar no cambia los badges de la consulta vigente", async () => {
        vi.mocked(getCitasPendientes).mockResolvedValue(respuestaConLista([]));

        render(<ComunicadorView />);
        await screen.findByText("Tabla con 0 citas. Página 1");

        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getByPlaceholderText("Ej: 12345678"), { target: { value: "77777777-7" } });
        fireEvent.click(within(panel).getByRole("button", { name: "Cerrar" }));

        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument());
        expect(screen.queryByText("RUT: 77777777-7")).not.toBeInTheDocument();
        expect(screen.getByText("Temporalidad: Agendamientos próximos")).toBeInTheDocument();
    });

    it("muestra los filtros aplicados como chips que desaparecen al limpiar", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaConLista(["CITA-1"]))
            .mockResolvedValueOnce(respuestaConLista([]))
            .mockResolvedValue(respuestaConLista(["CITA-1"]));

        render(<ComunicadorView />);
        await screen.findByText("CITA-1");

        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getByPlaceholderText("Ej: 12345678"), { target: { value: "99999999-9" } });
        fireEvent.click(within(panel).getByRole("button", { name: /^Buscar$/i }));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument());

        expect(screen.getByText("RUT: 99999999-9")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }));

        await waitFor(() => expect(screen.queryByText("RUT: 99999999-9")).not.toBeInTheDocument());
        // Limpiar restaura la temporalidad inicial y su badge vuelve a mostrarla.
        expect(screen.getByText("Temporalidad: Agendamientos próximos")).toBeInTheDocument();
        expect(vi.mocked(getCitasPendientes).mock.calls[2][0]).toMatchObject({ temporalidad: "Agendamientos próximos" });
        expect((vi.mocked(getCitasPendientes).mock.calls[2][0] as { rut?: string }).rut).toBeFalsy();
    });
});

describe("ComunicadorView búsqueda global", () => {
    function paginaCon(id: string, pagina: number, total = 301): RespuestaCitas {
        const respuesta = respuestaCon(id, total);
        if (respuesta.ok) respuesta.data.pagina = pagina;
        return respuesta;
    }

    async function editarTexto(texto: string) {
        fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        const input = within(panel).getByRole("textbox", { name: "Buscar en observación clínica" });
        fireEvent.change(input, { target: { value: texto } });
        return { panel, input };
    }

    it("busca al enviar, vuelve a página 1 y muestra el resultado global del servidor", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(paginaCon("CITA-INICIAL", 2))
            .mockResolvedValueOnce(paginaCon("CITA-REMOTA", 1, 201));
        render(<ComunicadorView />);
        await screen.findByText("CITA-INICIAL");
        const { panel, input } = await editarTexto("Observación de otra página");
        expect(input).toHaveAttribute("maxlength", "200");
        expect(within(panel).getByText("Busca en todas las páginas con los filtros actuales")).toBeInTheDocument();
        expect(getCitasPendientes).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/Observación clínica:/)).not.toBeInTheDocument();
        fireEvent.click(within(panel).getByRole("button", { name: "Buscar" }));
        expect(await screen.findByText("CITA-REMOTA")).toBeInTheDocument();
        expect(screen.queryByText("CITA-INICIAL")).not.toBeInTheDocument();
        expect(screen.getByText("Tabla con 201 citas. Página 1")).toBeInTheDocument();
        expect(screen.getByText("Observación clínica: Observación de otra página")).toBeInTheDocument();
        expect(getCitasPendientes).toHaveBeenLastCalledWith(expect.objectContaining({ texto: "Observación de otra página", pagina: 1 }));
    });

    it("vuelve a consultar al enviar de nuevo el mismo texto", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(paginaCon("CITA-INICIAL", 1))
            .mockResolvedValueOnce(paginaCon("CITA-PRIMERA", 1))
            .mockResolvedValueOnce(paginaCon("CITA-ACTUALIZADA", 1));
        render(<ComunicadorView />);
        await screen.findByText("CITA-INICIAL");
        const primera = await editarTexto("control");
        fireEvent.click(within(primera.panel).getByRole("button", { name: "Buscar" }));
        await screen.findByText("CITA-PRIMERA");
        fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.submit(within(panel).getByRole("textbox", { name: "Buscar en observación clínica" }).closest("form")!);
        expect(await screen.findByText("CITA-ACTUALIZADA")).toBeInTheDocument();
        expect(getCitasPendientes).toHaveBeenLastCalledWith(expect.objectContaining({ texto: "control", pagina: 1 }));
    });

    it("pagina y refresca con el texto aplicado aunque se edite un borrador", async () => {
        let visibilidad: DocumentVisibilityState = "visible";
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibilidad });
        try {
            vi.mocked(getCitasPendientes)
                .mockResolvedValueOnce(paginaCon("CITA-INICIAL", 1))
                .mockResolvedValueOnce(paginaCon("CITA-BUSQUEDA", 1, 201))
                .mockResolvedValue(paginaCon("CITA-PAGINA2", 2, 201));
            render(<ComunicadorView />);
            await screen.findByText("CITA-INICIAL");
            const { input } = await editarTexto("aplicado");
            fireEvent.submit(input.closest("form")!);
            await screen.findByText("CITA-BUSQUEDA");
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
            const borrador = await editarTexto("sin aplicar");
            expect(getCitasPendientes).toHaveBeenCalledTimes(2);
            expect(screen.getByText("Observación clínica: aplicado")).toBeInTheDocument();
            fireEvent.click(within(borrador.panel).getByRole("button", { name: "Cerrar" }));
            fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
            await screen.findByText("CITA-PAGINA2");
            expect(getCitasPendientes).toHaveBeenLastCalledWith(expect.objectContaining({ texto: "aplicado", pagina: 2 }));
            visibilidad = "hidden";
            fireEvent(document, new Event("visibilitychange"));
            visibilidad = "visible";
            fireEvent(document, new Event("visibilitychange"));
            await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(4));
            expect(getCitasPendientes).toHaveBeenLastCalledWith(expect.objectContaining({ texto: "aplicado", pagina: 2 }));
        } finally {
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        }
    });

    it("una respuesta A posterior a B no reemplaza filas ni chips y limpiar elimina el texto", async () => {
        let resolverA!: (respuesta: RespuestaCitas) => void;
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(paginaCon("CITA-INICIAL", 1))
            .mockReturnValueOnce(new Promise((resolve) => { resolverA = resolve; }))
            .mockResolvedValueOnce(paginaCon("CITA-B", 1, 201))
            .mockResolvedValueOnce(paginaCon("CITA-LIMPIA", 1, 2));
        render(<ComunicadorView />);
        await screen.findByText("CITA-INICIAL");
        const primera = await editarTexto("consulta A");
        fireEvent.click(within(primera.panel).getByRole("button", { name: "Buscar" }));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
        const segunda = await editarTexto("consulta B");
        fireEvent.click(within(segunda.panel).getByRole("button", { name: "Buscar" }));
        await screen.findByText("CITA-B");
        await act(async () => resolverA(paginaCon("CITA-A", 1, 999)));
        expect(screen.queryByText("CITA-A")).not.toBeInTheDocument();
        expect(screen.getByText("CITA-B")).toBeInTheDocument();
        expect(screen.getByText("Observación clínica: consulta B")).toBeInTheDocument();
        expect(screen.queryByText("Observación clínica: consulta A")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        await screen.findByText("CITA-LIMPIA");
        expect(screen.queryByText(/Observación clínica:/)).not.toBeInTheDocument();
        expect(getCitasPendientes).toHaveBeenLastCalledWith(expect.objectContaining({ texto: undefined, pagina: 1 }));
        const limpia = await editarTexto("");
        expect(within(limpia.panel).getByRole("textbox", { name: "Buscar en observación clínica" })).toHaveValue("");
    });

    it("conserva última tabla y feedback existente cuando falla la búsqueda", async () => {
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(paginaCon("CITA-INICIAL", 1))
            .mockResolvedValueOnce({ ok: false, error: "No fue posible buscar" });
        render(<ComunicadorView />);
        await screen.findByText("CITA-INICIAL");
        const { panel } = await editarTexto("consulta fallida");
        fireEvent.click(within(panel).getByRole("button", { name: "Buscar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Se muestra la última cola cargada");
        expect(toast.error).toHaveBeenCalledWith("No fue posible buscar");
        expect(screen.getByText("CITA-INICIAL")).toBeInTheDocument();
    });
});

describe("ComunicadorView orden local y continuidad visible", () => {
    function respuestaOrdenada(ids = ["CITA-A", "CITA-B", "CITA-C"], pagina = 1, total = 3): RespuestaCitas {
        const respuesta = respuestaConLista(ids, total);
        if (respuesta.ok) {
            const dias: Record<string, number> = { "CITA-A": 2, "CITA-B": 3, "CITA-C": 1, "CITA-D": 6, "CITA-E": 5, "CITA-F": 4 };
            respuesta.data.filas = respuesta.data.filas.map((fila) => ({
                ...fila,
                fecha_estimada_atencion: new Date(Date.UTC(2026, 10, dias[fila.id_cita] ?? 10)),
                tiene_llamada_hoy: fila.id_cita === "CITA-A"
            }));
            respuesta.data.pagina = pagina;
            respuesta.data.porPagina = 100;
        }
        return respuesta;
    }

    function idsVisibles(): string[] {
        return screen.getAllByRole("row").slice(1).map((fila) => within(fila).getByText(/^CITA-/).textContent!);
    }

    function llamar(id: string) {
        const fila = screen.getByText(id).closest("tr")!;
        fireEvent.click(within(fila).getByRole("button", { name: "Llamar" }));
    }

    async function registrarA() {
        llamar("CITA-A");
        const registrar = await screen.findByRole("button", { name: "Simular llamada registrada" });
        await act(async () => fireEvent.click(registrar));
    }

    beforeEach(() => {
        estadoMocks.tablaReal = true;
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(getCitasPendientes).mockResolvedValue(respuestaOrdenada());
    });

    it("cicla fecha ascendente, descendente y prioridad original sin consultar", async () => {
        render(<ComunicadorView />);
        await screen.findByText("CITA-A");
        const fecha = screen.getByRole("button", { name: "ID / Fecha Estimada" });
        expect(idsVisibles()).toEqual(["CITA-A", "CITA-B", "CITA-C"]);
        fireEvent.click(fecha);
        expect(idsVisibles()).toEqual(["CITA-C", "CITA-A", "CITA-B"]);
        expect(screen.getByText("Orden manual de esta página")).toBeInTheDocument();
        expect(screen.queryByText("Ordenadas de mayor a menor prioridad.")).not.toBeInTheDocument();
        fireEvent.click(fecha);
        expect(idsVisibles()).toEqual(["CITA-B", "CITA-A", "CITA-C"]);
        fireEvent.click(fecha);
        expect(idsVisibles()).toEqual(["CITA-A", "CITA-B", "CITA-C"]);
        expect(screen.getByText("Ordenadas de mayor a menor prioridad.")).toBeInTheDocument();
        expect(getCitasPendientes).toHaveBeenCalledTimes(1);
    });

    it("conserva criterio al paginar y al refrescar en silencio, ordenando las filas nuevas", async () => {
        let visibilidad: DocumentVisibilityState = "visible";
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibilidad });
        try {
            const refrescada = respuestaOrdenada(["CITA-E", "CITA-D", "CITA-F"], 2, 201);
            if (refrescada.ok) refrescada.data.filas[1].fecha_estimada_atencion = new Date("2026-11-03T00:00:00Z");
            vi.mocked(getCitasPendientes)
                .mockResolvedValueOnce(respuestaOrdenada(undefined, 1, 201))
                .mockResolvedValueOnce(respuestaOrdenada(["CITA-D", "CITA-E", "CITA-F"], 2, 201))
                .mockResolvedValueOnce(refrescada);
            render(<ComunicadorView />);
            await screen.findByText("CITA-A");
            fireEvent.click(screen.getByRole("button", { name: "ID / Fecha Estimada" }));
            fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
            await screen.findByText("CITA-D");
            expect(idsVisibles()).toEqual(["CITA-F", "CITA-E", "CITA-D"]);
            expect(screen.getByRole("columnheader", { name: "ID / Fecha Estimada" })).toHaveAttribute("aria-sort", "ascending");
            visibilidad = "hidden";
            fireEvent(document, new Event("visibilitychange"));
            visibilidad = "visible";
            fireEvent(document, new Event("visibilitychange"));
            await waitFor(() => expect(idsVisibles()).toEqual(["CITA-D", "CITA-F", "CITA-E"]));
            expect(getCitasPendientes).toHaveBeenCalledTimes(3);
            expect(getCitasPendientes).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2, temporalidad: "Agendamientos próximos" }));
        } finally {
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        }
    });

    it("conserva orden al aplicar filtros y lo restablece al limpiar", async () => {
        render(<ComunicadorView />);
        await screen.findByText("CITA-A");
        fireEvent.click(screen.getByRole("button", { name: "ID / Fecha Estimada" }));
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        const panel = await screen.findByRole("dialog", { name: "Filtros" });
        fireEvent.change(within(panel).getByPlaceholderText("Ej: 12345678"), { target: { value: "11111111-1" } });
        fireEvent.click(within(panel).getByRole("button", { name: "Buscar" }));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
        expect(idsVisibles()).toEqual(["CITA-C", "CITA-A", "CITA-B"]);
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(3));
        expect(idsVisibles()).toEqual(["CITA-A", "CITA-B", "CITA-C"]);
        expect(screen.getByRole("columnheader", { name: "ID / Fecha Estimada" })).toHaveAttribute("aria-sort", "none");
    });

    it.each([
        [["CITA-A", "CITA-C", "CITA-B"], "CITA-B"],
        [["CITA-C"], "CITA-C"]
    ])("tras gestionar A elige el primer candidato visible vigente en %j", async (ids, esperado) => {
        const refrescada = respuestaOrdenada(ids);
        // La nueva fecha mueve B antes de C: Siguiente debe conservar el orden capturado antes de recargar.
        if (refrescada.ok) {
            const b = refrescada.data.filas.find((fila) => fila.id_cita === "CITA-B");
            if (b) b.fecha_estimada_atencion = new Date("2026-10-01T00:00:00Z");
        }
        vi.mocked(getCitasPendientes).mockResolvedValueOnce(respuestaOrdenada()).mockResolvedValueOnce(refrescada);
        const { container } = render(<ComunicadorView />);
        await screen.findByText("CITA-A");
        fireEvent.click(screen.getByRole("button", { name: "ID / Fecha Estimada" }));
        expect(idsVisibles()).toEqual(["CITA-C", "CITA-A", "CITA-B"]);
        expect(screen.getByText("CITA-A").closest("tr")).toHaveClass("bg-primary/15");
        await registrarA();
        await waitFor(() => expect(container.querySelector('tr[data-cita-siguiente="true"]')).toHaveTextContent(esperado));
        const fila = container.querySelector('tr[data-cita-siguiente="true"]')! as HTMLElement;
        expect(document.activeElement).toBe(within(fila).getByRole("button", { name: "Llamar" }));
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
    });

    it("no destaca ni enfoca una fila ajena si ya no queda ningún candidato", async () => {
        vi.mocked(getCitasPendientes).mockResolvedValueOnce(respuestaOrdenada()).mockResolvedValueOnce(respuestaOrdenada(["CITA-D"]));
        const { container } = render(<ComunicadorView />);
        await screen.findByText("CITA-A");
        fireEvent.click(screen.getByRole("button", { name: "ID / Fecha Estimada" }));
        await registrarA();
        await screen.findByText("CITA-D");
        expect(container.querySelector('tr[data-cita-siguiente="true"]')).toBeNull();
        expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
        expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Llamar" }));
    });

    it("al cerrarse C concurrentemente sigue con A según el orden visible C–A–B", async () => {
        vi.mocked(getCitasPendientes).mockResolvedValueOnce(respuestaOrdenada()).mockResolvedValueOnce(respuestaOrdenada(["CITA-A", "CITA-B"]));
        const { container } = render(<ComunicadorView />);
        await screen.findByText("CITA-C");
        fireEvent.click(screen.getByRole("button", { name: "ID / Fecha Estimada" }));
        llamar("CITA-C");
        fireEvent.click(await screen.findByRole("button", { name: "Simular cita cerrada" }));
        await waitFor(() => expect(container.querySelector('tr[data-cita-siguiente="true"]')).toHaveTextContent("CITA-A"));
    });

    it.each(["criterio", "página", "filtros"] as const)("limpia candidatos capturados al cambiar %s mientras se recarga la llamada", async (cambio) => {
        let resolver!: (respuesta: RespuestaCitas) => void;
        vi.mocked(getCitasPendientes)
            .mockResolvedValueOnce(respuestaOrdenada(undefined, 1, 201))
            .mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }))
            .mockResolvedValue(respuestaOrdenada(undefined, 2, 201));
        const { container } = render(<ComunicadorView />);
        await screen.findByText("CITA-A");
        fireEvent.click(screen.getByRole("button", { name: "ID / Fecha Estimada" }));
        await registrarA();
        await waitFor(() => expect(getCitasPendientes).toHaveBeenCalledTimes(2));
        if (cambio === "criterio") {
            fireEvent.click(screen.getByRole("button", { name: "Estado" }));
        } else if (cambio === "página") {
            fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        } else {
            fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
            const panel = await screen.findByRole("dialog", { name: "Filtros" });
            fireEvent.click(within(panel).getByRole("button", { name: "Buscar" }));
        }
        await act(async () => resolver(respuestaOrdenada()));
        expect(container.querySelector('tr[data-cita-siguiente="true"]')).toBeNull();
        expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
});
