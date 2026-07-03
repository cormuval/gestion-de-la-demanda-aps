"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check, Filter, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
// actions
import { getRevisionCatalogos } from "@/modules/solicitudes/actions/getRevisionCatalogos.action";
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
import { gestionarSolicitud } from "@/modules/solicitudes/actions/gestionarSolicitud.action";
// schemas
import {
    ACCION_REALIZAR_SOLICITUD,
    ACCION_RECHAZAR_SOLICITUD,
    PRIORIDADES_CLINICAS,
    RAZONES_RECHAZO,
    TIPO_PRESTACION_EXAMENES,
    TIPO_PRESTACION_PROFESIONAL
} from "@/modules/solicitudes/schemas/revision.schema";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
// types
import type { SolicitudFiltros } from "@/modules/solicitudes/schemas/solicitud.schema";

type SolicitudesResponse = Awaited<ReturnType<typeof getSolicitudes>>;
type SolicitudRow = SolicitudesResponse["solicitudes"][number];
type RevisionCatalogos = Awaited<ReturnType<typeof getRevisionCatalogos>>;
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
const emptyCatalogos: RevisionCatalogos = { tiposSolicitud: [], motivos: [], profesionales: [], prestaciones: [] };

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

export default function RevisarSolicitudesPage() {
    const [filters, setFilters] = useState<SolicitudFiltros>({ rut: "", tipoSolicitudId: "", motivoId: "", fechaDesde: "", fechaHasta: "", page: 1 });
    const [data, setData] = useState<SolicitudesResponse>(emptyResponse);
    const [catalogos, setCatalogos] = useState<RevisionCatalogos>(emptyCatalogos);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionsOpen, setActionsOpen] = useState<string | null>(null);
    const [rechazoSolicitud, setRechazoSolicitud] = useState<SolicitudRow | null>(null);
    const [realizarSolicitud, setRealizarSolicitud] = useState<SolicitudRow | null>(null);
    const [razonRechazo, setRazonRechazo] = useState<RazonRechazo | "">("");
    const [observacionRechazo, setObservacionRechazo] = useState("");
    const [citas, setCitas] = useState<CitaForm[]>([emptyCita()]);

    useEffect(() => {
        getRevisionCatalogos()
            .then(setCatalogos)
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
            setData(result);
            setFilters((current) => ({ ...current, page: result.page }));
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
        setActionsOpen(null);
        setRechazoSolicitud(solicitud);
        setRazonRechazo("");
        setObservacionRechazo("");
    }

    function openRealizar(solicitud: SolicitudRow) {
        setActionsOpen(null);
        setRealizarSolicitud(solicitud);
        setCitas([emptyCita()]);
    }

    async function confirmarRechazo(event: React.FormEvent) {
        event.preventDefault();
        if (!rechazoSolicitud) return;
        setSaving(true);
        try {
            await gestionarSolicitud({
                id_solicitud: rechazoSolicitud.id_solicitud,
                accion: ACCION_RECHAZAR_SOLICITUD,
                razon_rechazo: razonRechazo as RazonRechazo,
                observacion_rechazo: observacionRechazo
            });
            toast.success("Solicitud rechazada");
            setRechazoSolicitud(null);
            await loadSolicitudes(filters);
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
            await gestionarSolicitud({
                id_solicitud: realizarSolicitud.id_solicitud,
                accion: ACCION_REALIZAR_SOLICITUD,
                citas: citasPayload
            });
            toast.success("Solicitud realizada");
            setRealizarSolicitud(null);
            await loadSolicitudes(filters);
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
                    <form className="grid gap-4 md:grid-cols-5" onSubmit={handleSubmit}>
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
                        <Field label="Desde">
                            <Input type="date" value={filters.fechaDesde ?? ""} onChange={(e) => updateFilter("fechaDesde", e.target.value)} />
                        </Field>
                        <Field label="Hasta">
                            <Input type="date" value={filters.fechaHasta ?? ""} onChange={(e) => updateFilter("fechaHasta", e.target.value)} />
                        </Field>
                        <div className="md:col-span-5">
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
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[1200px] text-left text-sm">
                            <thead className="bg-muted text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 font-medium">ID</th>
                                    <th className="px-3 py-2 font-medium">Fecha</th>
                                    <th className="px-3 py-2 font-medium">RUT</th>
                                    <th className="px-3 py-2 font-medium">Nombre usuario</th>
                                    <th className="px-3 py-2 font-medium">Tipo solicitud</th>
                                    <th className="px-3 py-2 font-medium">Motivo</th>
                                    <th className="px-3 py-2 font-medium">Priorizacion administrativa</th>
                                    <th className="px-3 py-2 font-medium">Descripcion</th>
                                    <th className="px-3 py-2 font-medium">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.solicitudes.length === 0 ? (
                                    <tr>
                                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={9}>
                                            No hay solicitudes en espera de validacion para los filtros actuales.
                                        </td>
                                    </tr>
                                ) : (
                                    data.solicitudes.map((s) => (
                                        <tr key={s.id_solicitud} className="border-t">
                                            <td className="px-3 py-3 font-medium">{s.id_solicitud}</td>
                                            <td className="px-3 py-3">{new Date(s.fecha_inicio).toLocaleDateString("es-CL")}</td>
                                            <td className="px-3 py-3">{s.rut_usuario}</td>
                                            <td className="px-3 py-3">
                                                {s.usuario?.nombre} {s.usuario?.apellido}
                                            </td>
                                            <td className="px-3 py-3">{s.tipoSolicitud?.nombre_tipo_solicitud || "-"}</td>
                                            <td className="px-3 py-3">{s.motivo?.nombre_motivo || "-"}</td>
                                            <td className="px-3 py-3">
                                                <Badge variant="muted">{s.priorizacion_admin ?? "-"}</Badge>
                                            </td>
                                            <td className="max-w-[260px] px-3 py-3">{s.descripcion || "-"}</td>
                                            <td className="relative px-3 py-3">
                                                <Button type="button" variant="outline" onClick={() => setActionsOpen((current) => (current === s.id_solicitud ? null : s.id_solicitud))}>
                                                    <MoreHorizontal size={16} />
                                                    Gestionar
                                                </Button>
                                                {actionsOpen === s.id_solicitud && (
                                                    <div className="absolute right-3 z-20 mt-2 w-52 rounded-md border bg-background p-2 shadow-lg">
                                                        <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => openRealizar(s)}>
                                                            <Check size={16} />
                                                            Realizar solicitud
                                                        </Button>
                                                        <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => openRechazo(s)}>
                                                            <X size={16} />
                                                            Rechazar solicitud
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
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
                    onSubmit={confirmarRealizar}
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

function RechazoModal({
    solicitud,
    razon,
    observacion,
    saving,
    onRazonChange,
    onObservacionChange,
    onClose,
    onSubmit
}: {
    solicitud: SolicitudRow;
    razon: string;
    observacion: string;
    saving: boolean;
    onRazonChange: (value: RazonRechazo | "") => void;
    onObservacionChange: (value: string) => void;
    onClose: () => void;
    onSubmit: (event: React.FormEvent) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-md border bg-background shadow-lg">
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold">Rechazar solicitud</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{solicitud.id_solicitud}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
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
            </div>
        </div>
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
    onSubmit: (event: React.FormEvent) => void;
}) {
    const minDate = new Date().toISOString().slice(0, 10);
    const maxDate = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().slice(0, 10);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md border bg-background shadow-lg">
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold">Realizar solicitud</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{solicitud.id_solicitud}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
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
            </div>
        </div>
    );
}
