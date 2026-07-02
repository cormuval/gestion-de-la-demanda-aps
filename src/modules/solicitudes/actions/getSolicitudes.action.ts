"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// types
import { SolicitudFiltros } from "../schemas/solicitud.schema";
// utils
import { normalizarRut } from "../utils/rut";

function buildWhere(filtros: SolicitudFiltros): Prisma.SolicitudWhereInput {
    const where: Prisma.SolicitudWhereInput = {};
    if (filtros.rut) where.rut_usuario = normalizarRut(filtros.rut);
    if (filtros.estado) where.estado_solicitud = filtros.estado;
    if (filtros.centroId) where.centro_id = filtros.centroId;
    if (filtros.fechaDesde || filtros.fechaHasta) {
        where.fecha_inicio = {};
        if (filtros.fechaDesde) where.fecha_inicio.gte = new Date(`${filtros.fechaDesde}T00:00:00`);
        if (filtros.fechaHasta) where.fecha_inicio.lte = new Date(`${filtros.fechaHasta}T23:59:59`);
    }
    return where;
}

export async function getSolicitudes(filtros: SolicitudFiltros = {}) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const solicitudes = await prisma.solicitud.findMany({
        where: buildWhere(filtros),
        include: { usuario: true, tipoSolicitud: true, motivo: true, orientador: true, gestor: true },
        orderBy: { fecha_inicio: "desc" },
        take: 100
    });

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "LISTADO_SOLICITUDES", {
        details: `Filtros: ${JSON.stringify(filtros)}`
    });

    return { solicitudes };
}
