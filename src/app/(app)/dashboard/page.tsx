"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, ClipboardList, Eye, PhoneCall, UserCheck, X, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
// actions
import { getDashboardFuncionario, type DashboardDiaSerie, type DashboardFuncionarioData } from "@/modules/dashboard/actions/getDashboardFuncionario.action";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/shared/components/ui/chart";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const emptyDashboard: DashboardFuncionarioData = {
    mes: currentMonth(),
    funcionario: { rut: "", nombre: "", rol: "", centro: null },
    totales: {
        solicitudesIngresadas: 0,
        solicitudesRechazadas: 0,
        solicitudesRealizadas: 0,
        citasCreadas: 0,
        llamadasRealizadas: 0
    },
    serie: [],
    detalles: { solicitudesIngresadas: [], gestiones: [], llamadas: [] }
};

const seriesConfig = [
    { key: "solicitudesIngresadas", label: "Solicitudes", color: "#0f766e" },
    { key: "solicitudesRechazadas", label: "Rechazadas", color: "#b91c1c" },
    { key: "solicitudesRealizadas", label: "Realizadas", color: "#2563eb" },
    { key: "citasCreadas", label: "Citas", color: "#7c3aed" },
    { key: "llamadasRealizadas", label: "Llamadas", color: "#d97706" }
] as const;

type SerieKey = (typeof seriesConfig)[number]["key"];
const chartConfig = Object.fromEntries(seriesConfig.map((item) => [item.key, { label: item.label, color: item.color }])) satisfies ChartConfig;

function currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatFecha(value: Date | string | null): string {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("es-CL");
}

function formatFechaHora(value: Date | string | null): string {
    if (!value) return "-";
    return new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function TotalCard({ title, value, icon: Icon }: { title: string; value: number; icon: typeof ClipboardList }) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="mt-1 text-3xl font-semibold">{value}</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon size={20} />
                </div>
            </CardContent>
        </Card>
    );
}

