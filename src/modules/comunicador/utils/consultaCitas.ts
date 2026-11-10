import { Prisma } from "@prisma/client";
// lib
import { escaparTextoLike } from "@/shared/lib/busquedaTexto";
// schemas
import type { CitasFiltros } from "../schemas/llamada.schema";
// types
import { ESTADOS_PENDIENTES } from "../types/comunicador";
// utils
import { rangoTemporalidad } from "./temporalidad";
import { rangoEdadAFechaNacimiento } from "./rangoEdadAFechaNacimiento";

export interface ConsultaCitas {
    where: Prisma.Sql;
    fromPagina: Prisma.Sql;
    fromConteo: Prisma.Sql;
}

export function construirConsultaCitas(filtros: CitasFiltros, centroId: string, ahora: Date): ConsultaCitas {
    // Estado: si viene un estado pendiente puntual, filtrar por él; si no, por todos los pendientes.
    const estadosFiltro =
        filtros.estado && (ESTADOS_PENDIENTES as readonly string[]).includes(filtros.estado) ? [filtros.estado] : [...ESTADOS_PENDIENTES];

    const condiciones: Prisma.Sql[] = [
        Prisma.sql`c.centro_id = ${centroId}`,
        Prisma.sql`c.estado_cita IN (${Prisma.join(estadosFiltro)})`
    ];

    if (filtros.profesional_id) condiciones.push(Prisma.sql`c.profesional_id = ${filtros.profesional_id}`);
    if (filtros.prestacion) condiciones.push(Prisma.sql`c.prestacion_id IN (SELECT id_prestacion FROM prestaciones WHERE nombre_prestacion = ${filtros.prestacion})`);

    // RUT: coincidencia parcial, ignorando puntos y guion en ambos lados.
    if (filtros.rut) {
        const fragmentoRut = filtros.rut.replace(/[.\-\s]/g, "");
        if (fragmentoRut) condiciones.push(Prisma.sql`REPLACE(REPLACE(c.rut_usuario, '.', ''), '-', '') LIKE ${`%${fragmentoRut}%`}`);
    }
    // Sector: coincidencia parcial (texto libre).
    if (filtros.sector) condiciones.push(Prisma.sql`u.sector LIKE ${`%${filtros.sector}%`}`);

    // Temporalidad (sobre fecha_estimada_atencion)
    const rt = rangoTemporalidad(filtros.temporalidad ?? "", ahora);
    if (rt?.gte) condiciones.push(Prisma.sql`c.fecha_estimada_atencion >= ${rt.gte}`);
    if (rt?.lte) condiciones.push(Prisma.sql`c.fecha_estimada_atencion <= ${rt.lte}`);
    if (rt?.lt) condiciones.push(Prisma.sql`c.fecha_estimada_atencion < ${rt.lt}`);

    // Rango de fecha estimada explícito (AND con temporalidad)
    if (filtros.fechaDesde) condiciones.push(Prisma.sql`c.fecha_estimada_atencion >= ${new Date(`${filtros.fechaDesde}T00:00:00`)}`);
    if (filtros.fechaHasta) condiciones.push(Prisma.sql`c.fecha_estimada_atencion <= ${new Date(`${filtros.fechaHasta}T23:59:59`)}`);

    // Edad -> fecha_nacimiento
    const rEdad = rangoEdadAFechaNacimiento(filtros.edadMin ?? null, filtros.edadMax ?? null, ahora);
    if (rEdad.gte) condiciones.push(Prisma.sql`u.fecha_nacimiento >= ${rEdad.gte}`);
    if (rEdad.lte) condiciones.push(Prisma.sql`u.fecha_nacimiento <= ${rEdad.lte}`);

    if (filtros.texto) condiciones.push(Prisma.sql`c.observacion LIKE ${`%${escaparTextoLike(filtros.texto, "!")}%`} ESCAPE '!'`);

    const where = Prisma.sql`WHERE ${Prisma.join(condiciones, " AND ")}`;

    const fromPagina = Prisma.sql`FROM citas c
        JOIN usuarios u ON u.rut = c.rut_usuario
        JOIN solicitudes s ON s.id_solicitud = c.solicitud_id
        LEFT JOIN profesionales p ON p.id_profesional = c.profesional_id
        LEFT JOIN prestaciones pr ON pr.id_prestacion = c.prestacion_id`;

    // Ambas relaciones son obligatorias y tienen FK: quitar sus joins no
    // cambia la cardinalidad. Usuario se necesita solo para sector o edad.
    const requiereUsuario = Boolean(filtros.sector) || filtros.edadMin !== undefined || filtros.edadMax !== undefined;
    const fromConteo = requiereUsuario
        ? Prisma.sql`FROM citas c JOIN usuarios u ON u.rut = c.rut_usuario`
        : Prisma.sql`FROM citas c`;

    return { where, fromPagina, fromConteo };
}
