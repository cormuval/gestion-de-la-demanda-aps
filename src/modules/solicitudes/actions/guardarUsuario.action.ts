"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { usuarioSolicitudSchema, UsuarioSolicitudInput } from "../schemas/usuario.schema";
// actions (núcleo compartido)
import { validarCentro, toUsuarioData, persistirActualizacionUsuario, USUARIO_SELECT } from "./usuarioUpdate";

async function requireSolicitudesUser() {
    return requirePermiso("solicitudes.crear", "solicitudes.gestionar");
}

export async function crearUsuario(input: UsuarioSolicitudInput) {
    const user = await requireSolicitudesUser();
    const data = usuarioSolicitudSchema.parse(input);
    await validarCentro(data.centro_id);

    const existing = await prisma.usuario.findUnique({ where: { rut: data.rut }, select: { rut: true } });
    if (existing) throw new Error("El usuario ya existe");

    const usuario = await prisma.usuario.create({
        data: { rut: data.rut, ...toUsuarioData(data) },
        select: USUARIO_SELECT
    });

    await AuditLogger.logDataAccess("CREATE", true, { id: user.email, name: user.nombre, rut: user.rut }, `USUARIO_${usuario.rut}`, {
        details: `Usuario creado desde ingreso de solicitudes`
    });

    return { usuario };
}

export async function actualizarUsuario(input: UsuarioSolicitudInput) {
    const user = await requireSolicitudesUser();
    return persistirActualizacionUsuario({ email: user.email, nombre: user.nombre, rut: user.rut }, input, "ingreso de solicitudes");
}
