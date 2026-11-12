"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, CircleAlert, Copy, Edit, Eye, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
// actions
import { getRevisionCatalogos } from "@/modules/solicitudes/actions/getRevisionCatalogos.action";
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
import { gestionarSolicitud } from "@/modules/solicitudes/actions/gestionarSolicitud.action";
import { getOtrasSolicitudes } from "@/modules/solicitudes/actions/getOtrasSolicitudes.action";
import { actualizarUsuario } from "@/modules/solicitudes/actions/guardarUsuario.action";
import { verificarSolicitudPendiente } from "@/modules/solicitudes/actions/verificarSolicitudPendiente.action";
// schemas
import {
    ACCION_ESPERA_VALIDACION,
    ACCION_REALIZAR_SOLICITUD,
    ACCION_RECHAZAR_SOLICITUD,
    PRIORIDADES_CLINICAS,
    RAZONES_RECHAZO,
    TIPO_PRESTACION_EXAMENES,
    TIPO_PRESTACION_PROFESIONAL
} from "@/modules/solicitudes/schemas/revision.schema";
import { DISCAPACIDAD_USUARIO, GENEROS_USUARIO, GESTANTE_USUARIO } from "@/modules/solicitudes/schemas/usuario.schema";
// components
import { NombrePaciente } from "@/shared/components/pacientes/nombre-paciente";
import { EncabezadoOrdenable } from "@/shared/components/tablas/encabezado-ordenable";
import { Badge } from "@/shared/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { TablaSkeleton } from "@/shared/components/feedback/tabla-skeleton";
import { PanelFiltros, contarFiltrosActivos } from "@/shared/components/filtros/panel-filtros";
import { Textarea } from "@/shared/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { EditarFechaEstimadaCitaDialog } from "@/modules/solicitudes/components/EditarFechaEstimadaCitaDialog";
import { EditarPrioridadCitaDialog } from "@/modules/solicitudes/components/EditarPrioridadCitaDialog";
import { ListaPendientes } from "@/modules/solicitudes/components/PendientesCascada";
import { UsuarioEditFormState, UsuarioEditModal } from "@/modules/solicitudes/components/UsuarioEditModal";
import { RegistrarLlamadaModal, type CitaParaLlamada } from "@/modules/comunicador/components/RegistrarLlamadaModal";
// hooks
import { useRefrescoAutomatico } from "@/shared/hooks/useRefrescoAutomatico";
// lib
import { cn } from "@/shared/lib/utils";
// utils
import { ordenarSolicitudes } from "@/modules/solicitudes/utils/ordenSolicitudes";
// types
import type { ColumnaSolicitud } from "@/modules/solicitudes/utils/ordenSolicitudes";
import type { OrdenPagina } from "@/shared/lib/ordenPagina";
import type { SolicitudFiltros } from "@/modules/solicitudes/schemas/solicitud.schema";
import { ERROR_SOLICITUD_NO_PENDIENTE } from "@/modules/solicitudes/types/gestion";
import type { CitaCascadaConEdicion } from "@/modules/solicitudes/types/pendientes";

type SolicitudesResponse = Extract<Awaited<ReturnType<typeof getSolicitudes>>, { ok: true }>["data"];
type SolicitudRow = SolicitudesResponse["solicitudes"][number];
type RevisionCatalogos = Extract<Awaited<ReturnType<typeof getRevisionCatalogos>>, { ok: true }>["data"];
type OtrasSolicitudesResponse = Extract<Awaited<ReturnType<typeof getOtrasSolicitudes>>, { ok: true }>["data"];
type GestionResumen = Extract<Awaited<ReturnType<typeof gestionarSolicitud>>, { ok: true }>["data"]["resumen"];
type CitaContexto = OtrasSolicitudesResponse["citas"][number];
type TipoPrestacion = typeof TIPO_PRESTACION_EXAMENES | typeof TIPO_PRESTACION_PROFESIONAL;
type PrioridadClinica = (typeof PRIORIDADES_CLINICAS)[number];
type RazonRechazo = (typeof RAZONES_RECHAZO)[number];
type CitaForm = {
    tipo_prestacion: TipoPrestacion;
    profesional_id: string;
    prestacion_id: string;
    fecha_estimada_atencion: string;
    observacion: string;
    priorizacion_clinica: PrioridadClinica | "";
};

const COLUMNAS_TABLA = 7;
const FILTROS_VACIOS: SolicitudFiltros = { rut: "", tipoSolicitudId: "", motivoId: "", sector: "", edadDesde: "", edadHasta: "", fechaDesde: "", fechaHasta: "", texto: "", page: 1 };
const emptyResponse: SolicitudesResponse = { solicitudes: [], total: 0, page: 1, pageSize: 100, totalPages: 1 };
const emptyCatalogos: RevisionCatalogos = { tiposSolicitud: [], motivos: [], profesionales: [], prestaciones: [], centros: [] };
const emptyUsuarioForm: UsuarioEditFormState = {
    rut: "",
    nombre: "",
    apellido: "",
    nombre_social: "",
    correo_contacto: "",
    sector: "",
    genero: "",
    fecha_nacimiento: "",
    telefono: "",
    telefono_alternativo: "",
    gestante: "",
    discapacidad: "",
    centro_id: ""
};

function emptyCita(): CitaForm {
    return {
        tipo_prestacion: TIPO_PRESTACION_EXAMENES,
        profesional_id: "",
        prestacion_id: "",
        fecha_estimada_atencion: "",
        observacion: "",
        priorizacion_clinica: ""
    };
}

function toDateInput(value: Date | string | null): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function asUsuarioOption<T extends readonly string[]>(options: T, value: string | null | undefined): T[number] | "" {
    return options.includes(value ?? "") ? (value as T[number]) : "";
}

function formatFechaSolicitud(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("es-CL");
}

function DescripcionSolicitudCell({ descripcion }: { descripcion: string | null }) {
    if (!descripcion) return <span className="text-muted-foreground">-</span>;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="line-clamp-2 max-w-[20rem] cursor-help">{descripcion}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
                <p>{descripcion}</p>
            </TooltipContent>
        </Tooltip>
    );
}

