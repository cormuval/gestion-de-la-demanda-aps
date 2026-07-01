"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederSolicitudes } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// utils
import { esRutChilenoValido, normalizarRut } from "../utils/rut";

export async function getUsuarioPorRut(rutUsuario: string) {
    const user = await requireSessionUser();
    if (!puedeAccederSolicitudes(user.rol.nombre)) throw new Error("No tienes permiso para solicitudes");

    const rut = normalizarRut(rutUsuario);
    if (!rut) throw new Error("RUT usuario es requerido");
    if (!esRutChilenoValido(rut)) throw new Error("RUT invalido");

    const usuario = await prisma.usuario.findUnique({
        where: { rut },
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

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `USUARIO_${rut}`, {
        details: `Consulta de usuario para RUT ${rut}`
    });

    return { usuario };
}
