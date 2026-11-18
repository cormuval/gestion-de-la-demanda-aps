"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
// types
import { esEstadoPendiente } from "@/modules/comunicador/types/comunicador";
import type { ResultadoAccion } from "@/shared/types/resultado";
// utils
import { esCitaEditable } from "../utils/citas";
import { normalizarRut } from "../utils/rut";
import { SOLICITUD_CASCADA_SELECT } from "../utils/selectCascada";

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
    const solicitudesRaw = await prisma.solicitud.findMany({
        where: {
            rut_usuario: rut,
            id_solicitud: { not: solicitudActualId },
            estado_solicitud: "En Curso",
            centro_id: centroId
        },
        select: {
            ...SOLICITUD_CASCADA_SELECT,
            rut_usuario: true,
            usuario: {
                select: {
                    rut: true,
                    nombre: true,
                    apellido: true,
                    nombre_social: true,
                    correo_contacto: true,
                    sector: true,
                    genero: true,
                    fecha_nacimiento: true,
                    telefono: true,
                    telefono_alternativo: true,
                    gestante: true,
                    discapacidad: true,
                    centro_id: true
                }
            },
            citas: { ...SOLICITUD_CASCADA_SELECT.citas, where: { centro_id: centroId }, orderBy: [{ fecha_estimada_atencion: "asc" }, { fecha_creacion: "asc" }] }
        },
        orderBy: [{ priorizacion_admin: "desc" }, { fecha_inicio: "asc" }]
    });

    const solicitudes = solicitudesRaw.map((solicitud) => ({
        ...solicitud,
        citas: solicitud.citas.map((cita) => ({
            ...cita,
            editable: esCitaEditable({ estado_cita: cita.estado_cita, cantidadLlamadas: cita.llamadas.length }),
            puedeRegistrarRechazo: esEstadoPendiente(cita.estado_cita)
        }))
    }));
    const payload = { solicitudes };
    return { ok: true, data: payload } satisfies ResultadoAccion<typeof payload>;
}
