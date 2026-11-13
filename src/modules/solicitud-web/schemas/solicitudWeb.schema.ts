// lib
import { z } from "zod";
// utils
import { esRutChilenoValido, normalizarRut } from "@/modules/solicitudes/utils/rut";
import { normalizarTelefono } from "../utils/telefono";

export const OPCIONES_DISCAPACIDAD = [
    "Tengo credencial de discapacidad",
    "Cuido de forma principal a una persona con discapacidad",
    "Ninguna de las anteriores"
] as const;

export const verificarSchema = z.object({
    rut: z.string().max(20)
        .pipe(z.string().transform(normalizarRut).refine(esRutChilenoValido, "Ingresa un RUT válido")),
    captcha: z.string().min(1, "Completa la verificación").max(2048)
});

const telefonoSchema = z.string().max(30)
    .transform(normalizarTelefono)
    .refine((telefono): telefono is string => telefono !== null, "Ingresa un teléfono válido");

function vacioANull(valor: unknown): unknown {
    return valor === undefined || (typeof valor === "string" && valor.trim() === "") ? null : valor;
}

export const envioSchema = z.object({
    token: z.string().min(1, "Falta el token de verificación").max(512),
    nombre_social: z.preprocess(vacioANull, z.string().trim().max(50).nullable()),
    telefono: telefonoSchema,
    telefono_alternativo: z.string().max(30).nullable().optional()
        .pipe(z.preprocess(vacioANull, telefonoSchema.nullable())),
    correo: z.preprocess(vacioANull, z.string().trim().email().max(100).nullable()),
    discapacidad: z.enum(OPCIONES_DISCAPACIDAD),
    tipo_solicitud_id: z.union([
        z.number(),
        z.string().max(10).regex(/^\d+$/).transform(Number)
    ]).pipe(z.number().int().min(1).max(2147483647)),
    descripcion: z.string().trim().min(10).max(1000),
    disponibilidad_llamada: z.enum(["AM", "PM", "AM/PM"]),
    sitio_web: z.string().max(200).optional()
});

export type EnvioSolicitudWeb = z.infer<typeof envioSchema>;
