"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
import { esEstadoActivo } from "@/shared/lib/access";

export async function getFiltrosComunicador(): Promise<{
    profesionales: { id: number; nombre: string }[];
    prestaciones: { id: number; nombre: string; profesional_id: number }[];
}> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");

    const [profesionales, prestaciones] = await Promise.all([
        prisma.profesional.findMany({ orderBy: { nombre: "asc" }, select: { id_profesional: true, nombre: true, estado: true } }),
        prisma.prestacion.findMany({ orderBy: { nombre_prestacion: "asc" }, select: { id_prestacion: true, nombre_prestacion: true, profesional_id: true, estado: true } })
    ]);

    return {
        profesionales: profesionales
            .filter((p) => esEstadoActivo(p.estado))
            .map((p) => ({ id: p.id_profesional, nombre: p.nombre })),
        prestaciones: prestaciones
            .filter((p) => esEstadoActivo(p.estado))
            .map((p) => ({ id: p.id_prestacion, nombre: p.nombre_prestacion, profesional_id: p.profesional_id }))
    };
}
