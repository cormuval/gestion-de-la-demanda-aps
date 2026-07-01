"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { usuarioSolicitudSchema, UsuarioSolicitudInput, UsuarioSolicitudData } from "../schemas/usuario.schema";

async function requireSolicitudesUser() {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");
    return user;
}

async function validarCentro(centroId: string): Promise<void> {
    const rows = await prisma.$queryRaw<{ id_centro: string }[]>`
        SELECT id_centro
        FROM centros
        WHERE id_centro = ${centroId}
        LIMIT 1
    `;
    if (rows.length === 0) throw new Error("Centro no encontrado");
}

function toUsuarioData(data: UsuarioSolicitudData) {
    return {
        nombre: data.nombre,
        apellido: data.apellido,
        nombre_social: data.nombre_social || null,
        correo_contacto: data.correo_contacto || null,
        sector: data.sector || null,
        genero: data.genero,
        fecha_nacimiento: new Date(`${data.fecha_nacimiento}T00:00:00`),
        telefono: data.telefono,
        telefono_alternativo: data.telefono_alternativo,
        gestante: data.gestante,
        discapacidad: data.discapacidad,
        centro_id: data.centro_id
    };
}

export async function crearUsuario(input: UsuarioSolicitudInput) {
    const user = await requireSolicitudesUser();
    const data = usuarioSolicitudSchema.parse(input);
    await validarCentro(data.centro_id);

    const existing = await prisma.usuario.findUnique({ where: { rut: data.rut }, select: { rut: true } });
    if (existing) throw new Error("El usuario ya existe");

    const usuario = await prisma.usuario.create({
        data: { rut: data.rut, ...toUsuarioData(data) },
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
    });

    await AuditLogger.logDataAccess("CREATE", true, { id: user.email, name: user.nombre, rut: user.rut }, `USUARIO_${usuario.rut}`, {
        details: `Usuario creado desde ingreso de solicitudes`
    });

    return { usuario };
}

export async function actualizarUsuario(input: UsuarioSolicitudInput) {
    const user = await requireSolicitudesUser();
    const data = usuarioSolicitudSchema.parse(input);
    await validarCentro(data.centro_id);

    const usuario = await prisma.usuario.update({
        where: { rut: data.rut },
        data: toUsuarioData(data),
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
    });

    await AuditLogger.logDataAccess("UPDATE", true, { id: user.email, name: user.nombre, rut: user.rut }, `USUARIO_${usuario.rut}`, {
        details: `Usuario actualizado desde ingreso de solicitudes`
    });

    return { usuario };
}
