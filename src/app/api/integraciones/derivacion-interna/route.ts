// lib
import { procesarIntegracion } from "@/modules/integraciones/lib/responder";
import { registrarDerivacionInterna } from "@/modules/integraciones/services/registrarDerivacionInterna";
// schemas
import { derivacionInternaSchema } from "@/modules/integraciones/schemas/derivacionInterna.schema";

// Registro de derivaciones internas desde Google Apps Script (cliente GAS).
export async function POST(request: Request) {
    return procesarIntegracion(request, {
        cliente: "GAS",
        ruta: "/api/integraciones/derivacion-interna",
        schema: derivacionInternaSchema,
        registrar: (datos) => registrarDerivacionInterna(datos),
        detalle: (datos) => `${datos.solicitud.id_solicitud} ${datos.modo}`
    });
}
