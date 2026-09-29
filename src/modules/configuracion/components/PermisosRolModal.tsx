"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
// actions
import { guardarPermisosRol } from "@/modules/configuracion/actions/mantenedores.action";
// config
import { agruparPermisos, esPermiso, type Permiso } from "@/config/permisos";
// components
import { Button } from "@/shared/components/ui/button";

export interface RolConPermisos {
    id_rol: number;
    nombre_rol: string;
    permisos: { permiso: string }[];
}

const GRUPOS = agruparPermisos();

export function PermisosRolModal({
    rol,
    permisosActor,
    esRolPropio,
    onClose,
    onSaved
}: {
    rol: RolConPermisos;
    permisosActor: Permiso[];
    esRolPropio: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [seleccion, setSeleccion] = useState<Permiso[]>(() => rol.permisos.map((fila) => fila.permiso).filter(esPermiso));
    const [saving, setSaving] = useState(false);
    const permisosActorSet = new Set(permisosActor);

    const alternar = (permiso: Permiso, activo: boolean) => {
        setSeleccion((actual) => (activo ? [...actual, permiso] : actual.filter((clave) => clave !== permiso)));
    };

    function checkboxDisabled(permiso: Permiso): boolean {
        return !permisosActorSet.has(permiso) || (esRolPropio && permiso === "config.roles");
    }

    function checkboxTitle(permiso: Permiso): string | undefined {
        if (esRolPropio && permiso === "config.roles") return "No puedes quitar el permiso de editar roles a tu propio rol";
        if (!permisosActorSet.has(permiso)) return "Tu rol no tiene este permiso";
        return undefined;
    }

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        try {
            const result = await guardarPermisosRol({ rol_id: rol.id_rol, permisos: seleccion });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            toast.success("Permisos actualizados");
            onSaved();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error al guardar permisos");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border bg-background shadow-lg">
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold">Permisos de {rol.nombre_rol}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Marca las acciones que este rol puede realizar.</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </Button>
                </div>
                <form className="grid gap-5 p-5" onSubmit={submit}>
                    {GRUPOS.map((grupo) => (
                        <div key={grupo.modulo} className="space-y-2">
                            <p className="text-sm font-semibold">{grupo.modulo}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {grupo.permisos.map((permiso) => (
                                    <label key={permiso.clave} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={seleccion.includes(permiso.clave)}
                                            onChange={(event) => alternar(permiso.clave, event.target.checked)}
                                            disabled={checkboxDisabled(permiso.clave)}
                                            title={checkboxTitle(permiso.clave)}
                                            className="h-4 w-4 rounded border-input"
                                        />
                                        <span>{permiso.etiqueta}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
