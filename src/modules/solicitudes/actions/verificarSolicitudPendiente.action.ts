"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
import type { EstadoPendiente } from "@/shared/types/estadoPendiente";
// schemas
import { ACCION_ESPERA_VALIDACION } from "../schemas/revision.schema";

const ERROR_CENTRO = "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion.";

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string | null> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    return funcionario?.centro_id ?? null;
}

export async function verificarSolicitudPendiente(idSolicitud: string): Promise<ResultadoAccion<EstadoPendiente>> {
    const user = await requirePermiso("solicitudes.gestionar");

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    if (!centroId) return { ok: false, error: ERROR_CENTRO } satisfies ResultadoAccion<never>;

    const solicitud = await prisma.solicitud.findFirst({
        where: { id_solicitud: idSolicitud, centro_id: centroId },
        select: { estado_solicitud: true, accion: true }
    });

    if (!solicitud) return { ok: true, data: { pendiente: false, estado: null } };

    const pendiente = solicitud.estado_solicitud === "En Curso" && solicitud.accion === ACCION_ESPERA_VALIDACION;

    return { ok: true, data: { pendiente, estado: solicitud.estado_solicitud } };
}
