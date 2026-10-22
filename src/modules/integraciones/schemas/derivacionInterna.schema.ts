// lib
import { z } from "zod";

// utils
import { vacioANull } from "../utils/normalizacion";

const idEntero = z.number().int();
const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

// Texto opcional: vacio -> null y recortado (si hay maximo) al largo de la columna para no perder la derivacion al insertar.
function textoTruncado(maximo?: number) {
    return z
        .unknown()
        .transform((valor) => vacioANull(valor)?.slice(0, maximo) ?? null)
        .pipe(z.string().nullable());
}

// "YYYY-MM-DD" -> Date UTC a medianoche (la columna es DATE).
const fechaDia = z.string().transform((texto, ctx) => {
    const m = PATRON_FECHA.exec(texto.trim());
    const fecha = m === null ? null : new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (m === null || fecha === null || fecha.getUTCMonth() !== +m[2] - 1 || fecha.getUTCDate() !== +m[3]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Formato esperado: YYYY-MM-DD" });
        return z.NEVER;
    }
    return fecha;
});

const citaSchema = z.object({
    profesional_id: idEntero,
    prestacion_id: idEntero,
    fecha_estimada_atencion: fechaDia,
    observacion: textoTruncado(500)
});

// Cuerpo que envia la derivacion interna (Google Apps Script).
export const derivacionInternaSchema = z
    .object({
        modo: z.enum(["validada", "pendiente"]),
        paciente: z.object({
            rut: z.string().trim().min(1).max(50),
            nombre: textoTruncado(50).optional().default(null)
        }),
        solicitud: z.object({
            id_solicitud: z.string().trim().min(1).max(50),
            tipo_solicitud_id: idEntero,
            motivo_id: idEntero.nullish().transform((valor) => valor ?? null),
            descripcion: textoTruncado(),
            centro_id: z
                .union([z.number(), z.string()])
                .transform((valor) => String(valor).trim())
                .pipe(z.string().min(1))
        }),
        cita: citaSchema.nullish().transform((valor) => valor ?? null)
    })
    .superRefine((datos, ctx) => {
        if (datos.modo === "validada" && datos.cita === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cita"], message: "La cita es obligatoria si modo es validada" });
        }
        if (datos.modo === "pendiente" && datos.cita !== null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cita"], message: "La cita no se permite si modo es pendiente" });
        }
    });

export type DerivacionInterna = z.output<typeof derivacionInternaSchema>;
