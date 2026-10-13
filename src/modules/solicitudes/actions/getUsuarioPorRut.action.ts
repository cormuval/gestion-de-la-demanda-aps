"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
// types
import type { Prisma } from "@prisma/client";
import type { ResultadoAccion } from "@/shared/types/resultado";
// utils
import { esRutChilenoValido, normalizarRut } from "../utils/rut";

const USUARIO_ENCONTRADO_SELECT = {
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
} satisfies Prisma.UsuarioSelect;

type UsuarioEncontrado = Prisma.UsuarioGetPayload<{ select: typeof USUARIO_ENCONTRADO_SELECT }>;

export async function getUsuarioPorRut(rutUsuario: string): Promise<ResultadoAccion<{ usuario: UsuarioEncontrado | null }>> {
    const user = await requirePermiso("solicitudes.ver");

    const rut = normalizarRut(rutUsuario);
    if (!rut) return { ok: false, error: "RUT usuario es requerido" };
    if (!esRutChilenoValido(rut)) return { ok: false, error: "RUT invalido" };

    const usuario = await prisma.usuario.findUnique({
        where: { rut },
        select: USUARIO_ENCONTRADO_SELECT
    });

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `USUARIO_${rut}`, {
        details: `Consulta de usuario para RUT ${rut}`
    });

    return { ok: true, data: { usuario } };
}
