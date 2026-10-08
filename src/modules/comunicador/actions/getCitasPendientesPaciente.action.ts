"use server";

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import type { ResultadoAccion } from "@/shared/types/resultado";
// utils
import { normalizarRut } from "@/modules/solicitudes/utils/rut";
import { rangoTemporalidad } from "../utils/temporalidad";
// types
import { ESTADOS_PENDIENTES, TEMPORALIDAD } from "../types/comunicador";

export interface CitaPacienteFila {
    id_cita: string;
    estado_cita: string | null;
    priorizacion: number | null;
    profesion: string | null;
    prestacion: string | null;
    fecha_estimada_atencion: Date | null;
    intentos: number;
}

export async function getCitasPendientesPaciente(rutUsuario: string, citaActualId: string): Promise<ResultadoAccion<CitaPacienteFila[]>> {
    const user = await requirePermiso("comunicador.ver");
    if (!user.centro_id) {
        return { ok: false, error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion." };
    }

    const rango = rangoTemporalidad(TEMPORALIDAD.PROXIMOS, new Date());

    const citas = await prisma.cita.findMany({
        where: {
            rut_usuario: normalizarRut(rutUsuario),
            centro_id: user.centro_id,
            id_cita: { not: citaActualId },
            estado_cita: { in: [...ESTADOS_PENDIENTES] },
            fecha_estimada_atencion: { gte: rango?.gte, lte: rango?.lte }
        },
        include: { profesional: true, prestacion: true },
        orderBy: { priorizacion: "desc" }
    });

    const filas: CitaPacienteFila[] = [];
    for (const c of citas) {
        const intentos = await prisma.llamada.count({ where: { cita_id: c.id_cita, respuesta_usuario: "No contesta" } });
        filas.push({
            id_cita: c.id_cita,
            estado_cita: c.estado_cita,
            priorizacion: c.priorizacion,
            profesion: c.profesional?.nombre ?? null,
            prestacion: c.prestacion?.nombre_prestacion ?? null,
            fecha_estimada_atencion: c.fecha_estimada_atencion,
            intentos
        });
    }
    return { ok: true, data: filas };
}
