"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
// actions
import { actualizarUsuarioComunicador } from "../actions/actualizarUsuarioComunicador.action";
import { getUsuarioParaEdicion, type UsuarioEditable } from "../actions/getUsuarioParaEdicion.action";
// components
import type { UsuarioEditFormState } from "@/modules/solicitudes/components/UsuarioEditModal";
// schemas
import { DISCAPACIDAD_USUARIO, GENEROS_USUARIO, GESTANTE_USUARIO } from "@/modules/solicitudes/schemas/usuario.schema";

const emptyForm: UsuarioEditFormState = {
    rut: "",
    nombre: "",
    apellido: "",
    nombre_social: "",
    correo_contacto: "",
    sector: "",
    genero: "",
    fecha_nacimiento: "",
    telefono: "",
    telefono_alternativo: "",
    gestante: "",
    discapacidad: "",
    centro_id: ""
};

function toDateInput(value: Date | string | null): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function toForm(usuario: UsuarioEditable): UsuarioEditFormState {
    return {
        rut: usuario.rut,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        nombre_social: usuario.nombre_social ?? "",
        correo_contacto: usuario.correo_contacto ?? "",
        sector: usuario.sector ?? "",
        genero: (usuario.genero as UsuarioEditFormState["genero"]) ?? "",
        fecha_nacimiento: toDateInput(usuario.fecha_nacimiento),
        telefono: usuario.telefono ?? "",
        telefono_alternativo: usuario.telefono_alternativo ?? "",
        gestante: usuario.genero === "Femenino" ? ((usuario.gestante as UsuarioEditFormState["gestante"]) ?? "") : "No aplica",
        discapacidad: (usuario.discapacidad as UsuarioEditFormState["discapacidad"]) ?? "",
        centro_id: usuario.centro_id ?? ""
    };
}

function isGenero(v: string): v is (typeof GENEROS_USUARIO)[number] {
    return (GENEROS_USUARIO as readonly string[]).includes(v);
}
function isGestante(v: string): v is (typeof GESTANTE_USUARIO)[number] {
    return (GESTANTE_USUARIO as readonly string[]).includes(v);
}
function isDiscapacidad(v: string): v is (typeof DISCAPACIDAD_USUARIO)[number] {
    return (DISCAPACIDAD_USUARIO as readonly string[]).includes(v);
}

export function useUsuarioEdit(onActualizado?: () => void) {
    const [form, setForm] = useState<UsuarioEditFormState>(emptyForm);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    async function abrir(rut: string) {
        try {
            const { usuario } = await getUsuarioParaEdicion(rut);
            if (!usuario) {
                toast.error("No se encontró el paciente");
                return;
            }
            setForm(toForm(usuario));
            setOpen(true);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al cargar el paciente");
        }
    }

    function cerrar() {
        setOpen(false);
    }

    function onChange(field: keyof UsuarioEditFormState, value: string) {
        setForm((current) => ({
            ...current,
            [field]: value,
            ...(field === "genero" && value !== "Femenino" ? { gestante: "No aplica" } : {})
        }));
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            if (!isGenero(form.genero) || !isGestante(form.gestante) || !isDiscapacidad(form.discapacidad)) {
                toast.error("Selecciona genero, gestante y discapacidad");
                return;
            }
            await actualizarUsuarioComunicador({
                ...form,
                genero: form.genero,
                gestante: form.genero === "Femenino" ? form.gestante : "No aplica",
                discapacidad: form.discapacidad
            });
            toast.success("Paciente actualizado");
            setOpen(false);
            onActualizado?.();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al guardar el paciente");
        } finally {
            setSaving(false);
        }
    }

    return { form, open, saving, abrir, cerrar, onChange, onSubmit };
}
