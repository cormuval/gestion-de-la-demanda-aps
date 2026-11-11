"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
// types
import { ESTADOS_PENDIENTES } from "@/modules/comunicador/types/comunicador";
import type { ResultadoAccion } from "@/shared/types/resultado";
// utils
import { esCitaEditable } from "../utils/citas";
import { normalizarRut } from "../utils/rut";

const ERROR_CENTRO = "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion.";

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string | null> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    return funcionario?.centro_id ?? null;
}

export async function getOtrasSolicitudes(rutUsuario: string, solicitudActualId: string) {
    const user = await requirePermiso("solicitudes.gestionar");

    const rut = normalizarRut(rutUsuario);
    if (!rut) return { ok: false, error: "rutUsuario es requerido" } satisfies ResultadoAccion<never>;

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    if (!centroId) return { ok: false, error: ERROR_CENTRO } satisfies ResultadoAccion<never>;
    const [solicitudes, citasRaw] = await Promise.all([
        prisma.solicitud.findMany({
            where: {
                rut_usuario: rut,
                id_solicitud: { not: solicitudActualId },
                estado_solicitud: "En Curso",
                centro_id: centroId
            },
            include: { usuario: true, tipoSolicitud: true, motivo: true, orientador: true, gestor: true },
            orderBy: [{ priorizacion_admin: "desc" }, { fecha_inicio: "asc" }]
        }),
        prisma.cita.findMany({
            where: {
                rut_usuario: rut,
                centro_id: centroId,
                estado_cita: { in: [...ESTADOS_PENDIENTES] },
                solicitud: {
                    is: {
                        id_solicitud: { not: solicitudActualId },
                        estado_solicitud: "En Curso",
                        centro_id: centroId
                    }
                }
            },
            include: { profesional: true, prestacion: true, _count: { select: { llamadas: true } } },
            orderBy: [{ fecha_estimada_atencion: "asc" }, { fecha_creacion: "asc" }]
        })
    ]);

    const citas = citasRaw.map(({ _count, ...cita }) => ({
        ...cita,
        editable: esCitaEditable({ estado_cita: cita.estado_cita, cantidadLlamadas: _count.llamadas }),
        puedeRegistrarRechazo: true
    }));

    const payload = { solicitudes, citas };
    return { ok: true, data: payload } satisfies ResultadoAccion<typeof payload>;
}
