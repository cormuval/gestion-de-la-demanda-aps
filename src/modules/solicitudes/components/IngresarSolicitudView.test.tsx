import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/modules/catalogos/actions/getCatalogos.action", () => ({ getCatalogos: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getCentros.action", () => ({ getCentros: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getPendientes.action", () => ({ getPendientes: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getUsuarioPorRut.action", () => ({ getUsuarioPorRut: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/crearSolicitud.action", () => ({ crearSolicitud: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/guardarUsuario.action", () => ({ actualizarUsuario: vi.fn(), crearUsuario: vi.fn() }));
vi.mock("@/modules/solicitudes/actions/getVoucherSolicitud.action", () => ({ getVoucherSolicitud: vi.fn() }));

// actions
import { getCatalogos } from "@/modules/catalogos/actions/getCatalogos.action";
import { crearSolicitud } from "@/modules/solicitudes/actions/crearSolicitud.action";
import { getCentros } from "@/modules/solicitudes/actions/getCentros.action";
import { getPendientes } from "@/modules/solicitudes/actions/getPendientes.action";
import { getUsuarioPorRut } from "@/modules/solicitudes/actions/getUsuarioPorRut.action";
import { actualizarUsuario } from "@/modules/solicitudes/actions/guardarUsuario.action";
import { getVoucherSolicitud } from "@/modules/solicitudes/actions/getVoucherSolicitud.action";
// components
import { IngresarSolicitudView } from "./IngresarSolicitudView";
// lib
import { toast } from "sonner";

const usuarioConfirmado = {
    rut: "12345678-5",
    nombre: "Paciente",
    apellido: "Demo",
    nombre_social: null,
    correo_contacto: "paciente@demo.local",
    sector: "1",
    genero: "Masculino",
    fecha_nacimiento: new Date("1990-01-01T00:00:00"),
    telefono: "+56911111111",
    telefono_alternativo: "+56922222222",
    gestante: "No aplica",
    discapacidad: "El usuario no poseé una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
    centro_id: "650",
    priorizacion_administrativa: null
};

const usuarioConfirmadoB = {
    ...usuarioConfirmado,
    rut: "11111111-1",
    nombre: "Paciente B"
};

const solicitudDuplicada = {
    id_solicitud: "SOL-duplicada",
    centro_id: "650",
    fecha_inicio: new Date("2026-07-02T12:00:00Z"),
    descripcion: null,
    estado_solicitud: "En Curso",
    accion: "En espera de validación",
    tipo_solicitud_id: 1,
    motivo_id: 10,
    tipoSolicitud: { nombre_tipo_solicitud: "Atencion" },
    motivo: { nombre_motivo: "Control" }
};

const pendientesConDuplicado = {
    solicitudesPendientes: [solicitudDuplicada],
    citasPendientes: []
};

const pendientesExitosos = { ok: true as const, data: pendientesConDuplicado };
const usuarioEncontrado = { ok: true as const, data: { usuario: usuarioConfirmado } };

const voucherReimpreso = {
    id_solicitud: "SOL-duplicada",
    fecha_inicio: new Date("2026-07-02T12:00:00Z"),
    rut: "12345678-5",
    usuario: {
        rut: "12345678-5",
        nombre: "Paciente",
        apellido: "Demo",
        nombre_social: null,
        telefono: "+56911111111",
        telefono_alternativo: "+56922222222"
    },
    tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Atencion" },
    motivo: { id_motivo: 10, nombre_motivo: "Control" },
    centro: "CESFAM",
    disponibilidad_llamada: "Solo AM"
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVoucherSolicitud).mockReset();
    vi.mocked(getCatalogos).mockResolvedValue({
        tiposSolicitud: [{ id_tipo_solicitud: 1, nombre_tipo_solicitud: "Atencion" }],
        motivos: [
            { id_motivo: 10, tipo_solicitud_id: 1, nombre_motivo: "Control" },
            { id_motivo: 11, tipo_solicitud_id: 1, nombre_motivo: "Otro motivo" }
        ]
    });
    vi.mocked(getCentros).mockResolvedValue([{ id_centro: "650", nombre_centro: "CESFAM" }]);
    vi.mocked(getPendientes).mockResolvedValue(pendientesExitosos as unknown as Awaited<ReturnType<typeof getPendientes>>);
    vi.mocked(getUsuarioPorRut).mockResolvedValue(usuarioEncontrado as Awaited<ReturnType<typeof getUsuarioPorRut>>);
});

async function buscarRutConfirmado() {
    render(<IngresarSolicitudView centroActivoId="650" />);

    fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));

    await screen.findByText("Paciente Demo");
}

async function completarFormularioSolicitud(motivo = "10") {
    const [tipoSolicitud] = screen.getAllByRole("combobox");
    fireEvent.change(tipoSolicitud, { target: { value: "1" } });

    await screen.findByText("Control");
    const [, motivoSolicitud, disponibilidad] = screen.getAllByRole("combobox");
    fireEvent.change(motivoSolicitud, { target: { value: motivo } });
    fireEvent.change(disponibilidad, { target: { value: "Solo AM" } });
}

function obtenerCamposSolicitud() {
    const [tipoSolicitud, motivoSolicitud, disponibilidad] = screen.getAllByRole("combobox");
    return {
        tipoSolicitud,
        motivoSolicitud,
        disponibilidad,
        descripcion: screen.getAllByRole("textbox").at(-1)!
    };
}

