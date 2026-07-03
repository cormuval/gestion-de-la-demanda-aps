"use client";

import type { FormEvent, ReactNode } from "react";
import { X } from "lucide-react";
// schemas
import { DISCAPACIDAD_USUARIO, GENEROS_USUARIO, GESTANTE_USUARIO } from "../schemas/usuario.schema";
// components
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

export interface UsuarioEditFormState {
    rut: string;
    nombre: string;
    apellido: string;
    nombre_social: string;
    correo_contacto: string;
    sector: string;
    genero: (typeof GENEROS_USUARIO)[number] | "";
    fecha_nacimiento: string;
    telefono: string;
    telefono_alternativo: string;
    gestante: (typeof GESTANTE_USUARIO)[number] | "";
    discapacidad: (typeof DISCAPACIDAD_USUARIO)[number] | "";
    centro_id: string;
}

export interface CentroUsuarioOption {
    id_centro: string;
    nombre_centro: string | null;
}

export function UsuarioEditModal({
    form,
    centros,
    saving,
    onChange,
    onClose,
    onSubmit
}: {
    form: UsuarioEditFormState;
    centros: CentroUsuarioOption[];
    saving: boolean;
    onChange: (field: keyof UsuarioEditFormState, value: string) => void;
    onClose: () => void;
    onSubmit: (event: FormEvent) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border bg-background shadow-lg">
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold">Editar usuario</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Actualiza los datos del usuario asociado a la solicitud.</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={onSubmit}>
                    <Field label="RUT">
                        <Input value={form.rut} disabled required />
                    </Field>
                    <Field label="Nombre">
                        <Input value={form.nombre} onChange={(e) => onChange("nombre", e.target.value)} required />
                    </Field>
                    <Field label="Apellido">
                        <Input value={form.apellido} onChange={(e) => onChange("apellido", e.target.value)} required />
                    </Field>
                    <Field label="Nombre social">
                        <Input value={form.nombre_social} onChange={(e) => onChange("nombre_social", e.target.value)} />
                    </Field>
                    <Field label="Correo contacto">
                        <Input type="email" value={form.correo_contacto} onChange={(e) => onChange("correo_contacto", e.target.value)} />
                    </Field>
                    <Field label="Sector">
                        <Input value={form.sector} onChange={(e) => onChange("sector", e.target.value)} />
                    </Field>
                    <Field label="Genero">
                        <Select value={form.genero} onChange={(e) => onChange("genero", e.target.value)} required>
                            <option value="">Seleccionar</option>
                            {GENEROS_USUARIO.map((genero) => (
                                <option key={genero} value={genero}>
                                    {genero}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Fecha nacimiento">
                        <Input type="date" value={form.fecha_nacimiento} onChange={(e) => onChange("fecha_nacimiento", e.target.value)} required />
                    </Field>
                    <Field label="Telefono">
                        <Input value={form.telefono} onChange={(e) => onChange("telefono", e.target.value)} required />
                    </Field>
                    <Field label="Telefono alternativo">
                        <Input value={form.telefono_alternativo} onChange={(e) => onChange("telefono_alternativo", e.target.value)} required />
                    </Field>
                    <Field label="Gestante">
                        <Select value={form.gestante} onChange={(e) => onChange("gestante", e.target.value)} required disabled={form.genero !== "Femenino"}>
                            <option value="">Seleccionar</option>
                            {GESTANTE_USUARIO.map((gestante) => (
                                <option key={gestante} value={gestante}>
                                    {gestante}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Discapacidad">
                        <Select value={form.discapacidad} onChange={(e) => onChange("discapacidad", e.target.value)} required>
                            <option value="">Seleccionar</option>
                            {DISCAPACIDAD_USUARIO.map((discapacidad) => (
                                <option key={discapacidad} value={discapacidad}>
                                    {discapacidad}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Centro">
                        <Select value={form.centro_id} onChange={(e) => onChange("centro_id", e.target.value)} required>
                            <option value="">Seleccionar</option>
                            {centros.map((centro) => (
                                <option key={centro.id_centro} value={centro.id_centro}>
                                    {centro.nombre_centro || centro.id_centro}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>{saving ? "Guardando..." : "Guardar usuario"}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
