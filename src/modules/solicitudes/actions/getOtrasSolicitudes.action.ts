"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
// schemas
import { ACCION_ESPERA_VALIDACION } from "../schemas/revision.schema";
// utils
import { normalizarRut } from "../utils/rut";

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    if (!funcionario?.centro_id) throw new Error("El funcionario activo no tiene centro asignado");
    return funcionario.centro_id;
}

export async function getOtrasSolicitudes(rutUsuario: string, solicitudActualId: string) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    const solicitudes = await prisma.solicitud.findMany({
        where: {
            rut_usuario: normalizarRut(rutUsuario),
            id_solicitud: { not: solicitudActualId },
            accion: ACCION_ESPERA_VALIDACION,
            estado_solicitud: "En Curso",
            centro_id: centroId
        },
        include: { usuario: true, tipoSolicitud: true, motivo: true, orientador: true, gestor: true },
        orderBy: [{ priorizacion_admin: "desc" }, { fecha_inicio: "asc" }]
    });

    return { solicitudes };
}
