// lib
import { z } from "zod";

// utils
import { fechaHoraChile, textoTruncado } from "../utils/normalizacion";

export const MAX_LOTE_SAPU = 500;

// Lote: las filas no se validan aqui, se validan una a una para informar el error por fila.
export const cargaSapuSchema = z.object({
    archivo: textoTruncado(150).optional().default(null),
    solicitudes: z.array(z.unknown()).min(1).max(MAX_LOTE_SAPU)
});

export const filaSapuSchema = z.object({
    id_solicitud: z.string().trim().min(1).max(50),
    fecha_inicio: fechaHoraChile,
    paciente: z.object({
        rut: z.string().trim().min(1).max(50),
        nombre: textoTruncado(50).optional().default(null)
    }),
    motivo_id: z.number().int(),
    descripcion: textoTruncado(),
    centro_id: z
        .union([z.number(), z.string()])
        .transform((valor) => String(valor).trim())
        .pipe(z.string().min(1))
});

export type CargaSapu = z.output<typeof cargaSapuSchema>;
export type FilaSapu = z.output<typeof filaSapuSchema>;
