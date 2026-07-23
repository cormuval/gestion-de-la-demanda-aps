"use server";

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { esEstadoActivo } from "@/shared/lib/access";

// Entradas de uso interno/administrativo que no son profesionales clínicos reales;
// se excluyen de los selectores del comunicador (y sus prestaciones exclusivas).
const PROFESIONALES_OCULTOS = ["Rechazar Solicitud", "ER", "Examenes"];

export async function getFiltrosComunicador(): Promise<{
    profesionales: { id: number; nombre: string }[];
    prestaciones: { id: number; nombre: string; profesional_id: number }[];
}> {
    const user = await requirePermiso("comunicador.ver");

    const [profesionales, prestaciones] = await Promise.all([
        prisma.profesional.findMany({ orderBy: { nombre: "asc" }, select: { id_profesional: true, nombre: true, estado: true } }),
        prisma.prestacion.findMany({ orderBy: { nombre_prestacion: "asc" }, select: { id_prestacion: true, nombre_prestacion: true, profesional_id: true, estado: true } })
    ]);

    const profesionalesVisibles = profesionales.filter((p) => esEstadoActivo(p.estado) && !PROFESIONALES_OCULTOS.includes(p.nombre));
    const idsVisibles = new Set(profesionalesVisibles.map((p) => p.id_profesional));

    return {
        profesionales: profesionalesVisibles.map((p) => ({ id: p.id_profesional, nombre: p.nombre })),
        prestaciones: prestaciones
            .filter((p) => esEstadoActivo(p.estado) && idsVisibles.has(p.profesional_id))
            .map((p) => ({ id: p.id_prestacion, nombre: p.nombre_prestacion, profesional_id: p.profesional_id }))
    };
}
