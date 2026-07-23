"use server";

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
// utils
import { normalizarRut } from "@/modules/solicitudes/utils/rut";
import { formatearTelefonos, formatearCorreo } from "../utils/contacto";

export async function getContactoPaciente(rutUsuario: string): Promise<{ telefonos: string; correo: string }> {
    const user = await requirePermiso("comunicador.ver");
    const usuario = await prisma.usuario.findUnique({
        where: { rut: normalizarRut(rutUsuario) },
        select: { telefono: true, telefono_alternativo: true, correo_contacto: true }
    });
    return {
        telefonos: formatearTelefonos(usuario?.telefono, usuario?.telefono_alternativo),
        correo: formatearCorreo(usuario?.correo_contacto)
    };
}
