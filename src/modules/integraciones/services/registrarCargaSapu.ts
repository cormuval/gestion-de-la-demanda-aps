// lib
import { prisma } from "@/shared/lib/prisma";

// services
import { verificarCatalogos } from "./catalogos";
import { aResultado, ErrorIntegracion } from "./errores";
import { asegurarPaciente } from "./paciente";

// schemas
import { filaSapuSchema, type FilaSapu } from "../schemas/sapu.schema";

// types
import type { ResultadoCargaIntegracion, ResultadoFilaIntegracion } from "../types/integraciones";

const TIPO_SOLICITUD_SAPU = 17;
const RUT_FUNCIONARIO_SAPU = "11111112-3";

// id_solicitud informado en la fila cruda, aunque otra regla de la fila falle.
function idDeFilaCruda(fila: unknown): string | null {
    if (typeof fila !== "object" || fila === null) return null;
    const id = (fila as Record<string, unknown>).id_solicitud;
    if (typeof id !== "string") return null;
    const recortado = id.trim();
    return recortado === "" ? null : recortado;
}

async function registrarFila(datos: FilaSapu): Promise<ResultadoFilaIntegracion["estado"] | { rechazo: string }> {
    try {
        await prisma.$transaction(async (tx) => {
            await verificarCatalogos(tx, {
                tipo_solicitud_id: TIPO_SOLICITUD_SAPU,
                motivo_id: datos.motivo_id,
                rut_funcionario: RUT_FUNCIONARIO_SAPU
            });

            const existente = await tx.solicitud.findUnique({
                where: { id_solicitud: datos.id_solicitud },
                select: { id_solicitud: true }
            });
            if (existente) throw new ErrorIntegracion("DUPLICADO", "La solicitud ya existe");

            await asegurarPaciente(
                tx,
                { rut: datos.paciente.rut, nombre: datos.paciente.nombre, apellido: "", centro_id: datos.centro_id },
                { actualizarContacto: false }
            );

            await tx.solicitud.create({
                data: {
                    id_solicitud: datos.id_solicitud,
                    fecha_inicio: datos.fecha_inicio,
                    fecha_validacion: null,
                    rut_usuario: datos.paciente.rut,
                    tipo_solicitud_id: TIPO_SOLICITUD_SAPU,
                    motivo_id: datos.motivo_id,
                    descripcion: datos.descripcion,
                    disponibilidad_llamada: "AM/PM",
                    priorizacion_admin: 3.6,
                    ultimo_control: null,
                    centro_id: datos.centro_id,
                    estado_solicitud: "En Curso",
                    accion: "En espera de validación",
                    rut_orientador: RUT_FUNCIONARIO_SAPU,
                    rut_gestor: RUT_FUNCIONARIO_SAPU
                }
            });
        });
        return "creada";
    } catch (error) {
        const resultado = aResultado(error);
        if (resultado.ok) return "creada";
        if (resultado.codigo === "DUPLICADO") return "duplicada";
        return { rechazo: resultado.codigo === "CATALOGO" ? resultado.error : "Error interno" };
    }
}

// Una transaccion por fila y en serie: una fila rechazada no afecta a las demas del lote.
export async function registrarCargaSapu(filas: unknown[]): Promise<ResultadoCargaIntegracion> {
    const resultados: ResultadoFilaIntegracion[] = [];

    for (let indice = 0; indice < filas.length; indice++) {
        const cruda = filas[indice];
        const id_solicitud = idDeFilaCruda(cruda);
        const parseo = filaSapuSchema.safeParse(cruda);

        if (!parseo.success) {
            const primero = parseo.error.issues[0];
            resultados.push({
                indice,
                id_solicitud,
                estado: "rechazada",
                error: `${primero.path.join(".")}: ${primero.message}`
            });
            continue;
        }

        const estado = await registrarFila(parseo.data);
        if (typeof estado === "string") {
            resultados.push({ indice, id_solicitud: parseo.data.id_solicitud, estado });
        } else {
            resultados.push({ indice, id_solicitud: parseo.data.id_solicitud, estado: "rechazada", error: estado.rechazo });
        }
    }

    const cuenta = (e: ResultadoFilaIntegracion["estado"]) => resultados.filter((r) => r.estado === e).length;
    return {
        resultados,
        totales: { creadas: cuenta("creada"), duplicadas: cuenta("duplicada"), rechazadas: cuenta("rechazada") }
    };
}
