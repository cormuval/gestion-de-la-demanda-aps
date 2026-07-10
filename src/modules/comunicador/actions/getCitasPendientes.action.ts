"use server";

import { Prisma } from "@prisma/client";
// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { citasFiltrosSchema } from "../schemas/llamada.schema";
// utils
import { rangoTemporalidad } from "../utils/temporalidad";
import { rangoEdadAFechaNacimiento } from "../utils/rangoEdadAFechaNacimiento";
// types
import { ESTADOS_PENDIENTES, ORDEN_ESTADOS_PENDIENTES, RESPUESTA_LLAMADA } from "../types/comunicador";

const POR_PAGINA = 100;

export interface CitaFila {
    id_cita: string;
    priorizacion: number | null;
    disponibilidad: string | null;
    rut_usuario: string;
    nombre_usuario: string | null;
    profesion: string | null;
    prestacion: string | null;
    fecha_estimada_atencion: Date | null;
    estado_cita: string | null;
    intentos: number;
}

export async function getCitasPendientes(filtros: unknown): Promise<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number }> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");
    if (!user.centro_id) throw new Error("El funcionario no tiene centro asignado");

    const f = citasFiltrosSchema.parse(filtros ?? {});
    const hoy = new Date();

    // Estado: si viene un estado pendiente puntual, filtrar por él; si no, por todos los pendientes.
    const estadosFiltro =
        f.estado && (ESTADOS_PENDIENTES as readonly string[]).includes(f.estado) ? [f.estado] : [...ESTADOS_PENDIENTES];

    const condiciones: Prisma.Sql[] = [
        Prisma.sql`c.centro_id = ${user.centro_id}`,
        Prisma.sql`c.estado_cita IN (${Prisma.join(estadosFiltro)})`
    ];

    if (f.profesional_id) condiciones.push(Prisma.sql`c.profesional_id = ${f.profesional_id}`);
    if (f.prestacion_id) condiciones.push(Prisma.sql`c.prestacion_id = ${f.prestacion_id}`);

    // Temporalidad (sobre fecha_estimada_atencion)
    const rt = rangoTemporalidad(f.temporalidad ?? "", hoy);
    if (rt?.gte) condiciones.push(Prisma.sql`c.fecha_estimada_atencion >= ${rt.gte}`);
    if (rt?.lte) condiciones.push(Prisma.sql`c.fecha_estimada_atencion <= ${rt.lte}`);
    if (rt?.lt) condiciones.push(Prisma.sql`c.fecha_estimada_atencion < ${rt.lt}`);

    // Rango de fecha estimada explícito (AND con temporalidad)
    if (f.fechaDesde) condiciones.push(Prisma.sql`c.fecha_estimada_atencion >= ${new Date(`${f.fechaDesde}T00:00:00`)}`);
    if (f.fechaHasta) condiciones.push(Prisma.sql`c.fecha_estimada_atencion <= ${new Date(`${f.fechaHasta}T23:59:59`)}`);

    // Edad -> fecha_nacimiento
    const rEdad = rangoEdadAFechaNacimiento(f.edadMin ?? null, f.edadMax ?? null, hoy);
    if (rEdad.gte) condiciones.push(Prisma.sql`u.fecha_nacimiento >= ${rEdad.gte}`);
    if (rEdad.lte) condiciones.push(Prisma.sql`u.fecha_nacimiento <= ${rEdad.lte}`);

    const where = Prisma.sql`WHERE ${Prisma.join(condiciones, " AND ")}`;

    // Orden en cascada por estado (FIELD) + priorizacion desc
    const ordenEstados = Prisma.join(ORDEN_ESTADOS_PENDIENTES.map((e) => Prisma.sql`${e}`));
    const orderBy = Prisma.sql`ORDER BY FIELD(c.estado_cita, ${ordenEstados}) ASC, c.priorizacion DESC`;

    const offset = (f.pagina - 1) * POR_PAGINA;

    const filas = await prisma.$queryRaw<CitaFila[]>`
        SELECT
            c.id_cita AS id_cita,
            c.priorizacion AS priorizacion,
            s.disponibilidad_llamada AS disponibilidad,
            c.rut_usuario AS rut_usuario,
            TRIM(CONCAT(COALESCE(u.nombre, ''), ' ', COALESCE(u.apellido, ''))) AS nombre_usuario,
            p.nombre AS profesion,
            pr.nombre_prestacion AS prestacion,
            c.fecha_estimada_atencion AS fecha_estimada_atencion,
            c.estado_cita AS estado_cita,
            (SELECT COUNT(*) FROM llamadas ll WHERE ll.cita_id = c.id_cita AND ll.respuesta_usuario = ${RESPUESTA_LLAMADA.NO_CONTESTA}) AS intentos
        FROM citas c
        JOIN usuarios u ON u.rut = c.rut_usuario
        JOIN solicitudes s ON s.id_solicitud = c.solicitud_id
        LEFT JOIN profesionales p ON p.id_profesional = c.profesional_id
        LEFT JOIN prestaciones pr ON pr.id_prestacion = c.prestacion_id
        ${where}
        ${orderBy}
        LIMIT ${POR_PAGINA} OFFSET ${offset}
    `;

    const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total
        FROM citas c
        JOIN usuarios u ON u.rut = c.rut_usuario
        JOIN solicitudes s ON s.id_solicitud = c.solicitud_id
        ${where}
    `;
    const total = Number(totalRows[0]?.total ?? 0);

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, "COLA_COMUNICADOR", {
        details: `Filtros: ${JSON.stringify(f)}`
    });

    // `intentos` puede venir como bigint desde MySQL; normalizar a number.
    const filasNorm = filas.map((r) => ({ ...r, intentos: Number(r.intentos as unknown as bigint) }));
    return { filas: filasNorm, total, pagina: f.pagina, porPagina: POR_PAGINA };
}
