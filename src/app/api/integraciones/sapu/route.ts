// lib
import { procesarCargaIntegracion } from "@/modules/integraciones/lib/responder";
import { registrarCargaSapu } from "@/modules/integraciones/services/registrarCargaSapu";
// schemas
import { cargaSapuSchema } from "@/modules/integraciones/schemas/sapu.schema";

// Carga por lote de solicitudes desde SAPU: responde 200 con el resultado de cada fila.
export async function POST(request: Request) {
    return procesarCargaIntegracion(request, {
        cliente: "SAPU",
        ruta: "/api/integraciones/sapu",
        schema: cargaSapuSchema,
        registrar: (datos) => registrarCargaSapu(datos.solicitudes),
        detalle: (datos, r) =>
            `${datos.archivo ?? "sin archivo"} creadas=${r.totales.creadas} duplicadas=${r.totales.duplicadas} rechazadas=${r.totales.rechazadas}`
    });
}
