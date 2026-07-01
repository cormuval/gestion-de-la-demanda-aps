"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
// utils
import { CentroTipoSolicitudColumna, getColumnaTipoSolicitudPorCentro } from "../utils/centroTipoSolicitud";
// types
import { Catalogos } from "../types/catalogos";

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

function buildTipoSolicitudWhere(centroColumna: CentroTipoSolicitudColumna | null) {
    return {
        estado: "1",
        ...(centroColumna ? { [centroColumna]: "1" } : {})
    };
}

export async function getCatalogos(): Promise<Catalogos> {
    const user = await requireSessionUser();
    const nombreCentro = await getNombreCentro(user.centro_id);
    const centroColumna = getColumnaTipoSolicitudPorCentro(nombreCentro);

    const [tiposSolicitud, motivos] = await Promise.all([
        prisma.tipoSolicitud.findMany({
            where: buildTipoSolicitudWhere(centroColumna),
            select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true },
            orderBy: { nombre_tipo_solicitud: "asc" }
        }),
        prisma.motivo.findMany({
            where: { estado: "1" },
            select: { id_motivo: true, tipo_solicitud_id: true, nombre_motivo: true },
            orderBy: { nombre_motivo: "asc" }
        })
    ]);
    return { tiposSolicitud, motivos };
}
