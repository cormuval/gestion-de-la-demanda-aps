"use client";

import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { toast } from "sonner";
// actions
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
// types
import type { SolicitudFiltros } from "@/modules/solicitudes/schemas/solicitud.schema";

const estados = ["", "En Curso", "Finalizada", "Rechazada"];

type Solicitudes = Awaited<ReturnType<typeof getSolicitudes>>["solicitudes"];

export default function RevisarSolicitudesPage() {
    const [filters, setFilters] = useState<SolicitudFiltros>({ rut: "", estado: "", fechaDesde: "", fechaHasta: "", centroId: "" });
    const [solicitudes, setSolicitudes] = useState<Solicitudes>([]);
    const [loading, setLoading] = useState(false);

    async function loadSolicitudes(nextFilters: SolicitudFiltros = filters) {
        setLoading(true);
        try {
            const data = await getSolicitudes(nextFilters);
            setSolicitudes(data.solicitudes);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al consultar solicitudes");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadSolicitudes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function updateFilter(field: keyof SolicitudFiltros, value: string) {
        setFilters((current) => ({ ...current, [field]: value }));
    }

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        loadSolicitudes(filters);
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Revisar solicitudes</h1>
                <p className="mt-1 text-sm text-muted-foreground">Listado filtrable de solicitudes registradas en la base local.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Consulta por RUT, estado, fechas y centro.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-4 md:grid-cols-5" onSubmit={handleSubmit}>
                        <Field label="RUT">
                            <Input value={filters.rut} onChange={(e) => updateFilter("rut", e.target.value)} />
                        </Field>
                        <Field label="Estado">
                            <Select value={filters.estado} onChange={(e) => updateFilter("estado", e.target.value)}>
                                {estados.map((estado) => (
                                    <option key={estado || "todos"} value={estado}>
                                        {estado || "Todos"}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Desde">
                            <Input type="date" value={filters.fechaDesde} onChange={(e) => updateFilter("fechaDesde", e.target.value)} />
                        </Field>
                        <Field label="Hasta">
                            <Input type="date" value={filters.fechaHasta} onChange={(e) => updateFilter("fechaHasta", e.target.value)} />
                        </Field>
                        <Field label="Centro">
                            <Input value={filters.centroId} onChange={(e) => updateFilter("centroId", e.target.value)} />
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
                    <CardTitle>Solicitudes</CardTitle>
                    <CardDescription>Maximo 100 registros ordenados por fecha de inicio.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead className="bg-muted text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 font-medium">ID</th>
                                    <th className="px-3 py-2 font-medium">Fecha</th>
                                    <th className="px-3 py-2 font-medium">RUT usuario</th>
                                    <th className="px-3 py-2 font-medium">Usuario</th>
                                    <th className="px-3 py-2 font-medium">Tipo</th>
                                    <th className="px-3 py-2 font-medium">Motivo</th>
                                    <th className="px-3 py-2 font-medium">Estado</th>
                                    <th className="px-3 py-2 font-medium">Centro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {solicitudes.length === 0 ? (
                                    <tr>
                                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                                            No hay solicitudes para los filtros actuales.
                                        </td>
                                    </tr>
                                ) : (
                                    solicitudes.map((s) => (
                                        <tr key={s.id_solicitud} className="border-t">
                                            <td className="px-3 py-3 font-medium">{s.id_solicitud}</td>
                                            <td className="px-3 py-3">{new Date(s.fecha_inicio).toLocaleString("es-CL")}</td>
                                            <td className="px-3 py-3">{s.rut_usuario}</td>
                                            <td className="px-3 py-3">
                                                {s.usuario?.nombre} {s.usuario?.apellido}
                                            </td>
                                            <td className="px-3 py-3">{s.tipoSolicitud?.nombre_tipo_solicitud}</td>
                                            <td className="px-3 py-3">{s.motivo?.nombre_motivo}</td>
                                            <td className="px-3 py-3">
                                                <Badge variant={s.estado_solicitud === "En Curso" ? "warning" : "muted"}>{s.estado_solicitud}</Badge>
                                            </td>
                                            <td className="px-3 py-3">{s.centro_id || "-"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
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