function obtenerVoucherVisible(): HTMLElement {
    return screen.getByText("Voucher de solicitud").closest(".fixed") as HTMLElement;
}

const resultadoCreacionExitosa = {
    ok: true as const,
    data: {
        solicitud: {
            id_solicitud: "SOL-nueva",
            estado_solicitud: "En Curso",
            fecha_inicio: new Date("2026-07-03T12:00:00"),
            centro_id: "650",
            descripcion: null,
            disponibilidad_llamada: "Solo AM",
            priorizacion_admin: null,
            ultimo_control: null,
            accion: "En espera de validación",
            usuario: {
                rut: "12345678-5",
                nombre: "Paciente",
                apellido: "Demo",
                nombre_social: null,
                telefono: "+56911111111",
                telefono_alternativo: "+56922222222"
            },
            tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Atencion" },
            motivo: { id_motivo: 11, nombre_motivo: "Otro motivo" }
        },
        voucher: {
            id_solicitud: "SOL-nueva",
            fecha_inicio: new Date("2026-07-03T12:00:00"),
            rut: "12345678-5",
            usuario: {
                rut: "12345678-5",
                nombre: "Paciente",
                apellido: "Demo",
                nombre_social: null,
                telefono: "+56911111111",
                telefono_alternativo: "+56922222222"
            },
            tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Atencion" },
            motivo: { id_motivo: 11, nombre_motivo: "Otro motivo" },
            centro: "CESFAM",
            disponibilidad_llamada: "Solo AM"
        }
    }
};

