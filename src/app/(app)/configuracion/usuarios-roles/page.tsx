"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Edit, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
// actions
import {
    getMantenedoresConfig,
    guardarFuncionario,
    guardarMotivo,
    guardarPrestacion,
    guardarProfesional,
    guardarRol,
    guardarTipoSolicitud
} from "@/modules/configuracion/actions/mantenedores.action";
// schemas
import { CENTRO_COLUMNAS, PROGRAMAS_FUNCIONARIO } from "@/modules/configuracion/schemas/mantenedores.schema";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

type ConfigData = Awaited<ReturnType<typeof getMantenedoresConfig>>;
type TabKey = "tipos" | "motivos" | "roles" | "profesionales" | "prestaciones" | "funcionarios";
type CentroKey = (typeof CENTRO_COLUMNAS)[number];
type CentroState = Record<CentroKey, "1" | "0">;
interface TipoSolicitudForm {
    id_tipo_solicitud?: number;
    nombre_tipo_solicitud: string;
    estado: "1" | "0";
    centros: CentroState;
}
interface MotivoForm {
    id_motivo?: number;
    tipo_solicitud_id: string;
    nombre_motivo: string;
    estado: "1" | "0";
}
interface RolForm {
    id_rol?: number;
    nombre_rol: string;
    estado: "Activo" | "Inactivo";
}
interface ProfesionalForm {
    id_profesional?: number;
    nombre: string;
    estado: "Activo" | "Inactivo";
    centros: CentroState;
}
interface PrestacionForm {
    id_prestacion?: number;
    profesional_id: string;
    nombre_prestacion: string;
    estado: "Activo" | "Inactivo";
}
interface FuncionarioForm {
    rut: string;
    email: string;
    nombre: string;
    rol_id: string;
    centro_id: string;
    programa_asociado: (typeof PROGRAMAS_FUNCIONARIO)[number] | "";
    estado: "Activo" | "Inactivo";
}

const tabs: { key: TabKey; label: string }[] = [
    { key: "tipos", label: "Tipo solicitud" },
    { key: "motivos", label: "Motivos" },
    { key: "roles", label: "Roles" },
    { key: "profesionales", label: "Profesionales" },
    { key: "prestaciones", label: "Prestaciones" },
    { key: "funcionarios", label: "Funcionarios" }
];

const emptyData: ConfigData = { tiposSolicitud: [], motivos: [], roles: [], profesionales: [], prestaciones: [], funcionarios: [], centros: [] };

function emptyCentros(): CentroState {
    return CENTRO_COLUMNAS.reduce((acc, columna) => {
        acc[columna] = "0";
        return acc;
    }, {} as CentroState);
}

function centrosFromRow(row: Partial<Record<CentroKey, string | null | undefined>>): CentroState {
    return CENTRO_COLUMNAS.reduce((acc, columna) => {
        acc[columna] = row[columna] === "1" ? "1" : "0";
        return acc;
    }, {} as CentroState);
}

function labelCentro(columna: string): string {
    return columna
        .split("_")
        .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
        .join(" ");
}

function asProgramaFuncionario(value: string | null): (typeof PROGRAMAS_FUNCIONARIO)[number] {
    return PROGRAMAS_FUNCIONARIO.find((programa) => programa === value) ?? PROGRAMAS_FUNCIONARIO[0];
}

