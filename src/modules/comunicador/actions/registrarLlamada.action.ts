"use server";

import crypto from "node:crypto";
// lib
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import type { ResultadoAccion } from "@/shared/types/resultado";
// schemas
import { registrarLlamadaSchema, RegistrarLlamadaInput } from "../schemas/llamada.schema";
// utils
import { computeEstadoCita } from "../utils/estadoCita";
// types
import { ERROR_CITA_CERRADA, ESTADO_CITA, ESTADOS_PENDIENTES, RESPUESTA_LLAMADA, RespuestaLlamada, esEstadoTerminal } from "../types/comunicador";

export async function registrarLlamada(input: RegistrarLlamadaInput): Promise<ResultadoAccion<{ estadoCita: string; solicitudRealizada: boolean }>> {
    const user = await requirePermiso("comunicador.llamar");

    const data = registrarLlamadaSchema.parse(input);

    const resultado = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id_cita FROM citas WHERE id_cita = ${data.cita_id} FOR UPDATE`;
        const cita = await tx.cita.findUnique({
            where: { id_cita: data.cita_id },
            select: { id_cita: true, solicitud_id: true, rut_usuario: true, estado_cita: true, centro_id: true }
        });
        if (!cita) return { ok: false, error: "La cita no existe" } satisfies ResultadoAccion<never>;
        if (cita.centro_id !== user.centro_id) return { ok: false, error: "La cita no pertenece a tu centro" } satisfies ResultadoAccion<never>;

        const estadoActual = cita.estado_cita ?? ESTADO_CITA.SIN_LLAMADAS;
        if (esEstadoTerminal(estadoActual)) return { ok: false, error: ERROR_CITA_CERRADA } satisfies ResultadoAccion<never>;

        const intentosNoContestaPrevios = await tx.llamada.count({
            where: { cita_id: cita.id_cita, respuesta_usuario: RESPUESTA_LLAMADA.NO_CONTESTA }
        });

        const nuevoEstado = computeEstadoCita(estadoActual, intentosNoContestaPrevios, data.respuesta as RespuestaLlamada);

        await tx.llamada.create({
            data: {
                id_llamada: `LLAM-${crypto.randomUUID()}`,
                cita_id: cita.id_cita,
                rut_usuario: cita.rut_usuario,
                rut_comunicador: user.rut,
                respuesta_usuario: data.respuesta,
                observacion: data.observacion || null,
                hora_agendada: data.respuesta === RESPUESTA_LLAMADA.ACEPTADA && data.hora_agendada ? new Date(data.hora_agendada) : null,
                fecha_llamada: new Date(),
                centro_id: cita.centro_id
            }
        });

        await tx.cita.update({ where: { id_cita: cita.id_cita }, data: { estado_cita: nuevoEstado } });

        let solicitudRealizada = false;
        if (esEstadoTerminal(nuevoEstado)) {
            const pendientesRestantes = await tx.cita.count({
                where: { solicitud_id: cita.solicitud_id, estado_cita: { in: [...ESTADOS_PENDIENTES] } }
            });
            if (pendientesRestantes === 0) {
                await tx.solicitud.update({ where: { id_solicitud: cita.solicitud_id }, data: { estado_solicitud: "Realizado" } });
                solicitudRealizada = true;
            }
        }

        return { ok: true, data: { estadoCita: nuevoEstado, solicitudRealizada } } satisfies ResultadoAccion<{ estadoCita: string; solicitudRealizada: boolean }>;
    });

    if (!resultado.ok) return resultado;

    await AuditLogger.logDataAccess("UPDATE", true, { id: user.email, name: user.nombre, rut: user.rut }, data.cita_id, {
        details: `Llamada registrada (${data.respuesta}) -> estado ${resultado.data.estadoCita}${resultado.data.solicitudRealizada ? "; solicitud Realizada" : ""}`
    });

    return resultado;
}
