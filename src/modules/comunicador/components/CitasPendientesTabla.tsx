"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
// lib
import { cn } from "@/shared/lib/utils";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
// utils
import { resolverPrioridadCita, SIMBOLOGIA_PRIORIDAD } from "../utils/prioridadCita";
// types
import type { CitaFila } from "../actions/getCitasPendientes.action";

export function CitasPendientesTabla({
    filas,
    total,
    pagina,
    porPagina,
    citaSiguienteId,
    onPagina,
    onGestionar,
    renderAcciones
}: {
    filas: CitaFila[];
    total: number;
    pagina: number;
    porPagina: number;
    citaSiguienteId?: string | null;
    onPagina: (p: number) => void;
    onGestionar: (cita: CitaFila) => void;
    renderAcciones?: (cita: CitaFila) => React.ReactNode;
}) {
    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    const filaSiguienteRef = useRef<HTMLTableRowElement | null>(null);
    const botonSiguienteRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!citaSiguienteId) return;
        const filaEl = filaSiguienteRef.current;
        const botonEl = botonSiguienteRef.current;
        if (!filaEl) return;
        if (typeof filaEl.scrollIntoView === "function") {
            filaEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        botonEl?.focus({ preventScroll: true });
    }, [citaSiguienteId, filas]);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-label="Simbología de prioridad">
                <span className="font-medium text-foreground">Simbología de prioridad:</span>
                {SIMBOLOGIA_PRIORIDAD.map((item) => (
                    <span
                        key={item.nivel}
                        className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium", item.badgeClassName)}
                    >
                        <span className={cn("size-2 rounded-full", item.dotClassName)} aria-hidden="true" />
                        {item.textoSimbologia}
                    </span>
                ))}
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader className="bg-muted text-muted-foreground">
                        <TableRow>
                            <TableHead>ID / Fecha Estimada</TableHead>
                            <TableHead>Paciente</TableHead>
                            <TableHead>Prestación</TableHead>
                            <TableHead>Priorización / Disponibilidad</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filas.length === 0 ? (
                            <TableRow>
                                <TableCell className="py-6 text-center text-muted-foreground" colSpan={6}>
                                    No hay citas pendientes para los filtros actuales.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filas.map((c) => {
                                const esSiguiente = Boolean(citaSiguienteId && c.id_cita === citaSiguienteId);
                                const prioridad = resolverPrioridadCita(c.priorizacion_clinica, c.priorizacion);
                                return (
                                    <TableRow
                                        key={c.id_cita}
                                        ref={esSiguiente ? filaSiguienteRef : undefined}
                                        data-cita-siguiente={esSiguiente ? "true" : undefined}
                                        className={cn(
                                            c.tiene_llamada_hoy && "bg-primary/15",
                                            esSiguiente && "border-l-4 border-l-primary bg-primary/5 ring-1 ring-inset ring-primary/30"
                                        )}
                                    >
                                        <TableCell>
                                            <div className="flex flex-wrap items-center gap-1.5 font-medium">
                                                <CodigoId id={c.id_cita} />
                                                {esSiguiente && <Badge variant="default">Siguiente</Badge>}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {c.fecha_estimada_atencion ? new Date(c.fecha_estimada_atencion).toLocaleDateString("es-CL") : "—"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>{c.nombre_usuario || "—"}</div>
                                            <div className="text-xs text-muted-foreground">{c.rut_usuario}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div>{c.prestacion || "—"}</div>
                                            <div className="text-xs text-muted-foreground">{c.profesion || "—"}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                {prioridad ? (
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                                                            prioridad.badgeClassName
                                                        )}
                                                    >
                                                        <span className={cn("size-2 rounded-full", prioridad.dotClassName)} aria-hidden="true" />
                                                        {prioridad.etiqueta}
                                                    </span>
                                                ) : (
                                                    "—"
                                                )}
                                            </div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">{c.disponibilidad || "—"}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="warning">
                                                <AlertTriangle size={12} />
                                                {c.estado_cita}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    ref={esSiguiente ? botonSiguienteRef : undefined}
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => onGestionar(c)}
                                                >
                                                    Llamar
                                                </Button>
                                                {renderAcciones?.(c)}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                    {total} citas · página {pagina} de {totalPaginas}
                </span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
                        Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>
                        Siguiente
                    </Button>
                </div>
            </div>
        </div>
    );
}
