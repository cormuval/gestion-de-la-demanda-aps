"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { BarChart3, ChevronDown, ChevronRight, ClipboardCheck, Filter, Stethoscope } from "lucide-react";
import { toast } from "sonner";
// actions
import { getSomePanel, type SomePanelData, type SomeRangoDias } from "@/modules/some/actions/getSomePanel.action";
// components
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/shared/components/ui/chart";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
// types
import { ESTADOS_PENDIENTES, TEMPORALIDAD } from "@/modules/comunicador/types/comunicador";

type TabKey = "productividad" | "demanda" | "solicitudes";

const RANGOS: SomeRangoDias[] = [30, 60, 90];
const metricasProductividad = [
    { key: "solicitudesIngresadas", label: "Solicitudes", color: "#0f766e" },
    { key: "gestiones", label: "Gestiones", color: "#475569" },
    { key: "solicitudesRealizadas", label: "Realizadas", color: "#2563eb" },
    { key: "solicitudesRechazadas", label: "Rechazadas", color: "#b91c1c" },
    { key: "citasCreadas", label: "Citas", color: "#7c3aed" },
    { key: "llamadasRealizadas", label: "Llamadas", color: "#d97706" }
] as const;
type MetricaProductividad = (typeof metricasProductividad)[number]["key"];
const chartConfig = Object.fromEntries(metricasProductividad.map((item) => [item.key, { label: item.label, color: item.color }])) satisfies ChartConfig;

const emptyData: SomePanelData = {
    esAdministrador: false,
    rangoDias: 30,
    desde: new Date(),
    hasta: new Date(),
    centroSeleccionado: "",
    funcionarioSeleccionado: "",
    demandaTemporalidad: "Todas",
    centros: [],
    funcionarios: [],
    totales: {
        solicitudesIngresadas: 0,
        gestiones: 0,
        solicitudesRealizadas: 0,
        solicitudesRechazadas: 0,
        citasCreadas: 0,
        llamadasRealizadas: 0
    },
    serie: [],
    productividad: [],
    demandaClinica: [],
    solicitudesPendientes: []
};

