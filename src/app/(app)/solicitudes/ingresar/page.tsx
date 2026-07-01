"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
// actions
import { getCatalogos } from "@/modules/catalogos/actions/getCatalogos.action";
import { getCentros, type CentroOption } from "@/modules/solicitudes/actions/getCentros.action";
import { getPendientes } from "@/modules/solicitudes/actions/getPendientes.action";
import { getUsuarioPorRut } from "@/modules/solicitudes/actions/getUsuarioPorRut.action";
import { actualizarUsuario, crearUsuario } from "@/modules/solicitudes/actions/guardarUsuario.action";
import { crearSolicitud } from "@/modules/solicitudes/actions/crearSolicitud.action";
// schemas
import { DISCAPACIDAD_USUARIO, GENEROS_USUARIO, GESTANTE_USUARIO } from "@/modules/solicitudes/schemas/usuario.schema";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
// types
import type { Catalogos } from "@/modules/catalogos/types/catalogos";

type UsuarioConfirmado = NonNullable<Awaited<ReturnType<typeof getUsuarioPorRut>>["usuario"]>;
type Pendientes = Awaited<ReturnType<typeof getPendientes>>;

type SolicitudFormState = {
    tipo_solicitud_id: string;
    motivo_id: string;
    disponibilidad_llamada: string;
    descripcion: string;
};

type UsuarioFormState = {
    rut: string;
    nombre: string;
    apellido: string;
    nombre_social: string;
    correo_contacto: string;
    sector: string;
    genero: string;
    fecha_nacimiento: string;
    telefono: string;
    telefono_alternativo: string;
    gestante: string;
    discapacidad: string;
    centro_id: string;
};

const emptySolicitudForm: SolicitudFormState = {
    tipo_solicitud_id: "",
    motivo_id: "",
    disponibilidad_llamada: "",
    descripcion: ""
};

