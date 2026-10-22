// lib
import { procesarIntegracion } from "@/modules/integraciones/lib/responder";
import { registrarContrarreferencia } from "@/modules/integraciones/services/registrarContrarreferencia";
// schemas
import { contrarreferenciaSchema } from "@/modules/integraciones/schemas/contrarreferencia.schema";

// Registro de contrarreferencias desde Google Apps Script (cliente CONTRARREFERENCIA).
export async function POST(request: Request) {
    return procesarIntegracion(request, {
        cliente: "CONTRARREFERENCIA",
        ruta: "/api/integraciones/contrarreferencia",
        schema: contrarreferenciaSchema,
        registrar: (datos) => registrarContrarreferencia(datos),
        detalle: (datos) => `${datos.solicitud.id_solicitud} cr=${datos.contrarreferencia_id} ${datos.modo}`
    });
}