export function SomeView() {
    const [tab, setTab] = useState<TabKey>("productividad");
    const [rangoDias, setRangoDias] = useState<SomeRangoDias>(30);
    const [centroId, setCentroId] = useState("");
    const [funcionarioRut, setFuncionarioRut] = useState("");
    const [demandaTemporalidad, setDemandaTemporalidad] = useState("Todas");
    const [activeMetric, setActiveMetric] = useState<MetricaProductividad>("solicitudesIngresadas");
    const [data, setData] = useState<SomePanelData>(emptyData);
    const [loading, setLoading] = useState(false);

    async function cargar(next?: { rangoDias?: SomeRangoDias; centroId?: string; funcionarioRut?: string; demandaTemporalidad?: string }) {
        setLoading(true);
        try {
            const result = await getSomePanel({
                rangoDias: next?.rangoDias ?? rangoDias,
                centroId: next?.centroId ?? centroId,
                funcionarioRut: next?.funcionarioRut ?? funcionarioRut,
                demandaTemporalidad: next?.demandaTemporalidad ?? demandaTemporalidad
            });
            setData(result);
            setCentroId(result.centroSeleccionado);
            setFuncionarioRut(result.funcionarioSeleccionado);
            setDemandaTemporalidad(result.demandaTemporalidad);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al cargar panel SOME");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const centroNombre = useMemo(() => {
        const centro = data.centros.find((item) => item.id_centro === data.centroSeleccionado);
        return centro?.nombre_centro || data.centroSeleccionado || "-";
    }, [data.centroSeleccionado, data.centros]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">SOME</h1>
                <p className="mt-1 text-sm text-muted-foreground">Productividad y demanda clinica del centro {centroNombre}.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button type="button" variant={tab === "productividad" ? "default" : "outline"} onClick={() => setTab("productividad")}>
                    <BarChart3 size={16} />
                    Productividad
                </Button>
                <Button type="button" variant={tab === "demanda" ? "default" : "outline"} onClick={() => setTab("demanda")}>
                    <Stethoscope size={16} />
                    Demanda Clinica
                </Button>
                <Button type="button" variant={tab === "solicitudes" ? "default" : "outline"} onClick={() => setTab("solicitudes")}>
                    <ClipboardCheck size={16} />
                    Solicitudes Pendientes
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>
                        {tab === "productividad"
                            ? "Rango de dias, centro y funcionario segun permisos del rol."
                            : tab === "demanda"
                              ? "Centro y temporalidad para citas pendientes."
                              : "Centro para solicitudes pendientes de validacion."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        className="grid gap-4 md:grid-cols-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            cargar();
                        }}
                    >
                        {tab === "productividad" && (
                            <Field label="Periodo">
                                <Select value={String(rangoDias)} onChange={(event) => setRangoDias(Number(event.target.value) as SomeRangoDias)}>
                                    {RANGOS.map((rango) => (
                                        <option key={rango} value={rango}>
                                            {rango} dias
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        )}
                        <Field label="Centro">
                            <Select
                                value={centroId}
                                disabled={!data.esAdministrador}
                                onChange={(event) => {
                                    const nextCentroId = event.target.value;
                                    setCentroId(nextCentroId);
                                    setFuncionarioRut("");
                                    cargar({ centroId: nextCentroId, funcionarioRut: "" });
                                }}
                            >
                                {data.centros.map((centro) => (
                                    <option key={centro.id_centro} value={centro.id_centro}>
                                        {centro.nombre_centro || centro.id_centro}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        {tab === "productividad" ? (
                            <Field label="Funcionario">
                                <Select value={funcionarioRut} onChange={(event) => setFuncionarioRut(event.target.value)}>
                                    <option value="">Todos</option>
                                    {data.funcionarios.map((funcionario) => (
                                        <option key={funcionario.rut} value={funcionario.rut}>
                                            {funcionario.nombre}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        ) : tab === "demanda" ? (
                            <Field label="Temporalidad">
                                <Select value={demandaTemporalidad} onChange={(event) => setDemandaTemporalidad(event.target.value)}>
                                    {[TEMPORALIDAD.TODAS, TEMPORALIDAD.ATRASADOS, TEMPORALIDAD.PROXIMOS, TEMPORALIDAD.FUTUROS].map((item) => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        ) : null}
                        <div className="flex items-end">
                            <Button disabled={loading}>
                                <Filter size={16} />
                                {loading ? "Consultando..." : "Aplicar filtros"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {tab === "productividad" ? (
                <ProductividadPanel data={data} activeMetric={activeMetric} onActiveMetricChange={setActiveMetric} />
            ) : tab === "demanda" ? (
                <DemandaClinicaPanel data={data} />
            ) : (
                <SolicitudesPendientesPanel data={data} />
            )}
        </div>
    );
}

function ProductividadPanel({
    data,
    activeMetric,
    onActiveMetricChange
}: {
    data: SomePanelData;
    activeMetric: MetricaProductividad;
    onActiveMetricChange: (metric: MetricaProductividad) => void;
}) {
    const totalesPorMetrica = useMemo(
        () => Object.fromEntries(metricasProductividad.map((item) => [item.key, data.totales[item.key]])) as Record<MetricaProductividad, number>,
        [data.totales]
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Serie diaria</CardTitle>
                    <CardDescription>Area Chart interactivo de los ultimos {data.rangoDias} dias para los filtros aplicados.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ProductividadChart serie={data.serie} activeMetric={activeMetric} onActiveMetricChange={onActiveMetricChange} totales={totalesPorMetrica} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Productividad por funcionario</CardTitle>
                    <CardDescription>Metricas de los ultimos {data.rangoDias} dias para funcionarios activos del centro seleccionado.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                            <thead className="bg-muted text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Funcionario</th>
                                    <th className="w-[120px] px-3 py-2 font-medium">Solicitudes</th>
                                    <th className="w-[110px] px-3 py-2 font-medium">Gestiones</th>
                                    <th className="w-[110px] px-3 py-2 font-medium">Realizadas</th>
                                    <th className="w-[110px] px-3 py-2 font-medium">Rechazadas</th>
                                    <th className="w-[90px] px-3 py-2 font-medium">Citas</th>
                                    <th className="w-[100px] px-3 py-2 font-medium">Llamadas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.productividad.map((row) => (
                                    <tr key={row.rut} className="border-t">
                                        <td className="px-3 py-3">
                                            <p className="font-medium">{row.nombre}</p>
                                            <p className="text-xs text-muted-foreground">{row.rut}</p>
                                        </td>
                                        <NumberCell value={row.solicitudesIngresadas} />
                                        <NumberCell value={row.gestiones} />
                                        <NumberCell value={row.solicitudesRealizadas} />
                                        <NumberCell value={row.solicitudesRechazadas} />
                                        <NumberCell value={row.citasCreadas} />
                                        <NumberCell value={row.llamadasRealizadas} />
                                    </tr>
                                ))}
                                {data.productividad.length === 0 && <EmptyRow colSpan={7} />}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function ProductividadChart({
    serie,
    activeMetric,
    onActiveMetricChange,
    totales
}: {
    serie: SomePanelData["serie"];
    activeMetric: MetricaProductividad;
    onActiveMetricChange: (metric: MetricaProductividad) => void;
    totales: Record<MetricaProductividad, number>;
}) {
    const hasData = serie.some((dia) => metricasProductividad.some((item) => dia[item.key] > 0));
    const activeConfig = metricasProductividad.find((item) => item.key === activeMetric) ?? metricasProductividad[0];

    return (
        <div className="space-y-4">
            <div className="grid rounded-md border md:grid-cols-3 xl:grid-cols-6">
                {metricasProductividad.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={`flex min-h-[72px] flex-col items-start justify-center gap-1 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 md:border-r md:last:border-r-0 xl:border-b-0 ${
                            activeMetric === item.key ? "bg-muted/70" : ""
                        }`}
                        onClick={() => onActiveMetricChange(item.key)}
                    >
                        <span className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            {item.label}
                        </span>
                        <span className="text-2xl font-semibold">{totales[item.key]}</span>
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
                            tickFormatter={(value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
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
                            <linearGradient id={`fill-some-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.35} />
                                <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0.04} />
                            </linearGradient>
                        </defs>
                        <Area
                            dataKey={activeMetric}
                            type="natural"
                            fill={`url(#fill-some-${activeMetric})`}
                            stroke={activeConfig.color}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </AreaChart>
                </ChartContainer>
                {!hasData && (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                        Sin actividad registrada para los filtros seleccionados
                    </div>
                )}
            </div>
        </div>
    );
}

function DemandaClinicaPanel({ data }: { data: SomePanelData }) {
    const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

    function toggle(profesional: string) {
        setAbiertos((current) => {
            const next = new Set(current);
            if (next.has(profesional)) {
                next.delete(profesional);
            } else {
                next.add(profesional);
            }
            return next;
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Demanda Clinica</CardTitle>
                <CardDescription>Citas pendientes agrupadas por profesional con prestaciones desplegables. Temporalidad: {data.demandaTemporalidad}.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[980px] table-fixed text-left text-sm">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 font-medium">Profesional / Prestacion</th>
                                <th className="w-[80px] px-3 py-2 font-medium">Total</th>
                                <th className="w-[120px] px-3 py-2 font-medium">Atrasados</th>
                                <th className="w-[120px] px-3 py-2 font-medium">Proximos</th>
                                <th className="w-[120px] px-3 py-2 font-medium">Futuros</th>
                                {ESTADOS_PENDIENTES.map((estado) => (
                                    <th key={estado} className="w-[130px] px-3 py-2 font-medium">
                                        {estado}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.demandaClinica.map((row) => {
                                const abierto = abiertos.has(row.profesional);
                                return (
                                    <Fragment key={row.profesional}>
                                        <tr className="border-t bg-muted/20">
                                            <td className="px-3 py-3">
                                                <button type="button" className="flex items-center gap-2 font-medium" onClick={() => toggle(row.profesional)}>
                                                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    {row.profesional}
                                                </button>
                                            </td>
                                            <NumberCell value={row.total} />
                                            <NumberCell value={row.temporalidades[TEMPORALIDAD.ATRASADOS] ?? 0} />
                                            <NumberCell value={row.temporalidades[TEMPORALIDAD.PROXIMOS] ?? 0} />
                                            <NumberCell value={row.temporalidades[TEMPORALIDAD.FUTUROS] ?? 0} />
                                            {ESTADOS_PENDIENTES.map((estado) => (
                                                <NumberCell key={estado} value={row.estados[estado] ?? 0} />
                                            ))}
                                        </tr>
                                        {abierto &&
                                            row.prestaciones.map((prestacion) => (
                                                <tr key={`${row.profesional}-${prestacion.prestacion}`} className="border-t">
                                                    <td className="px-3 py-3 pl-10 text-muted-foreground">{prestacion.prestacion}</td>
                                                    <NumberCell value={prestacion.total} />
                                                    <NumberCell value={prestacion.temporalidades[TEMPORALIDAD.ATRASADOS] ?? 0} />
                                                    <NumberCell value={prestacion.temporalidades[TEMPORALIDAD.PROXIMOS] ?? 0} />
                                                    <NumberCell value={prestacion.temporalidades[TEMPORALIDAD.FUTUROS] ?? 0} />
                                                    {ESTADOS_PENDIENTES.map((estado) => (
                                                        <NumberCell key={estado} value={prestacion.estados[estado] ?? 0} />
                                                    ))}
                                                </tr>
                                            ))}
                                    </Fragment>
                                );
                            })}
                            {data.demandaClinica.length === 0 && <EmptyRow colSpan={9} />}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function SolicitudesPendientesPanel({ data }: { data: SomePanelData }) {
    const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

    function toggle(tipoSolicitud: string) {
        setAbiertos((current) => {
            const next = new Set(current);
            if (next.has(tipoSolicitud)) {
                next.delete(tipoSolicitud);
            } else {
                next.add(tipoSolicitud);
            }
            return next;
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Solicitudes Pendientes</CardTitle>
                <CardDescription>Solicitudes en espera de validacion agrupadas por tipo y motivo.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[620px] table-fixed text-left text-sm">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 font-medium">Tipo solicitud / Motivo</th>
                                <th className="w-[120px] px-3 py-2 font-medium">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.solicitudesPendientes.map((row) => {
                                const abierto = abiertos.has(row.tipoSolicitud);
                                return (
                                    <Fragment key={row.tipoSolicitud}>
                                        <tr className="border-t bg-muted/20">
                                            <td className="px-3 py-3">
                                                <button type="button" className="flex items-center gap-2 font-medium" onClick={() => toggle(row.tipoSolicitud)}>
                                                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    {row.tipoSolicitud}
                                                </button>
                                            </td>
                                            <NumberCell value={row.total} />
                                        </tr>
                                        {abierto &&
                                            row.motivos.map((motivo) => (
                                                <tr key={`${row.tipoSolicitud}-${motivo.motivo}`} className="border-t">
                                                    <td className="px-3 py-3 pl-10 text-muted-foreground">{motivo.motivo}</td>
                                                    <NumberCell value={motivo.total} />
                                                </tr>
                                            ))}
                                    </Fragment>
                                );
                            })}
                            {data.solicitudesPendientes.length === 0 && <EmptyRow colSpan={2} />}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
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

function NumberCell({ value }: { value: number }) {
    return <td className="px-3 py-3 tabular-nums">{value}</td>;
}

function EmptyRow({ colSpan }: { colSpan: number }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-muted-foreground">
                Sin registros para los filtros seleccionados.
            </td>
        </tr>
    );
}
