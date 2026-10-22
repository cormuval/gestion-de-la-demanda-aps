// lib
import { z } from "zod";

// Texto vacio o ausente -> null; si no, el texto sin espacios en los bordes.
export function vacioANull(valor: unknown): string | null {
    if (valor === null || valor === undefined) return null;
    const limpio = String(valor).trim();
    return limpio === "" ? null : limpio;
}

// Texto opcional: vacio -> null y recortado (si hay maximo) al largo de la columna para no perder el registro al insertar.
export function textoTruncado(maximo?: number) {
    return z
        .unknown()
        .transform((valor) => vacioANull(valor)?.slice(0, maximo) ?? null)
        .pipe(z.string().nullable());
}

const FORMATO_CHILE = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
});

// Algoritmo copiado de prisma/scripts/migracion-appsheet/reglas.ts (la app no depende de los scripts).
function desfaseChileMs(instante: number): number {
    const partes = Object.fromEntries(FORMATO_CHILE.formatToParts(new Date(instante)).map((p) => [p.type, p.value]));
    const comoUtc = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
    return comoUtc - (instante - (instante % 1000));
}

const PATRON_HORA_CHILE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

// Interpreta "YYYY-MM-DD HH:mm:ss" como hora de America/Santiago (con cambio de hora) y devuelve el instante real.
export function instanteDesdeHoraChile(texto: string): Date | null {
    const m = PATRON_HORA_CHILE.exec(texto);
    if (m === null) return null;
    const [anio, mes, dia, hora, minuto, segundo] = m.slice(1).map(Number);
    const pared = Date.UTC(anio, mes - 1, dia, hora, minuto, segundo);
    const normalizada = new Date(pared);
    // Rechaza fechas imposibles (mes 13, 31 de febrero, hora 25) que Date.UTC desbordaria en silencio.
    if (
        normalizada.getUTCFullYear() !== anio ||
        normalizada.getUTCMonth() !== mes - 1 ||
        normalizada.getUTCDate() !== dia ||
        normalizada.getUTCHours() !== hora ||
        normalizada.getUTCMinutes() !== minuto ||
        normalizada.getUTCSeconds() !== segundo
    ) {
        return null;
    }
    const desfase = desfaseChileMs(pared);
    const candidato = pared - desfase;
    if (desfaseChileMs(candidato) === desfase) return new Date(candidato);
    // Cerca de un cambio de hora: se reintenta con el desfase del candidato.
    const ajustado = pared - desfaseChileMs(candidato);
    // Si tampoco calza, la hora no existe (salto de septiembre) y se corre hacia adelante.
    return new Date(desfaseChileMs(ajustado) === desfaseChileMs(candidato) ? ajustado : candidato);
}