describe("IngresarSolicitudView mantener usuario", () => {
    it("bloquea el cambio de paciente durante la creacion y abre el voucher confirmado", async () => {
        let resolverCreacion!: (value: Awaited<ReturnType<typeof crearSolicitud>>) => void;
        vi.mocked(crearSolicitud).mockReturnValueOnce(new Promise((resolve) => { resolverCreacion = resolve; }));
        await buscarRutConfirmado();
        await completarFormularioSolicitud("11");

        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        await waitFor(() => expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled());
        expect(screen.getByPlaceholderText("RUT usuario")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Buscar pendientes" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" })).toBeDisabled();
        expect(screen.getByPlaceholderText("RUT usuario")).toHaveValue("12.345.678-5");

        await act(async () => {
            resolverCreacion(resultadoCreacionExitosa as Awaited<ReturnType<typeof crearSolicitud>>);
        });

        expect(await screen.findByText("Voucher de solicitud")).toBeInTheDocument();
        expect(screen.getByText("SOL-nueva")).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("Solicitud creada: SOL-nueva");
    });

    it("muestra el control desmarcado solo despues de confirmar al usuario y lo reinicia al buscar otro RUT", async () => {
        vi.mocked(getUsuarioPorRut)
            .mockResolvedValueOnce(usuarioEncontrado as Awaited<ReturnType<typeof getUsuarioPorRut>>)
            .mockResolvedValueOnce({ ok: true, data: { usuario: usuarioConfirmadoB } } as Awaited<ReturnType<typeof getUsuarioPorRut>>);
        render(<IngresarSolicitudView centroActivoId="650" />);
        expect(screen.queryByRole("checkbox", { name: "Mantener usuario para otra solicitud" })).not.toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));
        const checkbox = await screen.findByRole("checkbox", { name: "Mantener usuario para otra solicitud" });
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "11.111.111-1" } });

        expect(screen.getByPlaceholderText("RUT usuario")).toHaveValue("11.111.111-1");
        expect(screen.queryByText("Paciente Demo")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Guardar solicitud" })).not.toBeInTheDocument();
        expect(screen.queryByRole("checkbox", { name: "Mantener usuario para otra solicitud" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));

        await screen.findByText(/Paciente B/);
        expect(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" })).not.toBeChecked();
    });

    it("reinicia paciente y formulario tras crear una solicitud sin mantenerlo", async () => {
        vi.mocked(crearSolicitud).mockResolvedValue(resultadoCreacionExitosa as Awaited<ReturnType<typeof crearSolicitud>>);
        await buscarRutConfirmado();
        await completarFormularioSolicitud("11");
        fireEvent.change(obtenerCamposSolicitud().descripcion, { target: { value: "Descripcion de prueba" } });

        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        await screen.findByText("Voucher de solicitud");
        expect(screen.getByPlaceholderText("RUT usuario")).toHaveValue("");
        expect(screen.queryByText("Paciente Demo")).not.toBeInTheDocument();
        expect(screen.queryByRole("checkbox", { name: "Mantener usuario para otra solicitud" })).not.toBeInTheDocument();
        expect(screen.queryByText("Pendientes del paciente")).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));
        await screen.findByText("Paciente Demo");
        const [tipoSolicitud] = screen.getAllByRole("combobox");
        const descripcion = screen.getAllByRole("textbox").at(-1)!;
        expect(tipoSolicitud).toHaveValue("");
        fireEvent.change(tipoSolicitud, { target: { value: "1" } });
        const [, motivoSolicitud, disponibilidad] = screen.getAllByRole("combobox");
        expect(motivoSolicitud).toHaveValue("");
        expect(disponibilidad).toHaveValue("");
        expect(descripcion).toHaveValue("");
    });

    it("conserva al paciente, limpia el formulario y refresca sus pendientes al mantenerlo", async () => {
        const pendientesActualizados = {
            solicitudesPendientes: [{ ...solicitudDuplicada, id_solicitud: "SOL-nueva", motivo_id: 11, motivo: { nombre_motivo: "Otro motivo" } }],
            citasPendientes: []
        };
        vi.mocked(getPendientes)
            .mockResolvedValueOnce(pendientesExitosos as unknown as Awaited<ReturnType<typeof getPendientes>>)
            .mockResolvedValueOnce({ ok: true, data: pendientesActualizados } as unknown as Awaited<ReturnType<typeof getPendientes>>);
        vi.mocked(crearSolicitud).mockResolvedValue(resultadoCreacionExitosa as Awaited<ReturnType<typeof crearSolicitud>>);
        await buscarRutConfirmado();
        await completarFormularioSolicitud("11");
        fireEvent.change(obtenerCamposSolicitud().descripcion, { target: { value: "Descripcion de prueba" } });
        fireEvent.click(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" }));

        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        await screen.findByText("Voucher de solicitud");
        expect(screen.getByText("Paciente Demo")).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" })).toBeChecked();
        const [tipoSolicitud, disponibilidad] = screen.getAllByRole("combobox");
        const descripcion = screen.getAllByRole("textbox").at(-1)!;
        expect(tipoSolicitud).toHaveValue("");
        expect(disponibilidad).toHaveValue("");
        expect(descripcion).toHaveValue("");
        expect(screen.getAllByRole("combobox")).toHaveLength(2);
        expect(getPendientes).toHaveBeenLastCalledWith("12.345.678-5");
        expect(await screen.findByTitle("SOL-nueva")).toBeInTheDocument();
    });

    it("mantiene bloqueada una segunda creacion hasta terminar el refresco de la primera", async () => {
        let resolverRefresco!: (value: Awaited<ReturnType<typeof getPendientes>>) => void;
        const refrescoPendiente = new Promise<Awaited<ReturnType<typeof getPendientes>>>((resolve) => {
            resolverRefresco = resolve;
        });
        vi.mocked(getPendientes)
            .mockResolvedValueOnce(pendientesExitosos as unknown as Awaited<ReturnType<typeof getPendientes>>)
            .mockReturnValueOnce(refrescoPendiente);
        vi.mocked(crearSolicitud).mockResolvedValue(resultadoCreacionExitosa as Awaited<ReturnType<typeof crearSolicitud>>);

        await buscarRutConfirmado();
        await completarFormularioSolicitud("11");
        fireEvent.click(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        expect(await screen.findByText("Voucher de solicitud")).toBeInTheDocument();
        const botonBloqueado = screen.getByRole("button", { name: "Guardar solicitud" });
        expect(botonBloqueado).toBeDisabled();
        fireEvent.click(botonBloqueado);
        expect(crearSolicitud).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolverRefresco(pendientesExitosos as unknown as Awaited<ReturnType<typeof getPendientes>>);
        });

        expect(screen.getByRole("button", { name: "Guardar solicitud" })).not.toBeDisabled();
    });

    it("conserva paciente, control y formulario cuando crear solicitud devuelve un error", async () => {
        vi.mocked(crearSolicitud).mockResolvedValue({ ok: false, error: "Error de negocio" } as Awaited<ReturnType<typeof crearSolicitud>>);
        await buscarRutConfirmado();
        await completarFormularioSolicitud("11");
        fireEvent.change(obtenerCamposSolicitud().descripcion, { target: { value: "Descripcion de prueba" } });
        fireEvent.click(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" }));

        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error de negocio"));
        expect(screen.getByText("Paciente Demo")).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" })).toBeChecked();
        const { tipoSolicitud, motivoSolicitud, disponibilidad, descripcion } = obtenerCamposSolicitud();
        expect(tipoSolicitud).toHaveValue("1");
        expect(motivoSolicitud).toHaveValue("11");
        expect(disponibilidad).toHaveValue("Solo AM");
        expect(descripcion).toHaveValue("Descripcion de prueba");
    });

    it.each([
        ["devuelve un error", () => Promise.resolve({ ok: false, error: "No fue posible actualizar pendientes" }), "No fue posible actualizar pendientes"],
        ["lanza una excepcion", () => Promise.reject(new Error("detalle tecnico")), "Error al actualizar pendientes"]
    ])("mantiene paciente y abre el voucher si el refresco de pendientes %s", async (_caso, refrescarPendientes, advertencia) => {
        vi.mocked(getPendientes)
            .mockResolvedValueOnce(pendientesExitosos as unknown as Awaited<ReturnType<typeof getPendientes>>)
            .mockImplementationOnce(refrescarPendientes as typeof getPendientes);
        vi.mocked(crearSolicitud).mockResolvedValue(resultadoCreacionExitosa as Awaited<ReturnType<typeof crearSolicitud>>);
        await buscarRutConfirmado();
        await completarFormularioSolicitud("11");
        fireEvent.change(obtenerCamposSolicitud().descripcion, { target: { value: "Descripcion de prueba" } });
        fireEvent.click(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" }));

        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        expect(await screen.findByText("Voucher de solicitud")).toBeInTheDocument();
        expect(screen.getByText("Paciente Demo")).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" })).toBeChecked();
        const [tipoSolicitud, disponibilidad] = screen.getAllByRole("combobox");
        const descripcion = screen.getAllByRole("textbox").at(-1)!;
        expect(tipoSolicitud).toHaveValue("");
        expect(disponibilidad).toHaveValue("");
        expect(descripcion).toHaveValue("");
        expect(screen.getAllByRole("combobox")).toHaveLength(2);
        fireEvent.change(tipoSolicitud, { target: { value: "1" } });
        const [, motivoSolicitud, disponibilidadConMotivo] = screen.getAllByRole("combobox");
        expect(motivoSolicitud).toHaveValue("");
        expect(disponibilidadConMotivo).toHaveValue("");
        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(advertencia));
    });

    it.each([
        ["resuelve con pendientes de A", (resolve: (value: Awaited<ReturnType<typeof getPendientes>>) => void, _reject: (reason?: unknown) => void) => resolve({ ok: true, data: pendientesConDuplicado } as unknown as Awaited<ReturnType<typeof getPendientes>>)],
        ["devuelve un error de A", (resolve: (value: Awaited<ReturnType<typeof getPendientes>>) => void, _reject: (reason?: unknown) => void) => resolve({ ok: false, error: "Pendientes de A no disponibles" } as Awaited<ReturnType<typeof getPendientes>>)],
        ["lanza un error de A", (_resolve: (value: Awaited<ReturnType<typeof getPendientes>>) => void, reject: (reason?: unknown) => void) => reject(new Error("detalle tecnico A"))]
    ])("descarta el refresco obsoleto cuando %s y el flujo activo ya es B", async (_caso, completarRefrescoA) => {
        let resolverRefrescoA!: (value: Awaited<ReturnType<typeof getPendientes>>) => void;
        let rechazarRefrescoA!: (reason?: unknown) => void;
        const refrescoA = new Promise<Awaited<ReturnType<typeof getPendientes>>>((resolve, reject) => {
            resolverRefrescoA = resolve;
            rechazarRefrescoA = reject;
        });
        const pendientesB = {
            solicitudesPendientes: [{ ...solicitudDuplicada, id_solicitud: "SOL-B" }],
            citasPendientes: []
        };
        vi.mocked(getPendientes)
            .mockResolvedValueOnce(pendientesExitosos as unknown as Awaited<ReturnType<typeof getPendientes>>)
            .mockReturnValueOnce(refrescoA)
            .mockResolvedValueOnce({ ok: true, data: pendientesB } as unknown as Awaited<ReturnType<typeof getPendientes>>);
        vi.mocked(getUsuarioPorRut)
            .mockResolvedValueOnce(usuarioEncontrado as Awaited<ReturnType<typeof getUsuarioPorRut>>)
            .mockResolvedValueOnce({ ok: true, data: { usuario: usuarioConfirmadoB } } as Awaited<ReturnType<typeof getUsuarioPorRut>>);
        vi.mocked(crearSolicitud).mockResolvedValue(resultadoCreacionExitosa as Awaited<ReturnType<typeof crearSolicitud>>);

        await buscarRutConfirmado();
        await completarFormularioSolicitud("11");
        fireEvent.click(screen.getByRole("checkbox", { name: "Mantener usuario para otra solicitud" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));
        await screen.findByText("Voucher de solicitud");
        await waitFor(() => expect(getPendientes).toHaveBeenCalledTimes(2));

        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "11.111.111-1" } });
        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));
        await screen.findByText(/Paciente B/);
        expect(await screen.findByTitle("SOL-B")).toBeInTheDocument();

        completarRefrescoA(resolverRefrescoA, rechazarRefrescoA);

        await waitFor(() => expect(screen.getByText(/Paciente B/)).toBeInTheDocument());
        expect(screen.getByTitle("SOL-B")).toBeInTheDocument();
        expect(screen.queryByTitle("SOL-duplicada")).not.toBeInTheDocument();
        expect(toast.warning).not.toHaveBeenCalled();
    });

    it("libera Buscar al cambiar el RUT durante una busqueda obsoleta", async () => {
        let resolverPendientesA!: (value: Awaited<ReturnType<typeof getPendientes>>) => void;
        const pendientesA = new Promise<Awaited<ReturnType<typeof getPendientes>>>((resolve) => {
            resolverPendientesA = resolve;
        });
        vi.mocked(getPendientes)
            .mockReturnValueOnce(pendientesA)
            .mockResolvedValueOnce({ ok: true, data: { solicitudesPendientes: [], citasPendientes: [] } } as Awaited<ReturnType<typeof getPendientes>>);
        vi.mocked(getUsuarioPorRut)
            .mockResolvedValueOnce(usuarioEncontrado as Awaited<ReturnType<typeof getUsuarioPorRut>>)
            .mockResolvedValueOnce({ ok: true, data: { usuario: usuarioConfirmadoB } } as Awaited<ReturnType<typeof getUsuarioPorRut>>);
        render(<IngresarSolicitudView centroActivoId="650" />);

        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
        fireEvent.click(screen.getByRole("button", { name: "Buscar pendientes" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Buscando..." })).toBeDisabled());

        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "11.111.111-1" } });
        expect(screen.getByRole("button", { name: "Buscar pendientes" })).not.toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Buscar pendientes" }));
        await screen.findByText(/Paciente B/);

        resolverPendientesA(pendientesExitosos as unknown as Awaited<ReturnType<typeof getPendientes>>);

        await waitFor(() => expect(screen.getByRole("button", { name: "Buscar pendientes" })).not.toBeDisabled());
        expect(screen.getByText(/Paciente B/)).toBeInTheDocument();
    });
});

