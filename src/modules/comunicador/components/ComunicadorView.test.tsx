import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estadoMocks = vi.hoisted(() => ({ usuarioEditOpen: false }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("../actions/getCitasPendientes.action", () => ({ getCitasPendientes: vi.fn() }));
vi.mock("../actions/getFiltrosComunicador.action", () => ({ getFiltrosComunicador: vi.fn() }));
vi.mock("../actions/getContactoPaciente.action", () => ({ getContactoPaciente: vi.fn() }));
vi.mock("../actions/verificarCitaPendiente.action", () => ({ verificarCitaPendiente: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getCentros.action", () => ({ getCentros: vi.fn() }));
vi.mock("@/modules/comunicador/hooks/useUsuarioEdit", () => ({
    useUsuarioEdit: () => ({ open: estadoMocks.usuarioEditOpen, form: {}, saving: false, abrir: vi.fn(), cerrar: vi.fn(), onChange: vi.fn(), onSubmit: vi.fn() })
}));
vi.mock("./CitasFiltros", async (importOriginal) => {
    const real = await importOriginal<typeof import("./CitasFiltros")>();
    return {
        ...real,
        CitasFiltros: ({ valor, onCambio }: { valor: Record<string, string>; onCambio: (v: Record<string, string>) => void }) => (
            <input aria-label="RUT filtro" value={valor.rut} onChange={(e) => onCambio({ ...valor, rut: e.target.value })} />
        )
    };
});
vi.mock("./CitasPendientesTabla", () => ({
    CitasPendientesTabla: ({ filas, total, citaSiguienteId, onPagina, onGestionar, renderAcciones }: {
        filas: { id_cita: string }[];
        total: number;
        citaSiguienteId?: string | null;
        onPagina: (pagina: number) => void;
        onGestionar: (cita: { id_cita: string }) => void;
        renderAcciones: (cita: { id_cita: string }) => React.ReactNode;
    }) => (
        <div>
            <p>Tabla con {total} citas</p>
            <p>Cita siguiente: {citaSiguienteId ?? "ninguna"}</p>
            <button type="button" onClick={() => onPagina(2)}>
                Pagina 2
            </button>
            {filas.map((f) => (
                <div key={f.id_cita}>
                    <span>{f.id_cita}</span>
                    <button type="button" onClick={() => onGestionar(f)}>
                        Llamar {f.id_cita}
                    </button>
                    {renderAcciones(f)}
                </div>
            ))}
        </div>
    )
}));
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
        fireEvent.change(within(panel).getByLabelText("RUT filtro"), { target: { value: "99999999-9" } });
        fireEvent.click(within(panel).getByRole("button", { name: /Aplicar filtros/i }));
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
        fireEvent.change(within(panel).getByLabelText("RUT filtro"), { target: { value: "12345678-5" } });
        fireEvent.click(within(panel).getByRole("button", { name: /Aplicar filtros/i }));
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
        expect(screen.getByText("Tabla con 7 citas")).toBeInTheDocument();
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
        fireEvent.click(await screen.findByRole("button", { name: /Aplicar filtros/i }));
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

        await screen.findByText("Tabla con 0 citas");
        expect(vi.mocked(getCitasPendientes).mock.calls[0][0]).toMatchObject({ temporalidad: "Agendamientos próximos" });
    });

    it("la temporalidad por defecto no cuenta como filtro activo", async () => {
        vi.mocked(getCitasPendientes).mockResolvedValue(respuestaConLista([]));

        render(<ComunicadorView />);

        expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Filtros" })).not.toHaveTextContent("0");
        expect(screen.queryByText(/Temporalidad:/)).not.toBeInTheDocument();
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
        fireEvent.change(within(panel).getByLabelText("RUT filtro"), { target: { value: "99999999-9" } });
        fireEvent.click(within(panel).getByRole("button", { name: /Aplicar filtros/i }));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument());

        expect(screen.getByText("RUT: 99999999-9")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }));

        await waitFor(() => expect(screen.queryByText("RUT: 99999999-9")).not.toBeInTheDocument());
        expect(vi.mocked(getCitasPendientes).mock.calls[2][0]).toMatchObject({ temporalidad: "Agendamientos próximos" });
        expect((vi.mocked(getCitasPendientes).mock.calls[2][0] as { rut?: string }).rut).toBeFalsy();
    });
});
