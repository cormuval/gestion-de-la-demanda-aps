"use server";

// lib
import { prisma } from "@/shared/lib/prisma";
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
import { AuditLogger } from "@/shared/lib/logger";

export interface HistorialLlamada {
    id_llamada: string;
    fecha_llamada: Date | null;
    respuesta_usuario: string | null;
    observacion: string | null;
    comunicador: string | null;
}

export async function getHistorialLlamadas(citaId: string): Promise<HistorialLlamada[]> {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");
    if (!user.centro_id) throw new Error("El funcionario no tiene centro asignado");

    const cita = await prisma.cita.findUnique({ where: { id_cita: citaId }, select: { centro_id: true } });
    if (!cita || cita.centro_id !== user.centro_id) throw new Error("La cita no pertenece a tu centro");

    const llamadas = await prisma.llamada.findMany({
        where: { cita_id: citaId },
        orderBy: { fecha_llamada: "desc" },
        select: { id_llamada: true, fecha_llamada: true, respuesta_usuario: true, observacion: true, rut_comunicador: true }
    });

    const ruts = [...new Set(llamadas.map((l) => l.rut_comunicador).filter((r): r is string => Boolean(r)))];
    const funcionarios = ruts.length
        ? await prisma.funcionario.findMany({ where: { rut: { in: ruts } }, select: { rut: true, nombre: true } })
        : [];
    const nombrePorRut = new Map(funcionarios.map((f) => [f.rut, f.nombre]));

    await AuditLogger.logDataAccess("SEARCH", true, { id: user.email, name: user.nombre, rut: user.rut }, `HISTORIAL_${citaId}`, {
        details: `Historial de llamadas de la cita ${citaId}`
    });

    return llamadas.map((l) => ({
        id_llamada: l.id_llamada,
        fecha_llamada: l.fecha_llamada,
        respuesta_usuario: l.respuesta_usuario,
        observacion: l.observacion,
        comunicador: l.rut_comunicador ? nombrePorRut.get(l.rut_comunicador) ?? l.rut_comunicador : null
    }));
}
