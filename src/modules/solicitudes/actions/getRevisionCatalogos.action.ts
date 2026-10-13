"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { CentroTipoSolicitudColumna, getColumnaTipoSolicitudPorCentro } from "@/modules/catalogos/utils/centroTipoSolicitud";
import type { ResultadoAccion } from "@/shared/types/resultado";

const ERROR_CENTRO = "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion.";

async function getNombreCentro(centroId: string | null): Promise<string | null> {
    if (!centroId) return null;
    const centros = await prisma.$queryRaw<{ nombre_centro: string | null }[]>`
        SELECT nombre_centro
        FROM centros
        WHERE id_centro = ${centroId}
        LIMIT 1
    `;
    return centros[0]?.nombre_centro ?? null;
}

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string | null> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    return funcionario?.centro_id ?? null;
}

function buildCentroWhere(centroColumna: CentroTipoSolicitudColumna | null) {
    return centroColumna ? { [centroColumna]: "1" } : {};
}

export async function getRevisionCatalogos() {
    const user = await requirePermiso("solicitudes.gestionar");

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    if (!centroId) return { ok: false, error: ERROR_CENTRO } satisfies ResultadoAccion<never>;
    const nombreCentro = await getNombreCentro(centroId);
    const centroColumna = getColumnaTipoSolicitudPorCentro(nombreCentro);

    const [tiposSolicitud, motivos, profesionales, prestaciones, centros] = await Promise.all([
        // Tipos y motivos solo alimentan los filtros de la bandeja: van todos, tambien los inactivos
        // (Atencion Sapu, Contrarreferencia), porque hay solicitudes de esos tipos que no se ingresan a mano.
        prisma.tipoSolicitud.findMany({
            select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true },
            orderBy: { nombre_tipo_solicitud: "asc" }
        }),
        prisma.motivo.findMany({
            select: { id_motivo: true, tipo_solicitud_id: true, nombre_motivo: true },
            orderBy: { nombre_motivo: "asc" }
        }),
        prisma.profesional.findMany({
            where: { estado: { in: ["Activo", "1"] }, ...buildCentroWhere(centroColumna) },
            select: { id_profesional: true, nombre: true },
            orderBy: { nombre: "asc" }
        }),
        prisma.prestacion.findMany({
            where: { estado: { in: ["Activo", "1"] }, profesional: { estado: { in: ["Activo", "1"] }, ...buildCentroWhere(centroColumna) } },
            select: { id_prestacion: true, profesional_id: true, nombre_prestacion: true },
            orderBy: { nombre_prestacion: "asc" }
        }),
        prisma.$queryRaw<{ id_centro: string; nombre_centro: string | null }[]>`
            SELECT id_centro, nombre_centro
            FROM centros
            ORDER BY nombre_centro
        `
    ]);

    const payload = { tiposSolicitud, motivos, profesionales, prestaciones, centros };
    return { ok: true, data: payload } satisfies ResultadoAccion<typeof payload>;
}
