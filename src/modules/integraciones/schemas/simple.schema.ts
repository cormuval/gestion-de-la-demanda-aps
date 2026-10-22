// lib
import { z } from "zod";

// utils
import { instanteDesdeHoraChile, vacioANull } from "../utils/normalizacion";

// Simple puede enviar numeros como texto: se aceptan numeros y cadenas de digitos (recortadas).
const enteroOTexto = z.union([z.number().int(), z.string().trim().regex(/^\d+$/).transform(Number)]);
const numeroOTexto = z.union([z.number(), z.string().trim().regex(/^\d+(\.\d+)?$/).transform(Number)]);
const aNullSiVacio = (valor: unknown) => (valor === undefined || valor === null || (typeof valor === "string" && valor.trim() === "") ? null : valor);
const textoOpcional = z.unknown().transform(vacioANull).pipe(z.string().nullable());

// Cuerpo que envia Simple (contrato v2.2). Los campos fijos del contrato se aceptan y se descartan.
export const simpleSchema = z.object({
    id_solicitud: z.string().trim().min(1).max(50),
    fecha_inicio: z
        .string()
        .transform((texto, ctx) => {
            const instante = instanteDesdeHoraChile(texto.trim());
            if (instante === null) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Formato esperado: YYYY-MM-DD HH:mm:ss" });
                return z.NEVER;
            }
            return instante;
        }),
    rut_usuario: z.string().trim().min(1).max(50),
    tipo_solicitud_id: enteroOTexto,
    motivo_id: z.preprocess(aNullSiVacio, enteroOTexto.nullable()),
    descripcion: textoOpcional,
    disponibilidad_llamada: z.preprocess(
        (valor) => (typeof valor === "string" && valor.trim() === "" ? null : aNullSiVacio(valor)),
        z.enum(["AM", "PM", "AM/PM"]).nullable()
    ),
    priorizacion_admin: z.preprocess(aNullSiVacio, numeroOTexto.nullable()),
    centro_id: z
        .union([z.number(), z.string()])
        .transform((valor) => String(valor).trim())
        .pipe(z.string().min(1)),
    telefono: textoOpcional,
    correo: textoOpcional
});

export type SolicitudSimple = z.output<typeof simpleSchema>;