function SerieChart({ serie, activeKey, onActiveKeyChange, totales }: {
    serie: DashboardDiaSerie[];
    activeKey: SerieKey;
    onActiveKeyChange: (key: SerieKey) => void;
    totales: Record<SerieKey, number>;
}) {
    const hasData = serie.some((dia) => seriesConfig.some((config) => dia[config.key] > 0));
    const activeConfig = seriesConfig.find((config) => config.key === activeKey) ?? seriesConfig[0];

    return (
        <div className="space-y-4">
            <div className="grid rounded-md border md:grid-cols-5">
                {seriesConfig.map((config) => (
                    <button
                        key={config.key}
                        type="button"
                        className={`flex min-h-[72px] flex-col items-start justify-center gap-1 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 md:border-b-0 md:border-r md:last:border-r-0 ${
                            activeKey === config.key ? "bg-muted/70" : ""
                        }`}
                        onClick={() => onActiveKeyChange(config.key)}
                    >
                        <span className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: config.color }} />
                            {config.label}
                        </span>
                        <span className="text-2xl font-semibold">{totales[config.key]}</span>
                    </button>
                ))}
            </div>
            <div className="relative">
                <ChartContainer config={chartConfig} className="h-[320px] w-full">
                    <AreaChart accessibilityLayer data={serie} margin={{ left: 12, right: 12, top: 16 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="fecha"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={18}
                            tickFormatter={(value: string) => String(Number(value.slice(8, 10)))}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value) => new Date(`${value as string}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "long" })}
                                />
                            }
                        />
                        <defs>
                            <linearGradient id={`fill-${activeKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.35} />
                                <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0.04} />
                            </linearGradient>
                        </defs>
                        <Area
                            dataKey={activeKey}
                            type="natural"
                            fill={`url(#fill-${activeKey})`}
                            stroke={activeConfig.color}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </AreaChart>
                </ChartContainer>
                {!hasData && (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                        Sin actividad registrada para el mes seleccionado
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const [mes, setMes] = useState(currentMonth());
    const [data, setData] = useState<DashboardFuncionarioData>(emptyDashboard);
    const [activeMetric, setActiveMetric] = useState<SerieKey>("solicitudesIngresadas");
    const [gestionCitas, setGestionCitas] = useState<DashboardFuncionarioData["detalles"]["gestiones"][number] | null>(null);
    const [llamadaDetalle, setLlamadaDetalle] = useState<DashboardFuncionarioData["detalles"]["llamadas"][number] | null>(null);
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getDashboardFuncionario(mes));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al cargar el dashboard");
        } finally {
            setLoading(false);
        }
    }, [mes]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const gestionesResumen = useMemo(() => {
        return `${data.totales.solicitudesRealizadas} realizadas · ${data.totales.solicitudesRechazadas} rechazadas`;
    }, [data.totales.solicitudesRealizadas, data.totales.solicitudesRechazadas]);
    const totalesPorSerie = useMemo(
        () => ({
            solicitudesIngresadas: data.totales.solicitudesIngresadas,
            solicitudesRechazadas: data.totales.solicitudesRechazadas,
            solicitudesRealizadas: data.totales.solicitudesRealizadas,
            citasCreadas: data.totales.citasCreadas,
            llamadasRealizadas: data.totales.llamadasRealizadas
        }),
        [data.totales]
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Métricas mensuales de {data.funcionario.nombre || "funcionario activo"} por solicitudes, gestiones, citas y llamadas.
                    </p>
                </div>
                <div className="w-full max-w-xs space-y-2">
                    <Label>Mes</Label>
                    <Input type="month" value={mes} onChange={(event) => setMes(event.target.value || currentMonth())} />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <TotalCard title="Solicitudes ingresadas" value={data.totales.solicitudesIngresadas} icon={ClipboardList} />
                <TotalCard title="Solicitudes rechazadas" value={data.totales.solicitudesRechazadas} icon={XCircle} />
                <TotalCard title="Solicitudes realizadas" value={data.totales.solicitudesRealizadas} icon={UserCheck} />
                <TotalCard title="Citas creadas" value={data.totales.citasCreadas} icon={CalendarCheck} />
                <TotalCard title="Llamadas realizadas" value={data.totales.llamadasRealizadas} icon={PhoneCall} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Serie diaria</CardTitle>
                    <CardDescription>Total mensual: {gestionesResumen}. {loading ? "Actualizando..." : "Datos filtrados por funcionario activo."}</CardDescription>
                </CardHeader>
                <CardContent>
                    <SerieChart serie={data.serie} activeKey={activeMetric} onActiveKeyChange={setActiveMetric} totales={totalesPorSerie} />
                </CardContent>
            </Card>

            <div className="space-y-6">
                <DetalleSolicitudes data={data} />
                <DetalleGestiones data={data} onVerCitas={setGestionCitas} />
                <DetalleLlamadas data={data} onVerDetalle={setLlamadaDetalle} />
            </div>

            {gestionCitas && <CitasGestionadasModal gestion={gestionCitas} onClose={() => setGestionCitas(null)} />}
            {llamadaDetalle && <DetalleLlamadaModal llamada={llamadaDetalle} onClose={() => setLlamadaDetalle(null)} />}
        </div>
    );
}

