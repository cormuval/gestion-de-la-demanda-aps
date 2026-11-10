import { z } from "zod";
// lib
import { textoBusquedaSchema } from "@/shared/lib/busquedaTexto";

const textoOpcional = z.string().trim().optional();
const enteroOpcional = (minimo: number) => z.string().trim().refine(
    (valor) => valor === "" || (/^\d+$/.test(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) >= minimo),
    "Debe ser un numero entero valido"
).optional();
const fechaOpcional = z.union([z.string().trim().date("Fecha invalida"), z.literal("")]).optional();

export const solicitudFiltrosSchema = z.object({
    texto: textoBusquedaSchema,
    rut: textoOpcional,
    estado: textoOpcional,
    tipoSolicitudId: enteroOpcional(1),
    motivoId: enteroOpcional(1),
    sector: textoOpcional,
    edadDesde: enteroOpcional(0),
    edadHasta: enteroOpcional(0),
    // Se conserva por compatibilidad; la accion obtiene el centro de la sesion.
    centroId: textoOpcional,
    fechaDesde: fechaOpcional,
    fechaHasta: fechaOpcional,
    page: z.number().int().positive().safe().optional().default(1)
});

export type SolicitudFiltrosValidados = z.output<typeof solicitudFiltrosSchema>;