const emptyUsuarioForm: UsuarioFormState = {
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

const DISPONIBILIDADES_LLAMADA = ["Solo AM", "Solo PM", "AM/PM"] as const;
type DisponibilidadLlamada = (typeof DISPONIBILIDADES_LLAMADA)[number];
type GeneroUsuario = (typeof GENEROS_USUARIO)[number];
type GestanteUsuario = (typeof GESTANTE_USUARIO)[number];
type DiscapacidadUsuario = (typeof DISCAPACIDAD_USUARIO)[number];

function isDisponibilidadLlamada(value: string): value is DisponibilidadLlamada {
    return (DISPONIBILIDADES_LLAMADA as readonly string[]).includes(value);
}

function isGeneroUsuario(value: string): value is GeneroUsuario {
    return (GENEROS_USUARIO as readonly string[]).includes(value);
}

function isGestanteUsuario(value: string): value is GestanteUsuario {
    return (GESTANTE_USUARIO as readonly string[]).includes(value);
}

function isDiscapacidadUsuario(value: string): value is DiscapacidadUsuario {
    return (DISCAPACIDAD_USUARIO as readonly string[]).includes(value);
}

function toDateInput(value: Date | string | null): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function toUsuarioForm(rut: string, usuario?: UsuarioConfirmado | null): UsuarioFormState {
    if (!usuario) return { ...emptyUsuarioForm, rut };
    return {
        rut: usuario.rut,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        nombre_social: usuario.nombre_social ?? "",
        correo_contacto: usuario.correo_contacto ?? "",
        sector: usuario.sector ?? "",
        genero: usuario.genero ?? "",
        fecha_nacimiento: toDateInput(usuario.fecha_nacimiento),
        telefono: usuario.telefono ?? "",
        telefono_alternativo: usuario.telefono_alternativo ?? "",
        gestante: usuario.genero === "Femenino" ? usuario.gestante ?? "" : "No aplica",
        discapacidad: usuario.discapacidad ?? "",
        centro_id: usuario.centro_id ?? ""
    };
}

export default function IngresarSolicitudPage() {
    const [rutBusqueda, setRutBusqueda] = useState("");
    const [rutRevisado, setRutRevisado] = useState("");
    const [pendientes, setPendientes] = useState<Pendientes | null>(null);
    const [usuarioConfirmado, setUsuarioConfirmado] = useState<UsuarioConfirmado | null>(null);
    const [catalogos, setCatalogos] = useState<Catalogos>({ tiposSolicitud: [], motivos: [] });
    const [centros, setCentros] = useState<CentroOption[]>([]);
    const [solicitudForm, setSolicitudForm] = useState<SolicitudFormState>(emptySolicitudForm);
    const [usuarioForm, setUsuarioForm] = useState<UsuarioFormState>(emptyUsuarioForm);
    const [usuarioModalMode, setUsuarioModalMode] = useState<"crear" | "editar" | null>(null);
    const [loadingPendientes, setLoadingPendientes] = useState(false);
    const [submittingSolicitud, setSubmittingSolicitud] = useState(false);
    const [savingUsuario, setSavingUsuario] = useState(false);

    useEffect(() => {
        Promise.all([getCatalogos(), getCentros()])
            .then(([catalogosData, centrosData]) => {
                setCatalogos(catalogosData);
                setCentros(centrosData);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cargar datos iniciales"));
    }, []);

    const motivosFiltrados = useMemo(() => {
        if (!solicitudForm.tipo_solicitud_id) return catalogos.motivos;
        return catalogos.motivos.filter((m) => String(m.tipo_solicitud_id) === String(solicitudForm.tipo_solicitud_id));
    }, [catalogos.motivos, solicitudForm.tipo_solicitud_id]);
    const requiereMotivo = Boolean(solicitudForm.tipo_solicitud_id && motivosFiltrados.length > 0);

    function updateSolicitudField(field: keyof SolicitudFormState, value: string) {
        setSolicitudForm((current) => ({ ...current, [field]: value, ...(field === "tipo_solicitud_id" ? { motivo_id: "" } : {}) }));
    }

    function updateUsuarioField(field: keyof UsuarioFormState, value: string) {
        setUsuarioForm((current) => ({
            ...current,
            [field]: value,
            ...(field === "genero" && value !== "Femenino" ? { gestante: "No aplica" } : {})
        }));
    }

    function openCrearUsuario() {
        setUsuarioForm(toUsuarioForm(rutRevisado || rutBusqueda));
        setUsuarioModalMode("crear");
    }

    function openEditarUsuario() {
        if (!usuarioConfirmado) return;
        setUsuarioForm(toUsuarioForm(rutRevisado, usuarioConfirmado));
        setUsuarioModalMode("editar");
    }

    async function buscarPendientes(event: React.FormEvent) {
        event.preventDefault();
        setPendientes(null);
        setUsuarioConfirmado(null);
        setSolicitudForm(emptySolicitudForm);
        setLoadingPendientes(true);
        try {
            const [data, usuarioData] = await Promise.all([getPendientes(rutBusqueda), getUsuarioPorRut(rutBusqueda)]);
            setPendientes(data);
            setRutRevisado(rutBusqueda);
            const usuario = usuarioData.usuario;
            if (usuario) {
                setUsuarioConfirmado(usuario);
                toast.success("Usuario encontrado. Ya puedes ingresar la solicitud.");
            } else {
                toast.warning("No se encontro el RUT en usuarios. Crea el usuario antes de ingresar la solicitud.");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al buscar pendientes");
        } finally {
            setLoadingPendientes(false);
        }
    }

    async function onGuardarUsuario(event: React.FormEvent) {
        event.preventDefault();
        if (!usuarioModalMode) return;
        setSavingUsuario(true);
        try {
            if (!isGeneroUsuario(usuarioForm.genero) || !isGestanteUsuario(usuarioForm.gestante) || !isDiscapacidadUsuario(usuarioForm.discapacidad)) {
                toast.error("Selecciona genero, gestante y discapacidad");
                return;
            }
            const action = usuarioModalMode === "crear" ? crearUsuario : actualizarUsuario;
            const { usuario } = await action({
                ...usuarioForm,
                genero: usuarioForm.genero,
                gestante: usuarioForm.genero === "Femenino" ? usuarioForm.gestante : "No aplica",
                discapacidad: usuarioForm.discapacidad
            });
            setUsuarioConfirmado(usuario);
            setRutRevisado(usuario.rut);
            setRutBusqueda(usuario.rut);
            setUsuarioModalMode(null);
            toast.success(usuarioModalMode === "crear" ? "Usuario creado" : "Usuario actualizado");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar usuario");
        } finally {
            setSavingUsuario(false);
        }
    }

    async function onCrearSolicitud(event: React.FormEvent) {
        event.preventDefault();
        if (!usuarioConfirmado) {
            toast.error("Debes completar la revision previa y confirmar el usuario");
            return;
        }
        setSubmittingSolicitud(true);
        try {
            if (!isDisponibilidadLlamada(solicitudForm.disponibilidad_llamada)) {
                toast.error("Selecciona una disponibilidad de llamada valida");
                return;
            }
            const { solicitud } = await crearSolicitud({
                rut_usuario: usuarioConfirmado.rut,
                disponibilidad_llamada: solicitudForm.disponibilidad_llamada,
                tipo_solicitud_id: Number(solicitudForm.tipo_solicitud_id),
                motivo_id: requiereMotivo ? Number(solicitudForm.motivo_id) : null,
                descripcion: solicitudForm.descripcion
            });
            toast.success(`Solicitud creada: ${solicitud.id_solicitud}`);
            setSolicitudForm(emptySolicitudForm);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al crear solicitud");
        } finally {
            setSubmittingSolicitud(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Ingresar solicitud</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Primero busca el RUT para informar solicitudes en curso y citas pendientes antes del registro.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Revision previa</CardTitle>
                    <CardDescription>Solicitudes pendientes: estado_solicitud En Curso. Citas pendientes: Sin llamadas, No contesta (1), No contesta (2).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={buscarPendientes}>
                        <Input placeholder="RUT usuario" value={rutBusqueda} onChange={(e) => setRutBusqueda(e.target.value)} required />
                        <Button disabled={loadingPendientes}>
                            <Search size={16} />
                            {loadingPendientes ? "Buscando..." : "Buscar pendientes"}
                        </Button>
                    </form>

                    {pendientes && (
                        <UsuarioStatus usuario={usuarioConfirmado} rut={rutRevisado} centros={centros} onCrear={openCrearUsuario} onEditar={openEditarUsuario} />
                    )}
                </CardContent>
            </Card>

            {pendientes && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Solicitudes pendientes</CardTitle>
                            <CardDescription>Estado de solicitud En Curso.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pendientes.solicitudesPendientes.length === 0 ? (
                                <EmptyState text="No hay solicitudes En Curso para este RUT." />
                            ) : (
                                pendientes.solicitudesPendientes.map((s) => (
                                    <PendingRow
                                        key={s.id_solicitud}
                                        title={s.id_solicitud}
                                        badge={s.estado_solicitud}
                                        description={[
                                            `Fecha inicio: ${formatFecha(s.fecha_inicio)}`,
                                            `Tipo solicitud: ${s.tipoSolicitud?.nombre_tipo_solicitud || "-"}`,
                                            `Motivo: ${s.motivo?.nombre_motivo || "-"}`
                                        ].join(" · ")}
                                        detail={s.descripcion}
                                    />
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Citas pendientes</CardTitle>
                            <CardDescription>Estados de llamada pendientes definidos para la primera etapa.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pendientes.citasPendientes.length === 0 ? (
                                <EmptyState text="No hay citas o llamadas pendientes para este RUT." />
                            ) : (
                                pendientes.citasPendientes.map((l) => (
                                    <PendingRow key={l.id_llamada} title={l.id_llamada} badge={l.respuesta_usuario} description={l.observacion || l.solicitud?.descripcion} />
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {usuarioConfirmado && (
                <Card>
                    <CardHeader>
                        <CardTitle>Nueva solicitud</CardTitle>
                        <CardDescription>El estado inicial queda como En Curso.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="grid gap-4 lg:grid-cols-2" onSubmit={onCrearSolicitud}>
                            <Field label="RUT usuario">
                                <Input value={usuarioConfirmado.rut} disabled />
                            </Field>
                            <Field label="Usuario">
                                <Input value={`${usuarioConfirmado.nombre} ${usuarioConfirmado.apellido}`} disabled />
                            </Field>
                            <Field label="Tipo solicitud">
                                <Select value={solicitudForm.tipo_solicitud_id} onChange={(e) => updateSolicitudField("tipo_solicitud_id", e.target.value)} required>
                                    <option value="">Seleccionar</option>
                                    {catalogos.tiposSolicitud.map((t) => (
                                        <option key={t.id_tipo_solicitud} value={t.id_tipo_solicitud}>
                                            {t.nombre_tipo_solicitud}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            {requiereMotivo && (
                                <Field label="Motivo">
                                    <Select value={solicitudForm.motivo_id} onChange={(e) => updateSolicitudField("motivo_id", e.target.value)} required>
                                        <option value="">Seleccionar</option>
                                        {motivosFiltrados.map((m) => (
                                            <option key={m.id_motivo} value={m.id_motivo}>
                                                {m.nombre_motivo}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            )}
                            <Field label="Disponibilidad llamada">
                                <Select value={solicitudForm.disponibilidad_llamada} onChange={(e) => updateSolicitudField("disponibilidad_llamada", e.target.value)} required>
                                    <option value="">Seleccionar</option>
                                    {DISPONIBILIDADES_LLAMADA.map((disponibilidad) => (
                                        <option key={disponibilidad} value={disponibilidad}>
                                            {disponibilidad}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <div className="lg:col-span-2">
                                <Field label="Descripcion">
                                    <Textarea value={solicitudForm.descripcion} onChange={(e) => updateSolicitudField("descripcion", e.target.value)} />
                                </Field>
                            </div>
                            <div className="lg:col-span-2">
                                <Button disabled={submittingSolicitud}>{submittingSolicitud ? "Guardando..." : "Guardar solicitud"}</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {!usuarioConfirmado && (
                <Card>
                    <CardHeader>
                        <CardTitle>Nueva solicitud</CardTitle>
                        <CardDescription>Completa la revision previa y confirma el usuario para habilitar el ingreso.</CardDescription>
                    </CardHeader>
                </Card>
            )}

            {usuarioModalMode && (
                <UsuarioModal
                    mode={usuarioModalMode}
                    form={usuarioForm}
                    centros={centros}
                    saving={savingUsuario}
                    onChange={updateUsuarioField}
                    onClose={() => setUsuarioModalMode(null)}
                    onSubmit={onGuardarUsuario}
                />
            )}
        </div>
    );
}

function UsuarioStatus({
    usuario,
    rut,
    centros,
    onCrear,
    onEditar
}: {
    usuario: UsuarioConfirmado | null;
    rut: string;
    centros: CentroOption[];
    onCrear: () => void;
    onEditar: () => void;
}) {
    if (!usuario) {
        return (
            <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">El RUT {rut} no existe en usuarios. Debes crearlo antes de ingresar la solicitud.</p>
                <Button type="button" onClick={onCrear}>
                    <Plus size={16} />
                    Crear usuario
                </Button>
            </div>
        );
    }

    const centro = centros.find((c) => c.id_centro === usuario.centro_id);
    return (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <span>
                    <strong>RUT:</strong> {usuario.rut}
                </span>
                <span>
                    <strong>Nombre:</strong> {usuario.nombre} {usuario.apellido}
                </span>
                <span>
                    <strong>Telefono:</strong> {usuario.telefono || "-"}
                </span>
                <span>
                    <strong>Centro:</strong> {centro?.nombre_centro || usuario.centro_id || "-"}
                </span>
            </div>
            <Button type="button" variant="outline" onClick={onEditar}>
                <Pencil size={16} />
                Editar usuario
            </Button>
        </div>
    );
}

function UsuarioModal({
    mode,
    form,
    centros,
    saving,
    onChange,
    onClose,
    onSubmit
}: {
    mode: "crear" | "editar";
    form: UsuarioFormState;
    centros: CentroOption[];
    saving: boolean;
    onChange: (field: keyof UsuarioFormState, value: string) => void;
    onClose: () => void;
    onSubmit: (event: React.FormEvent) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border bg-background shadow-lg">
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold">{mode === "crear" ? "Crear usuario" : "Editar usuario"}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Completa los datos obligatorios del usuario.</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={onSubmit}>
                    <Field label="RUT">
                        <Input value={form.rut} disabled required />
                    </Field>
                    <Field label="Nombre">
                        <Input value={form.nombre} onChange={(e) => onChange("nombre", e.target.value)} required />
                    </Field>
                    <Field label="Apellido">
                        <Input value={form.apellido} onChange={(e) => onChange("apellido", e.target.value)} required />
                    </Field>
                    <Field label="Nombre social">
                        <Input value={form.nombre_social} onChange={(e) => onChange("nombre_social", e.target.value)} />
                    </Field>
                    <Field label="Correo contacto">
                        <Input type="email" value={form.correo_contacto} onChange={(e) => onChange("correo_contacto", e.target.value)} />
                    </Field>
                    <Field label="Sector">
                        <Input value={form.sector} onChange={(e) => onChange("sector", e.target.value)} />
                    </Field>
                    <Field label="Genero">
                        <Select value={form.genero} onChange={(e) => onChange("genero", e.target.value)} required>
                            <option value="">Seleccionar</option>
                            {GENEROS_USUARIO.map((genero) => (
                                <option key={genero} value={genero}>
                                    {genero}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Fecha nacimiento">
                        <Input type="date" value={form.fecha_nacimiento} onChange={(e) => onChange("fecha_nacimiento", e.target.value)} required />
                    </Field>
                    <Field label="Telefono">
                        <Input value={form.telefono} onChange={(e) => onChange("telefono", e.target.value)} required />
                    </Field>
                    <Field label="Telefono alternativo">
                        <Input value={form.telefono_alternativo} onChange={(e) => onChange("telefono_alternativo", e.target.value)} required />
                    </Field>
                    <Field label="Gestante">
                        <Select value={form.gestante} onChange={(e) => onChange("gestante", e.target.value)} required disabled={form.genero !== "Femenino"}>
                            <option value="">Seleccionar</option>
                            {GESTANTE_USUARIO.map((gestante) => (
                                <option key={gestante} value={gestante}>
                                    {gestante}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Discapacidad">
                        <Select value={form.discapacidad} onChange={(e) => onChange("discapacidad", e.target.value)} required>
                            <option value="">Seleccionar</option>
                            {DISCAPACIDAD_USUARIO.map((discapacidad) => (
                                <option key={discapacidad} value={discapacidad}>
                                    {discapacidad}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Centro">
                        <Select value={form.centro_id} onChange={(e) => onChange("centro_id", e.target.value)} required>
                            <option value="">Seleccionar</option>
                            {centros.map((centro) => (
                                <option key={centro.id_centro} value={centro.id_centro}>
                                    {centro.nombre_centro || centro.id_centro}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>{saving ? "Guardando..." : "Guardar usuario"}</Button>
                    </div>
                </form>
            </div>
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

function EmptyState({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <CheckCircle2 size={16} />
            {text}
        </div>
    );
}

function formatFecha(value: Date | string): string {
    return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function PendingRow({ title, badge, description, detail }: { title: string; badge: string; description?: string | null; detail?: string | null }) {
    return (
        <div className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description || "Sin observacion"}</p>
                    {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
                </div>
                <Badge variant="warning">
                    <AlertTriangle size={12} />
                    {badge}
                </Badge>
            </div>
        </div>
    );
}
