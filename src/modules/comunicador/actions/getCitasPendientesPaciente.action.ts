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
    atrasada: boolean;
    intentos: number;
}

export async function getCitasPendientesPaciente(rutUsuario: string, citaActualId: string): Promise<ResultadoAccion<CitaPacienteFila[]>> {
    const user = await requirePermiso("comunicador.ver");
    if (!user.centro_id) {
        return { ok: false, error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion." };
    }

    // Sin filtro de temporalidad: al llamar se debe ver todo lo pendiente del paciente,
    // incluidas las citas atrasadas, para resolverlo en un solo llamado.
    const limiteAtrasada = rangoTemporalidad(TEMPORALIDAD.ATRASADOS, new Date())?.lt;

    const citas = await prisma.cita.findMany({
        where: {
            rut_usuario: normalizarRut(rutUsuario),
            centro_id: user.centro_id,
            id_cita: { not: citaActualId },
            estado_cita: { in: [...ESTADOS_PENDIENTES] }
        },
        include: {
            profesional: true,
            prestacion: true,
            _count: { select: { llamadas: { where: { respuesta_usuario: "No contesta" } } } }
        },
        orderBy: [{ priorizacion: "desc" }, { fecha_estimada_atencion: "asc" }]
    });

    const filas: CitaPacienteFila[] = citas.map((c) => ({
        id_cita: c.id_cita,
        estado_cita: c.estado_cita,
        priorizacion: c.priorizacion,
        profesion: c.profesional?.nombre ?? null,
        prestacion: c.prestacion?.nombre_prestacion ?? null,
        fecha_estimada_atencion: c.fecha_estimada_atencion,
        atrasada: !!(c.fecha_estimada_atencion && limiteAtrasada && c.fecha_estimada_atencion < limiteAtrasada),
        intentos: c._count.llamadas
    }));
    return { ok: true, data: filas };
}
