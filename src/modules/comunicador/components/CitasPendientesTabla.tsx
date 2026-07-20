"use client";

import { AlertTriangle } from "lucide-react";
// lib
import { cn } from "@/shared/lib/utils";
// components
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type { CitaFila } from "../actions/getCitasPendientes.action";

function abreviar(codigo: string): string {
    return codigo.length > 14 ? `${codigo.slice(0, 12)}…` : codigo;
}

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
            <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 font-medium">Código</th>
                            <th className="px-3 py-2 font-medium">Priorización</th>
                            <th className="px-3 py-2 font-medium">Disponibilidad</th>
                            <th className="px-3 py-2 font-medium">RUT</th>
                            <th className="px-3 py-2 font-medium">Profesión</th>
                            <th className="px-3 py-2 font-medium">Prestación</th>
                            <th className="px-3 py-2 font-medium">Fecha estimada</th>
                            <th className="px-3 py-2 font-medium">Estado</th>
                            <th className="px-3 py-2 font-medium"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.length === 0 ? (
                            <tr>
                                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={9}>
                                    No hay citas pendientes para los filtros actuales.
                                </td>
                            </tr>
                        ) : (
                            filas.map((c) => (
                                <tr key={c.id_cita} className={cn("border-t", c.tiene_llamada_hoy && "bg-primary/5")}>
                                    <td className="px-3 py-3 font-medium" title={c.id_cita}>{abreviar(c.id_cita)}</td>
                                    <td className="px-3 py-3">{c.priorizacion ?? "—"}</td>
                                    <td className="px-3 py-3">{c.disponibilidad || "—"}</td>
                                    <td className="px-3 py-3">{c.rut_usuario}</td>
                                    <td className="px-3 py-3">{c.profesion || "—"}</td>
                                    <td className="px-3 py-3">{c.prestacion || "—"}</td>
                                    <td className="px-3 py-3">{c.fecha_estimada_atencion ? new Date(c.fecha_estimada_atencion).toLocaleDateString("es-CL") : "—"}</td>
                                    <td className="px-3 py-3">
                                        <Badge variant="warning">
                                            <AlertTriangle size={12} />
                                            {c.estado_cita}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" onClick={() => onGestionar(c)}>
                                                Llamar
                                            </Button>
                                            {renderAcciones?.(c)}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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