describe("IngresarSolicitudView duplicados", () => {
    it("permite guardar Control cronico respiratorio aunque exista una solicitud pendiente coincidente", async () => {
        vi.mocked(getCatalogos).mockResolvedValue({
            tiposSolicitud: [{ id_tipo_solicitud: 1, nombre_tipo_solicitud: "Control cronico respiratorio" }],
            motivos: [{ id_motivo: 10, tipo_solicitud_id: 1, nombre_motivo: "Control" }]
        });

        await buscarRutConfirmado();
        await completarFormularioSolicitud();

        expect(screen.queryByText("Solicitud duplicada")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar solicitud" })).not.toBeDisabled();
    });

    it("permite guardar Control de salud mental aunque exista una solicitud pendiente con el mismo motivo", async () => {
        vi.mocked(getCatalogos).mockResolvedValue({
            tiposSolicitud: [{ id_tipo_solicitud: 1, nombre_tipo_solicitud: "Control de salud mental" }],
            motivos: [{ id_motivo: 10, tipo_solicitud_id: 1, nombre_motivo: "Control" }]
        });

        await buscarRutConfirmado();
        await completarFormularioSolicitud();

        expect(screen.queryByText("Solicitud duplicada")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar solicitud" })).not.toBeDisabled();
    });

    it("vuelve a bloquear el duplicado al cambiar desde un programa exceptuado a Atencion", async () => {
        vi.mocked(getCatalogos).mockResolvedValue({
            tiposSolicitud: [
                { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Control cronico respiratorio" },
                { id_tipo_solicitud: 2, nombre_tipo_solicitud: "Atencion" }
            ],
            motivos: [
                { id_motivo: 10, tipo_solicitud_id: 1, nombre_motivo: "Control respiratorio" },
                { id_motivo: 20, tipo_solicitud_id: 2, nombre_motivo: "Control atencion" }
            ]
        });
        vi.mocked(getPendientes).mockResolvedValue({
            ok: true,
            data: {
                solicitudesPendientes: [
                    solicitudDuplicada,
                    { ...solicitudDuplicada, id_solicitud: "SOL-atencion", tipo_solicitud_id: 2, motivo_id: 20, tipoSolicitud: { nombre_tipo_solicitud: "Atencion" }, motivo: { nombre_motivo: "Control atencion" } }
                ],
                citasPendientes: []
            }
        } as Awaited<ReturnType<typeof getPendientes>>);

        await buscarRutConfirmado();
        const [tipoSolicitud] = screen.getAllByRole("combobox");
        fireEvent.change(tipoSolicitud, { target: { value: "1" } });
        const [, motivoRespiratorio, disponibilidad] = screen.getAllByRole("combobox");
        fireEvent.change(motivoRespiratorio, { target: { value: "10" } });
        fireEvent.change(disponibilidad, { target: { value: "Solo AM" } });

        expect(screen.queryByText("Solicitud duplicada")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar solicitud" })).not.toBeDisabled();

        fireEvent.change(tipoSolicitud, { target: { value: "2" } });
        const [, motivoAtencion] = screen.getAllByRole("combobox");
        fireEvent.change(motivoAtencion, { target: { value: "20" } });

        expect(screen.getByText("Solicitud duplicada")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar solicitud" })).toBeDisabled();
    });

    it("muestra aviso y deshabilita guardar cuando tipo y motivo ya tienen solicitud en curso", async () => {
        await buscarRutConfirmado();
        await completarFormularioSolicitud();

        expect(screen.getByText("Solicitud duplicada")).toBeInTheDocument();
        expect(screen.getByText(/Ya existe la solicitud SOL-icada/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar solicitud" })).toBeDisabled();
    });

    it("oculta el aviso y habilita guardar al cambiar a otro motivo", async () => {
        await buscarRutConfirmado();
        await completarFormularioSolicitud();

        const [, motivoSolicitud] = screen.getAllByRole("combobox");
        fireEvent.change(motivoSolicitud, { target: { value: "11" } });

        expect(screen.queryByText("Solicitud duplicada")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar solicitud" })).not.toBeDisabled();
    });

    it("muestra error de negocio, refresca pendientes y conserva el formulario", async () => {
        vi.mocked(getPendientes)
            .mockResolvedValueOnce({ ok: true, data: { solicitudesPendientes: [], citasPendientes: [] } } as Awaited<ReturnType<typeof getPendientes>>)
            .mockResolvedValueOnce(pendientesExitosos as unknown as Awaited<ReturnType<typeof getPendientes>>);
        vi.mocked(crearSolicitud).mockResolvedValue({ ok: false, error: "Ya existe una solicitud en curso" } as Awaited<ReturnType<typeof crearSolicitud>>);

        await buscarRutConfirmado();
        await completarFormularioSolicitud();

        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ya existe una solicitud en curso"));
        expect(getPendientes).toHaveBeenLastCalledWith("12345678-5");
        const [tipoSolicitud, motivoSolicitud, disponibilidad] = screen.getAllByRole("combobox");
        expect(tipoSolicitud).toHaveValue("1");
        expect(motivoSolicitud).toHaveValue("10");
        expect(disponibilidad).toHaveValue("Solo AM");
    });

    it("conserva el mensaje original si el refresco de pendientes devuelve un error esperado", async () => {
        vi.mocked(getPendientes)
            .mockResolvedValueOnce({ ok: true, data: { solicitudesPendientes: [], citasPendientes: [] } } as Awaited<ReturnType<typeof getPendientes>>)
            .mockResolvedValueOnce({ ok: false, error: "RUT usuario es requerido" } as Awaited<ReturnType<typeof getPendientes>>);
        vi.mocked(crearSolicitud).mockResolvedValue({ ok: false, error: "Ya existe una solicitud en curso" } as Awaited<ReturnType<typeof crearSolicitud>>);

        await buscarRutConfirmado();
        await completarFormularioSolicitud();

        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ya existe una solicitud en curso"));
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Guardar solicitud" })).toBeInTheDocument();
    });

    it("muestra exito y voucher cuando la solicitud se crea", async () => {
        vi.mocked(getPendientes).mockResolvedValue({ ok: true, data: { solicitudesPendientes: [], citasPendientes: [] } } as Awaited<ReturnType<typeof getPendientes>>);
        vi.mocked(crearSolicitud).mockResolvedValue({
            ok: true,
            data: {
                solicitud: {
                    id_solicitud: "SOL-nueva",
                    estado_solicitud: "En Curso",
                    fecha_inicio: new Date("2026-07-03T12:00:00"),
                    centro_id: "650",
                    descripcion: null,
                    disponibilidad_llamada: "Solo AM",
                    priorizacion_admin: null,
                    ultimo_control: null,
                    accion: "En espera de validación",
                    usuario: {
                        rut: "12345678-5",
                        nombre: "Paciente",
                        apellido: "Demo",
                        nombre_social: null,
                        telefono: "+56911111111",
                        telefono_alternativo: "+56922222222"
                    },
                    tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Atencion" },
                    motivo: { id_motivo: 10, nombre_motivo: "Control" }
                },
                voucher: {
                    id_solicitud: "SOL-nueva",
                    fecha_inicio: new Date("2026-07-03T12:00:00"),
                    rut: "12345678-5",
                    usuario: {
                        rut: "12345678-5",
                        nombre: "Paciente",
                        apellido: "Demo",
                        nombre_social: null,
                        telefono: "+56911111111",
                        telefono_alternativo: "+56922222222"
                    },
                    tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Atencion" },
                    motivo: { id_motivo: 10, nombre_motivo: "Control" },
                    centro: "CESFAM",
                    disponibilidad_llamada: "Solo AM"
                }
            }
        } as Awaited<ReturnType<typeof crearSolicitud>>);

        await buscarRutConfirmado();
        await completarFormularioSolicitud();

        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Solicitud creada: SOL-nueva"));
        expect(await screen.findByText("Voucher de solicitud")).toBeInTheDocument();
        expect(screen.getByText("SOL-nueva")).toBeInTheDocument();
    });
});

describe("IngresarSolicitudView reimpresion de voucher", () => {
    it("usa el centro activo y conserva los pendientes de otros centros sin reimpresion", async () => {
        vi.mocked(getUsuarioPorRut).mockResolvedValueOnce({
            ok: true, data: { usuario: { ...usuarioConfirmado, centro_id: "999" } }
        } as Awaited<ReturnType<typeof getUsuarioPorRut>>);
        vi.mocked(getPendientes).mockResolvedValueOnce({
            ok: true,
            data: {
                solicitudesPendientes: [solicitudDuplicada, { ...solicitudDuplicada, id_solicitud: "SOL-otro-centro", centro_id: "999" }],
                citasPendientes: []
            }
        } as unknown as Awaited<ReturnType<typeof getPendientes>>);

        await buscarRutConfirmado();

        expect(screen.getByTitle("SOL-otro-centro")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Reimprimir voucher SOL-otro-centro" })).not.toBeInTheDocument();
        expect(getVoucherSolicitud).not.toHaveBeenCalled();
    });

    it("consulta el voucher de la solicitud pendiente y abre el comprobante", async () => {
        vi.mocked(getVoucherSolicitud).mockResolvedValue({ ok: true, data: voucherReimpreso } as Awaited<ReturnType<typeof getVoucherSolicitud>>);

        await buscarRutConfirmado();
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" }));

        await waitFor(() => expect(getVoucherSolicitud).toHaveBeenCalledWith("SOL-duplicada"));
        expect(await screen.findByText("Voucher de solicitud")).toBeInTheDocument();
        expect(screen.getByText("SOL-duplicada")).toBeInTheDocument();
    });

    it("evita una segunda consulta mientras se esta reimprimiendo el voucher activo", async () => {
        let resolver!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        vi.mocked(getVoucherSolicitud).mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));

        await buscarRutConfirmado();
        const boton = screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" });
        fireEvent.click(boton);

        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-duplicada" })).toBeDisabled());
        fireEvent.click(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-duplicada" }));

        expect(getVoucherSolicitud).toHaveBeenCalledOnce();

        resolver({ ok: true, data: voucherReimpreso } as Awaited<ReturnType<typeof getVoucherSolicitud>>);
        await screen.findByText("Voucher de solicitud");
    });

    it("muestra el error de negocio y no abre el comprobante cuando no obtiene el voucher", async () => {
        vi.mocked(getVoucherSolicitud).mockResolvedValue({ ok: false, error: "Solicitud no encontrada" } as Awaited<ReturnType<typeof getVoucherSolicitud>>);

        await buscarRutConfirmado();
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Solicitud no encontrada"));
        expect(screen.queryByText("Voucher de solicitud")).not.toBeInTheDocument();
        expect(screen.getByText("Paciente Demo")).toBeInTheDocument();
        expect(screen.getByTitle("SOL-duplicada")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" })).not.toBeDisabled();
    });

    it("permite reimprimir otra solicitud mientras conserva la carga de la primera", async () => {
        const solicitudOtra = { ...solicitudDuplicada, id_solicitud: "SOL-otra" };
        vi.mocked(getPendientes).mockResolvedValue({
            ok: true,
            data: { solicitudesPendientes: [solicitudDuplicada, solicitudOtra], citasPendientes: [] }
        } as unknown as Awaited<ReturnType<typeof getPendientes>>);
        let resolverPrimero!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        let resolverSegundo!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        vi.mocked(getVoucherSolicitud)
            .mockReturnValueOnce(new Promise((resolve) => { resolverPrimero = resolve; }))
            .mockReturnValueOnce(new Promise((resolve) => { resolverSegundo = resolve; }));

        await buscarRutConfirmado();
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-duplicada" })).toBeDisabled());

        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-otra" }));
        await waitFor(() => expect(getVoucherSolicitud).toHaveBeenNthCalledWith(2, "SOL-otra"));
        expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-duplicada" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-otra" })).toBeDisabled();

        resolverPrimero({ ok: false, error: "No disponible" } as Awaited<ReturnType<typeof getVoucherSolicitud>>);
        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" })).not.toBeDisabled());
        expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-otra" })).toBeDisabled();

        resolverSegundo({ ok: false, error: "No disponible" } as Awaited<ReturnType<typeof getVoucherSolicitud>>);
        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-otra" })).not.toBeDisabled());
    });

    it("conserva el voucher de la reimpresion mas reciente si las respuestas llegan invertidas", async () => {
        const solicitudOtra = { ...solicitudDuplicada, id_solicitud: "SOL-otra" };
        const voucherOtra = { ...voucherReimpreso, id_solicitud: "SOL-otra" };
        vi.mocked(getPendientes).mockResolvedValue({
            ok: true,
            data: { solicitudesPendientes: [solicitudDuplicada, solicitudOtra], citasPendientes: [] }
        } as unknown as Awaited<ReturnType<typeof getPendientes>>);
        let resolverPrimera!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        let resolverSegunda!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        vi.mocked(getVoucherSolicitud)
            .mockReturnValueOnce(new Promise((resolve) => { resolverPrimera = resolve; }))
            .mockReturnValueOnce(new Promise((resolve) => { resolverSegunda = resolve; }));

        await buscarRutConfirmado();
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" }));
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-otra" }));

        await act(async () => {
            resolverSegunda({ ok: true, data: voucherOtra } as Awaited<ReturnType<typeof getVoucherSolicitud>>);
        });
        expect(within(obtenerVoucherVisible()).getByText("SOL-otra")).toBeInTheDocument();

        await act(async () => {
            resolverPrimera({ ok: true, data: voucherReimpreso } as Awaited<ReturnType<typeof getVoucherSolicitud>>);
        });
        expect(within(obtenerVoucherVisible()).getByText("SOL-otra")).toBeInTheDocument();
        expect(within(obtenerVoucherVisible()).queryByText("SOL-duplicada")).not.toBeInTheDocument();
    });

    it("mantiene el voucher creado si una reimpresion anterior termina despues", async () => {
        let resolverReimpresion!: (value: Awaited<ReturnType<typeof getVoucherSolicitud>>) => void;
        vi.mocked(getVoucherSolicitud).mockReturnValueOnce(new Promise((resolve) => { resolverReimpresion = resolve; }));
        vi.mocked(crearSolicitud).mockResolvedValue(resultadoCreacionExitosa as Awaited<ReturnType<typeof crearSolicitud>>);
        await buscarRutConfirmado();
        await completarFormularioSolicitud("11");

        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Reimprimiendo voucher SOL-duplicada" })).toBeDisabled());
        fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));

        expect(await screen.findByText("SOL-nueva")).toBeInTheDocument();
        await act(async () => {
            resolverReimpresion({ ok: true, data: voucherReimpreso } as Awaited<ReturnType<typeof getVoucherSolicitud>>);
        });

        expect(within(obtenerVoucherVisible()).getByText("SOL-nueva")).toBeInTheDocument();
        expect(within(obtenerVoucherVisible()).queryByText("SOL-duplicada")).not.toBeInTheDocument();
    });

    it("muestra un error generico, conserva al paciente y libera la carga si la consulta falla", async () => {
        vi.mocked(getVoucherSolicitud).mockRejectedValue(new Error("detalle sensible"));

        await buscarRutConfirmado();
        fireEvent.click(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al reimprimir voucher"));
        expect(screen.getByText("Paciente Demo")).toBeInTheDocument();
        expect(screen.getByTitle("SOL-duplicada")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reimprimir voucher SOL-duplicada" })).not.toBeDisabled();
    });
});

describe("IngresarSolicitudView errores esperados de consulta", () => {
    it("oculta el detalle tecnico cuando falla la busqueda de pendientes", async () => {
        vi.mocked(getPendientes).mockRejectedValue(new Error("detalle sensible"));

        render(<IngresarSolicitudView centroActivoId="650" />);
        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al buscar pendientes"));
        expect(toast.error).not.toHaveBeenCalledWith("detalle sensible");
    });

    it("muestra un solo error de pendientes sin confirmar al usuario ni dejar estado parcial", async () => {
        vi.mocked(getPendientes).mockResolvedValue({ ok: false, error: "rutUsuario es requerido" } as Awaited<ReturnType<typeof getPendientes>>);

        render(<IngresarSolicitudView centroActivoId="650" />);
        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("rutUsuario es requerido"));
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Paciente Demo")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Crear usuario" })).not.toBeInTheDocument();
    });

    it("muestra un solo error de usuario sin confirmar al usuario ni dejar estado parcial", async () => {
        vi.mocked(getUsuarioPorRut).mockResolvedValue({ ok: false, error: "RUT invalido" } as Awaited<ReturnType<typeof getUsuarioPorRut>>);

        render(<IngresarSolicitudView centroActivoId="650" />);
        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("RUT invalido"));
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Paciente Demo")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Crear usuario" })).not.toBeInTheDocument();
    });
});

