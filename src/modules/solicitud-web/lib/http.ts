// lib
import { NextResponse } from "next/server";
import { crearLimitador } from "./limiteIp";

export const limitadorVerificar = crearLimitador(10, 15 * 60_000);
export const limitadorEnvio = crearLimitador(5, 60 * 60_000);

export function ipDe(request: Request): string | null {
    return request.headers.get("x-real-ip")?.trim()
        || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
        || null;
}

export function encabezadosCors(request: Request): Record<string, string> {
    const origen = request.headers.get("origin");
    const permitidos = process.env.SOLICITUD_WEB_ORIGEN?.split(",").map((valor) => valor.trim()).filter(Boolean) ?? [];
    if (!origen || !permitidos.includes(origen)) return { "Vary": "Origin" };
    return {
        "Access-Control-Allow-Origin": origen,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin"
    };
}

export function responder(request: Request, cuerpo: unknown, status: number): NextResponse {
    return NextResponse.json(cuerpo, { status, headers: encabezadosCors(request) });
}
