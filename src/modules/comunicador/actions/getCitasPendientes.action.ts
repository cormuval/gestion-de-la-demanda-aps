"use server";

import { Prisma } from "@prisma/client";
// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { debeRegistrarBusqueda } from "@/shared/lib/auditoriaBusquedas";
import type { ResultadoAccion } from "@/shared/types/resultado";
// schemas
import { citasFiltrosSchema } from "../schemas/llamada.schema";
// utils
import { construirConsultaCitas } from "../utils/consultaCitas";
// types
import { RESPUESTA_LLAMADA } from "../types/comunicador";

const POR_PAGINA = 100;

export interface CitaFila {
    id_cita: string;
    priorizacion_clinica: string | null;
    priorizacion: number | null;
    disponibilidad: string | null;
    rut_usuario: string;
    nombre_usuario: string | null;
    nombre_social: string | null;
    profesion: string | null;
    prestacion: string | null;
    fecha_estimada_atencion: Date | null;
    estado_cita: string | null;
    observacion: string | null;
    intentos: number;
    tiene_llamada_hoy: boolean;
}

export async function getCitasPendientes(filtros: unknown): Promise<ResultadoAccion<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number }>> {
    const user = await requirePermiso("comunicador.ver");
    if (!user.centro_id) {
        return { ok: false, error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion." };
    }

    const validacion = citasFiltrosSchema.safeParse(filtros ?? {});
    if (!validacion.success) {
        return { ok: false, error: "Filtros invalidos. Revisa los valores; el texto admite hasta 200 caracteres." };
    }
    const f = validacion.data;
    const { where, fromPagina, fromConteo } = construirConsultaCitas(f, user.centro_id, new Date());

    // Orden por priorizacion descendente con desempate determinista por fecha estimada e id
    const orderBy = Prisma.sql`ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC`;

    const offset = (f.pagina - 1) * POR_PAGINA;

    const filas = await prisma.$queryRaw<CitaFila[]>`
        SELECT
            c.id_cita AS id_cita,
            c.priorizacion_clinica AS priorizacion_clinica,
            c.priorizacion AS priorizacion,
            s.disponibilidad_llamada AS disponibilidad,
            c.rut_usuario AS rut_usuario,
            TRIM(CONCAT(COALESCE(u.nombre, ''), ' ', COALESCE(u.apellido, ''))) AS nombre_usuario,
            u.nombre_social AS nombre_social,
            p.nombre AS profesion,
            pr.nombre_prestacion AS prestacion,
            c.fecha_estimada_atencion AS fecha_estimada_atencion,
            c.estado_cita AS estado_cita,
            c.observacion AS observacion,
            (SELECT COUNT(*) FROM llamadas ll WHERE ll.cita_id = c.id_cita AND ll.respuesta_usuario = ${RESPUESTA_LLAMADA.NO_CONTESTA}) AS intentos,
            EXISTS(SELECT 1 FROM llamadas lh WHERE lh.cita_id = c.id_cita AND DATE(lh.fecha_llamada) = CURDATE()) AS tiene_llamada_hoy
        ${fromPagina}
        ${where}
        ${orderBy}
        LIMIT ${POR_PAGINA} OFFSET ${offset}
    `;

    const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total
        ${fromConteo}
        ${where}
    `;
    const total = Number(totalRows[0]?.total ?? 0);

    const details = `Filtros: ${JSON.stringify(f)}`;
    if (debeRegistrarBusqueda(`${user.rut}|${user.centro_id}|COLA_COMUNICADOR|${details}`)) {
        await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "COLA_COMUNICADOR", {
            details
        });
    }

    // `intentos` puede venir como bigint desde MySQL; normalizar a number.
    const filasNorm = filas.map((r) => ({
        ...r,
        intentos: Number(r.intentos as unknown as bigint),
        tiene_llamada_hoy: Number(r.tiene_llamada_hoy as unknown as number) === 1
    }));
    return { ok: true, data: { filas: filasNorm, total, pagina: f.pagina, porPagina: POR_PAGINA } };
}
