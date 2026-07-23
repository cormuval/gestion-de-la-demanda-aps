"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";

export interface CentroOption {
    id_centro: string;
    nombre_centro: string | null;
}

export async function getCentros(): Promise<CentroOption[]> {
    await requirePermiso("solicitudes.ver", "comunicador.ver");
    return prisma.$queryRaw<CentroOption[]>`
        SELECT id_centro, nombre_centro
        FROM centros
        ORDER BY nombre_centro
    `;
}
