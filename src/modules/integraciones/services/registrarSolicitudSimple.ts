// lib
import { prisma } from "@/shared/lib/prisma";

// services
import { verificarCatalogos } from "./catalogos";
import { aResultado, ErrorIntegracion } from "./errores";
import { asegurarPaciente } from "./paciente";

// types
import type { SolicitudSimple } from "../schemas/simple.schema";
import type { ResultadoIntegracion } from "../types/integraciones";

const RUT_ORIENTADOR_SIMPLE = "11111112-3";

export async function registrarSolicitudSimple(datos: SolicitudSimple): Promise<ResultadoIntegracion> {
    try {
        await prisma.$transaction(async (tx) => {
            await verificarCatalogos(tx, {
                tipo_solicitud_id: datos.tipo_solicitud_id,
                motivo_id: datos.motivo_id,
                rut_funcionario: RUT_ORIENTADOR_SIMPLE
            });

            const existente = await tx.solicitud.findUnique({
                where: { id_solicitud: datos.id_solicitud },
                select: { id_solicitud: true }
            });
            if (existente) throw new ErrorIntegracion("DUPLICADO", "La solicitud ya existe");

            await asegurarPaciente(
                tx,
                { rut: datos.rut_usuario, nombre: null, centro_id: datos.centro_id, telefono: datos.telefono, correo: datos.correo },
                { actualizarContacto: true }
            );

            await tx.solicitud.create({
                data: {
                    id_solicitud: datos.id_solicitud,
                    fecha_inicio: datos.fecha_inicio,
                    rut_usuario: datos.rut_usuario,
                    tipo_solicitud_id: datos.tipo_solicitud_id,
                    motivo_id: datos.motivo_id,
                    descripcion: datos.descripcion,
                    disponibilidad_llamada: datos.disponibilidad_llamada,
                    priorizacion_admin: datos.priorizacion_admin,
                    centro_id: datos.centro_id,
                    estado_solicitud: "En Curso",
                    accion: "En espera de validación",
                    rut_orientador: RUT_ORIENTADOR_SIMPLE,
                    rut_gestor: null,
                    fecha_validacion: null
                }
            });
        });
        return { ok: true, data: { id_solicitud: datos.id_solicitud } };
    } catch (error) {
        return aResultado(error);
    }
}
