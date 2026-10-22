// lib
import { procesarIntegracion } from "@/modules/integraciones/lib/responder";
import { registrarSolicitudSimple } from "@/modules/integraciones/services/registrarSolicitudSimple";
// schemas
import { simpleSchema } from "@/modules/integraciones/schemas/simple.schema";

// Registro de solicitudes desde Simple (cliente GI).
export async function POST(request: Request) {
    return procesarIntegracion(request, {
        cliente: "GI",
        ruta: "/api/integraciones/simple",
        schema: simpleSchema,
        registrar: registrarSolicitudSimple,
        detalle: (datos) => datos.id_solicitud
    });
}