function ErrorCarga({
    titulo,
    mensaje,
    etiquetaReintento,
    reintentando,
    onRetry
}: {
    titulo: string;
    mensaje: string;
    etiquetaReintento: string;
    reintentando: boolean;
    onRetry: () => void;
}) {
    return (
        <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{titulo}</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
                <p>{mensaje}</p>
                <Button type="button" variant="outline" size="sm" disabled={reintentando} onClick={onRetry}>
                    {reintentando ? "Reintentando..." : etiquetaReintento}
                </Button>
            </AlertDescription>
        </Alert>
    );
}

function toUsuarioForm(usuario: SolicitudRow["usuario"]): UsuarioEditFormState {
    const genero = asUsuarioOption(GENEROS_USUARIO, usuario?.genero);
    return {
        rut: usuario?.rut ?? "",
        nombre: usuario?.nombre ?? "",
        apellido: usuario?.apellido ?? "",
        nombre_social: usuario?.nombre_social ?? "",
        correo_contacto: usuario?.correo_contacto ?? "",
        sector: usuario?.sector ?? "",
        genero,
        fecha_nacimiento: toDateInput(usuario?.fecha_nacimiento ?? null),
        telefono: usuario?.telefono ?? "",
        telefono_alternativo: usuario?.telefono_alternativo ?? "",
        gestante: genero === "Femenino" ? asUsuarioOption(GESTANTE_USUARIO, usuario?.gestante) : "No aplica",
        discapacidad: asUsuarioOption(DISCAPACIDAD_USUARIO, usuario?.discapacidad),
        centro_id: usuario?.centro_id ?? ""
    };
}

