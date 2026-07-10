"use server";

import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
// utils
import { normalizarRut } from "@/modules/solicitudes/utils/rut";
// types
import { ESTADOS_PENDIENTES } from "../types/comunicador";

export interface CitaPacienteFila {
    id_cita: string;
    estado_cita: string | null;
    priorizacion: number | null;
    profesion: string | null;
    prestacion: string | null;
    fecha_estimada_atencion: Date | null;
    intentos: number;
}

export async function getCitasPendientesPaciente(rutUsuario: string, citaActualId: string): Promise<CitaPacienteFila[]> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");
    if (!user.centro_id) throw new Error("El funcionario no tiene centro asignado");

    const citas = await prisma.cita.findMany({
        where: {
            rut_usuario: normalizarRut(rutUsuario),
            centro_id: user.centro_id,
            id_cita: { not: citaActualId },
            estado_cita: { in: [...ESTADOS_PENDIENTES] }
        },
        include: { profesional: true, prestacion: true },
        orderBy: { priorizacion: "desc" }
    });

    const filas: CitaPacienteFila[] = [];
    for (const c of citas) {
        const intentos = await prisma.llamada.count({ where: { cita_id: c.id_cita, respuesta_usuario: "No contesta" } });
        filas.push({
            id_cita: c.id_cita,
            estado_cita: c.estado_cita,
            priorizacion: c.priorizacion,
            profesion: c.profesional?.nombre ?? null,
            prestacion: c.prestacion?.nombre_prestacion ?? null,
            fecha_estimada_atencion: c.fecha_estimada_atencion,
            intentos
        });
    }
    return filas;
}
