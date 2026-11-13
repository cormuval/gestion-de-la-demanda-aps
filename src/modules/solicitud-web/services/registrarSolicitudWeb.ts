// lib
import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/lib/prisma";

// services
import { verificarCatalogos } from "@/modules/integraciones/services/catalogos";
import { ErrorIntegracion } from "@/modules/integraciones/services/errores";

// types
import type { EnvioSolicitudWeb } from "../schemas/solicitudWeb.schema";
import type { PacientePercapita } from "../types/solicitudWeb";

export const RUT_ORIENTADOR_WEB = "11111113-8";

export type ResultadoSolicitudWeb =
    | { ok: true; estado: "CREADA"; id_solicitud: string }
    | { ok: true; estado: "DUPLICADA" }
    | { ok: false; codigo: "CATALOGO" | "INTERNO"; error: string };

interface EntradaSolicitudWeb {
    rut: string;
    centro_id: string;
    envio: EnvioSolicitudWeb;
    percapita: PacientePercapita;
    ahora?: Date;
}

export async function registrarSolicitudWeb(entrada: EntradaSolicitudWeb): Promise<ResultadoSolicitudWeb> {
    const { rut, centro_id, envio, percapita } = entrada;
    try {
        return await prisma.$transaction(async (tx): Promise<ResultadoSolicitudWeb> => {
            await verificarCatalogos(tx, {
                tipo_solicitud_id: envio.tipo_solicitud_id,
                motivo_id: null,
                rut_funcionario: RUT_ORIENTADOR_WEB
            });

            // Riesgo aceptado: findFirst no excluye duplicados de envíos simultáneos.
            const duplicada = await tx.solicitud.findFirst({
                where: { rut_usuario: rut, tipo_solicitud_id: envio.tipo_solicitud_id, estado_solicitud: "En Curso" }
            });
            if (duplicada) return { ok: true, estado: "DUPLICADA" };

            const paciente = await tx.usuario.findUnique({ where: { rut } });
            const contacto = {
                nombre_social: envio.nombre_social,
                telefono: envio.telefono,
                telefono_alternativo: envio.telefono_alternativo,
                correo_contacto: envio.correo,
                discapacidad: envio.discapacidad
            };
            let descripcion = envio.descripcion;
            if (!paciente) {
                await tx.usuario.create({
                    data: {
                        rut,
                        nombre: percapita.nombre,
                        apellido: percapita.apellido.trim().slice(0, 50),
                        fecha_nacimiento: percapita.fecha_nacimiento,
                        genero: percapita.genero,
                        centro_id,
                        ...contacto
                    }
                });
            } else {
                const faltantes: Partial<Record<keyof typeof contacto, string | null>> = {};
                for (const campo of Object.keys(contacto) as Array<keyof typeof contacto>) {
                    if ((paciente[campo] === null || paciente[campo] === "") && contacto[campo] !== null) {
                        faltantes[campo] = contacto[campo];
                    }
                }
                if (Object.keys(faltantes).length > 0) {
                    await tx.usuario.update({ where: { rut }, data: faltantes });
                }
                if (paciente.telefono && paciente.telefono !== envio.telefono) {
                    descripcion += `\n\nTeléfono indicado en el formulario web: ${envio.telefono}`;
                }
            }

            const id_solicitud = `WEB-${randomUUID().replaceAll("-", "")}`.slice(0, 50);
            await tx.solicitud.create({
                data: {
                    id_solicitud,
                    fecha_inicio: entrada.ahora ?? new Date(),
                    rut_usuario: rut,
                    tipo_solicitud_id: envio.tipo_solicitud_id,
                    motivo_id: null,
                    descripcion,
                    disponibilidad_llamada: envio.disponibilidad_llamada,
                    centro_id,
                    estado_solicitud: "En Curso",
                    accion: "En espera de validación",
                    rut_orientador: RUT_ORIENTADOR_WEB,
                    rut_gestor: null,
                    fecha_validacion: null
                }
            });
            return { ok: true, estado: "CREADA", id_solicitud };
        });
    } catch (error) {
        if (error instanceof ErrorIntegracion && error.codigo === "CATALOGO") {
            return { ok: false, codigo: "CATALOGO", error: error.message };
        }
        console.error(error instanceof Error ? error.name : "Error");
        return { ok: false, codigo: "INTERNO", error: "Error interno del servidor" };
    }
}
