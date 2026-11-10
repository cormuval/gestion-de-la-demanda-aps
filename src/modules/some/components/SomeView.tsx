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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
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
    alcanzaTodosLosCentros: false,
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
    const [data, setData] = useState<SomePanelData | null>(null);
    const [loading, setLoading] = useState(false);

    function sincronizarFiltros(panel: SomePanelData) {
        setRangoDias(panel.rangoDias);
        setCentroId(panel.centroSeleccionado);
        setFuncionarioRut(panel.funcionarioSeleccionado);
        setDemandaTemporalidad(panel.demandaTemporalidad);
    }

    async function cargar(next?: { rangoDias?: SomeRangoDias; centroId?: string; funcionarioRut?: string; demandaTemporalidad?: string }) {
        setLoading(true);
        try {
            const result = await getSomePanel({
                rangoDias: next?.rangoDias ?? rangoDias,
                centroId: next?.centroId ?? centroId,
                funcionarioRut: next?.funcionarioRut ?? funcionarioRut,
                demandaTemporalidad: next?.demandaTemporalidad ?? demandaTemporalidad
            });
            if (!result.ok) {
                if (data) sincronizarFiltros(data);
                toast.error(result.error);
                return;
            }
            setData(result.data);
            sincronizarFiltros(result.data);
        } catch {
            if (data) sincronizarFiltros(data);
            toast.error("No se pudo cargar el panel SOME");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const panelData = data ?? emptyData;
    const centroNombre = useMemo(() => {
        const centro = panelData.centros.find((item) => item.id_centro === panelData.centroSeleccionado);
        return centro?.nombre_centro || panelData.centroSeleccionado || "-";
    }, [panelData.centroSeleccionado, panelData.centros]);

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
                                disabled={!panelData.alcanzaTodosLosCentros}
                                onChange={(event) => {
                                    const nextCentroId = event.target.value;
                                    cargar({ centroId: nextCentroId, funcionarioRut: "" });
                                }}
                            >
                                {panelData.centros.map((centro) => (
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
                                    {panelData.funcionarios.map((funcionario) => (
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

            {data &&
                (tab === "productividad" ? (
                    <ProductividadPanel data={data} activeMetric={activeMetric} onActiveMetricChange={setActiveMetric} />
                ) : tab === "demanda" ? (
                    <DemandaClinicaPanel data={data} />
                ) : (
                    <SolicitudesPendientesPanel data={data} />
                ))}
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
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader className="bg-muted text-muted-foreground">
                                <TableRow>
                                    <TableHead>Funcionario</TableHead>
                                    <TableHead>Solicitudes</TableHead>
                                    <TableHead>Gestiones</TableHead>
                                    <TableHead>Realizadas</TableHead>
                                    <TableHead>Rechazadas</TableHead>
                                    <TableHead>Citas</TableHead>
                                    <TableHead>Llamadas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.productividad.map((row) => (
                                    <TableRow key={row.rut}>
                                        <TableCell>
                                            <p className="font-medium">{row.nombre}</p>
                                            <p className="text-xs text-muted-foreground">{row.rut}</p>
                                        </TableCell>
                                        <NumberCell value={row.solicitudesIngresadas} />
                                        <NumberCell value={row.gestiones} />
                                        <NumberCell value={row.solicitudesRealizadas} />
                                        <NumberCell value={row.solicitudesRechazadas} />
                                        <NumberCell value={row.citasCreadas} />
                                        <NumberCell value={row.llamadasRealizadas} />
                                    </TableRow>
                                ))}
                                {data.productividad.length === 0 && <EmptyRow colSpan={7} />}
                            </TableBody>
                        </Table>
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
                <div className="rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted text-muted-foreground">
                            <TableRow>
                                <TableHead>Profesional / Prestacion</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Temporalidad</TableHead>
                                <TableHead>Estados</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.demandaClinica.map((row) => {
                                const abierto = abiertos.has(row.profesional);
                                return (
                                    <Fragment key={row.profesional}>
                                        <TableRow className="bg-muted/20">
                                            <TableCell>
                                                <button type="button" className="flex items-center gap-2 font-medium" onClick={() => toggle(row.profesional)}>
                                                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    {row.profesional}
                                                </button>
                                            </TableCell>
                                            <NumberCell value={row.total} />
                                            <TableCell>
                                                <ConteosList
                                                    items={[
                                                        [TEMPORALIDAD.ATRASADOS, row.temporalidades[TEMPORALIDAD.ATRASADOS] ?? 0],
                                                        [TEMPORALIDAD.PROXIMOS, row.temporalidades[TEMPORALIDAD.PROXIMOS] ?? 0],
                                                        [TEMPORALIDAD.FUTUROS, row.temporalidades[TEMPORALIDAD.FUTUROS] ?? 0]
                                                    ]}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <ConteosList items={ESTADOS_PENDIENTES.map((estado) => [estado, row.estados[estado] ?? 0])} />
                                            </TableCell>
                                        </TableRow>
                                        {abierto &&
                                            row.prestaciones.map((prestacion) => (
                                                <TableRow key={`${row.profesional}-${prestacion.prestacion}`}>
                                                    <TableCell className="pl-10 text-muted-foreground">{prestacion.prestacion}</TableCell>
                                                    <NumberCell value={prestacion.total} />
                                                    <TableCell>
                                                        <ConteosList
                                                            items={[
                                                                [TEMPORALIDAD.ATRASADOS, prestacion.temporalidades[TEMPORALIDAD.ATRASADOS] ?? 0],
                                                                [TEMPORALIDAD.PROXIMOS, prestacion.temporalidades[TEMPORALIDAD.PROXIMOS] ?? 0],
                                                                [TEMPORALIDAD.FUTUROS, prestacion.temporalidades[TEMPORALIDAD.FUTUROS] ?? 0]
                                                            ]}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <ConteosList items={ESTADOS_PENDIENTES.map((estado) => [estado, prestacion.estados[estado] ?? 0])} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </Fragment>
                                );
                            })}
                            {data.demandaClinica.length === 0 && <EmptyRow colSpan={4} />}
                        </TableBody>
                    </Table>
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
                <div className="rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted text-muted-foreground">
                            <TableRow>
                                <TableHead>Tipo solicitud / Motivo</TableHead>
                                <TableHead>Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.solicitudesPendientes.map((row) => {
                                const abierto = abiertos.has(row.tipoSolicitud);
                                return (
                                    <Fragment key={row.tipoSolicitud}>
                                        <TableRow className="bg-muted/20">
                                            <TableCell>
                                                <button type="button" className="flex items-center gap-2 font-medium" onClick={() => toggle(row.tipoSolicitud)}>
                                                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    {row.tipoSolicitud}
                                                </button>
                                            </TableCell>
                                            <NumberCell value={row.total} />
                                        </TableRow>
                                        {abierto &&
                                            row.motivos.map((motivo) => (
                                                <TableRow key={`${row.tipoSolicitud}-${motivo.motivo}`}>
                                                    <TableCell className="pl-10 text-muted-foreground">{motivo.motivo}</TableCell>
                                                    <NumberCell value={motivo.total} />
                                                </TableRow>
                                            ))}
                                    </Fragment>
                                );
                            })}
                            {data.solicitudesPendientes.length === 0 && <EmptyRow colSpan={2} />}
                        </TableBody>
                    </Table>
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
    return <TableCell className="tabular-nums">{value}</TableCell>;
}

function EmptyRow({ colSpan }: { colSpan: number }) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan} className="py-6 text-center text-sm text-muted-foreground">
                Sin registros para los filtros seleccionados.
            </TableCell>
        </TableRow>
    );
}

function ConteosList({ items }: { items: Array<[string, number]> }) {
    return (
        <dl className="flex flex-col gap-1 text-xs">
            {items.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                </div>
            ))}
        </dl>
    );
}
