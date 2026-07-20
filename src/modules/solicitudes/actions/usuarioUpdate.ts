// lib
import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { usuarioSolicitudSchema, type UsuarioSolicitudInput, type UsuarioSolicitudData } from "../schemas/usuario.schema";
// utils
import { calcularPriorizacionAdministrativa } from "../utils/priorizacion";

export interface ActorAuditoria {
    email: string;
    nombre: string;
    rut: string;
}

export const USUARIO_SELECT = {
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
    centro_id: true,
    priorizacion_administrativa: true
} as const;

export async function validarCentro(centroId: string): Promise<void> {
    const rows = await prisma.$queryRaw<{ id_centro: string }[]>`
        SELECT id_centro
        FROM centros
        WHERE id_centro = ${centroId}
        LIMIT 1
    `;
    if (rows.length === 0) throw new Error("Centro no encontrado");
}

export function toUsuarioData(data: UsuarioSolicitudData) {
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
        centro_id: data.centro_id,
        priorizacion_administrativa: calcularPriorizacionAdministrativa({
            discapacidad: data.discapacidad,
            fechaNacimiento: data.fecha_nacimiento,
            gestante: data.gestante
        })
    };
}

export async function persistirActualizacionUsuario(actor: ActorAuditoria, input: UsuarioSolicitudInput, origen: string) {
    const data = usuarioSolicitudSchema.parse(input);
    await validarCentro(data.centro_id);

    const usuario = await prisma.usuario.update({
        where: { rut: data.rut },
        data: toUsuarioData(data),
        select: USUARIO_SELECT
    });

    await AuditLogger.logDataAccess("UPDATE", true, { id: actor.email, name: actor.nombre, rut: actor.rut }, `USUARIO_${usuario.rut}`, {
        details: `Usuario actualizado desde ${origen}`
    });

    return { usuario };
}
