"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
// schemas
import { editarCitaSchema, type EditarCitaInput } from "../schemas/revision.schema";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
import type { PrioridadClinica } from "../utils/citas";
// utils
import { calcularPriorizacionCita, esCitaEditable, evaluarFechaEstimada } from "../utils/citas";

export interface CitaEditada {
    id_cita: string;
    priorizacion_clinica: PrioridadClinica;
    priorizacion: number;
    fecha_estimada_atencion: Date | null;
}

async function getCentroFuncionario(rutFuncionario: string, centroSesion: string | null): Promise<string | null> {
    if (centroSesion) return centroSesion;

    const funcionario = await prisma.funcionario.findUnique({
        where: { rut: rutFuncionario },
        select: { centro_id: true }
    });

    return funcionario?.centro_id ?? null;
}

export async function editarCita(input: EditarCitaInput): Promise<ResultadoAccion<CitaEditada>> {
    const user = await requirePermiso("solicitudes.gestionar");
    const data = editarCitaSchema.parse(input);
    const centroId = await getCentroFuncionario(user.rut, user.centro_id);
    if (!centroId) return { ok: false, error: "El funcionario activo no tiene centro asignado" };

    const fecha = evaluarFechaEstimada(data.fecha_estimada_atencion);
    if (!fecha.ok) return { ok: false, error: fecha.error };

    const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id_cita FROM citas WHERE id_cita = ${data.id_cita} FOR UPDATE`;
        const cita = await tx.cita.findUnique({
            where: { id_cita: data.id_cita },
            select: {
                id_cita: true,
                centro_id: true,
                estado_cita: true,
                priorizacion_clinica: true,
                priorizacion: true,
                fecha_estimada_atencion: true,
                usuario: { select: { priorizacion_administrativa: true } },
                _count: { select: { llamadas: true } }
            }
        });

        if (!cita || cita.centro_id !== centroId) return { ok: false as const, error: "La cita no existe o no pertenece a tu centro" };
        if (!esCitaEditable({ estado_cita: cita.estado_cita, cantidadLlamadas: cita._count.llamadas })) {
            return { ok: false as const, error: "La cita ya tiene llamadas registradas y no se puede modificar" };
        }

        const priorizacion = calcularPriorizacionCita(data.priorizacion_clinica, cita.usuario?.priorizacion_administrativa);
        const citaEditada = await tx.cita.update({
            where: { id_cita: cita.id_cita },
            data: {
                priorizacion_clinica: data.priorizacion_clinica,
                fecha_estimada_atencion: fecha.fecha,
                priorizacion
            },
            select: {
                id_cita: true,
                priorizacion_clinica: true,
                priorizacion: true,
                fecha_estimada_atencion: true
            }
        });

        return { ok: true as const, data: citaEditada as CitaEditada, anterior: cita };
    });

    if (!result.ok) return result;

    await AuditLogger.logDataAccess("UPDATE", true, { id: user.email, name: user.nombre, rut: user.rut }, result.data.id_cita, {
        details: `Cita editada: priorizacion_clinica ${result.anterior.priorizacion_clinica ?? "-"}->${result.data.priorizacion_clinica}, priorizacion ${result.anterior.priorizacion ?? "-"}->${result.data.priorizacion}, fecha_estimada ${result.anterior.fecha_estimada_atencion?.toISOString().slice(0, 10) ?? "-"}->${result.data.fecha_estimada_atencion?.toISOString().slice(0, 10) ?? "-"}`
    });

    return { ok: true, data: result.data };
}
