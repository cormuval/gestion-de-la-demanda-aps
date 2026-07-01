"use server";

import crypto from "node:crypto";
// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
import { CentroTipoSolicitudColumna, getColumnaTipoSolicitudPorCentro } from "@/modules/catalogos/utils/centroTipoSolicitud";
// schemas
import { crearSolicitudSchema, CrearSolicitudInput } from "../schemas/solicitud.schema";
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

async function getNombreCentro(centroId: string): Promise<string | null> {
    const centros = await prisma.$queryRaw<{ nombre_centro: string | null }[]>`
        SELECT nombre_centro
        FROM centros
        WHERE id_centro = ${centroId}
        LIMIT 1
    `;
    return centros[0]?.nombre_centro ?? null;
}

function buildTipoSolicitudWhere(idTipoSolicitud: number, centroColumna: CentroTipoSolicitudColumna) {
    return {
        id_tipo_solicitud: idTipoSolicitud,
        estado: "1",
        [centroColumna]: "1"
    };
}

export async function crearSolicitud(input: CrearSolicitudInput) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const data = crearSolicitudSchema.parse(input);
    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    const nombreCentro = await getNombreCentro(centroId);
    const centroColumna = getColumnaTipoSolicitudPorCentro(nombreCentro);
    if (!centroColumna) throw new Error("No se pudo validar el centro del funcionario para el tipo de solicitud");

    const [usuario, tipoSolicitud, motivo, motivosActivos] = await Promise.all([
        prisma.usuario.findUnique({ where: { rut: normalizarRut(data.rut_usuario) }, select: { rut: true } }),
        prisma.tipoSolicitud.findFirst({
            where: buildTipoSolicitudWhere(data.tipo_solicitud_id, centroColumna),
            select: { id_tipo_solicitud: true }
        }),
        data.motivo_id
            ? prisma.motivo.findFirst({
                  where: {
                      id_motivo: data.motivo_id,
                      tipo_solicitud_id: data.tipo_solicitud_id,
                      estado: "1"
                  },
                  select: { id_motivo: true }
              })
            : Promise.resolve(null),
        prisma.motivo.count({ where: { tipo_solicitud_id: data.tipo_solicitud_id, estado: "1" } })
    ]);

    if (!usuario) throw new Error("Debes crear o confirmar el usuario antes de ingresar la solicitud");
    if (!tipoSolicitud) throw new Error("Tipo de solicitud inactivo, no encontrado o no habilitado para el centro del funcionario");
    if (data.motivo_id && !motivo) throw new Error("Motivo inactivo, no encontrado o no asociado al tipo de solicitud");
    if (!data.motivo_id && motivosActivos > 0) throw new Error("Motivo requerido para el tipo de solicitud seleccionado");

    const solicitud = await prisma.solicitud.create({
        data: {
            id_solicitud: `SOL-${crypto.randomUUID()}`,
            rut_orientador: user.rut,
            rut_usuario: usuario.rut,
            tipo_solicitud_id: data.tipo_solicitud_id,
            motivo_id: data.motivo_id,
            descripcion: data.descripcion || null,
            disponibilidad_llamada: data.disponibilidad_llamada || null,
            priorizacion_admin: null,
            estado_solicitud: "En Curso",
            centro_id: centroId
        },
        select: {
            id_solicitud: true,
            estado_solicitud: true,
            centro_id: true,
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

    await AuditLogger.logDataAccess("CREATE", true, { id: user.email, name: user.nombre, rut: user.rut }, solicitud.id_solicitud, {
        details: `Solicitud creada para RUT ${usuario.rut}`
    });

    return { solicitud };
}