function DetalleSolicitudes({ data }: { data: DashboardFuncionarioData }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Solicitudes ingresadas</CardTitle>
                <CardDescription>Registros creados con el RUT orientador del funcionario activo.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="w-[120px] px-3 py-2 font-medium">Fecha</th>
                                <th className="w-[180px] px-3 py-2 font-medium">Solicitud</th>
                                <th className="w-[130px] px-3 py-2 font-medium">RUT paciente</th>
                                <th className="px-3 py-2 font-medium">Tipo</th>
                                <th className="w-[120px] px-3 py-2 font-medium">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.detalles.solicitudesIngresadas.map((solicitud) => (
                                <tr key={solicitud.id_solicitud} className="border-t">
                                    <td className="px-3 py-3">{formatFecha(solicitud.fecha_inicio)}</td>
                                    <td className="px-3 py-3 font-medium">{solicitud.id_solicitud}</td>
                                    <td className="px-3 py-3">{solicitud.rut_usuario}</td>
                                    <td className="px-3 py-3">{solicitud.tipo_solicitud}</td>
                                    <td className="px-3 py-3"><Badge variant="muted">{solicitud.estado_solicitud}</Badge></td>
                                </tr>
                            ))}
                            {data.detalles.solicitudesIngresadas.length === 0 && <EmptyRow colSpan={5} />}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function DetalleGestiones({ data, onVerCitas }: { data: DashboardFuncionarioData; onVerCitas: (gestion: DashboardFuncionarioData["detalles"]["gestiones"][number]) => void }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestiones</CardTitle>
                <CardDescription>Solicitudes rechazadas o realizadas por fecha de validación.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="w-[120px] px-3 py-2 font-medium">Fecha</th>
                                <th className="w-[180px] px-3 py-2 font-medium">Solicitud</th>
                                <th className="w-[130px] px-3 py-2 font-medium">RUT paciente</th>
                                <th className="w-[150px] px-3 py-2 font-medium">Acción</th>
                                <th className="w-[90px] px-3 py-2 font-medium">Citas</th>
                                <th className="w-[150px] px-3 py-2 font-medium">Citas gestionadas</th>
                                <th className="px-3 py-2 font-medium">Rechazo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.detalles.gestiones.map((gestion) => (
                                <tr key={gestion.id_solicitud} className="border-t">
                                    <td className="px-3 py-3">{formatFecha(gestion.fecha_validacion)}</td>
                                    <td className="px-3 py-3 font-medium">{gestion.id_solicitud}</td>
                                    <td className="px-3 py-3">{gestion.rut_usuario}</td>
                                    <td className="px-3 py-3">{gestion.accion}</td>
                                    <td className="px-3 py-3">{gestion.citas_creadas}</td>
                                    <td className="px-3 py-3">
                                        {gestion.citas_creadas > 0 ? (
                                            <Button type="button" variant="outline" size="sm" onClick={() => onVerCitas(gestion)}>
                                                <Eye size={14} />
                                                Visualizar
                                            </Button>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                    <td className="px-3 py-3">{gestion.razon_rechazo || "-"}</td>
                                </tr>
                            ))}
                            {data.detalles.gestiones.length === 0 && <EmptyRow colSpan={7} />}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function DetalleLlamadas({ data, onVerDetalle }: { data: DashboardFuncionarioData; onVerDetalle: (llamada: DashboardFuncionarioData["detalles"]["llamadas"][number]) => void }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Llamadas realizadas</CardTitle>
                <CardDescription>Registros creados con el RUT comunicador del funcionario activo.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
                        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="w-[150px] px-3 py-2 font-medium">Fecha</th>
                                <th className="w-[190px] px-3 py-2 font-medium">Llamada</th>
                                <th className="w-[130px] px-3 py-2 font-medium">RUT paciente</th>
                                <th className="w-[190px] px-3 py-2 font-medium">Cita</th>
                                <th className="w-[160px] px-3 py-2 font-medium">Estamento</th>
                                <th className="w-[220px] px-3 py-2 font-medium">Prestación llamada</th>
                                <th className="w-[150px] px-3 py-2 font-medium">Respuesta</th>
                                <th className="w-[120px] px-3 py-2 font-medium">Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.detalles.llamadas.map((llamada) => (
                                <tr key={llamada.id_llamada} className="border-t">
                                    <td className="px-3 py-3">{formatFechaHora(llamada.fecha_llamada)}</td>
                                    <td className="px-3 py-3 font-medium">{llamada.id_llamada}</td>
                                    <td className="px-3 py-3">{llamada.rut_usuario}</td>
                                    <td className="px-3 py-3">{llamada.cita_id}</td>
                                    <td className="px-3 py-3">{llamada.estamento || "-"}</td>
                                    <td className="px-3 py-3">{llamada.prestacion || llamada.tipo_prestacion || "-"}</td>
                                    <td className="px-3 py-3">{llamada.respuesta_usuario}</td>
                                    <td className="px-3 py-3">
                                        <Button type="button" variant="outline" size="sm" onClick={() => onVerDetalle(llamada)}>
                                            <Eye size={14} />
                                            Ver
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {data.detalles.llamadas.length === 0 && <EmptyRow colSpan={8} />}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
    return (
        <tr>
            <td className="px-3 py-6 text-center text-muted-foreground" colSpan={colSpan}>
                Sin registros para el mes seleccionado.
            </td>
        </tr>
    );
}

function ModalShell({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-lg border bg-background shadow-lg">
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <div className="max-h-[calc(85vh-96px)] overflow-y-auto p-5">{children}</div>
            </div>
        </div>
    );
}

function CitasGestionadasModal({ gestion, onClose }: { gestion: DashboardFuncionarioData["detalles"]["gestiones"][number]; onClose: () => void }) {
    return (
        <ModalShell title="Citas gestionadas" description={`Solicitud ${gestion.id_solicitud} · ${gestion.rut_usuario}`} onClose={onClose}>
            <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[980px] table-fixed text-left text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                        <tr>
                            <th className="w-[190px] px-3 py-2 font-medium">Cita</th>
                            <th className="w-[120px] px-3 py-2 font-medium">Fecha estimada</th>
                            <th className="w-[210px] px-3 py-2 font-medium">Tipo</th>
                            <th className="w-[170px] px-3 py-2 font-medium">Estamento</th>
                            <th className="w-[220px] px-3 py-2 font-medium">Prestación</th>
                            <th className="w-[110px] px-3 py-2 font-medium">Prioridad</th>
                            <th className="w-[130px] px-3 py-2 font-medium">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gestion.citas.map((cita) => (
                            <tr key={cita.id_cita} className="border-t">
                                <td className="px-3 py-3 font-medium">{cita.id_cita}</td>
                                <td className="px-3 py-3">{formatFecha(cita.fecha_estimada_atencion)}</td>
                                <td className="px-3 py-3">{cita.tipo_prestacion}</td>
                                <td className="px-3 py-3">{cita.estamento || "-"}</td>
                                <td className="px-3 py-3">{cita.prestacion || cita.tipo_prestacion}</td>
                                <td className="px-3 py-3">{cita.priorizacion_clinica || "-"}</td>
                                <td className="px-3 py-3"><Badge variant="muted">{cita.estado_cita || "-"}</Badge></td>
                            </tr>
                        ))}
                        {gestion.citas.length === 0 && <EmptyRow colSpan={7} />}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

function DetalleLlamadaModal({ llamada, onClose }: { llamada: DashboardFuncionarioData["detalles"]["llamadas"][number]; onClose: () => void }) {
    return (
        <ModalShell title="Detalle llamada" description={`Llamada ${llamada.id_llamada}`} onClose={onClose}>
            <dl className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Fecha llamada" value={formatFechaHora(llamada.fecha_llamada)} />
                <DetailItem label="RUT paciente" value={llamada.rut_usuario} />
                <DetailItem label="Cita" value={llamada.cita_id} />
                <DetailItem label="Respuesta" value={llamada.respuesta_usuario} />
                <DetailItem label="Estamento" value={llamada.estamento || "-"} />
                <DetailItem label="Prestación llamada" value={llamada.prestacion || llamada.tipo_prestacion || "-"} />
                <div className="md:col-span-2">
                    <DetailItem label="Observación" value={llamada.observacion || "-"} />
                </div>
            </dl>
        </ModalShell>
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border p-3">
            <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm">{value}</dd>
        </div>
    );
}
