"use server";

import { Prisma } from "@prisma/client";
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
    if (filtros.sector) where.usuario = { sector: { contains: filtros.sector } };
    if (filtros.edadDesde || filtros.edadHasta) {
        where.ultimo_control = { not: null };
        if (filtros.edadDesde) where.ultimo_control.gte = filtros.edadDesde;
        if (filtros.edadHasta) where.ultimo_control.lte = filtros.edadHasta;
    }
    if (filtros.fechaDesde || filtros.fechaHasta) {
        where.fecha_inicio = {};
        if (filtros.fechaDesde) where.fecha_inicio.gte = new Date(`${filtros.fechaDesde}T00:00:00`);
        if (filtros.fechaHasta) where.fecha_inicio.lte = new Date(`${filtros.fechaHasta}T23:59:59`);
    }
    return where;
}

function hasEdadFilter(filtros: SolicitudFiltros): boolean {
    return Boolean(filtros.edadDesde || filtros.edadHasta);
}

function buildRawWhere(filtros: SolicitudFiltros, centroId: string) {
    const clauses: Prisma.Sql[] = [
        Prisma.sql`s.accion = ${ACCION_ESPERA_VALIDACION}`,
        Prisma.sql`s.estado_solicitud = ${"En Curso"}`,
        Prisma.sql`s.centro_id = ${centroId}`
    ];

    if (filtros.rut) clauses.push(Prisma.sql`s.rut_usuario = ${normalizarRut(filtros.rut)}`);
    if (filtros.tipoSolicitudId) clauses.push(Prisma.sql`s.tipo_solicitud_id = ${Number(filtros.tipoSolicitudId)}`);
    if (filtros.motivoId) clauses.push(Prisma.sql`s.motivo_id = ${Number(filtros.motivoId)}`);
    if (filtros.sector) clauses.push(Prisma.sql`u.sector LIKE ${`%${filtros.sector}%`}`);
    if (filtros.fechaDesde) clauses.push(Prisma.sql`s.fecha_inicio >= ${new Date(`${filtros.fechaDesde}T00:00:00`)}`);
    if (filtros.fechaHasta) clauses.push(Prisma.sql`s.fecha_inicio <= ${new Date(`${filtros.fechaHasta}T23:59:59`)}`);
    if (filtros.edadDesde || filtros.edadHasta) clauses.push(Prisma.sql`s.ultimo_control IS NOT NULL`);
    if (filtros.edadDesde) clauses.push(Prisma.sql`CAST(s.ultimo_control AS UNSIGNED) >= ${Number(filtros.edadDesde)}`);
    if (filtros.edadHasta) clauses.push(Prisma.sql`CAST(s.ultimo_control AS UNSIGNED) <= ${Number(filtros.edadHasta)}`);

    return Prisma.join(clauses, " AND ");
}

export async function getSolicitudes(filtros: SolicitudFiltros = {}) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    const page = Math.max(1, Number(filtros.page ?? 1));
    const where = buildWhere(filtros, centroId);

    if (hasEdadFilter(filtros)) {
        const rawWhere = buildRawWhere(filtros, centroId);
        const offset = (page - 1) * PAGE_SIZE;
        const [ids, countRows] = await Promise.all([
            prisma.$queryRaw<{ id_solicitud: string }[]>`
                SELECT s.id_solicitud
                FROM solicitudes s
                INNER JOIN usuarios u ON u.rut = s.rut_usuario
                WHERE ${rawWhere}
                ORDER BY s.priorizacion_admin DESC, s.fecha_inicio ASC
                LIMIT ${PAGE_SIZE} OFFSET ${offset}
            `,
            prisma.$queryRaw<{ total: bigint }[]>`
                SELECT COUNT(*) AS total
                FROM solicitudes s
                INNER JOIN usuarios u ON u.rut = s.rut_usuario
                WHERE ${rawWhere}
            `
        ]);
        const idOrder = ids.map((item) => item.id_solicitud);
        const solicitudesSinOrden = idOrder.length
            ? await prisma.solicitud.findMany({
                  where: { id_solicitud: { in: idOrder } },
                  include: { usuario: true, tipoSolicitud: true, motivo: true, orientador: true, gestor: true }
              })
            : [];
        const solicitudes = idOrder
            .map((id) => solicitudesSinOrden.find((solicitud) => solicitud.id_solicitud === id))
            .filter((solicitud): solicitud is NonNullable<typeof solicitud> => Boolean(solicitud));
        const total = Number(countRows[0]?.total ?? 0);

        await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "LISTADO_SOLICITUDES", {
            details: `Filtros: ${JSON.stringify(filtros)}`
        });

        return { solicitudes, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
    }

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
