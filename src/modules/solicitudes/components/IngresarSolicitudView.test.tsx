import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const solicitudDuplicada = {
    id_solicitud: "SOL-duplicada",
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
    render(<IngresarSolicitudView />);

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

describe("IngresarSolicitudView duplicados", () => {
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
        } as Awaited<ReturnType<typeof getPendientes>>);
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

        render(<IngresarSolicitudView />);
        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al buscar pendientes"));
        expect(toast.error).not.toHaveBeenCalledWith("detalle sensible");
    });

    it("muestra un solo error de pendientes sin confirmar al usuario ni dejar estado parcial", async () => {
        vi.mocked(getPendientes).mockResolvedValue({ ok: false, error: "rutUsuario es requerido" } as Awaited<ReturnType<typeof getPendientes>>);

        render(<IngresarSolicitudView />);
        fireEvent.change(screen.getByPlaceholderText("RUT usuario"), { target: { value: "12.345.678-5" } });
        fireEvent.click(screen.getByRole("button", { name: /Buscar pendientes/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("rutUsuario es requerido"));
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Paciente Demo")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Crear usuario" })).not.toBeInTheDocument();
    });

    it("muestra un solo error de usuario sin confirmar al usuario ni dejar estado parcial", async () => {
        vi.mocked(getUsuarioPorRut).mockResolvedValue({ ok: false, error: "RUT invalido" } as Awaited<ReturnType<typeof getUsuarioPorRut>>);

        render(<IngresarSolicitudView />);
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
