// lib
import { prisma } from "@/shared/lib/prisma";

// services
import { verificarCatalogos } from "./catalogos";
import { aResultado, ErrorIntegracion } from "./errores";
import { asegurarPaciente, type Tx } from "./paciente";

// types
import type { Contrarreferencia } from "../schemas/contrarreferencia.schema";
import type { ResultadoIntegracion } from "../types/integraciones";

const RUT_FUNCIONARIO_CR = "11111111-1";
const TIPO_SOLICITUD_CR = 18;

// Hay otra solicitud con el mismo "Registro Contrarreferencia ID: n" (el separador evita que 43 calce con 4321).
async function existePorDescripcion(tx: Tx, contrarreferenciaId: number): Promise<boolean> {
    const marca = `Registro Contrarreferencia ID: ${contrarreferenciaId}`;
    const candidatas = await tx.solicitud.findMany({
        where: { tipo_solicitud_id: TIPO_SOLICITUD_CR, descripcion: { contains: marca } },
        select: { descripcion: true }
    });
    const patron = new RegExp(`${marca}( \\||$)`);
    return candidatas.some((s) => patron.test(s.descripcion ?? ""));
}

export async function registrarContrarreferencia(datos: Contrarreferencia): Promise<ResultadoIntegracion> {
    const { paciente, solicitud, cita } = datos;
    const validada = datos.modo === "validada";

    try {
        await prisma.$transaction(async (tx) => {
            await verificarCatalogos(tx, {
                tipo_solicitud_id: TIPO_SOLICITUD_CR,
                motivo_id: null,
                rut_funcionario: RUT_FUNCIONARIO_CR,
                profesional_id: cita?.profesional_id,
                prestacion_id: cita?.prestacion_id
            });

            const existente = await tx.solicitud.findUnique({
                where: { id_solicitud: solicitud.id_solicitud },
                select: { id_solicitud: true }
            });
            if (existente || (await existePorDescripcion(tx, datos.contrarreferencia_id))) {
                throw new ErrorIntegracion("DUPLICADO", "La solicitud ya existe");
            }

            await asegurarPaciente(
                tx,
                {
                    rut: paciente.rut,
                    nombre: paciente.nombre,
                    apellido: paciente.apellido,
                    centro_id: solicitud.centro_id,
                    telefono: paciente.telefono
                },
                { actualizarContacto: true }
            );

            await tx.solicitud.create({
                data: {
                    id_solicitud: solicitud.id_solicitud,
                    fecha_inicio: solicitud.fecha_inicio,
                    fecha_validacion: validada ? solicitud.fecha_inicio : null,
                    rut_usuario: paciente.rut,
                    tipo_solicitud_id: TIPO_SOLICITUD_CR,
                    motivo_id: null,
                    descripcion: solicitud.descripcion,
                    disponibilidad_llamada: "AM/PM",
                    priorizacion_admin: 3.6,
                    ultimo_control: null,
                    centro_id: solicitud.centro_id,
                    estado_solicitud: "En Curso",
                    accion: validada ? "Realizar solicitud" : "En espera de validación",
                    rut_orientador: RUT_FUNCIONARIO_CR,
                    rut_gestor: RUT_FUNCIONARIO_CR
                }
            });

            if (validada && cita) {
                await tx.cita.create({
                    data: {
                        id_cita: cita.id_cita,
                        solicitud_id: solicitud.id_solicitud,
                        rut_usuario: paciente.rut,
                        rut_gestor: RUT_FUNCIONARIO_CR,
                        tipo_prestacion: "Agendar una hora con profesional",
                        profesional_id: cita.profesional_id,
                        prestacion_id: cita.prestacion_id,
                        fecha_estimada_atencion: cita.fecha_estimada_atencion,
                        observacion: cita.observacion,
                        estado_cita: "Sin llamadas",
                        priorizacion_clinica: "Alta",
                        priorizacion: 80,
                        centro_id: solicitud.centro_id,
                        fecha_creacion: solicitud.fecha_inicio
                    }
                });
            }
        });
        return { ok: true, data: { id_solicitud: solicitud.id_solicitud } };
    } catch (error) {
        return aResultado(error);
    }
}
