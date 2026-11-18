"use server";

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
// types
import type { Prisma } from "@prisma/client";
import type { ResultadoAccion } from "@/shared/types/resultado";
// utils
import { normalizarRut } from "../utils/rut";
// types
import { ESTADOS_PENDIENTES } from "@/modules/comunicador/types/comunicador";

import { CITA_CASCADA_SELECT, SOLICITUD_CASCADA_SELECT } from "../utils/selectCascada";

interface PendientesPaciente {
    solicitudesPendientes: Prisma.SolicitudGetPayload<{ select: typeof SOLICITUD_CASCADA_SELECT }>[];
    citasPendientes: Prisma.CitaGetPayload<{ select: typeof CITA_CASCADA_SELECT }>[];
}

export async function getPendientes(rutUsuario: string): Promise<ResultadoAccion<PendientesPaciente>> {
    const user = await requirePermiso("solicitudes.ver");

    const rut = normalizarRut(rutUsuario);
    if (!rut) return { ok: false, error: "rutUsuario es requerido" };

    const [solicitudesPendientes, citasPendientes] = await Promise.all([
        prisma.solicitud.findMany({
            where: { rut_usuario: rut, estado_solicitud: "En Curso" },
            select: SOLICITUD_CASCADA_SELECT,
            orderBy: { fecha_inicio: "desc" }
        }),
        prisma.cita.findMany({
            where: { rut_usuario: rut, estado_cita: { in: [...ESTADOS_PENDIENTES] } },
            select: CITA_CASCADA_SELECT,
            orderBy: [{ priorizacion: "desc" }, { fecha_creacion: "desc" }]
        })
    ]);

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `PENDIENTES_${rut}`, {
        details: `Consulta de pendientes para RUT ${rut}`
    });

    return { ok: true, data: { solicitudesPendientes, citasPendientes } };
}
