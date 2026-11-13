// lib
import { NextResponse } from "next/server";
import { AuditLogger } from "@/shared/lib/logger";
import { prisma } from "@/shared/lib/prisma";
import { encabezadosCors, ipDe, limitadorVerificar, responder } from "@/modules/solicitud-web/lib/http";
import { consultarPercapita } from "@/modules/solicitud-web/lib/percapita";
import { firmarToken } from "@/modules/solicitud-web/lib/token";
import { verificarCaptcha } from "@/modules/solicitud-web/lib/turnstile";
// schemas
import { verificarSchema } from "@/modules/solicitud-web/schemas/solicitudWeb.schema";
// services
import { tiposHabilitados } from "@/modules/solicitud-web/services/tiposHabilitados";

export function OPTIONS(request: Request): NextResponse {
    return new NextResponse(null, { status: 204, headers: encabezadosCors(request) });
}

export async function POST(request: Request): Promise<NextResponse> {
    let rut = "-";
    async function finalizar(cuerpo: unknown, status: number, ok = false, sufijo = ""): Promise<NextResponse> {
        await AuditLogger.logDataAccess("SEARCH", ok, { name: "Formulario web" }, "solicitudes", {
            details: `/api/publico/solicitud-hora/verificar rut=${rut} → ${status}${sufijo}`
        });
        return responder(request, cuerpo, status);
    }
    try {
        const ip = ipDe(request);
        if (!limitadorVerificar.permitir(ip ?? "sin-ip")) return responder(request, { error: "LIMITE" }, 429);
        let cuerpo: unknown;
        if (Number(request.headers.get("content-length")) > 16384) return finalizar({ error: "DATOS" }, 413);
        try {
            const texto = await request.text();
            if (texto.length > 16384) return finalizar({ error: "DATOS" }, 413);
            cuerpo = JSON.parse(texto);
        } catch { return finalizar({ error: "RUT" }, 400); }
        const secreto = process.env.SOLICITUD_WEB_TOKEN_SECRET;
        if (!secreto) return finalizar({ ok: false, motivo: "NO_DISPONIBLE" }, 200, false, " sin secreto");
        const captcha = verificarSchema.shape.captcha.safeParse(
            typeof cuerpo === "object" && cuerpo !== null && "captcha" in cuerpo ? cuerpo.captcha : undefined
        );
        if (!captcha.success || !await verificarCaptcha(captcha.data, ip)) return finalizar({ error: "CAPTCHA" }, 400);
        const validacion = verificarSchema.safeParse(cuerpo);
        if (!validacion.success) return finalizar({ error: "RUT" }, 400);
        rut = validacion.data.rut;
        const resultado = await consultarPercapita(rut);
        if (resultado.estado !== "INSCRITO") return finalizar({ ok: false, motivo: resultado.estado }, 200);
        const centro_id = resultado.paciente.centro_id;
        const centro = await prisma.centro.findUnique({ where: { id_centro: centro_id }, select: { id_centro: true } });
        if (!centro) return finalizar({ ok: false, motivo: "NO_INSCRITO" }, 200, false, " sin centro");
        const tipos = await tiposHabilitados(centro_id);
        const token = firmarToken({ rut, centro_id, exp: Date.now() + 20 * 60_000 }, secreto);
        return finalizar({ ok: true, token, tipos }, 200, true);
    } catch {
        return finalizar({ ok: false, motivo: "NO_DISPONIBLE" }, 200);
    }
}
