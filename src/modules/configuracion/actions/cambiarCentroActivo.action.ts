"use server";
// lib
import { z } from "zod";
import { prisma } from "@/shared/lib/prisma";
import { getSessionPermisos } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
// utils
import { puedeCambiarCentroPropio } from "../utils/privilegios";
import { logBloqueo } from "../utils/auditoria";

const centroIdSchema = z.string().trim().min(1);

export async function cambiarCentroActivo(centroId: string): Promise<ResultadoAccion<{ centro_id: string; centro_nombre: string | null }>> {
    const contexto = await getSessionPermisos();
    if (!contexto) throw new Error("No autenticado");
    const { user, permisos } = contexto;

    if (!puedeCambiarCentroPropio(permisos)) {
        const error = "Solo un administrador puede cambiar su centro";
        await logBloqueo("UPDATE", user, `funcionario:${user.rut}`, "regla=cambiarCentroActivo", error);
        return { ok: false, error };
    }

    const parsed = centroIdSchema.safeParse(centroId);
    if (!parsed.success) {
        return { ok: false, error: "El centro seleccionado no existe" };
    }

    const centro = await prisma.centro.findUnique({
        where: { id_centro: parsed.data },
        select: { id_centro: true, nombre_centro: true }
    });
    if (!centro) {
        return { ok: false, error: "El centro seleccionado no existe" };
    }

    if (centro.id_centro === user.centro_id) {
        return { ok: true, data: { centro_id: centro.id_centro, centro_nombre: centro.nombre_centro } };
    }

    await prisma.funcionario.update({ where: { rut: user.rut }, data: { centro_id: centro.id_centro } });

    const anterior = user.centro_id ?? "null";
    await AuditLogger.logDataAccess("UPDATE", true, { rut: user.rut, name: user.nombre }, `funcionario:${user.rut}`, {
        details: `centro_id ${anterior} -> ${centro.id_centro} (selector centro activo)`
    });

    return { ok: true, data: { centro_id: centro.id_centro, centro_nombre: centro.nombre_centro } };
}
