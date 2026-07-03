import { z } from "zod";
// utils
import { CENTRO_TIPO_SOLICITUD_COLUMNAS } from "@/modules/catalogos/utils/centroTipoSolicitud";
import { esRutChilenoValido, normalizarRut } from "@/modules/solicitudes/utils/rut";

export const ESTADOS_BINARIOS = ["1", "0"] as const;
export const ESTADOS_ACTIVO = ["Activo", "Inactivo"] as const;
export const PROGRAMAS_FUNCIONARIO = ["Programa cardiovascular", "Programa respiratorio", "Programa salud mental"] as const;
export const CENTRO_COLUMNAS = CENTRO_TIPO_SOLICITUD_COLUMNAS;

const idOptionalSchema = z.preprocess((value) => (value === "" || value === null || value === undefined ? undefined : value), z.coerce.number().int().positive().optional());

export const centrosEstadoSchema = z.record(z.enum(CENTRO_COLUMNAS), z.enum(ESTADOS_BINARIOS)).default(
    CENTRO_COLUMNAS.reduce(
        (acc, columna) => {
            acc[columna] = "0";
            return acc;
        },
        {} as Record<(typeof CENTRO_COLUMNAS)[number], (typeof ESTADOS_BINARIOS)[number]>
    )
);

export const tipoSolicitudConfigSchema = z.object({
    id_tipo_solicitud: idOptionalSchema,
    nombre_tipo_solicitud: z.string().trim().min(1, "Nombre requerido").max(50, "Maximo 50 caracteres"),
    estado: z.enum(ESTADOS_BINARIOS),
    centros: centrosEstadoSchema
});

export const motivoConfigSchema = z.object({
    id_motivo: idOptionalSchema,
    tipo_solicitud_id: z.coerce.number().int().positive("Tipo solicitud requerido"),
    nombre_motivo: z.string().trim().min(1, "Motivo requerido").max(150, "Maximo 150 caracteres"),
    estado: z.enum(ESTADOS_BINARIOS)
});

export const rolConfigSchema = z.object({
    id_rol: idOptionalSchema,
    nombre_rol: z.string().trim().min(1, "Nombre requerido").max(50, "Maximo 50 caracteres"),
    estado: z.enum(ESTADOS_ACTIVO)
});

export const profesionalConfigSchema = z.object({
    id_profesional: idOptionalSchema,
    nombre: z.string().trim().min(1, "Nombre requerido").max(50, "Maximo 50 caracteres"),
    estado: z.enum(ESTADOS_ACTIVO),
    centros: centrosEstadoSchema
});

export const prestacionConfigSchema = z.object({
    id_prestacion: idOptionalSchema,
    profesional_id: z.coerce.number().int().positive("Profesional requerido"),
    nombre_prestacion: z.string().trim().min(1, "Prestacion requerida").max(100, "Maximo 100 caracteres"),
    estado: z.enum(ESTADOS_ACTIVO)
});

export const funcionarioConfigSchema = z.object({
    rut: z
        .string()
        .trim()
        .min(1, "RUT requerido")
        .refine(esRutChilenoValido, "RUT invalido")
        .transform(normalizarRut),
    email: z.string().trim().email("Email invalido").max(100, "Maximo 100 caracteres"),
    nombre: z.string().trim().min(1, "Nombre requerido").max(50, "Maximo 50 caracteres"),
    rol_id: z.coerce.number().int().positive("Rol requerido"),
    centro_id: z.string().trim().min(1, "Centro requerido").max(50, "Maximo 50 caracteres"),
    programa_asociado: z.enum(PROGRAMAS_FUNCIONARIO),
    estado: z.enum(ESTADOS_ACTIVO)
});

export interface ConfiguracionFiltros {
    search?: string;
}

export type TipoSolicitudConfigInput = z.input<typeof tipoSolicitudConfigSchema>;
export type TipoSolicitudConfigData = z.output<typeof tipoSolicitudConfigSchema>;
export type MotivoConfigInput = z.input<typeof motivoConfigSchema>;
export type RolConfigInput = z.input<typeof rolConfigSchema>;
export type ProfesionalConfigInput = z.input<typeof profesionalConfigSchema>;
export type PrestacionConfigInput = z.input<typeof prestacionConfigSchema>;
export type FuncionarioConfigInput = z.input<typeof funcionarioConfigSchema>;
