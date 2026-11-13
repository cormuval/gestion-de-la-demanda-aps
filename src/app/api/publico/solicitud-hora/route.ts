// lib
import { NextResponse } from "next/server";
import { AuditLogger } from "@/shared/lib/logger";
import { encabezadosCors, ipDe, limitadorEnvio, responder } from "@/modules/solicitud-web/lib/http";
import { consultarPercapita } from "@/modules/solicitud-web/lib/percapita";
import { verificarToken } from "@/modules/solicitud-web/lib/token";
// schemas
import { envioSchema } from "@/modules/solicitud-web/schemas/solicitudWeb.schema";
// services
import { tiposHabilitados } from "@/modules/solicitud-web/services/tiposHabilitados";
import { registrarSolicitudWeb } from "@/modules/solicitud-web/services/registrarSolicitudWeb";

export function OPTIONS(request: Request): NextResponse {
    return new NextResponse(null, { status: 204, headers: encabezadosCors(request) });
}

export async function POST(request: Request): Promise<NextResponse> {
    let rut = "-";
    async function finalizar(cuerpo: unknown, status: number, ok = false, sufijo = ""): Promise<NextResponse> {
        await AuditLogger.logDataAccess("CREATE", ok, { name: "Formulario web" }, "solicitudes", {
            details: `/api/publico/solicitud-hora rut=${rut} → ${status}${sufijo}`
        });
        return responder(request, cuerpo, status);
    }
    try {
        if (!limitadorEnvio.permitir(ipDe(request) ?? "sin-ip")) return finalizar({ error: "LIMITE" }, 429);
        let cuerpo: unknown;
        try { cuerpo = await request.json(); } catch { return finalizar({ error: "DATOS", campos: [] }, 400); }
        const objeto = typeof cuerpo === "object" && cuerpo !== null && !Array.isArray(cuerpo) ? cuerpo : {};
        if ("sitio_web" in objeto && typeof objeto.sitio_web === "string" && objeto.sitio_web.length > 0) {
            return finalizar({ ok: true }, 201, true, " trampa");
        }
        const token = "token" in objeto && typeof objeto.token === "string" ? objeto.token : "";
        const payload = verificarToken(token, process.env.SOLICITUD_WEB_TOKEN_SECRET ?? "");
        if (!payload) return finalizar({ error: "TOKEN" }, 400);
        rut = payload.rut;
        const validacion = envioSchema.safeParse(cuerpo);
        if (!validacion.success) {
            const campos = [...new Set(validacion.error.issues.map((issue) => String(issue.path[0])))];
            return finalizar({ error: "DATOS", campos }, 400);
        }
        const envio = validacion.data;
        const tipos = await tiposHabilitados(payload.centro_id);
        if (!tipos.some((tipo) => tipo.id === envio.tipo_solicitud_id)) {
            return finalizar({ error: "DATOS", campos: ["tipo_solicitud_id"] }, 400);
        }
        const resultado = await consultarPercapita(rut);
        if (resultado.estado !== "INSCRITO") return finalizar({ error: "NO_DISPONIBLE" }, 503);
        const registro = await registrarSolicitudWeb({ rut, centro_id: payload.centro_id, envio, percapita: resultado.paciente });
        if (!registro.ok) return finalizar({ error: "INTERNO" }, 500);
        return finalizar({ ok: true }, 201, true, registro.estado === "DUPLICADA" ? " duplicada" : "");
    } catch {
        return finalizar({ error: "INTERNO" }, 500);
    }
}
