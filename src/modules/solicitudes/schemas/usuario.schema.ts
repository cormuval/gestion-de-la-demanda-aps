import { z } from "zod";
// utils
import { esRutChilenoValido, normalizarRut } from "../utils/rut";

export const GENEROS_USUARIO = ["Femenino", "Masculino", "No revelado"] as const;
export const GESTANTE_USUARIO = ["Si", "No", "No aplica"] as const;
export const DISCAPACIDAD_USUARIO = [
    "El usuario no poseé una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
    "El usuario es cuidador(a) principal de una persona con discapacidad.",
    "El usuario poseé una credencial de discapacidad.",
    "El usuario pertenece a la poblacion sename."
] as const;

export const usuarioSolicitudSchema = z.object({
    rut: z
        .string()
        .trim()
        .min(1, "RUT requerido")
        .refine(esRutChilenoValido, "RUT invalido")
        .transform(normalizarRut),
    nombre: z.string().trim().min(1, "Nombre requerido"),
    apellido: z.string().trim().min(1, "Apellido requerido"),
    nombre_social: z.string().trim().optional().default(""),
    correo_contacto: z.string().trim().optional().default(""),
    sector: z.string().trim().optional().default(""),
    genero: z.enum(GENEROS_USUARIO, { required_error: "Genero requerido" }),
    fecha_nacimiento: z
        .string()
        .trim()
        .min(1, "Fecha de nacimiento requerida")
        .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), "Fecha de nacimiento invalida"),
    telefono: z.string().trim().min(1, "Telefono requerido"),
    telefono_alternativo: z.string().trim().min(1, "Telefono alternativo requerido"),
    gestante: z.enum(GESTANTE_USUARIO, { required_error: "Gestante requerido" }),
    discapacidad: z.enum(DISCAPACIDAD_USUARIO, { required_error: "Discapacidad requerida" }),
    centro_id: z.string().trim().min(1, "Centro requerido")
}).transform((data) => ({ ...data, gestante: data.genero === "Femenino" ? data.gestante : "No aplica" }));

export type UsuarioSolicitudInput = z.input<typeof usuarioSolicitudSchema>;
export type UsuarioSolicitudData = z.output<typeof usuarioSolicitudSchema>;