export default function UsuariosRolesPage() {
    const [activeTab, setActiveTab] = useState<TabKey>("tipos");
    const [data, setData] = useState<ConfigData>(emptyData);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modal, setModal] = useState<TabKey | null>(null);
    const [editingFuncionarioRut, setEditingFuncionarioRut] = useState<string | null>(null);
    const [tipoForm, setTipoForm] = useState<TipoSolicitudForm>({ nombre_tipo_solicitud: "", estado: "1", centros: emptyCentros() });
    const [motivoForm, setMotivoForm] = useState<MotivoForm>({ tipo_solicitud_id: "", nombre_motivo: "", estado: "1" });
    const [rolForm, setRolForm] = useState<RolForm>({ nombre_rol: "", estado: "Activo" });
    const [profesionalForm, setProfesionalForm] = useState<ProfesionalForm>({ nombre: "", estado: "Activo", centros: emptyCentros() });
    const [prestacionForm, setPrestacionForm] = useState<PrestacionForm>({ profesional_id: "", nombre_prestacion: "", estado: "Activo" });
    const [funcionarioForm, setFuncionarioForm] = useState<FuncionarioForm>({ rut: "", email: "", nombre: "", rol_id: "", centro_id: "", programa_asociado: "", estado: "Activo" });

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tiposActivos = useMemo(() => data.tiposSolicitud.filter((tipo) => tipo.estado === "1"), [data.tiposSolicitud]);
    const profesionalesActivos = useMemo(() => data.profesionales.filter((profesional) => profesional.estado === "Activo"), [data.profesionales]);
    const rolesActivos = useMemo(() => data.roles.filter((rol) => rol.estado === "Activo"), [data.roles]);

    async function loadData(nextSearch = search) {
        setLoading(true);
        try {
            const result = await getMantenedoresConfig({ search: nextSearch });
            setData(result);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al cargar configuracion");
        } finally {
            setLoading(false);
        }
    }

    function openCreate(tab: TabKey) {
        setActiveTab(tab);
        setEditingFuncionarioRut(null);
        if (tab === "tipos") setTipoForm({ nombre_tipo_solicitud: "", estado: "1", centros: emptyCentros() });
        if (tab === "motivos") setMotivoForm({ tipo_solicitud_id: tiposActivos[0]?.id_tipo_solicitud ? String(tiposActivos[0].id_tipo_solicitud) : "", nombre_motivo: "", estado: "1" });
        if (tab === "roles") setRolForm({ nombre_rol: "", estado: "Activo" });
        if (tab === "profesionales") setProfesionalForm({ nombre: "", estado: "Activo", centros: emptyCentros() });
        if (tab === "prestaciones") setPrestacionForm({ profesional_id: profesionalesActivos[0]?.id_profesional ? String(profesionalesActivos[0].id_profesional) : "", nombre_prestacion: "", estado: "Activo" });
        if (tab === "funcionarios") {
            setFuncionarioForm({
                rut: "",
                email: "",
                nombre: "",
                rol_id: rolesActivos[0]?.id_rol ? String(rolesActivos[0].id_rol) : "",
                centro_id: data.centros[0]?.id_centro ?? "",
                programa_asociado: PROGRAMAS_FUNCIONARIO[0],
                estado: "Activo"
            });
        }
        setModal(tab);
    }

    async function submitTipo(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            await guardarTipoSolicitud(tipoForm);
            toast.success("Tipo de solicitud guardado");
            setModal(null);
            await loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar tipo de solicitud");
        } finally {
            setSaving(false);
        }
    }

    async function submitMotivo(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            await guardarMotivo({ ...motivoForm, tipo_solicitud_id: Number(motivoForm.tipo_solicitud_id) });
            toast.success("Motivo guardado");
            setModal(null);
            await loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar motivo");
        } finally {
            setSaving(false);
        }
    }

    async function submitRol(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            await guardarRol(rolForm);
            toast.success("Rol guardado");
            setModal(null);
            await loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar rol");
        } finally {
            setSaving(false);
        }
    }

    async function submitProfesional(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            await guardarProfesional(profesionalForm);
            toast.success("Profesional guardado");
            setModal(null);
            await loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar profesional");
        } finally {
            setSaving(false);
        }
    }

    async function submitPrestacion(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            await guardarPrestacion({ ...prestacionForm, profesional_id: Number(prestacionForm.profesional_id) });
            toast.success("Prestacion guardada");
            setModal(null);
            await loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar prestacion");
        } finally {
            setSaving(false);
        }
    }

    async function submitFuncionario(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            if (!funcionarioForm.programa_asociado) throw new Error("Programa asociado requerido");
            await guardarFuncionario({
                ...funcionarioForm,
                rol_id: Number(funcionarioForm.rol_id),
                programa_asociado: funcionarioForm.programa_asociado
            });
            toast.success("Funcionario guardado");
            setModal(null);
            await loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar funcionario");
        } finally {
            setSaving(false);
        }
    }

    function nombreCentro(centroId: string | null): string {
        return data.centros.find((centro) => centro.id_centro === centroId)?.nombre_centro || centroId || "Sin centro";
    }

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Configuracion</h1>
                <p className="mt-1 text-sm text-muted-foreground">Administra catalogos operativos y estados de uso del sistema.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle>Mantenedores</CardTitle>
                            <CardDescription>Crear, editar y habilitar registros sin eliminar informacion historica.</CardDescription>
                        </div>
                        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); loadData(search); }}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el tab actual" className="w-64" />
                            <Button type="submit" variant="outline">
                                <Search size={16} />
                                Buscar
                            </Button>
                        </form>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                        {tabs.map((tab) => (
                            <Button key={tab.key} type="button" variant={activeTab === tab.key ? "default" : "outline"} size="sm" onClick={() => setActiveTab(tab.key)}>
                                {tab.label}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{loading ? "Cargando..." : "Resultados limitados a 300 registros."}</p>
                        <Button type="button" onClick={() => openCreate(activeTab)}>
                            <Plus size={16} />
                            Agregar
                        </Button>
                    </div>

                    {activeTab === "tipos" && (
                        <Table headers={["Nombre", "Estado", "Centros activos", "Acciones"]}>
                            {data.tiposSolicitud.map((tipo) => (
                                <tr key={tipo.id_tipo_solicitud} className="border-t">
                                    <td className="px-3 py-3 font-medium">{tipo.nombre_tipo_solicitud}</td>
                                    <td className="px-3 py-3"><EstadoBadge active={tipo.estado === "1"} /></td>
                                    <td className="px-3 py-3 text-sm text-muted-foreground">{CENTRO_COLUMNAS.filter((columna) => tipo[columna] === "1").length} centros</td>
                                    <td className="px-3 py-3">
                                        <RowActions
                                            active={tipo.estado === "1"}
                                            onEdit={() => {
                                                setTipoForm({ id_tipo_solicitud: tipo.id_tipo_solicitud, nombre_tipo_solicitud: tipo.nombre_tipo_solicitud, estado: tipo.estado === "1" ? "1" : "0", centros: centrosFromRow(tipo) });
                                                setModal("tipos");
                                            }}
                                            onToggle={() => guardarTipoSolicitud({ id_tipo_solicitud: tipo.id_tipo_solicitud, nombre_tipo_solicitud: tipo.nombre_tipo_solicitud, estado: tipo.estado === "1" ? "0" : "1", centros: centrosFromRow(tipo) }).then(() => loadData()).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cambiar estado"))}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}

                    {activeTab === "motivos" && (
                        <Table headers={["Motivo", "Tipo solicitud", "Estado", "Acciones"]}>
                            {data.motivos.map((motivo) => (
                                <tr key={motivo.id_motivo} className="border-t">
                                    <td className="px-3 py-3 font-medium">{motivo.nombre_motivo}</td>
                                    <td className="px-3 py-3">{motivo.tipoSolicitud.nombre_tipo_solicitud}</td>
                                    <td className="px-3 py-3"><EstadoBadge active={motivo.estado === "1"} /></td>
                                    <td className="px-3 py-3">
                                        <RowActions
                                            active={motivo.estado === "1"}
                                            onEdit={() => {
                                                setMotivoForm({ id_motivo: motivo.id_motivo, tipo_solicitud_id: String(motivo.tipo_solicitud_id), nombre_motivo: motivo.nombre_motivo, estado: motivo.estado === "1" ? "1" : "0" });
                                                setModal("motivos");
                                            }}
                                            onToggle={() => guardarMotivo({ id_motivo: motivo.id_motivo, tipo_solicitud_id: motivo.tipo_solicitud_id, nombre_motivo: motivo.nombre_motivo, estado: motivo.estado === "1" ? "0" : "1" }).then(() => loadData()).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cambiar estado"))}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}

                    {activeTab === "roles" && (
                        <Table headers={["Rol", "Estado", "Acciones"]}>
                            {data.roles.map((rol) => (
                                <tr key={rol.id_rol} className="border-t">
                                    <td className="px-3 py-3 font-medium">{rol.nombre_rol}</td>
                                    <td className="px-3 py-3"><EstadoBadge active={rol.estado === "Activo"} /></td>
                                    <td className="px-3 py-3">
                                        <RowActions
                                            active={rol.estado === "Activo"}
                                            onEdit={() => {
                                                setRolForm({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Activo" : "Inactivo" });
                                                setModal("roles");
                                            }}
                                            onToggle={() => guardarRol({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol, estado: rol.estado === "Activo" ? "Inactivo" : "Activo" }).then(() => loadData()).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cambiar estado"))}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}

                    {activeTab === "profesionales" && (
                        <Table headers={["Profesional", "Estado", "Centros activos", "Acciones"]}>
                            {data.profesionales.map((profesional) => (
                                <tr key={profesional.id_profesional} className="border-t">
                                    <td className="px-3 py-3 font-medium">{profesional.nombre}</td>
                                    <td className="px-3 py-3"><EstadoBadge active={profesional.estado === "Activo"} /></td>
                                    <td className="px-3 py-3 text-sm text-muted-foreground">{CENTRO_COLUMNAS.filter((columna) => profesional[columna] === "1").length} centros</td>
                                    <td className="px-3 py-3">
                                        <RowActions
                                            active={profesional.estado === "Activo"}
                                            onEdit={() => {
                                                setProfesionalForm({ id_profesional: profesional.id_profesional, nombre: profesional.nombre, estado: profesional.estado === "Activo" ? "Activo" : "Inactivo", centros: centrosFromRow(profesional) });
                                                setModal("profesionales");
                                            }}
                                            onToggle={() => guardarProfesional({ id_profesional: profesional.id_profesional, nombre: profesional.nombre, estado: profesional.estado === "Activo" ? "Inactivo" : "Activo", centros: centrosFromRow(profesional) }).then(() => loadData()).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cambiar estado"))}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}

                    {activeTab === "prestaciones" && (
                        <Table headers={["Prestacion", "Profesional", "Estado", "Acciones"]}>
                            {data.prestaciones.map((prestacion) => (
                                <tr key={prestacion.id_prestacion} className="border-t">
                                    <td className="px-3 py-3 font-medium">{prestacion.nombre_prestacion}</td>
                                    <td className="px-3 py-3">{prestacion.profesional.nombre}</td>
                                    <td className="px-3 py-3"><EstadoBadge active={prestacion.estado === "Activo"} /></td>
                                    <td className="px-3 py-3">
                                        <RowActions
                                            active={prestacion.estado === "Activo"}
                                            onEdit={() => {
                                                setPrestacionForm({ id_prestacion: prestacion.id_prestacion, profesional_id: String(prestacion.profesional_id), nombre_prestacion: prestacion.nombre_prestacion, estado: prestacion.estado === "Activo" ? "Activo" : "Inactivo" });
                                                setModal("prestaciones");
                                            }}
                                            onToggle={() => guardarPrestacion({ id_prestacion: prestacion.id_prestacion, profesional_id: prestacion.profesional_id, nombre_prestacion: prestacion.nombre_prestacion, estado: prestacion.estado === "Activo" ? "Inactivo" : "Activo" }).then(() => loadData()).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cambiar estado"))}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}

                    {activeTab === "funcionarios" && (
                        <Table headers={["RUT", "Email", "Nombre", "Rol", "Centro", "Programa", "Estado", "Acciones"]}>
                            {data.funcionarios.map((funcionario) => (
                                <tr key={funcionario.rut} className="border-t">
                                    <td className="px-3 py-3 font-medium">{funcionario.rut}</td>
                                    <td className="px-3 py-3">{funcionario.email}</td>
                                    <td className="px-3 py-3">{funcionario.nombre}</td>
                                    <td className="px-3 py-3">{funcionario.role.nombre_rol}</td>
                                    <td className="px-3 py-3">{nombreCentro(funcionario.centro_id)}</td>
                                    <td className="px-3 py-3">{funcionario.programa_asociado || "-"}</td>
                                    <td className="px-3 py-3"><EstadoBadge active={funcionario.estado === "Activo"} /></td>
                                    <td className="px-3 py-3">
                                        <RowActions
                                            active={funcionario.estado === "Activo"}
                                            onEdit={() => {
                                                setFuncionarioForm({
                                                    rut: funcionario.rut,
                                                    email: funcionario.email,
                                                    nombre: funcionario.nombre,
                                                    rol_id: String(funcionario.rol_id),
                                                    centro_id: funcionario.centro_id ?? "",
                                                    programa_asociado: asProgramaFuncionario(funcionario.programa_asociado),
                                                    estado: funcionario.estado === "Activo" ? "Activo" : "Inactivo"
                                                });
                                                setEditingFuncionarioRut(funcionario.rut);
                                                setModal("funcionarios");
                                            }}
                                            onToggle={() =>
                                                guardarFuncionario({
                                                    rut: funcionario.rut,
                                                    email: funcionario.email,
                                                    nombre: funcionario.nombre,
                                                    rol_id: funcionario.rol_id,
                                                    centro_id: funcionario.centro_id ?? "",
                                                    programa_asociado: asProgramaFuncionario(funcionario.programa_asociado),
                                                    estado: funcionario.estado === "Activo" ? "Inactivo" : "Activo"
                                                })
                                                    .then(() => loadData())
                                                    .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Error al cambiar estado"))
                                            }
                                        />
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}
                </CardContent>
            </Card>

            {modal === "tipos" && (
                <ConfigModal title={tipoForm.id_tipo_solicitud ? "Editar tipo de solicitud" : "Agregar tipo de solicitud"} saving={saving} onClose={() => setModal(null)} onSubmit={submitTipo}>
                    <Field label="Nombre">
                        <Input value={tipoForm.nombre_tipo_solicitud} onChange={(event) => setTipoForm((current) => ({ ...current, nombre_tipo_solicitud: event.target.value }))} required maxLength={50} />
                    </Field>
                    <Field label="Estado">
                        <EstadoBinarioSelect value={tipoForm.estado as "1" | "0"} onChange={(estado) => setTipoForm((current) => ({ ...current, estado }))} />
                    </Field>
                    <CentrosCheckboxes value={tipoForm.centros as CentroState} onChange={(centros) => setTipoForm((current) => ({ ...current, centros }))} />
                </ConfigModal>
            )}

            {modal === "motivos" && (
                <ConfigModal title={motivoForm.id_motivo ? "Editar motivo" : "Agregar motivo"} saving={saving} onClose={() => setModal(null)} onSubmit={submitMotivo}>
                    <Field label="Tipo solicitud">
                        <Select value={String(motivoForm.tipo_solicitud_id ?? "")} onChange={(event) => setMotivoForm((current) => ({ ...current, tipo_solicitud_id: event.target.value }))} required>
                            <option value="">Seleccionar</option>
                            {data.tiposSolicitud.map((tipo) => (
                                <option key={tipo.id_tipo_solicitud} value={tipo.id_tipo_solicitud}>
                                    {tipo.nombre_tipo_solicitud}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Motivo">
                        <Input value={motivoForm.nombre_motivo} onChange={(event) => setMotivoForm((current) => ({ ...current, nombre_motivo: event.target.value }))} required maxLength={150} />
                    </Field>
                    <Field label="Estado">
                        <EstadoBinarioSelect value={motivoForm.estado as "1" | "0"} onChange={(estado) => setMotivoForm((current) => ({ ...current, estado }))} />
                    </Field>
                </ConfigModal>
            )}

            {modal === "roles" && (
                <ConfigModal title={rolForm.id_rol ? "Editar rol" : "Agregar rol"} saving={saving} onClose={() => setModal(null)} onSubmit={submitRol}>
                    <Field label="Nombre rol">
                        <Input value={rolForm.nombre_rol} onChange={(event) => setRolForm((current) => ({ ...current, nombre_rol: event.target.value }))} required maxLength={50} />
                    </Field>
                    <Field label="Estado">
                        <EstadoActivoSelect value={rolForm.estado as "Activo" | "Inactivo"} onChange={(estado) => setRolForm((current) => ({ ...current, estado }))} />
                    </Field>
                </ConfigModal>
            )}

            {modal === "profesionales" && (
                <ConfigModal title={profesionalForm.id_profesional ? "Editar profesional" : "Agregar profesional"} saving={saving} onClose={() => setModal(null)} onSubmit={submitProfesional}>
                    <Field label="Nombre">
                        <Input value={profesionalForm.nombre} onChange={(event) => setProfesionalForm((current) => ({ ...current, nombre: event.target.value }))} required maxLength={50} />
                    </Field>
                    <Field label="Estado">
                        <EstadoActivoSelect value={profesionalForm.estado as "Activo" | "Inactivo"} onChange={(estado) => setProfesionalForm((current) => ({ ...current, estado }))} />
                    </Field>
                    <CentrosCheckboxes value={profesionalForm.centros as CentroState} onChange={(centros) => setProfesionalForm((current) => ({ ...current, centros }))} />
                </ConfigModal>
            )}

            {modal === "prestaciones" && (
                <ConfigModal title={prestacionForm.id_prestacion ? "Editar prestacion" : "Agregar prestacion"} saving={saving} onClose={() => setModal(null)} onSubmit={submitPrestacion}>
                    <Field label="Profesional">
                        <Select value={String(prestacionForm.profesional_id ?? "")} onChange={(event) => setPrestacionForm((current) => ({ ...current, profesional_id: event.target.value }))} required>
                            <option value="">Seleccionar</option>
                            {data.profesionales.map((profesional) => (
                                <option key={profesional.id_profesional} value={profesional.id_profesional}>
                                    {profesional.nombre}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Prestacion">
                        <Input value={prestacionForm.nombre_prestacion} onChange={(event) => setPrestacionForm((current) => ({ ...current, nombre_prestacion: event.target.value }))} required maxLength={100} />
                    </Field>
                    <Field label="Estado">
                        <EstadoActivoSelect value={prestacionForm.estado as "Activo" | "Inactivo"} onChange={(estado) => setPrestacionForm((current) => ({ ...current, estado }))} />
                    </Field>
                </ConfigModal>
            )}

            {modal === "funcionarios" && (
                <ConfigModal title={editingFuncionarioRut ? "Editar funcionario" : "Agregar funcionario"} saving={saving} onClose={() => setModal(null)} onSubmit={submitFuncionario}>
                    <Field label="RUT">
                        <Input
                            value={funcionarioForm.rut}
                            onChange={(event) => setFuncionarioForm((current) => ({ ...current, rut: event.target.value }))}
                            required
                            disabled={Boolean(editingFuncionarioRut)}
                        />
                    </Field>
                    <Field label="Email Google">
                        <Input type="email" value={funcionarioForm.email} onChange={(event) => setFuncionarioForm((current) => ({ ...current, email: event.target.value }))} required maxLength={100} />
                    </Field>
                    <Field label="Nombre">
                        <Input value={funcionarioForm.nombre} onChange={(event) => setFuncionarioForm((current) => ({ ...current, nombre: event.target.value }))} required maxLength={50} />
                    </Field>
                    <Field label="Rol">
                        <Select value={funcionarioForm.rol_id} onChange={(event) => setFuncionarioForm((current) => ({ ...current, rol_id: event.target.value }))} required>
                            <option value="">Seleccionar</option>
                            {data.roles.map((rol) => (
                                <option key={rol.id_rol} value={rol.id_rol}>
                                    {rol.nombre_rol}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Centro">
                        <Select value={funcionarioForm.centro_id} onChange={(event) => setFuncionarioForm((current) => ({ ...current, centro_id: event.target.value }))} required>
                            <option value="">Seleccionar</option>
                            {data.centros.map((centro) => (
                                <option key={centro.id_centro} value={centro.id_centro}>
                                    {centro.nombre_centro || centro.id_centro}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Programa asociado">
                        <Select value={funcionarioForm.programa_asociado} onChange={(event) => setFuncionarioForm((current) => ({ ...current, programa_asociado: event.target.value as (typeof PROGRAMAS_FUNCIONARIO)[number] }))} required>
                            <option value="">Seleccionar</option>
                            {PROGRAMAS_FUNCIONARIO.map((programa) => (
                                <option key={programa} value={programa}>
                                    {programa}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Estado">
                        <EstadoActivoSelect value={funcionarioForm.estado} onChange={(estado) => setFuncionarioForm((current) => ({ ...current, estado }))} />
                    </Field>
                </ConfigModal>
            )}
        </div>
    );
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
    return (
        <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[780px] table-fixed text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                        {headers.map((header) => (
                            <th key={header} className="px-3 py-2 font-medium">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

function RowActions({ active, onEdit, onToggle }: { active: boolean; onEdit: () => void; onToggle: () => void }) {
    return (
        <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Edit size={14} />
                Editar
            </Button>
            <Button type="button" variant={active ? "secondary" : "default"} size="sm" onClick={onToggle}>
                {active ? "Desactivar" : "Activar"}
            </Button>
        </div>
    );
}

function EstadoBadge({ active }: { active: boolean }) {
    return <Badge variant={active ? "success" : "muted"}>{active ? "Activo" : "Inactivo"}</Badge>;
}

function ConfigModal({ title, saving, onClose, onSubmit, children }: { title: string; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void; children: ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border bg-background shadow-lg">
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Completa los datos obligatorios y guarda los cambios.</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={onSubmit}>
                    {children}
                    <div className="flex justify-end gap-2 sm:col-span-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function EstadoBinarioSelect({ value, onChange }: { value: "1" | "0"; onChange: (value: "1" | "0") => void }) {
    return (
        <Select value={value} onChange={(event) => onChange(event.target.value as "1" | "0")} required>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
        </Select>
    );
}

function EstadoActivoSelect({ value, onChange }: { value: "Activo" | "Inactivo"; onChange: (value: "Activo" | "Inactivo") => void }) {
    return (
        <Select value={value} onChange={(event) => onChange(event.target.value as "Activo" | "Inactivo")} required>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
        </Select>
    );
}

function CentrosCheckboxes({ value, onChange }: { value: CentroState; onChange: (value: CentroState) => void }) {
    return (
        <div className="space-y-2 sm:col-span-2">
            <Label>Centros habilitados</Label>
            <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
                {CENTRO_COLUMNAS.map((columna) => (
                    <label key={columna} className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={value[columna] === "1"}
                            onChange={(event) => onChange({ ...value, [columna]: event.target.checked ? "1" : "0" })}
                            className="h-4 w-4 rounded border-input"
                        />
                        <span>{labelCentro(columna)}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}
