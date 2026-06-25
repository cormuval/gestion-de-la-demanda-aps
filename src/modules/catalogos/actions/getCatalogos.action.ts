"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
// types
import { Catalogos } from "../types/catalogos";

export async function getCatalogos(): Promise<Catalogos> {
    await requireSessionUser();
    const [tiposSolicitud, motivos] = await Promise.all([
        prisma.tipoSolicitud.findMany({ where: { estado: "Activo" }, orderBy: { nombre_tipo_solicitud: "asc" } }),
        prisma.motivo.findMany({ where: { estado: "Activo" }, orderBy: { nombre_motivo: "asc" } })
    ]);
    return { tiposSolicitud, motivos };
}
