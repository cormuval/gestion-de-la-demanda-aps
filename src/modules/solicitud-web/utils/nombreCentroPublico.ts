// Los nombres de `centros` vienen con el prefijo completo y, a veces, sin espacio
// antes del nombre propio. El formulario web muestra una versión legible.
const REEMPLAZOS: ReadonlyArray<[RegExp, string]> = [
    [/^centro comunitario de salud familiar\s*/i, "CECOSF "],
    [/^centro de salud familiar\s*/i, "CESFAM "]
];

const SUFIJO_CIUDAD = /\s*\(\s*valpara[ií]so\s*\)\s*$/i;

export function nombreCentroPublico(nombre: string | null | undefined): string | null {
    const original = nombre?.trim();
    if (!original) return null;

    let resultado = original.replace(/\s+/g, " ").trim().replace(SUFIJO_CIUDAD, "");
    for (const [patron, reemplazo] of REEMPLAZOS) resultado = resultado.replace(patron, reemplazo);
    return resultado.replace(/\s+/g, " ").trim() || null;
}
