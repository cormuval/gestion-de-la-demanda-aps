"use client";

import type { JSX } from "react";
import { Printer, X } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
// types
import type { VoucherSolicitud } from "@/modules/solicitudes/types/voucher";

export interface VoucherSolicitudModalProps {
    voucher: VoucherSolicitud;
    onClose: () => void;
}

export function VoucherSolicitudModal({ voucher, onClose }: VoucherSolicitudModalProps): JSX.Element {
    const fecha = new Date(voucher.fecha_inicio);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-md border bg-background shadow-lg">
                <div className="no-print flex items-center justify-between border-b p-4">
                    <div>
                        <h2 className="text-lg font-semibold">Voucher de solicitud</h2>
                        <p className="text-sm text-muted-foreground">Listo para imprimir.</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>

                <div className="voucher-print-area mx-auto bg-white p-4 text-black">
                    <div className="text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/CALUGA_LOGOS_2025.png" alt="Corporacion Municipal Valparaiso" className="mx-auto mb-3 max-h-14 max-w-full object-contain" />
                        <p className="text-sm font-bold">COMPROBANTE DE SOLICITUD</p>
                        <p className="text-xs">{voucher.centro || "Centro no informado"}</p>
                    </div>

                    <div className="my-3 border-t border-dashed border-black" />
                    <VoucherLine label="Solicitud" value={voucher.id_solicitud} />
                    <VoucherLine label="Fecha" value={fecha.toLocaleDateString("es-CL")} />
                    <VoucherLine label="Hora" value={fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} />
                    <VoucherLine label="RUT" value={voucher.rut} />
                    <VoucherLine label="Tipo" value={voucher.tipoSolicitud.nombre_tipo_solicitud} />
                    <VoucherLine label="Motivo" value={voucher.motivo?.nombre_motivo || "Sin motivo"} />
                    {voucher.disponibilidad_llamada && <VoucherLine label="Disponibilidad" value={voucher.disponibilidad_llamada} />}
                    {(voucher.usuario.telefono || voucher.usuario.telefono_alternativo) && (
                        <VoucherLine label="Telefonos" value={[voucher.usuario.telefono, voucher.usuario.telefono_alternativo].filter(Boolean).join(" / ")} />
                    )}
                    <div className="my-3 border-t border-dashed border-black" />
                    <p className="text-center text-[11px]">Conserve este comprobante.</p>
                    <p className="mt-2 text-center text-[11px]">
                        Esta solicitud sera revisada y gestionada por un profesional de salud para otorgar la prestacion adecuada a su solicitud.
                    </p>
                </div>

                <div className="no-print flex justify-end gap-2 border-t p-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                    <Button type="button" onClick={() => window.print()}>
                        <Printer size={16} />
                        Imprimir
                    </Button>
                </div>

                <style>{`
                    .voucher-print-area {
                        width: 80mm;
                        max-width: 100%;
                        font-family: Arial, sans-serif;
                        font-size: 12px;
                        line-height: 1.35;
                    }

                    @media print {
                        @page {
                            size: 80mm auto;
                            margin: 4mm;
                        }

                        body * {
                            visibility: hidden;
                        }

                        .voucher-print-area,
                        .voucher-print-area * {
                            visibility: visible;
                        }

                        .voucher-print-area {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 72mm;
                            max-width: 72mm;
                            padding: 0;
                        }

                        .no-print {
                            display: none !important;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}

function VoucherLine({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <div className="mb-1">
            <span className="font-bold">{label}: </span>
            <span>{value}</span>
        </div>
    );
}
