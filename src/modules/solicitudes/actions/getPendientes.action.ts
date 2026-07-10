"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// utils
import { normalizarRut } from "../utils/rut";
// types
import { ESTADOS_PENDIENTES } from "@/modules/comunicador/types/comunicador";

export async function getPendientes(rutUsuario: string) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const rut = normalizarRut(rutUsuario);
    if (!rut) throw new Error("rutUsuario es requerido");

    const [solicitudesPendientes, citasPendientes] = await Promise.all([
        prisma.solicitud.findMany({
            where: { rut_usuario: rut, estado_solicitud: "En Curso" },
            include: { tipoSolicitud: true, motivo: true },
            orderBy: { fecha_inicio: "desc" }
        }),
        prisma.cita.findMany({
            where: { rut_usuario: rut, estado_cita: { in: [...ESTADOS_PENDIENTES] } },
            include: { solicitud: { include: { tipoSolicitud: true, motivo: true } }, profesional: true, prestacion: true },
            orderBy: [{ priorizacion: "desc" }, { fecha_creacion: "desc" }]
        })
    ]);

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `PENDIENTES_${rut}`, {
        details: `Consulta de pendientes para RUT ${rut}`
    });

    return { solicitudesPendientes, citasPendientes };
}
