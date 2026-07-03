"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// types
import { SolicitudFiltros } from "../schemas/solicitud.schema";
import { ACCION_ESPERA_VALIDACION } from "../schemas/revision.schema";
// utils
import { normalizarRut } from "../utils/rut";

const PAGE_SIZE = 100;

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    if (!funcionario?.centro_id) throw new Error("El funcionario activo no tiene centro asignado");
    return funcionario.centro_id;
}

function buildWhere(filtros: SolicitudFiltros, centroId: string): Prisma.SolicitudWhereInput {
    const where: Prisma.SolicitudWhereInput = {
        accion: ACCION_ESPERA_VALIDACION,
        estado_solicitud: "En Curso",
        centro_id: centroId
    };
    if (filtros.rut) where.rut_usuario = normalizarRut(filtros.rut);
    if (filtros.tipoSolicitudId) where.tipo_solicitud_id = Number(filtros.tipoSolicitudId);
    if (filtros.motivoId) where.motivo_id = Number(filtros.motivoId);
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

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    const page = Math.max(1, Number(filtros.page ?? 1));
    const where = buildWhere(filtros, centroId);

    const [solicitudes, total] = await Promise.all([
        prisma.solicitud.findMany({
            where,
            include: { usuario: true, tipoSolicitud: true, motivo: true, orientador: true, gestor: true },
            orderBy: [{ priorizacion_admin: "desc" }, { fecha_inicio: "asc" }],
            take: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE
        }),
        prisma.solicitud.count({ where })
    ]);

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "LISTADO_SOLICITUDES", {
        details: `Filtros: ${JSON.stringify(filtros)}`
    });

    return { solicitudes, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
