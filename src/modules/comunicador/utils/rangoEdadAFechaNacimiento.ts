export interface RangoFechaNac {
    gte?: Date;
    lte?: Date;
}

function restarAnios(fecha: Date, anios: number): Date {
    return new Date(fecha.getFullYear() - anios, fecha.getMonth(), fecha.getDate());
}

/**
 * Traduce un rango de edad [edadMin, edadMax] a límites de fecha_nacimiento.
 * - edad >= edadMin  <=>  fecha_nac <= hoy - edadMin años   (lte)
 * - edad <= edadMax  <=>  fecha_nac >= hoy - (edadMax+1) años + 1 día  (gte)
 */
export function rangoEdadAFechaNacimiento(edadMin: number | null, edadMax: number | null, hoy: Date): RangoFechaNac {
    const rango: RangoFechaNac = {};
    if (edadMin !== null && edadMin !== undefined) {
        rango.lte = restarAnios(hoy, edadMin);
    }
    if (edadMax !== null && edadMax !== undefined) {
        const base = restarAnios(hoy, edadMax + 1);
        base.setDate(base.getDate() + 1);
        rango.gte = base;
    }
    return rango;
}
