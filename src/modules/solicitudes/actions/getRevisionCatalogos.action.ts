"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { CentroTipoSolicitudColumna, getColumnaTipoSolicitudPorCentro } from "@/modules/catalogos/utils/centroTipoSolicitud";

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

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    if (!funcionario?.centro_id) throw new Error("El funcionario activo no tiene centro asignado");
    return funcionario.centro_id;
}

function buildCentroWhere(centroColumna: CentroTipoSolicitudColumna | null) {
    return centroColumna ? { [centroColumna]: "1" } : {};
}

export async function getRevisionCatalogos() {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    const nombreCentro = await getNombreCentro(centroId);
    const centroColumna = getColumnaTipoSolicitudPorCentro(nombreCentro);

    const [tiposSolicitud, motivos, profesionales, prestaciones] = await Promise.all([
        prisma.tipoSolicitud.findMany({
            where: { estado: "1" },
            select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true },
            orderBy: { nombre_tipo_solicitud: "asc" }
        }),
        prisma.motivo.findMany({
            where: { estado: "1" },
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
        })
    ]);

    return { tiposSolicitud, motivos, profesionales, prestaciones };
}
