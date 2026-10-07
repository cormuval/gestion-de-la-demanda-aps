"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, Copy, Edit, Eye, Filter, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
// actions
import { getRevisionCatalogos } from "@/modules/solicitudes/actions/getRevisionCatalogos.action";
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
import { gestionarSolicitud } from "@/modules/solicitudes/actions/gestionarSolicitud.action";
import { getOtrasSolicitudes } from "@/modules/solicitudes/actions/getOtrasSolicitudes.action";
import { actualizarUsuario } from "@/modules/solicitudes/actions/guardarUsuario.action";
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
import { Badge } from "@/shared/components/ui/badge";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { EditarCitaDialog } from "@/modules/solicitudes/components/EditarCitaDialog";
import { ListaPendientes } from "@/modules/solicitudes/components/PendientesCascada";
import { UsuarioEditFormState, UsuarioEditModal } from "@/modules/solicitudes/components/UsuarioEditModal";
// types
import type { SolicitudFiltros } from "@/modules/solicitudes/schemas/solicitud.schema";
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

const emptyResponse: SolicitudesResponse = { solicitudes: [], total: 0, page: 1, pageSize: 100, totalPages: 1 };
const emptyCatalogos: RevisionCatalogos = { tiposSolicitud: [], motivos: [], profesionales: [], prestaciones: [], centros: [] };
const emptyOtrasContexto: OtrasSolicitudesResponse = { solicitudes: [], citas: [] };
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
    const [filters, setFilters] = useState<SolicitudFiltros>({ rut: "", tipoSolicitudId: "", motivoId: "", sector: "", edadDesde: "", edadHasta: "", fechaDesde: "", fechaHasta: "", page: 1 });
    const [data, setData] = useState<SolicitudesResponse>(emptyResponse);
    const [catalogos, setCatalogos] = useState<RevisionCatalogos>(emptyCatalogos);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rechazoSolicitud, setRechazoSolicitud] = useState<SolicitudRow | null>(null);
    const [realizarSolicitud, setRealizarSolicitud] = useState<SolicitudRow | null>(null);
    const [razonRechazo, setRazonRechazo] = useState<RazonRechazo | "">("");
    const [observacionRechazo, setObservacionRechazo] = useState("");
    const [citas, setCitas] = useState<CitaForm[]>([emptyCita()]);
    const [otrasSolicitudBase, setOtrasSolicitudBase] = useState<SolicitudRow | null>(null);
    const [otrasContexto, setOtrasContexto] = useState<OtrasSolicitudesResponse>(emptyOtrasContexto);
    const [citaEditando, setCitaEditando] = useState<CitaCascadaConEdicion | null>(null);
    const [loadingOtras, setLoadingOtras] = useState(false);
    const [usuarioForm, setUsuarioForm] = useState<UsuarioEditFormState>(emptyUsuarioForm);
    const [editingUsuario, setEditingUsuario] = useState<SolicitudRow | null>(null);
    const [savingUsuario, setSavingUsuario] = useState(false);
    const [resumenGestion, setResumenGestion] = useState<GestionResumen | null>(null);
    const accionOrigenRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        getRevisionCatalogos()
            .then((result) => {
                if (!result.ok) {
                    toast.error(result.error);
                    return;
                }
                setCatalogos(result.data);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cargar catalogos"));
    }, []);

    useEffect(() => {
        loadSolicitudes(filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const motivosFiltrados = useMemo(() => {
        if (!filters.tipoSolicitudId) return catalogos.motivos;
        return catalogos.motivos.filter((m) => String(m.tipo_solicitud_id) === String(filters.tipoSolicitudId));
    }, [catalogos.motivos, filters.tipoSolicitudId]);

    async function loadSolicitudes(nextFilters: SolicitudFiltros = filters) {
        setLoading(true);
        try {
            const result = await getSolicitudes(nextFilters);
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            setData(result.data);
            setFilters((current) => ({ ...current, page: result.data.page }));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al consultar solicitudes");
        } finally {
            setLoading(false);
        }
    }

    function updateFilter(field: keyof SolicitudFiltros, value: string) {
        setFilters((current) => ({ ...current, [field]: value, page: 1, ...(field === "tipoSolicitudId" ? { motivoId: "" } : {}) }));
    }

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        loadSolicitudes({ ...filters, page: 1 });
    }

    function openRechazo(solicitud: SolicitudRow) {
        accionOrigenRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setRechazoSolicitud(solicitud);
        setRazonRechazo("");
        setObservacionRechazo("");
    }

    function openRealizar(solicitud: SolicitudRow) {
        accionOrigenRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setRealizarSolicitud(solicitud);
        setCitas([emptyCita()]);
    }

    async function cargarContexto(solicitud: SolicitudRow) {
        setLoadingOtras(true);
        try {
            const result = await getOtrasSolicitudes(solicitud.rut_usuario, solicitud.id_solicitud);
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            setOtrasContexto(result.data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al consultar solicitudes y citas");
        } finally {
            setLoadingOtras(false);
        }
    }

    async function openOtrasSolicitudes(solicitud: SolicitudRow) {
        setOtrasSolicitudBase(solicitud);
        await cargarContexto(solicitud);
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
            await loadSolicitudes(filters);
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
                return;
            }
            toast.success("Solicitud rechazada");
            setRechazoSolicitud(null);
            setResumenGestion(result.data.resumen);
            await loadSolicitudes(filters);
            if (otrasSolicitudBase) await cargarContexto(otrasSolicitudBase);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al rechazar solicitud");
        } finally {
            setSaving(false);
        }
    }

    async function confirmarRealizar(event: React.FormEvent) {
        event.preventDefault();
        if (!realizarSolicitud) return;
        setSaving(true);
        try {
            const citasPayload = citas.map((cita) => {
                if (!cita.priorizacion_clinica) throw new Error("Selecciona priorizacion clinica en todas las citas");
                return {
                    tipo_prestacion: cita.tipo_prestacion,
                    profesional_id: cita.tipo_prestacion === TIPO_PRESTACION_PROFESIONAL ? cita.profesional_id : null,
                    prestacion_id: cita.tipo_prestacion === TIPO_PRESTACION_PROFESIONAL ? cita.prestacion_id : null,
                    fecha_estimada_atencion: cita.fecha_estimada_atencion,
                    observacion: cita.observacion,
                    priorizacion_clinica: cita.priorizacion_clinica
                };
            });
            const result = await gestionarSolicitud({
                id_solicitud: realizarSolicitud.id_solicitud,
                accion: ACCION_REALIZAR_SOLICITUD,
                citas: citasPayload
            });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            toast.success("Solicitud realizada");
            setRealizarSolicitud(null);
            setResumenGestion(result.data.resumen);
            await loadSolicitudes(filters);
            if (otrasSolicitudBase) await cargarContexto(otrasSolicitudBase);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al realizar solicitud");
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
        loadSolicitudes({ ...filters, page: nextPage });
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Revisar solicitudes</h1>
                <p className="mt-1 text-sm text-muted-foreground">Solicitudes en espera de validacion para el centro del funcionario activo.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Consulta por RUT, tipo, motivo y fecha de ingreso.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-4 md:grid-cols-4 xl:grid-cols-8" onSubmit={handleSubmit}>
                        <Field label="RUT">
                            <Input value={filters.rut ?? ""} onChange={(e) => updateFilter("rut", e.target.value)} />
                        </Field>
                        <Field label="Tipo solicitud">
                            <Select value={filters.tipoSolicitudId ?? ""} onChange={(e) => updateFilter("tipoSolicitudId", e.target.value)}>
                                <option value="">Todos</option>
                                {catalogos.tiposSolicitud.map((tipo) => (
                                    <option key={tipo.id_tipo_solicitud} value={tipo.id_tipo_solicitud}>
                                        {tipo.nombre_tipo_solicitud}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Motivo">
                            <Select value={filters.motivoId ?? ""} onChange={(e) => updateFilter("motivoId", e.target.value)}>
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
                        <div className="md:col-span-4 xl:col-span-8">
                            <Button disabled={loading}>
                                <Filter size={16} />
                                {loading ? "Consultando..." : "Aplicar filtros"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Solicitudes pendientes</CardTitle>
                    <CardDescription>
                        {data.total} solicitudes encontradas. Pagina {data.page} de {data.totalPages}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <TooltipProvider>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Solicitud</TableHead>
                                        <TableHead>Paciente</TableHead>
                                        <TableHead>Tipo / Motivo</TableHead>
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
                                        data.solicitudes.map((s) => (
                                            <TableRow key={s.id_solicitud}>
                                                <TableCell className="align-top font-medium">
                                                    <div className="flex flex-col gap-1">
                                                        <CodigoId id={s.id_solicitud} />
                                                        <span className="text-xs font-normal text-muted-foreground">{formatFechaSolicitud(s.fecha_inicio)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="flex flex-col gap-1">
                                                        <span>
                                                            {s.usuario?.nombre} {s.usuario?.apellido}
                                                        </span>
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
                    loading={loadingOtras}
                    onClose={() => {
                        setOtrasSolicitudBase(null);
                        setOtrasContexto(emptyOtrasContexto);
                    }}
                    onRealizar={openRealizar}
                    onRechazar={openRechazo}
                    onEditarUsuario={openEditarUsuario}
                    onEditarCita={setCitaEditando}
                />
            )}

            {citaEditando && otrasSolicitudBase && (
                <EditarCitaDialog
                    cita={citaEditando}
                    open
                    onOpenChange={(open) => {
                        if (!open) setCitaEditando(null);
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
                        <Textarea value={observacion} onChange={(e) => onObservacionChange(e.target.value)} />
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
    loading,
    onClose,
    onRealizar,
    onRechazar,
    onEditarUsuario,
    onEditarCita
}: {
    solicitudBase: SolicitudRow;
    contexto: OtrasSolicitudesResponse;
    loading: boolean;
    onClose: () => void;
    onRealizar: (solicitud: SolicitudRow) => void;
    onRechazar: (solicitud: SolicitudRow) => void;
    onEditarUsuario: (solicitud: SolicitudRow) => void;
    onEditarCita: (cita: CitaContexto) => void;
}) {
    const estaVacio = contexto.solicitudes.length === 0 && contexto.citas.length === 0;

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[86vh] max-w-5xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Solicitudes y citas en curso</DialogTitle>
                    <DialogDescription>RUT {solicitudBase.rut_usuario} · solo tu centro</DialogDescription>
                </DialogHeader>

                {loading ? (
                    <p className="text-sm text-muted-foreground">Consultando solicitudes y citas...</p>
                ) : estaVacio ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">No hay otras solicitudes ni citas en curso para este RUT en tu centro.</div>
                ) : (
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
                        accionesCita={(cita) =>
                            cita.editable ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => onEditarCita(cita)}>
                                    <Pencil data-icon="inline-start" />
                                    Editar
                                </Button>
                            ) : null
                        }
                    />
                )}
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
