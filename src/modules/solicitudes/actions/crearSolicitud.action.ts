"use server";

import crypto from "node:crypto";
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { crearSolicitudSchema, CrearSolicitudInput } from "../schemas/solicitud.schema";

async function ensureUsuario(data: CrearSolicitudInput) {
    const rut = data.rut_usuario.trim();
    const existing = await prisma.usuario.findUnique({ where: { rut } });
    if (existing) return existing;
    return prisma.usuario.create({
        data: {
            rut,
            nombre: data.nombre_usuario,
            apellido: data.apellido_usuario,
            telefono: data.telefono || null,
            correo_contacto: data.correo_contacto || null,
            centro_id: data.centro_id || null
        }
    });
}

export async function crearSolicitud(input: CrearSolicitudInput) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const data = crearSolicitudSchema.parse(input);
    const usuario = await ensureUsuario(data);

    const solicitud = await prisma.solicitud.create({
        data: {
            id_solicitud: `SOL-${crypto.randomUUID()}`,
            rut_orientador: user.rut,
            rut_usuario: usuario.rut,
            tipo_solicitud_id: data.tipo_solicitud_id,
            motivo_id: data.motivo_id,
            descripcion: data.descripcion || null,
            disponibilidad_llamada: data.disponibilidad_llamada || null,
            priorizacion_admin: data.priorizacion_admin ? Number(data.priorizacion_admin) : null,
            estado_solicitud: "En Curso",
            centro_id: data.centro_id || null
        },
        include: { usuario: true, tipoSolicitud: true, motivo: true }
    });

    await AuditLogger.logDataAccess("CREATE", true, { id: user.email, name: user.nombre, rut: user.rut }, solicitud.id_solicitud, {
        details: `Solicitud creada para RUT ${usuario.rut}`
    });

    return { solicitud };
}
