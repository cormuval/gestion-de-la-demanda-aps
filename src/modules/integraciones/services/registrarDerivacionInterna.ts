// lib
import { prisma } from "@/shared/lib/prisma";

// services
import { verificarCatalogos } from "./catalogos";
import { aResultado, ErrorIntegracion } from "./errores";
import { asegurarPaciente } from "./paciente";

// types
import type { DerivacionInterna } from "../schemas/derivacionInterna.schema";
import type { ResultadoIntegracion } from "../types/integraciones";

const RUT_FUNCIONARIO_DI = "11111112-2";

export async function registrarDerivacionInterna(
    datos: DerivacionInterna,
    ahora: Date = new Date()
): Promise<ResultadoIntegracion> {
    const { paciente, solicitud, cita } = datos;
    const validada = datos.modo === "validada";

    try {
        await prisma.$transaction(async (tx) => {
            await verificarCatalogos(tx, {
                tipo_solicitud_id: solicitud.tipo_solicitud_id,
                motivo_id: solicitud.motivo_id,
                rut_funcionario: RUT_FUNCIONARIO_DI,
                profesional_id: cita?.profesional_id,
                prestacion_id: cita?.prestacion_id
            });

            const existente = await tx.solicitud.findUnique({
                where: { id_solicitud: solicitud.id_solicitud },
                select: { id_solicitud: true }
            });
            if (existente) throw new ErrorIntegracion("DUPLICADO", "La solicitud ya existe");

            await asegurarPaciente(
                tx,
                { rut: paciente.rut, nombre: paciente.nombre, centro_id: solicitud.centro_id },
                { actualizarContacto: false }
            );

            await tx.solicitud.create({
                data: {
                    id_solicitud: solicitud.id_solicitud,
                    fecha_inicio: ahora,
                    fecha_validacion: ahora,
                    rut_usuario: paciente.rut,
                    tipo_solicitud_id: solicitud.tipo_solicitud_id,
                    motivo_id: solicitud.motivo_id,
                    descripcion: solicitud.descripcion,
                    disponibilidad_llamada: null,
                    priorizacion_admin: 2,
                    ultimo_control: null,
                    centro_id: solicitud.centro_id,
                    estado_solicitud: "En Curso",
                    accion: validada ? "Realizar solicitud" : "En espera de validación",
                    rut_orientador: RUT_FUNCIONARIO_DI,
                    rut_gestor: RUT_FUNCIONARIO_DI
                }
            });

            if (validada && cita) {
                await tx.cita.create({
                    data: {
                        id_cita: solicitud.id_solicitud,
                        solicitud_id: solicitud.id_solicitud,
                        rut_usuario: paciente.rut,
                        tipo_prestacion: "Agendar una hora con profesional",
                        profesional_id: cita.profesional_id,
                        prestacion_id: cita.prestacion_id,
                        fecha_estimada_atencion: cita.fecha_estimada_atencion,
                        observacion: cita.observacion,
                        estado_cita: "Sin llamadas",
                        priorizacion_clinica: "Media",
                        priorizacion: 60,
                        centro_id: solicitud.centro_id,
                        fecha_creacion: ahora
                    }
                });
            }
        });
        return { ok: true, data: { id_solicitud: solicitud.id_solicitud } };
    } catch (error) {
        return aResultado(error);
    }
}