export function RevisarSolicitudesView() {
    const [filters, setFilters] = useState<SolicitudFiltros>(FILTROS_VACIOS);
    // Filtros con los que se cargo la tabla (los de `filters` pueden estar editandose en el panel).
    const [filtrosAplicados, setFiltrosAplicados] = useState<SolicitudFiltros>(FILTROS_VACIOS);
    const [data, setData] = useState<SolicitudesResponse>(emptyResponse);
    const [orden, setOrden] = useState<OrdenPagina<ColumnaSolicitud> | null>(null);
    const solicitudesOrdenadas = useMemo(() => ordenarSolicitudes(data.solicitudes, orden), [data.solicitudes, orden]);
    const [catalogos, setCatalogos] = useState<RevisionCatalogos>(emptyCatalogos);
    const [catalogosError, setCatalogosError] = useState<string | null>(null);
    const [solicitudesError, setSolicitudesError] = useState<string | null>(null);
    const [loadingCatalogos, setLoadingCatalogos] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // Hasta la primera respuesta exitosa no hay tabla que conservar durante las recargas.
    const sinDatosAun = data === emptyResponse;
    const [rechazoSolicitud, setRechazoSolicitud] = useState<SolicitudRow | null>(null);
    const [realizarSolicitud, setRealizarSolicitud] = useState<SolicitudRow | null>(null);
    const [razonRechazo, setRazonRechazo] = useState<RazonRechazo | "">("");
    const [observacionRechazo, setObservacionRechazo] = useState("");
    const [citas, setCitas] = useState<CitaForm[]>([emptyCita()]);
    const [otrasSolicitudBase, setOtrasSolicitudBase] = useState<SolicitudRow | null>(null);
    const [otrasContexto, setOtrasContexto] = useState<OtrasSolicitudesResponse | null>(null);
    const [otrasError, setOtrasError] = useState<string | null>(null);
    const [citaEditandoPrioridad, setCitaEditandoPrioridad] = useState<CitaCascadaConEdicion | null>(null);
    const [citaEditandoFecha, setCitaEditandoFecha] = useState<CitaCascadaConEdicion | null>(null);
    const [citaLlamando, setCitaLlamando] = useState<{ cita: CitaParaLlamada; telefonos: string; correo: string } | null>(null);
    const [loadingOtras, setLoadingOtras] = useState(false);
    const [usuarioForm, setUsuarioForm] = useState<UsuarioEditFormState>(emptyUsuarioForm);
    const [editingUsuario, setEditingUsuario] = useState<SolicitudRow | null>(null);
    const [savingUsuario, setSavingUsuario] = useState(false);
    const [resumenGestion, setResumenGestion] = useState<GestionResumen | null>(null);
    const accionOrigenRef = useRef<HTMLElement | null>(null);
    // Solo la ultima peticion del listado puede actualizar la tabla.
    const ultimaPeticionRef = useRef(0);
    // Cargas normales (no silenciosas) sin responder: mientras haya alguna, no se recarga en silencio.
    const cargasNormalesEnCursoRef = useRef(0);
    // Espejo de `filtrosAplicados` para recargas disparadas desde closures antiguos (intervalo, verificacion).
    const filtrosAplicadosRef = useRef<SolicitudFiltros>(FILTROS_VACIOS);
    // Solicitud cuya vigencia se esta verificando; ignora pulsaciones repetidas.
    const verificandoRef = useRef<string | null>(null);
    const hayModalAbierto = Boolean(
        rechazoSolicitud
        || realizarSolicitud
        || otrasSolicitudBase
        || citaEditandoPrioridad
        || citaEditandoFecha
        || citaLlamando
        || editingUsuario
    );

    useRefrescoAutomatico(() => loadSolicitudes(filtrosAplicadosRef.current, { silencioso: true }), { pausado: hayModalAbierto });

    useEffect(() => {
        loadCatalogos();
    }, []);

    useEffect(() => {
        loadSolicitudes(filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const motivosFiltrados = useMemo(() => {
        if (!filters.tipoSolicitudId) return catalogos.motivos;
        return catalogos.motivos.filter((m) => String(m.tipo_solicitud_id) === String(filters.tipoSolicitudId));
    }, [catalogos.motivos, filters.tipoSolicitudId]);

    async function loadCatalogos() {
        setLoadingCatalogos(true);
        setCatalogosError(null);
        try {
            const result = await getRevisionCatalogos();
            if (!result.ok) {
                setCatalogosError(result.error);
                toast.error(result.error);
                return;
            }
            setCatalogos(result.data);
        } catch {
            const mensaje = "Error al cargar catalogos";
            setCatalogosError(mensaje);
            toast.error(mensaje);
        } finally {
            setLoadingCatalogos(false);
        }
    }

    async function loadSolicitudes(nextFilters: SolicitudFiltros = filtrosAplicados, opciones?: { silencioso?: boolean }) {
        // La recarga silenciosa (refresco automatico) no muestra carga ni errores: si falla, conserva la tabla.
        const silencioso = opciones?.silencioso ?? false;
        // Una recarga silenciosa nunca reemplaza a una carga normal pendiente: esa ya trae datos frescos.
        if (silencioso && cargasNormalesEnCursoRef.current > 0) return;
        const peticion = ++ultimaPeticionRef.current;
        const esVigente = () => peticion === ultimaPeticionRef.current;
        if (!silencioso) {
            cargasNormalesEnCursoRef.current += 1;
            setLoading(true);
            setSolicitudesError(null);
        }
        try {
            const result = await getSolicitudes(nextFilters);
            if (!esVigente()) return;
            if (!result.ok) {
                if (!silencioso) {
                    setSolicitudesError(result.error);
                    toast.error(result.error);
                }
                return;
            }
            setData(result.data);
            setFilters((current) => ({ ...current, page: result.data.page }));
            filtrosAplicadosRef.current = { ...nextFilters, page: result.data.page };
            setFiltrosAplicados(filtrosAplicadosRef.current);
        } catch {
            if (!esVigente() || silencioso) return;
            const mensaje = "Error al consultar solicitudes";
            setSolicitudesError(mensaje);
            toast.error(mensaje);
        } finally {
            if (!silencioso) {
                cargasNormalesEnCursoRef.current -= 1;
                // La carga se apaga cuando no queda ninguna carga normal pendiente, sea o no la vigente.
                if (cargasNormalesEnCursoRef.current === 0) setLoading(false);
            }
        }
    }

    function updateFilter(field: keyof SolicitudFiltros, value: string) {
        setFilters((current) => ({ ...current, [field]: value, page: 1, ...(field === "tipoSolicitudId" ? { motivoId: "" } : {}) }));
    }

    function aplicarFiltros() {
        loadSolicitudes({ ...filters, page: 1 });
    }

    function limpiarFiltros() {
        setFilters(FILTROS_VACIOS);
        setOrden(null);
        loadSolicitudes(FILTROS_VACIOS);
    }

    // Antes de gestionar confirma que la solicitud sigue pendiente: otro funcionario pudo haberla
    // gestionado mientras la tabla estaba abierta. Si la verificacion falla, se abre igual.
    async function verificarAntesDeAbrir(solicitud: SolicitudRow, abrir: () => void) {
        if (verificandoRef.current) return;
        verificandoRef.current = solicitud.id_solicitud;
        const origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        let pendiente = true;
        let estado: string | null = null;
        try {
            const result = await verificarSolicitudPendiente(solicitud.id_solicitud);
            if (result.ok) {
                pendiente = result.data.pendiente;
                estado = result.data.estado;
            }
        } catch {
            // Sin verificacion se abre igual; el guardado vuelve a validar.
        } finally {
            verificandoRef.current = null;
        }
        if (!pendiente) {
            toast.warning(estado ? `Otro funcionario ya gestionó esta solicitud (${estado})` : "Esta solicitud ya no está disponible en tu centro");
            // Si hay una carga normal pendiente (p. ej. filtros nuevos), esa ya traera la tabla al dia.
            if (cargasNormalesEnCursoRef.current === 0) void loadSolicitudes(filtrosAplicadosRef.current);
            // Si la accion se abrio desde el modal de Otras solicitudes, ese contexto tambien queda obsoleto.
            if (otrasSolicitudBase) void cargarContexto(otrasSolicitudBase);
            return;
        }
        accionOrigenRef.current = origen;
        abrir();
    }

    function openRechazo(solicitud: SolicitudRow) {
        void verificarAntesDeAbrir(solicitud, () => {
            setRechazoSolicitud(solicitud);
            setRazonRechazo("");
            setObservacionRechazo("");
        });
    }

    function openRealizar(solicitud: SolicitudRow) {
        void verificarAntesDeAbrir(solicitud, () => {
            setRealizarSolicitud(solicitud);
            setCitas([emptyCita()]);
        });
    }

    async function cargarContexto(solicitud: SolicitudRow) {
        setLoadingOtras(true);
        setOtrasContexto(null);
        setOtrasError(null);
        try {
            const result = await getOtrasSolicitudes(solicitud.rut_usuario, solicitud.id_solicitud);
            if (!result.ok) {
                setOtrasError(result.error);
                toast.error(result.error);
                return;
            }
            setOtrasContexto(result.data);
        } catch {
            const mensaje = "Error al consultar solicitudes y citas";
            setOtrasError(mensaje);
            toast.error(mensaje);
        } finally {
            setLoadingOtras(false);
        }
    }

    async function openOtrasSolicitudes(solicitud: SolicitudRow) {
        setOtrasSolicitudBase(solicitud);
        setOtrasContexto(null);
        setOtrasError(null);
        await cargarContexto(solicitud);
    }

    function openRegistrarRechazoCita(cita: CitaContexto) {
        const solicitudContextual = otrasContexto?.solicitudes.find((solicitud) => solicitud.id_solicitud === cita.solicitud_id);
        const usuario = solicitudContextual?.usuario;
        if (!usuario) return;

        const nombreUsuario = [usuario.nombre, usuario.apellido].filter(Boolean).join(" ");
        const telefonos = [usuario.telefono, usuario.telefono_alternativo].filter(Boolean).join(" · ");
        setCitaLlamando({
            cita: {
                id_cita: cita.id_cita,
                rut_usuario: usuario.rut,
                estado_cita: cita.estado_cita,
                nombre_usuario: nombreUsuario,
                nombre_social: usuario.nombre_social,
                profesion: cita.profesional?.nombre ?? null,
                prestacion: cita.prestacion?.nombre_prestacion ?? null,
                fecha_estimada_atencion: cita.fecha_estimada_atencion,
                observacion: cita.observacion
            },
            telefonos,
            correo: usuario.correo_contacto ?? ""
        });
    }

    function cerrarLlamadaYRecargarContexto(mensaje?: string) {
        setCitaLlamando(null);
        if (mensaje) toast.success(mensaje);
        if (otrasSolicitudBase) void cargarContexto(otrasSolicitudBase);
    }

    function openEditarUsuario(solicitud: SolicitudRow) {
        accionOrigenRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setEditingUsuario(solicitud);
        setUsuarioForm(toUsuarioForm(solicitud.usuario));
    }

    function updateUsuarioField(field: keyof UsuarioEditFormState, value: string) {
        setUsuarioForm((current) => ({
            ...current,
            [field]: value,
            ...(field === "genero" && value !== "Femenino" ? { gestante: "No aplica" } : {})
        }));
    }

    async function onGuardarUsuario(event: React.FormEvent) {
        event.preventDefault();
        if (!usuarioForm.genero || !usuarioForm.discapacidad) {
            toast.error("Completa genero y discapacidad del usuario");
            return;
        }
        setSavingUsuario(true);
        try {
            const genero = usuarioForm.genero;
            const discapacidad = usuarioForm.discapacidad;
            const result = await actualizarUsuario({
                ...usuarioForm,
                genero,
                discapacidad,
                gestante: genero === "Femenino" && usuarioForm.gestante ? usuarioForm.gestante : "No aplica"
            });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            toast.success("Usuario actualizado");
            setEditingUsuario(null);
            await loadSolicitudes(filtrosAplicados);
            if (otrasSolicitudBase) await cargarContexto(otrasSolicitudBase);
        } catch {
            toast.error("Error al guardar usuario");
        } finally {
            setSavingUsuario(false);
        }
    }

    async function confirmarRechazo(event: React.FormEvent) {
        event.preventDefault();
        if (!rechazoSolicitud) return;
        setSaving(true);
        try {
            const result = await gestionarSolicitud({
                id_solicitud: rechazoSolicitud.id_solicitud,
                accion: ACCION_RECHAZAR_SOLICITUD,
                razon_rechazo: razonRechazo as RazonRechazo,
                observacion_rechazo: observacionRechazo
            });
            if (!result.ok) {
                toast.error(result.error);
                if (result.error === ERROR_SOLICITUD_NO_PENDIENTE) {
                    // Otro funcionario se adelanto: el formulario ya no aplica.
                    setRechazoSolicitud(null);
                    await loadSolicitudes(filtrosAplicados);
                    if (otrasSolicitudBase) await cargarContexto(otrasSolicitudBase);
                }
                return;
            }
            toast.success("Solicitud rechazada");
            setRechazoSolicitud(null);
            setResumenGestion(result.data.resumen);
            await loadSolicitudes(filtrosAplicados);
            if (otrasSolicitudBase) await cargarContexto(otrasSolicitudBase);
        } catch {
            toast.error("Error al rechazar solicitud");
        } finally {
            setSaving(false);
        }
    }

    async function confirmarRealizar(event: React.FormEvent) {
        event.preventDefault();
        if (!realizarSolicitud) return;
        setSaving(true);
        try {
            if (citas.some((cita) => !cita.priorizacion_clinica)) {
                toast.error("Selecciona priorizacion clinica en todas las citas");
                return;
            }
            const citasPayload = citas.map((cita) => {
                return {
                    tipo_prestacion: cita.tipo_prestacion,
                    profesional_id: cita.tipo_prestacion === TIPO_PRESTACION_PROFESIONAL ? cita.profesional_id : null,
                    prestacion_id: cita.tipo_prestacion === TIPO_PRESTACION_PROFESIONAL ? cita.prestacion_id : null,
                    fecha_estimada_atencion: cita.fecha_estimada_atencion,
                    observacion: cita.observacion,
                    priorizacion_clinica: cita.priorizacion_clinica as PrioridadClinica
                };
            });
            const result = await gestionarSolicitud({
                id_solicitud: realizarSolicitud.id_solicitud,
                accion: ACCION_REALIZAR_SOLICITUD,
                citas: citasPayload
            });
            if (!result.ok) {
                toast.error(result.error);
                if (result.error === ERROR_SOLICITUD_NO_PENDIENTE) {
                    // Otro funcionario se adelanto: el formulario ya no aplica.
                    setRealizarSolicitud(null);
                    await loadSolicitudes(filtrosAplicados);
                    if (otrasSolicitudBase) await cargarContexto(otrasSolicitudBase);
                }
                return;
            }
            toast.success("Solicitud realizada");
            setRealizarSolicitud(null);
            setResumenGestion(result.data.resumen);
            await loadSolicitudes(filtrosAplicados);
            if (otrasSolicitudBase) await cargarContexto(otrasSolicitudBase);
        } catch {
            toast.error("Error al realizar solicitud");
        } finally {
            setSaving(false);
        }
    }

    function updateCita(index: number, field: keyof CitaForm, value: string) {
        setCitas((current) =>
            current.map((cita, i) =>
                i === index
                    ? {
                          ...cita,
                          [field]: value,
                          ...(field === "tipo_prestacion" ? { profesional_id: "", prestacion_id: "" } : {}),
                          ...(field === "profesional_id" ? { prestacion_id: "" } : {})
                      }
                    : cita
            )
        );
    }

    function addCita() {
        setCitas((current) => (current.length >= 5 ? current : [...current, emptyCita()]));
    }

    function removeCita(index: number) {
        setCitas((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
    }

    function cambiarPagina(page: number) {
        const nextPage = Math.min(Math.max(1, page), data.totalPages);
        loadSolicitudes({ ...filtrosAplicados, page: nextPage });
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Gestionar solicitudes</h1>
                <p className="mt-1 text-sm text-muted-foreground">Solicitudes en espera de validacion para el centro del funcionario activo.</p>
            </div>

            <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div className="min-w-0 space-y-1.5">
                        <CardTitle>Solicitudes pendientes</CardTitle>
                        <CardDescription>
                            {data.total} solicitudes encontradas. Pagina {data.page} de {data.totalPages}.
                        </CardDescription>
                    </div>
                    <PanelFiltros
                        descripcion="Consulta por descripción, RUT, tipo, motivo, sector, edad y fecha de ingreso."
                        etiquetaAplicar="Buscar"
                        activos={contarFiltrosActivos(filtrosAplicados, ["page"])}
                        aplicando={loading}
                        onAplicar={aplicarFiltros}
                        onLimpiar={limpiarFiltros}
                        aviso={
                            catalogosError ? (
                                <ErrorCarga
                                    titulo="No fue posible cargar los catalogos"
                                    mensaje={`${catalogosError}. Puedes seguir filtrando por RUT, sector, edad y fecha.`}
                                    etiquetaReintento="Reintentar catalogos"
                                    reintentando={loadingCatalogos}
                                    onRetry={loadCatalogos}
                                />
                            ) : null
                        }
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="RUT">
                                <Input value={filters.rut ?? ""} onChange={(e) => updateFilter("rut", e.target.value)} />
                            </Field>
                            <Field label="Tipo solicitud">
                                <Select value={filters.tipoSolicitudId ?? ""} disabled={loadingCatalogos} onChange={(e) => updateFilter("tipoSolicitudId", e.target.value)}>
                                    <option value="">Todos</option>
                                    {catalogos.tiposSolicitud.map((tipo) => (
                                        <option key={tipo.id_tipo_solicitud} value={tipo.id_tipo_solicitud}>
                                            {tipo.nombre_tipo_solicitud}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Motivo">
                                <Select value={filters.motivoId ?? ""} disabled={loadingCatalogos} onChange={(e) => updateFilter("motivoId", e.target.value)}>
                                    <option value="">Todos</option>
                                    {motivosFiltrados.map((motivo) => (
                                        <option key={motivo.id_motivo} value={motivo.id_motivo}>
                                            {motivo.nombre_motivo}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Sector">
                                <Input value={filters.sector ?? ""} onChange={(e) => updateFilter("sector", e.target.value)} />
                            </Field>
                            <Field label="Edad desde">
                                <Input type="number" min={0} value={filters.edadDesde ?? ""} onChange={(e) => updateFilter("edadDesde", e.target.value)} />
                            </Field>
                            <Field label="Edad hasta">
                                <Input type="number" min={0} value={filters.edadHasta ?? ""} onChange={(e) => updateFilter("edadHasta", e.target.value)} />
                            </Field>
                            <Field label="Desde">
                                <Input type="date" value={filters.fechaDesde ?? ""} onChange={(e) => updateFilter("fechaDesde", e.target.value)} />
                            </Field>
                            <Field label="Hasta">
                                <Input type="date" value={filters.fechaHasta ?? ""} onChange={(e) => updateFilter("fechaHasta", e.target.value)} />
                            </Field>
                            <div className="flex flex-col gap-2 sm:col-span-2">
                                <Label htmlFor="buscar-descripcion">Buscar en descripción</Label>
                                <Input
                                    id="buscar-descripcion"
                                    aria-describedby="ayuda-buscar-descripcion"
                                    maxLength={200}
                                    value={filters.texto ?? ""}
                                    onChange={(e) => updateFilter("texto", e.target.value)}
                                />
                                <p id="ayuda-buscar-descripcion" className="text-sm text-muted-foreground">Busca en todas las páginas con los filtros actuales</p>
                            </div>
                        </div>
                    </PanelFiltros>
                </CardHeader>
                <CardContent className="space-y-4">
                    {solicitudesError && (
                        <ErrorCarga
                            titulo="No fue posible cargar las solicitudes"
                            mensaje={solicitudesError}
                            etiquetaReintento="Reintentar solicitudes"
                            reintentando={loading}
                            onRetry={() => loadSolicitudes(filtrosAplicados)}
                        />
                    )}
                    {sinDatosAun && loading ? (
                        <TablaSkeleton columnas={COLUMNAS_TABLA} etiqueta="Consultando solicitudes..." />
                    ) : sinDatosAun && solicitudesError ? null : (
                        <>
                            <p className="text-sm text-muted-foreground">Ordena esta página</p>
                            <TooltipProvider>
                                <div className={cn("rounded-md border transition-opacity", loading && "opacity-60")} aria-busy={loading}>
                                    <Table>
                                <TableHeader>
                                    <TableRow>
                                        <EncabezadoOrdenable columna="fecha" orden={orden} onOrden={setOrden}>Solicitud / Fecha</EncabezadoOrdenable>
                                        <TableHead>Paciente</TableHead>
                                        <EncabezadoOrdenable columna="tipo" orden={orden} onOrden={setOrden}>Tipo / Motivo</EncabezadoOrdenable>
                                        <TableHead>Prioridad</TableHead>
                                        <TableHead>Descripcion</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.solicitudes.length === 0 ? (
                                        <TableRow>
                                            <TableCell className="py-6 text-center text-muted-foreground" colSpan={6}>
                                                No hay solicitudes en espera de validacion para los filtros actuales.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        solicitudesOrdenadas.map((s) => (
                                            <TableRow key={s.id_solicitud}>
                                                <TableCell className="align-top font-medium">
                                                    <div className="flex flex-col gap-1">
                                                        <CodigoId id={s.id_solicitud} />
                                                        <span className="text-xs font-normal text-muted-foreground">{formatFechaSolicitud(s.fecha_inicio)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="flex flex-col gap-1">
                                                        <NombrePaciente
                                                            nombreLegal={s.usuario ? `${s.usuario.nombre} ${s.usuario.apellido}` : null}
                                                            nombreSocial={s.usuario?.nombre_social}
                                                        />
                                                        <span className="text-xs text-muted-foreground">{s.rut_usuario}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="flex flex-col gap-1">
                                                        <span>{s.tipoSolicitud?.nombre_tipo_solicitud || "-"}</span>
                                                        <span className="text-xs text-muted-foreground">{s.motivo?.nombre_motivo || "Sin motivo"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <Badge variant="muted">{s.priorizacion_admin ?? "-"}</Badge>
                                                </TableCell>
                                                <TableCell className="max-w-[20rem] align-top">
                                                    <DescripcionSolicitudCell descripcion={s.descripcion} />
                                                </TableCell>
                                                <TableCell className="align-top text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button type="button" variant="outline" size="sm">
                                                                <MoreHorizontal data-icon="inline-start" />
                                                                Gestionar
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuGroup>
                                                                <DropdownMenuItem onSelect={() => openRealizar(s)}>
                                                                    <Check />
                                                                    Realizar solicitud
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => openRechazo(s)}>
                                                                    <X />
                                                                    Rechazar solicitud
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => openOtrasSolicitudes(s)}>
                                                                    <Eye />
                                                                    Otras solicitudes y citas
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => openEditarUsuario(s)}>
                                                                    <Edit />
                                                                    Editar usuario
                                                                </DropdownMenuItem>
                                                            </DropdownMenuGroup>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                    </Table>
                                </div>
                            </TooltipProvider>
                            <div className="flex items-center justify-between">
                                <Button type="button" variant="outline" disabled={loading || data.page <= 1} onClick={() => cambiarPagina(data.page - 1)}>
                                    Anterior
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    {data.page} / {data.totalPages}
                                </span>
                                <Button type="button" variant="outline" disabled={loading || data.page >= data.totalPages} onClick={() => cambiarPagina(data.page + 1)}>
                                    Siguiente
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {rechazoSolicitud && (
                <RechazoModal
                    solicitud={rechazoSolicitud}
                    razon={razonRechazo}
                    observacion={observacionRechazo}
                    saving={saving}
                    onRazonChange={setRazonRechazo}
                    onObservacionChange={setObservacionRechazo}
                    onClose={() => setRechazoSolicitud(null)}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        accionOrigenRef.current?.focus();
                    }}
                    onSubmit={confirmarRechazo}
                />
            )}

            {realizarSolicitud && (
                <RealizarModal
                    solicitud={realizarSolicitud}
                    catalogos={catalogos}
                    citas={citas}
                    saving={saving}
                    onChange={updateCita}
                    onAdd={addCita}
                    onRemove={removeCita}
                    onClose={() => setRealizarSolicitud(null)}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        accionOrigenRef.current?.focus();
                    }}
                    onSubmit={confirmarRealizar}
                />
            )}

            {otrasSolicitudBase && (
                <OtrasSolicitudesModal
                    solicitudBase={otrasSolicitudBase}
                    contexto={otrasContexto}
                    error={otrasError}
                    loading={loadingOtras}
                    onClose={() => {
                        setOtrasSolicitudBase(null);
                        setOtrasContexto(null);
                        setOtrasError(null);
                    }}
                    onRetry={() => cargarContexto(otrasSolicitudBase)}
                    onRealizar={openRealizar}
                    onRechazar={openRechazo}
                    onEditarUsuario={openEditarUsuario}
                    onEditarPrioridadCita={setCitaEditandoPrioridad}
                    onEditarFechaEstimadaCita={setCitaEditandoFecha}
                    onRegistrarRechazoCita={openRegistrarRechazoCita}
                />
            )}

            {citaLlamando && (
                <RegistrarLlamadaModal
                    cita={citaLlamando.cita}
                    telefonos={citaLlamando.telefonos}
                    correo={citaLlamando.correo}
                    modo="gestion_solicitudes"
                    onCerrar={() => setCitaLlamando(null)}
                    onRegistrado={(mensaje) => cerrarLlamadaYRecargarContexto(mensaje)}
                    onCitaCerrada={() => cerrarLlamadaYRecargarContexto()}
                />
            )}

            {citaEditandoPrioridad && otrasSolicitudBase && (
                <EditarPrioridadCitaDialog
                    cita={citaEditandoPrioridad}
                    open
                    onOpenChange={(open) => {
                        if (!open) setCitaEditandoPrioridad(null);
                    }}
                    onActualizada={async () => {
                        await cargarContexto(otrasSolicitudBase);
                    }}
                />
            )}

            {citaEditandoFecha && otrasSolicitudBase && (
                <EditarFechaEstimadaCitaDialog
                    cita={citaEditandoFecha}
                    open
                    onOpenChange={(open) => {
                        if (!open) setCitaEditandoFecha(null);
                    }}
                    onActualizada={async () => {
                        await cargarContexto(otrasSolicitudBase);
                    }}
                />
            )}

            {editingUsuario && (
                <UsuarioEditModal
                    form={usuarioForm}
                    centros={catalogos.centros}
                    saving={savingUsuario}
                    onChange={updateUsuarioField}
                    onClose={() => setEditingUsuario(null)}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        accionOrigenRef.current?.focus();
                    }}
                    onSubmit={onGuardarUsuario}
                />
            )}

            {resumenGestion && (
                <ResumenGestionModal
                    resumen={resumenGestion}
                    onClose={() => setResumenGestion(null)}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        accionOrigenRef.current?.focus();
                    }}
                />
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function SolicitudMeta({ solicitud }: { solicitud: SolicitudRow }) {
    return (
        <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">
            <span>RUT: {solicitud.rut_usuario}</span>
            <span>Tipo: {solicitud.tipoSolicitud?.nombre_tipo_solicitud || "-"}</span>
            <span>Motivo: {solicitud.motivo?.nombre_motivo || "-"}</span>
            {solicitud.descripcion && (
                <p className="whitespace-pre-wrap break-words sm:col-span-3">Descripción: {solicitud.descripcion}</p>
            )}
            <p className="sm:col-span-3">Orientador: {solicitud.orientador?.nombre ?? "Sin registro"}</p>
        </div>
    );
}

function formatFechaResumen(value: Date | string | null): string {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("es-CL");
}

function buildResumenTexto(resumen: GestionResumen): string {
    const lines = [
        `Solicitud: ${resumen.id_solicitud}`,
        `RUT usuario: ${resumen.rut_usuario}`,
        `Accion: ${resumen.accion || "-"}`
    ];

    if (resumen.razon_rechazo) lines.push(`Razon rechazo: ${resumen.razon_rechazo}`);
    if (resumen.observacion_rechazo) lines.push(`Observacion rechazo: ${resumen.observacion_rechazo}`);

    if (resumen.citas.length > 0) {
        lines.push("Citas asociadas:");
        resumen.citas.forEach((cita, index) => {
            lines.push(
                `${index + 1}. Profesional: ${cita.profesional || "-"} | Prestacion: ${cita.prestacion || "-"} | Fecha estimada: ${formatFechaResumen(cita.fecha_estimada_atencion)}`
            );
        });
    } else {
        lines.push("Citas asociadas: -");
    }

    return lines.join("\n");
}

function ResumenGestionModal({
    resumen,
    onClose,
    onCloseAutoFocus
}: {
    resumen: GestionResumen;
    onClose: () => void;
    onCloseAutoFocus: (event: Event) => void;
}) {
    const texto = buildResumenTexto(resumen);

    async function copiarResumen() {
        try {
            await navigator.clipboard.writeText(texto);
            toast.success("Resumen copiado");
        } catch {
            toast.error("No se pudo copiar el resumen");
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent overlayClassName="z-[60] bg-black/40" className="z-[70] max-w-3xl gap-0 p-0" onCloseAutoFocus={onCloseAutoFocus}>
                <DialogHeader className="border-b p-5 pr-12">
                    <DialogTitle>Resumen de gestion</DialogTitle>
                    <DialogDescription>
                        Solicitud <CodigoId id={resumen.id_solicitud} /> · RUT {resumen.rut_usuario}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 p-5">
                    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-3">
                        <div>
                            <p className="text-muted-foreground">ID solicitud</p>
                            <p className="font-medium">{resumen.id_solicitud}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">RUT usuario</p>
                            <p className="font-medium">{resumen.rut_usuario}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Accion</p>
                            <p className="font-medium">{resumen.accion || "-"}</p>
                        </div>
                    </div>

                    {resumen.razon_rechazo && (
                        <div className="rounded-md border p-3 text-sm">
                            <p><strong>Razon:</strong> {resumen.razon_rechazo}</p>
                            <p><strong>Observacion:</strong> {resumen.observacion_rechazo || "-"}</p>
                        </div>
                    )}

                    {resumen.citas.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader className="bg-muted text-muted-foreground">
                                    <TableRow>
                                        <TableHead>Cita</TableHead>
                                        <TableHead>Prestacion</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {resumen.citas.map((cita) => (
                                        <TableRow key={cita.id_cita}>
                                            <TableCell>
                                                <div>{cita.profesional || "-"}</div>
                                                <div className="text-xs text-muted-foreground">{formatFechaResumen(cita.fecha_estimada_atencion)}</div>
                                            </TableCell>
                                            <TableCell>{cita.prestacion || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">Gestion guardada sin citas asociadas.</div>
                    )}

                    <Textarea value={texto} readOnly rows={7} />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cerrar
                        </Button>
                        <Button type="button" onClick={copiarResumen}>
                            <Copy size={16} />
                            Copiar resumen
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function RechazoModal({
    solicitud,
    razon,
    observacion,
    saving,
    onRazonChange,
    onObservacionChange,
    onClose,
    onCloseAutoFocus,
    onSubmit
}: {
    solicitud: SolicitudRow;
    razon: string;
    observacion: string;
    saving: boolean;
    onRazonChange: (value: RazonRechazo | "") => void;
    onObservacionChange: (value: string) => void;
    onClose: () => void;
    onCloseAutoFocus: (event: Event) => void;
    onSubmit: (event: React.FormEvent) => void;
}) {
    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent overlayClassName="z-[60] bg-black/40" className="z-[70] max-w-xl gap-0 p-0" onCloseAutoFocus={onCloseAutoFocus}>
                <DialogHeader className="border-b p-5 pr-12">
                    <DialogTitle>Rechazar solicitud</DialogTitle>
                    <DialogDescription asChild>
                        <div>
                            <p className="mt-1"><CodigoId id={solicitud.id_solicitud} /></p>
                            <SolicitudMeta solicitud={solicitud} />
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <form className="space-y-4 p-5" onSubmit={onSubmit}>
                    <Field label="Razon rechazo">
                        <Select value={razon} onChange={(e) => onRazonChange(e.target.value as RazonRechazo | "")} required>
                            <option value="">Seleccionar</option>
                            {RAZONES_RECHAZO.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Observacion rechazo">
                        <Textarea
                            value={observacion}
                            maxLength={350}
                            aria-describedby="observacion-rechazo-contador"
                            onChange={(e) => onObservacionChange(e.target.value)}
                        />
                        <p id="observacion-rechazo-contador" className="text-right text-sm text-muted-foreground" aria-live="polite">
                            {observacion.length}/350
                        </p>
                    </Field>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>{saving ? "Guardando..." : "Confirmar rechazo"}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function OtrasSolicitudesModal({
    solicitudBase,
    contexto,
    error,
    loading,
    onClose,
    onRetry,
    onRealizar,
    onRechazar,
    onEditarUsuario,
    onEditarPrioridadCita,
    onEditarFechaEstimadaCita,
    onRegistrarRechazoCita
}: {
    solicitudBase: SolicitudRow;
    contexto: OtrasSolicitudesResponse | null;
    error: string | null;
    loading: boolean;
    onClose: () => void;
    onRetry: () => void;
    onRealizar: (solicitud: SolicitudRow) => void;
    onRechazar: (solicitud: SolicitudRow) => void;
    onEditarUsuario: (solicitud: SolicitudRow) => void;
    onEditarPrioridadCita: (cita: CitaContexto) => void;
    onEditarFechaEstimadaCita: (cita: CitaContexto) => void;
    onRegistrarRechazoCita: (cita: CitaContexto) => void;
}) {
    const estaVacio = contexto !== null && contexto.solicitudes.length === 0 && contexto.citas.length === 0;

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[86vh] max-w-5xl overflow-y-auto max-sm:w-[calc(100%-2rem)]">
                <DialogHeader>
                    <DialogTitle>Solicitudes y citas en curso</DialogTitle>
                    <DialogDescription>RUT {solicitudBase.rut_usuario} · solo tu centro</DialogDescription>
                </DialogHeader>

                {loading ? (
                    <p className="text-sm text-muted-foreground">Consultando solicitudes y citas...</p>
                ) : error ? (
                    <ErrorCarga
                        titulo="No fue posible cargar las solicitudes y citas"
                        mensaje={error}
                        etiquetaReintento="Reintentar contexto"
                        reintentando={loading}
                        onRetry={onRetry}
                    />
                ) : estaVacio ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">No hay otras solicitudes ni citas en curso para este RUT en tu centro.</div>
                ) : contexto ? (
                    <ListaPendientes
                        solicitudes={contexto.solicitudes}
                        citas={contexto.citas}
                        accionesSolicitud={(solicitud) => {
                            const enEspera = solicitud.accion === ACCION_ESPERA_VALIDACION;
                            return (
                                <div className="flex flex-wrap justify-end gap-2">
                                    {enEspera ? (
                                        <>
                                            <Button type="button" variant="outline" onClick={() => onRealizar(solicitud)}>
                                                <Check data-icon="inline-start" />
                                                Realizar
                                            </Button>
                                            <Button type="button" variant="outline" onClick={() => onRechazar(solicitud)}>
                                                <X data-icon="inline-start" />
                                                Rechazar
                                            </Button>
                                        </>
                                    ) : (
                                        <Badge variant="muted">Validada</Badge>
                                    )}
                                    <Button type="button" variant="outline" onClick={() => onEditarUsuario(solicitud)}>
                                        <Edit data-icon="inline-start" />
                                        Usuario
                                    </Button>
                                </div>
                            );
                        }}
                        accionesCita={(cita) => (
                            <div className="flex flex-wrap justify-end gap-2">
                                {cita.puedeRegistrarRechazo && (
                                    <Button type="button" size="sm" onClick={() => onRegistrarRechazoCita(cita)}>
                                        <X data-icon="inline-start" />
                                        Cerrar cita
                                    </Button>
                                )}
                                {cita.editable ? (
                                    <>
                                        <Button type="button" variant="outline" size="sm" onClick={() => onEditarPrioridadCita(cita)}>
                                            <Pencil data-icon="inline-start" />
                                            Editar prioridad
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => onEditarFechaEstimadaCita(cita)}>
                                            <CalendarPlus data-icon="inline-start" />
                                            Editar fecha estimada
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        )}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function RealizarModal({
    solicitud,
    catalogos,
    citas,
    saving,
    onChange,
    onAdd,
    onRemove,
    onClose,
    onCloseAutoFocus,
    onSubmit
}: {
    solicitud: SolicitudRow;
    catalogos: RevisionCatalogos;
    citas: CitaForm[];
    saving: boolean;
    onChange: (index: number, field: keyof CitaForm, value: string) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
    onClose: () => void;
    onCloseAutoFocus: (event: Event) => void;
    onSubmit: (event: React.FormEvent) => void;
}) {
    const minDate = new Date().toISOString().slice(0, 10);
    const maxDate = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().slice(0, 10);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent overlayClassName="z-[60] bg-black/40" className="z-[70] max-h-[90vh] max-w-5xl gap-0 overflow-y-auto p-0" onCloseAutoFocus={onCloseAutoFocus}>
                <DialogHeader className="border-b p-5 pr-12">
                    <DialogTitle>Realizar solicitud</DialogTitle>
                    <DialogDescription asChild>
                        <div>
                            <p className="mt-1"><CodigoId id={solicitud.id_solicitud} /></p>
                            <SolicitudMeta solicitud={solicitud} />
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <form className="space-y-4 p-5" onSubmit={onSubmit}>
                    <div className="flex justify-end">
                        <Button type="button" variant="outline" disabled={citas.length >= 5} onClick={onAdd}>
                            <Plus size={16} />
                            Agregar cita
                        </Button>
                    </div>
                    {citas.map((cita, index) => {
                        const prestaciones = catalogos.prestaciones.filter((p) => String(p.profesional_id) === String(cita.profesional_id));
                        return (
                            <div key={index} className="rounded-md border p-4">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="font-medium">Cita {index + 1}</h3>
                                    <Button type="button" variant="ghost" size="icon" disabled={citas.length === 1} onClick={() => onRemove(index)} aria-label="Eliminar cita">
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field label="Tipo de prestacion">
                                        <Select value={cita.tipo_prestacion} onChange={(e) => onChange(index, "tipo_prestacion", e.target.value)} required>
                                            <option value={TIPO_PRESTACION_EXAMENES}>{TIPO_PRESTACION_EXAMENES}</option>
                                            <option value={TIPO_PRESTACION_PROFESIONAL}>{TIPO_PRESTACION_PROFESIONAL}</option>
                                        </Select>
                                    </Field>
                                    <Field label="Fecha estimada">
                                        <Input
                                            type="date"
                                            min={minDate}
                                            max={maxDate}
                                            value={cita.fecha_estimada_atencion}
                                            onChange={(e) => onChange(index, "fecha_estimada_atencion", e.target.value)}
                                            required
                                        />
                                    </Field>
                                    {cita.tipo_prestacion === TIPO_PRESTACION_PROFESIONAL && (
                                        <>
                                            <Field label="Profesional">
                                                <Select value={cita.profesional_id} onChange={(e) => onChange(index, "profesional_id", e.target.value)} required>
                                                    <option value="">Seleccionar</option>
                                                    {catalogos.profesionales.map((profesional) => (
                                                        <option key={profesional.id_profesional} value={profesional.id_profesional}>
                                                            {profesional.nombre}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </Field>
                                            <Field label="Prestacion">
                                                <Select value={cita.prestacion_id} onChange={(e) => onChange(index, "prestacion_id", e.target.value)} required>
                                                    <option value="">Seleccionar</option>
                                                    {prestaciones.map((prestacion) => (
                                                        <option key={prestacion.id_prestacion} value={prestacion.id_prestacion}>
                                                            {prestacion.nombre_prestacion}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </Field>
                                        </>
                                    )}
                                    <Field label="Priorizacion clinica">
                                        <Select value={cita.priorizacion_clinica} onChange={(e) => onChange(index, "priorizacion_clinica", e.target.value)} required>
                                            <option value="">Seleccionar</option>
                                            {PRIORIDADES_CLINICAS.map((prioridad) => (
                                                <option key={prioridad} value={prioridad}>
                                                    {prioridad}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>
                                    <div className="md:col-span-2">
                                        <Field label="Observacion">
                                            <Textarea value={cita.observacion} onChange={(e) => onChange(index, "observacion", e.target.value)} />
                                        </Field>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>
                            <CalendarPlus size={16} />
                            {saving ? "Guardando..." : "Guardar gestion"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
