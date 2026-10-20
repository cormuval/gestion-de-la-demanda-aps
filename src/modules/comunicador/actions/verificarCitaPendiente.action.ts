"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
import type { EstadoPendiente } from "@/shared/types/estadoPendiente";
import { esEstadoPendiente } from "../types/comunicador";

export async function verificarCitaPendiente(idCita: string): Promise<ResultadoAccion<EstadoPendiente>> {
    const user = await requirePermiso("comunicador.llamar");
    if (!user.centro_id) {
        return { ok: false, error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion." };
    }

    const cita = await prisma.cita.findFirst({
        where: { id_cita: idCita, centro_id: user.centro_id },
        select: { estado_cita: true }
    });

    if (!cita) return { ok: true, data: { pendiente: false, estado: null } };

    const pendiente = esEstadoPendiente(cita.estado_cita) || cita.estado_cita === null;

    return { ok: true, data: { pendiente, estado: cita.estado_cita } };
}
