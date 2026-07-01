"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";

export interface CentroOption {
    id_centro: string;
    nombre_centro: string | null;
}

export async function getCentros(): Promise<CentroOption[]> {
    await requireSessionUser();
    return prisma.$queryRaw<CentroOption[]>`
        SELECT id_centro, nombre_centro
        FROM centros
        ORDER BY nombre_centro
    `;
}
