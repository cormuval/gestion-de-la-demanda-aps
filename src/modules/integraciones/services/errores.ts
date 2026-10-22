// lib
import { Prisma } from "@prisma/client";

// types
import type { CodigoErrorIntegracion, ResultadoIntegracion } from "../types/integraciones";

// Error de negocio de los servicios de integracion; se traduce a ResultadoIntegracion en el borde.
export class ErrorIntegracion extends Error {
    codigo: CodigoErrorIntegracion;

    constructor(codigo: CodigoErrorIntegracion, mensaje: string) {
        super(mensaje);
        this.name = "ErrorIntegracion";
        this.codigo = codigo;
    }
}

export function aResultado(error: unknown): ResultadoIntegracion {
    if (error instanceof ErrorIntegracion) {
        return { ok: false, codigo: error.codigo, error: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { ok: false, codigo: "DUPLICADO", error: "La solicitud ya existe" };
    }
    console.error("[integraciones] error inesperado:", error);
    return { ok: false, codigo: "INTERNO", error: "Error interno del servidor" };
}
