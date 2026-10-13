"use client";

import { AlertTriangle } from "lucide-react";
// lib
import { cn } from "@/shared/lib/utils";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { CodigoId } from "@/shared/components/ui/codigo-id";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import type { CitaFila } from "../actions/getCitasPendientes.action";

export function CitasPendientesTabla({ filas, total, pagina, porPagina, onPagina, onGestionar, renderAcciones }: {
    filas: CitaFila[];
    total: number;
    pagina: number;
    porPagina: number;
    onPagina: (p: number) => void;
    onGestionar: (cita: CitaFila) => void;
    renderAcciones?: (cita: CitaFila) => React.ReactNode;
}) {
    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    return (
        <div className="space-y-3">
            <div className="rounded-md border">
                <Table>
                    <TableHeader className="bg-muted text-muted-foreground">
                        <TableRow>
                            <TableHead>Cita</TableHead>
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
                            filas.map((c) => (
                                <TableRow key={c.id_cita} className={cn(c.tiene_llamada_hoy && "bg-primary/15")}>
                                    <TableCell>
                                        <div className="font-medium"><CodigoId id={c.id_cita} /></div>
                                        <div className="text-xs text-muted-foreground">
                                            {c.fecha_estimada_atencion ? new Date(c.fecha_estimada_atencion).toLocaleDateString("es-CL") : "—"}
                                        </div>
                                    </TableCell>
                                    <TableCell>{c.rut_usuario}</TableCell>
                                    <TableCell>
                                        <div>{c.prestacion || "—"}</div>
                                        <div className="text-xs text-muted-foreground">{c.profesion || "—"}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div>{c.priorizacion ?? "—"}</div>
                                        <div className="text-xs text-muted-foreground">{c.disponibilidad || "—"}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="warning">
                                            <AlertTriangle size={12} />
                                            {c.estado_cita}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button type="button" size="sm" onClick={() => onGestionar(c)}>
                                                Llamar
                                            </Button>
                                            {renderAcciones?.(c)}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{total} citas · página {pagina} de {totalPaginas}</span>
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
