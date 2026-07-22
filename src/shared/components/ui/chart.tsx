"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
// lib
import { cn } from "@/shared/lib/utils";

export type ChartConfig = Record<
    string,
    {
        label: string;
        color: string;
    }
>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
    const context = React.useContext(ChartContext);
    if (!context) throw new Error("useChart debe usarse dentro de ChartContainer");
    return context;
}

const ChartContainer = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        config: ChartConfig;
        children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
    }
>(({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                ref={ref}
                data-chart={chartId}
                className={cn(
                    "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/70 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-none",
                    className
                )}
                style={
                    {
                        ...Object.fromEntries(Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color]))
                    } as React.CSSProperties
                }
                {...props}
            >
                <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
});
ChartContainer.displayName = "ChartContainer";

const ChartTooltip = RechartsPrimitive.Tooltip;

interface ChartTooltipContentPayload {
    dataKey?: string | number;
    name?: string | number;
    value?: unknown;
    color?: string;
}

interface ChartTooltipContentProps {
    active?: boolean;
    payload?: ChartTooltipContentPayload[];
    label?: unknown;
    className?: string;
    labelFormatter?: (label: unknown, payload: ChartTooltipContentPayload[]) => React.ReactNode;
    valueFormatter?: (value: unknown, name: string) => React.ReactNode;
}

function ChartTooltipContent({
    active,
    payload,
    label,
    className,
    labelFormatter,
    valueFormatter
}: ChartTooltipContentProps) {
    const { config } = useChart();

    if (!active || !payload?.length) return null;

    return (
        <div className={cn("min-w-[9rem] rounded-md border bg-background px-3 py-2 text-sm shadow-md", className)}>
            {label !== undefined && (
                <div className="mb-2 font-medium">
                    {labelFormatter ? labelFormatter(label, payload) : String(label)}
                </div>
            )}
            <div className="space-y-1">
                {payload.map((item) => {
                    const key = String(item.dataKey ?? item.name ?? "");
                    const itemConfig = config[key];
                    const color = item.color ?? itemConfig?.color ?? "currentColor";
                    return (
                        <div key={key} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                                <span>{itemConfig?.label ?? item.name ?? key}</span>
                            </div>
                            <span className="font-mono font-medium text-foreground">
                                {valueFormatter ? valueFormatter(item.value, key) : String(item.value ?? 0)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
