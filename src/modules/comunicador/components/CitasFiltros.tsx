"use client";

import { useMemo } from "react";
// components
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
// types
import { TEMPORALIDADES, ESTADOS_PENDIENTES } from "../types/comunicador";
import type { getFiltrosComunicador } from "../actions/getFiltrosComunicador.action";

export interface CitasFiltrosUI {
    temporalidad: string;
    estado: string;
    profesional_id: string;
    prestacion: string;
    edadMin: string;
    edadMax: string;
    fechaDesde: string;
    fechaHasta: string;
    rut: string;
    sector: string;
}

export const FILTROS_INICIALES: CitasFiltrosUI = {
    temporalidad: "Todas",
    estado: "",
    profesional_id: "",
    prestacion: "",
    edadMin: "",
    edadMax: "",
    fechaDesde: "",
    fechaHasta: "",
    rut: "",
    sector: ""
};

type Opciones = Awaited<ReturnType<typeof getFiltrosComunicador>>;

// Campos de filtro de la cola; el formulario y el boton Aplicar los pone PanelFiltros.
export function CitasFiltros({ opciones, valor, onCambio }: {
    opciones: Opciones;
    valor: CitasFiltrosUI;
    onCambio: (f: CitasFiltrosUI) => void;
}) {
    // Nombres de prestación únicos (deduplicados). Si hay profesional seleccionado, solo los suyos.
    const prestacionesUnicas = useMemo(() => {
        const base = valor.profesional_id
            ? opciones.prestaciones.filter((p) => String(p.profesional_id) === String(valor.profesional_id))
            : opciones.prestaciones;
        const nombres = Array.from(new Set(base.map((p) => p.nombre)));
        nombres.sort((a, b) => a.localeCompare(b, "es"));
        return nombres;
    }, [opciones.prestaciones, valor.profesional_id]);

    function set(campo: keyof CitasFiltrosUI, v: string) {
        onCambio({ ...valor, [campo]: v, ...(campo === "profesional_id" ? { prestacion: "" } : {}) });
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Temporalidad">
                <Select value={valor.temporalidad} onChange={(e) => set("temporalidad", e.target.value)}>
                    {TEMPORALIDADES.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Estado">
                <Select value={valor.estado} onChange={(e) => set("estado", e.target.value)}>
                    <option value="">Todas</option>
                    {ESTADOS_PENDIENTES.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Profesión">
                <Select value={valor.profesional_id} onChange={(e) => set("profesional_id", e.target.value)}>
                    <option value="">Todas</option>
                    {opciones.profesionales.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.nombre}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Prestación">
                <Select value={valor.prestacion} onChange={(e) => set("prestacion", e.target.value)}>
                    <option value="">Todas</option>
                    {prestacionesUnicas.map((nombre) => (
                        <option key={nombre} value={nombre}>
                            {nombre}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Edad mínima">
                <Input type="number" min="0" value={valor.edadMin} onChange={(e) => set("edadMin", e.target.value)} />
            </Field>
            <Field label="Edad máxima">
                <Input type="number" min="0" value={valor.edadMax} onChange={(e) => set("edadMax", e.target.value)} />
            </Field>
            <Field label="Fecha desde">
                <Input type="date" value={valor.fechaDesde} onChange={(e) => set("fechaDesde", e.target.value)} />
            </Field>
            <Field label="Fecha hasta">
                <Input type="date" value={valor.fechaHasta} onChange={(e) => set("fechaHasta", e.target.value)} />
            </Field>
            <Field label="RUT paciente">
                <Input value={valor.rut} onChange={(e) => set("rut", e.target.value)} placeholder="Ej: 12345678" />
            </Field>
            <Field label="Sector">
                <Input value={valor.sector} onChange={(e) => set("sector", e.target.value)} placeholder="Ej: Amarillo, 1, 2" />
            </Field>
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
