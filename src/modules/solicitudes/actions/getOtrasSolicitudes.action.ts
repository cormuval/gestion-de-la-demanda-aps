"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
// types
import { ESTADOS_PENDIENTES } from "@/modules/comunicador/types/comunicador";
// utils
import { esCitaEditable } from "../utils/citas";
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
    const user = await requirePermiso("solicitudes.gestionar");

    const rut = normalizarRut(rutUsuario);
    if (!rut) throw new Error("rutUsuario es requerido");

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
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
            where: { rut_usuario: rut, centro_id: centroId, estado_cita: { in: [...ESTADOS_PENDIENTES] } },
            include: { profesional: true, prestacion: true, _count: { select: { llamadas: true } } },
            orderBy: [{ fecha_estimada_atencion: "asc" }, { fecha_creacion: "asc" }]
        })
    ]);

    const citas = citasRaw.map(({ _count, ...cita }) => ({
        ...cita,
        editable: esCitaEditable({ estado_cita: cita.estado_cita, cantidadLlamadas: _count.llamadas })
    }));

    return { solicitudes, citas };
}
