"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
// actions
import { getCatalogos } from "@/modules/catalogos/actions/getCatalogos.action";
import { getPendientes } from "@/modules/solicitudes/actions/getPendientes.action";
import { crearSolicitud } from "@/modules/solicitudes/actions/crearSolicitud.action";
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

type FormState = {
    rut_usuario: string;
    nombre_usuario: string;
    apellido_usuario: string;
    telefono: string;
    correo_contacto: string;
    tipo_solicitud_id: string;
    motivo_id: string;
    disponibilidad_llamada: string;
    priorizacion_admin: string;
    centro_id: string;
    descripcion: string;
};

const emptyForm: FormState = {
    rut_usuario: "",
    nombre_usuario: "",
    apellido_usuario: "",
    telefono: "",
    correo_contacto: "",
    tipo_solicitud_id: "",
    motivo_id: "",
    disponibilidad_llamada: "",
    priorizacion_admin: "",
    centro_id: "CENTRO-01",
    descripcion: ""
};

type Pendientes = Awaited<ReturnType<typeof getPendientes>>;

export default function IngresarSolicitudPage() {
    const [rutBusqueda, setRutBusqueda] = useState("");
    const [pendientes, setPendientes] = useState<Pendientes | null>(null);
    const [catalogos, setCatalogos] = useState<Catalogos>({ tiposSolicitud: [], motivos: [] });
    const [form, setForm] = useState<FormState>(emptyForm);
    const [loadingPendientes, setLoadingPendientes] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        getCatalogos()
            .then(setCatalogos)
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cargar catalogos"));
    }, []);

    const motivosFiltrados = useMemo(() => {
        if (!form.tipo_solicitud_id) return catalogos.motivos;
        return catalogos.motivos.filter((m) => String(m.tipo_solicitud_id) === String(form.tipo_solicitud_id));
    }, [catalogos.motivos, form.tipo_solicitud_id]);

    function updateField(field: keyof FormState, value: string) {
        setForm((current) => ({ ...current, [field]: value, ...(field === "tipo_solicitud_id" ? { motivo_id: "" } : {}) }));
    }

    async function buscarPendientes(event: React.FormEvent) {
        event.preventDefault();
        setPendientes(null);
        setLoadingPendientes(true);
        try {
            const data = await getPendientes(rutBusqueda);
            setPendientes(data);
            setForm((current) => ({ ...current, rut_usuario: rutBusqueda }));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al buscar pendientes");
        } finally {
            setLoadingPendientes(false);
        }
    }

    async function onCrearSolicitud(event: React.FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        try {
            const { solicitud } = await crearSolicitud({
                ...form,
                tipo_solicitud_id: Number(form.tipo_solicitud_id),
                motivo_id: Number(form.motivo_id)
            });
            toast.success(`Solicitud creada: ${solicitud.id_solicitud}`);
            setForm({ ...emptyForm, rut_usuario: form.rut_usuario });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al crear solicitud");
        } finally {
            setSubmitting(false);
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
                <CardContent>
                    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={buscarPendientes}>
                        <Input placeholder="RUT usuario" value={rutBusqueda} onChange={(e) => setRutBusqueda(e.target.value)} required />
                        <Button disabled={loadingPendientes}>
                            <Search size={16} />
                            {loadingPendientes ? "Buscando..." : "Buscar pendientes"}
                        </Button>
                    </form>
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
                                    <PendingRow key={s.id_solicitud} title={s.id_solicitud} badge={s.estado_solicitud} description={s.descripcion || s.motivo?.nombre_motivo} />
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

            <Card>
                <CardHeader>
                    <CardTitle>Nueva solicitud</CardTitle>
                    <CardDescription>El estado inicial queda como En Curso.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-4 lg:grid-cols-2" onSubmit={onCrearSolicitud}>
                        <Field label="RUT usuario">
                            <Input value={form.rut_usuario} onChange={(e) => updateField("rut_usuario", e.target.value)} required />
                        </Field>
                        <Field label="Centro">
                            <Input value={form.centro_id} onChange={(e) => updateField("centro_id", e.target.value)} />
                        </Field>
                        <Field label="Nombre">
                            <Input value={form.nombre_usuario} onChange={(e) => updateField("nombre_usuario", e.target.value)} required />
                        </Field>
                        <Field label="Apellido">
                            <Input value={form.apellido_usuario} onChange={(e) => updateField("apellido_usuario", e.target.value)} required />
                        </Field>
                        <Field label="Telefono">
                            <Input value={form.telefono} onChange={(e) => updateField("telefono", e.target.value)} />
                        </Field>
                        <Field label="Correo contacto">
                            <Input type="email" value={form.correo_contacto} onChange={(e) => updateField("correo_contacto", e.target.value)} />
                        </Field>
                        <Field label="Tipo solicitud">
                            <Select value={form.tipo_solicitud_id} onChange={(e) => updateField("tipo_solicitud_id", e.target.value)} required>
                                <option value="">Seleccionar</option>
                                {catalogos.tiposSolicitud.map((t) => (
                                    <option key={t.id_tipo_solicitud} value={t.id_tipo_solicitud}>
                                        {t.nombre_tipo_solicitud}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Motivo">
                            <Select value={form.motivo_id} onChange={(e) => updateField("motivo_id", e.target.value)} required>
                                <option value="">Seleccionar</option>
                                {motivosFiltrados.map((m) => (
                                    <option key={m.id_motivo} value={m.id_motivo}>
                                        {m.nombre_motivo}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Disponibilidad llamada">
                            <Input value={form.disponibilidad_llamada} onChange={(e) => updateField("disponibilidad_llamada", e.target.value)} placeholder="Ej: manana AM" />
                        </Field>
                        <Field label="Priorizacion admin">
                            <Input type="number" step="0.1" value={form.priorizacion_admin} onChange={(e) => updateField("priorizacion_admin", e.target.value)} />
                        </Field>
                        <div className="lg:col-span-2">
                            <Field label="Descripcion">
                                <Textarea value={form.descripcion} onChange={(e) => updateField("descripcion", e.target.value)} />
                            </Field>
                        </div>
                        <div className="lg:col-span-2">
                            <Button disabled={submitting}>{submitting ? "Guardando..." : "Guardar solicitud"}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
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

function PendingRow({ title, badge, description }: { title: string; badge: string; description?: string | null }) {
    return (
        <div className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description || "Sin observacion"}</p>
                </div>
                <Badge variant="warning">
                    <AlertTriangle size={12} />
                    {badge}
                </Badge>
            </div>
        </div>
    );
}
