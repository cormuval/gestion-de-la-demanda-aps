"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
// components
import { Select } from "@/shared/components/ui/select";
// actions
import { cambiarCentroActivo } from "@/modules/configuracion/actions/cambiarCentroActivo.action";

export interface CentroOpcion {
    id_centro: string;
    nombre_centro: string | null;
}

interface SelectorCentroActivoProps {
    centroId: string | null;
    centros: CentroOpcion[];
}

export function SelectorCentroActivo({ centroId, centros }: SelectorCentroActivoProps) {
    const router = useRouter();
    const [valor, setValor] = useState(centroId ?? "");
    const [pendiente, setPendiente] = useState(false);
    const [centroIdPrevio, setCentroIdPrevio] = useState(centroId);

    // El centro_id de la sesion puede cambiar por fuera de este componente (otra pestana,
    // otro administrador, el propio router.refresh()). Mientras no haya un cambio en curso,
    // sincronizamos el valor local con la verdad del servidor.
    if (!pendiente && centroId !== centroIdPrevio) {
        setCentroIdPrevio(centroId);
        setValor(centroId ?? "");
    }

    async function onChange(event: ChangeEvent<HTMLSelectElement>) {
        const anterior = valor;
        const nuevo = event.target.value;
        setValor(nuevo);
        setPendiente(true);

        try {
            const resultado = await cambiarCentroActivo(nuevo);
            if (!resultado.ok) {
                setValor(anterior);
                toast.error(resultado.error);
                return;
            }
            toast.success(`Centro cambiado a ${resultado.data.centro_nombre || resultado.data.centro_id}`);
            router.refresh();
        } catch {
            setValor(anterior);
            toast.error("No fue posible cambiar el centro");
        } finally {
            setPendiente(false);
        }
    }

    return (
        <Select aria-label="Centro activo" className="h-8 text-xs" value={valor} disabled={pendiente} onChange={onChange}>
            {centroId === null && <option value="">Sin centro</option>}
            {centros.map((centro) => (
                <option key={centro.id_centro} value={centro.id_centro}>
                    {centro.nombre_centro || centro.id_centro}
                </option>
            ))}
        </Select>
    );
}
