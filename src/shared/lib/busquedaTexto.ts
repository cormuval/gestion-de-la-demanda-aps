import { z } from "zod";

export const textoBusquedaSchema = z.string().trim().max(200).optional().default("");

export function escaparTextoLike(texto: string, escape: "!" | "\\"): string {
    return texto.replace(/[!\\%_]/g, (caracter) => caracter === escape || caracter === "%" || caracter === "_" ? `${escape}${caracter}` : caracter);
}