describe("IngresarSolicitudView guardado de usuario", () => {
    it("mantiene abierto el formulario y sus valores cuando actualizar usuario retorna un error de negocio", async () => {
        vi.mocked(actualizarUsuario).mockResolvedValue({ ok: false, error: "Centro no encontrado" } as Awaited<ReturnType<typeof actualizarUsuario>>);

        await buscarRutConfirmado();
        fireEvent.click(screen.getByRole("button", { name: "Editar usuario" }));
        fireEvent.change(screen.getByDisplayValue("Paciente"), { target: { value: "Paciente actualizado" } });
        vi.mocked(toast.success).mockClear();
        fireEvent.submit(screen.getByRole("button", { name: "Guardar usuario" }).closest("form")!);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Centro no encontrado"));
        expect(screen.getAllByText("Editar usuario")).toHaveLength(2);
        expect(screen.getByDisplayValue("Paciente actualizado")).toBeInTheDocument();
        expect(toast.success).not.toHaveBeenCalled();
    });
});

describe("IngresarSolicitudView edad del usuario", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-10T12:00:00"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function buscarRutConfirmadoConTiempoFalso() {
        render(<IngresarSolicitudView centroActivoId="650" />);

        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
            fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));
            await Promise.resolve();
        });
    }

    it("muestra los años cumplidos del usuario", async () => {
        vi.mocked(getUsuarioPorRut).mockResolvedValueOnce({
            ok: true,
            data: { usuario: { ...usuarioConfirmado, fecha_nacimiento: new Date("1990-01-01T00:00:00") } }
        } as Awaited<ReturnType<typeof getUsuarioPorRut>>);

        await buscarRutConfirmadoConTiempoFalso();

        expect(screen.getByText("Edad:")).toBeInTheDocument();
        expect(screen.getByText("36 años")).toBeInTheDocument();
    });

    it("considera los cumpleaños aun no cumplidos", async () => {
        vi.mocked(getUsuarioPorRut).mockResolvedValueOnce({
            ok: true,
            data: { usuario: { ...usuarioConfirmado, fecha_nacimiento: new Date("1990-12-01T00:00:00") } }
        } as Awaited<ReturnType<typeof getUsuarioPorRut>>);

        await buscarRutConfirmadoConTiempoFalso();

        expect(screen.getByText("35 años")).toBeInTheDocument();
    });

    it("informa la fecha de nacimiento ausente sin bloquear la edicion", async () => {
        vi.mocked(getUsuarioPorRut).mockResolvedValueOnce({
            ok: true,
            data: { usuario: { ...usuarioConfirmado, fecha_nacimiento: null } }
        } as Awaited<ReturnType<typeof getUsuarioPorRut>>);

        await buscarRutConfirmadoConTiempoFalso();

        expect(screen.getByText("Falta fecha de nacimiento")).toHaveClass("text-primary");
        expect(screen.queryByText("NaN años")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Editar usuario" })).toBeInTheDocument();
    });

    it("informa la fecha de nacimiento invalida sin bloquear la edicion", async () => {
        vi.mocked(getUsuarioPorRut).mockResolvedValueOnce({
            ok: true,
            data: { usuario: { ...usuarioConfirmado, fecha_nacimiento: "fecha-invalida" } }
        } as Awaited<ReturnType<typeof getUsuarioPorRut>>);

        await buscarRutConfirmadoConTiempoFalso();

        expect(screen.getByText("Falta fecha de nacimiento")).toHaveClass("text-primary");
        expect(screen.queryByText("NaN años")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Editar usuario" })).toBeInTheDocument();
    });
});
