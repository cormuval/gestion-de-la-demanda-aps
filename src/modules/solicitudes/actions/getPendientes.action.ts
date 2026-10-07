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

const SOLICITUD_PENDIENTE_INCLUDE = { tipoSolicitud: true, motivo: true } satisfies Prisma.SolicitudInclude;
const CITA_PENDIENTE_INCLUDE = {
    solicitud: { include: SOLICITUD_PENDIENTE_INCLUDE },
    profesional: true,
    prestacion: true
} satisfies Prisma.CitaInclude;

type PendientesPaciente = {
    solicitudesPendientes: Prisma.SolicitudGetPayload<{ include: typeof SOLICITUD_PENDIENTE_INCLUDE }>[];
    citasPendientes: Prisma.CitaGetPayload<{ include: typeof CITA_PENDIENTE_INCLUDE }>[];
};

export async function getPendientes(rutUsuario: string): Promise<ResultadoAccion<PendientesPaciente>> {
    const user = await requirePermiso("solicitudes.ver");

    const rut = normalizarRut(rutUsuario);
    if (!rut) return { ok: false, error: "rutUsuario es requerido" };

    const [solicitudesPendientes, citasPendientes] = await Promise.all([
        prisma.solicitud.findMany({
            where: { rut_usuario: rut, estado_solicitud: "En Curso" },
            include: SOLICITUD_PENDIENTE_INCLUDE,
            orderBy: { fecha_inicio: "desc" }
        }),
        prisma.cita.findMany({
            where: { rut_usuario: rut, estado_cita: { in: [...ESTADOS_PENDIENTES] } },
            include: CITA_PENDIENTE_INCLUDE,
            orderBy: [{ priorizacion: "desc" }, { fecha_creacion: "desc" }]
        })
    ]);

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `PENDIENTES_${rut}`, {
        details: `Consulta de pendientes para RUT ${rut}`
    });

    return { ok: true, data: { solicitudesPendientes, citasPendientes } };
}
