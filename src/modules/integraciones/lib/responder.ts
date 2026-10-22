import { NextResponse } from "next/server";
import type { ZodType } from "zod";

// lib
import { AuditLogger } from "@/shared/lib/logger";
import { autenticarIntegracion } from "./autenticarIntegracion";
// types
import type { ClienteIntegracion, ResultadoCargaIntegracion, ResultadoIntegracion } from "../types/integraciones";

interface OpcionesIntegracion<T> {
    cliente: ClienteIntegracion;
    ruta: string;
    schema: ZodType<T, any, any>;
    registrar: (datos: T) => Promise<ResultadoIntegracion>;
    // Texto para la auditoria: nunca debe incluir datos de contacto ni del paciente.
    detalle: (datos: T) => string;
}

const STATUS_POR_CODIGO = { DUPLICADO: 409, CATALOGO: 422, INTERNO: 500 } as const;

interface OpcionesCargaIntegracion<T> {
    cliente: ClienteIntegracion;
    ruta: string;
    schema: ZodType<T, any, any>;
    registrar: (datos: T) => Promise<ResultadoCargaIntegracion>;
    // Texto para la auditoria: nunca debe incluir datos de contacto ni del paciente.
    detalle: (datos: T, resultado: ResultadoCargaIntegracion) => string;
}

type EntradaValidada<T> = { datos: T } | { respuesta: NextResponse };

// Parte comun: autenticar, leer el JSON y validarlo. Audita los fallos y devuelve la respuesta 403/400.
async function autenticarYValidar<T>(
    request: Request,
    cliente: ClienteIntegracion,
    ruta: string,
    schema: ZodType<T, any, any>,
    usuario: { name: string }
): Promise<EntradaValidada<T>> {
    if (!autenticarIntegracion(request, cliente)) {
        await AuditLogger.logSecurity("CREATE", false, usuario, { details: ruta });
        return { respuesta: NextResponse.json({ Mensaje: "api-key no valida" }, { status: 403 }) };
    }

    let cuerpo: unknown;
    try {
        cuerpo = await request.json();
    } catch {
        await AuditLogger.logDataAccess("CREATE", false, usuario, "solicitudes", { details: ruta });
        return { respuesta: NextResponse.json({ error: "Datos inválidos", detalles: {} }, { status: 400 }) };
    }

    const parsed = schema.safeParse(cuerpo);
    if (!parsed.success) {
        await AuditLogger.logDataAccess("CREATE", false, usuario, "solicitudes", { details: ruta });
        return {
            respuesta: NextResponse.json(
                { error: "Datos inválidos", detalles: parsed.error.flatten().fieldErrors },
                { status: 400 }
            )
        };
    }
    return { datos: parsed.data };
}

// Flujo comun de las rutas de integracion: autenticar, validar, registrar, responder y auditar.
export async function procesarIntegracion<T>(request: Request, opciones: OpcionesIntegracion<T>): Promise<NextResponse> {
    const { cliente, ruta, schema, registrar, detalle } = opciones;
    const usuario = { name: `Integración ${cliente}` };

    const entrada = await autenticarYValidar(request, cliente, ruta, schema, usuario);
    if ("respuesta" in entrada) return entrada.respuesta;

    const resultado = await registrar(entrada.datos);
    const status = resultado.ok ? 201 : STATUS_POR_CODIGO[resultado.codigo];
    await AuditLogger.logDataAccess("CREATE", resultado.ok, usuario, "solicitudes", {
        details: `${ruta} ${detalle(entrada.datos)} → ${status}`
    });

    if (resultado.ok) {
        return NextResponse.json(
            { message: "Solicitud creada con éxito", id_solicitud: resultado.data.id_solicitud },
            { status }
        );
    }
    const error = resultado.codigo === "INTERNO" ? "Error interno del servidor" : resultado.error;
    return NextResponse.json({ error }, { status });
}

// Flujo de las cargas por lote: responde 200 con el resultado por fila y audita solo los totales.
export async function procesarCargaIntegracion<T>(
    request: Request,
    opciones: OpcionesCargaIntegracion<T>
): Promise<NextResponse> {
    const { cliente, ruta, schema, registrar, detalle } = opciones;
    const usuario = { name: `Integración ${cliente}` };

    const entrada = await autenticarYValidar(request, cliente, ruta, schema, usuario);
    if ("respuesta" in entrada) return entrada.respuesta;

    const resultado = await registrar(entrada.datos);
    await AuditLogger.logDataAccess("CREATE", true, usuario, "solicitudes", {
        details: `${ruta} ${detalle(entrada.datos, resultado)} → 200`
    });
    return NextResponse.json(resultado, { status: 200 });
}
