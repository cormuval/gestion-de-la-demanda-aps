"use client";

import { useMemo } from "react";
import { Filter } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
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
    prestacion_id: string;
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
    prestacion_id: "",
    edadMin: "",
    edadMax: "",
    fechaDesde: "",
    fechaHasta: "",
    rut: "",
    sector: ""
};

type Opciones = Awaited<ReturnType<typeof getFiltrosComunicador>>;

export function CitasFiltros({ opciones, valor, onCambio, onAplicar }: {
    opciones: Opciones;
    valor: CitasFiltrosUI;
    onCambio: (f: CitasFiltrosUI) => void;
    onAplicar: () => void;
}) {
    const prestacionesFiltradas = useMemo(() => {
        if (!valor.profesional_id) return opciones.prestaciones;
        return opciones.prestaciones.filter((p) => String(p.profesional_id) === String(valor.profesional_id));
    }, [opciones.prestaciones, valor.profesional_id]);

    function set(campo: keyof CitasFiltrosUI, v: string) {
        onCambio({ ...valor, [campo]: v, ...(campo === "profesional_id" ? { prestacion_id: "" } : {}) });
    }

    return (
        <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(e) => {
                e.preventDefault();
                onAplicar();
            }}
        >
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
                <Select value={valor.prestacion_id} onChange={(e) => set("prestacion_id", e.target.value)}>
                    <option value="">Todas</option>
                    {prestacionesFiltradas.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.nombre}
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
            <div className="md:col-span-4">
                <Button type="submit">
                    <Filter size={16} />
                    Aplicar filtros
                </Button>
            </div>
        </form>
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
