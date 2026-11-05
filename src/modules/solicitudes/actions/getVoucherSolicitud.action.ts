"use server";

import { z } from "zod";
// lib
import { AuditLogger } from "@/shared/lib/logger";
import { requirePermiso } from "@/shared/lib/permisos";
import { prisma } from "@/shared/lib/prisma";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
import type { VoucherSolicitud } from "../types/voucher";

const ERROR_CENTRO = "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion.";
const ERROR_VOUCHER = "No fue posible obtener el voucher de la solicitud";
const idSolicitudSchema = z.string().trim().min(1, "ID de solicitud requerido");

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string | null> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    return funcionario?.centro_id ?? null;
}

async function getNombreCentro(centroId: string): Promise<string | null> {
    const centros = await prisma.$queryRaw<{ nombre_centro: string | null }[]>`
        SELECT nombre_centro
        FROM centros
        WHERE id_centro = ${centroId}
        LIMIT 1
    `;

    return centros[0]?.nombre_centro ?? null;
}

export async function getVoucherSolicitud(idSolicitud: string): Promise<ResultadoAccion<VoucherSolicitud>> {
    const user = await requirePermiso("solicitudes.ver", "historial.ver");

    const idResultado = idSolicitudSchema.safeParse(idSolicitud);
    if (!idResultado.success) return { ok: false, error: "ID de solicitud requerido" };

    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    if (!centroId) return { ok: false, error: ERROR_CENTRO };

    const solicitud = await prisma.solicitud.findFirst({
        where: {
            id_solicitud: idResultado.data,
            centro_id: centroId,
            estado_solicitud: "En Curso"
        },
        select: {
            id_solicitud: true,
            fecha_inicio: true,
            disponibilidad_llamada: true,
            usuario: {
                select: {
                    rut: true,
                    nombre: true,
                    apellido: true,
                    nombre_social: true,
                    telefono: true,
                    telefono_alternativo: true
                }
            },
            tipoSolicitud: { select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true } },
            motivo: { select: { id_motivo: true, nombre_motivo: true } }
        }
    });

    if (!solicitud) {
        const solicitudExistente = await prisma.solicitud.findUnique({
            where: { id_solicitud: idResultado.data },
            select: { id_solicitud: true, centro_id: true, estado_solicitud: true }
        });

        if (solicitudExistente?.centro_id === centroId && solicitudExistente.estado_solicitud !== "En Curso") {
            return { ok: false, error: "Solo se pueden reimprimir vouchers de solicitudes En Curso" };
        }

        return { ok: false, error: ERROR_VOUCHER };
    }

    const nombreCentro = await getNombreCentro(centroId);
    const voucher: VoucherSolicitud = {
        id_solicitud: solicitud.id_solicitud,
        fecha_inicio: solicitud.fecha_inicio,
        rut: solicitud.usuario.rut,
        usuario: solicitud.usuario,
        tipoSolicitud: solicitud.tipoSolicitud,
        motivo: solicitud.motivo,
        centro: nombreCentro ?? centroId,
        disponibilidad_llamada: solicitud.disponibilidad_llamada
    };

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, solicitud.id_solicitud, {
        details: "Reimpresion de voucher de solicitud"
    });

    return { ok: true, data: voucher };
}
