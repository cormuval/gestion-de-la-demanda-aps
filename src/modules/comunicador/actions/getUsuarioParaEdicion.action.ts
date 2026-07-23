"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
// utils
import { esRutChilenoValido, normalizarRut } from "@/modules/solicitudes/utils/rut";
// actions
import { USUARIO_SELECT } from "@/modules/solicitudes/actions/usuarioUpdate";

export interface UsuarioEditable {
    rut: string;
    nombre: string;
    apellido: string;
    nombre_social: string | null;
    correo_contacto: string | null;
    sector: string | null;
    genero: string | null;
    fecha_nacimiento: Date | null;
    telefono: string | null;
    telefono_alternativo: string | null;
    gestante: string | null;
    discapacidad: string | null;
    centro_id: string | null;
    priorizacion_administrativa: number | null;
}

export async function getUsuarioParaEdicion(rutUsuario: string): Promise<{ usuario: UsuarioEditable | null }> {
    const user = await requirePermiso("comunicador.paciente");

    const rut = normalizarRut(rutUsuario);
    if (!rut) throw new Error("RUT usuario es requerido");
    if (!esRutChilenoValido(rut)) throw new Error("RUT invalido");

    const usuario = await prisma.usuario.findUnique({
        where: { rut },
        select: USUARIO_SELECT
    });

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `USUARIO_${rut}`, {
        details: `Consulta de usuario (edición desde comunicador) para RUT ${rut}`
    });

    return { usuario };
}
