const DISCAPACIDAD_CON_PUNTAJE = [
    "El usuario poseé una credencial de discapacidad.",
    "El usuario es cuidador(a) principal de una persona con discapacidad.",
    "El usuario pertenece a la poblacion sename.",
    "El usuario pertenece a la poblacion sename"
];

const DISCAPACIDAD_SIN_PUNTAJE = [
    "El usuario no poseé una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
    "El usuario no posee una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad."
];

export function calcularEdad(fechaNacimiento: Date | string | null, fechaReferencia: Date = new Date()): number | null {
    if (!fechaNacimiento) return null;

    const nacimiento = fechaNacimiento instanceof Date ? fechaNacimiento : new Date(`${fechaNacimiento}T00:00:00`);
    if (Number.isNaN(nacimiento.getTime())) return null;

    let edad = fechaReferencia.getFullYear() - nacimiento.getFullYear();
    const mes = fechaReferencia.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && fechaReferencia.getDate() < nacimiento.getDate())) {
        edad -= 1;
    }

    return edad;
}

export function calcularPriorizacionAdministrativa({
    discapacidad,
    fechaNacimiento,
    gestante,
    fechaReferencia = new Date()
}: {
    discapacidad: string | null | undefined;
    fechaNacimiento: Date | string | null;
    gestante: string | null | undefined;
    fechaReferencia?: Date;
}): number | null {
    const edad = calcularEdad(fechaNacimiento, fechaReferencia);
    if (edad === null) return null;

    const puntajeDiscapacidad = discapacidad && DISCAPACIDAD_CON_PUNTAJE.includes(discapacidad) ? 5 : 0;
    const puntajeEdad = edad >= 60 ? 1 : edad <= 5 ? 3 : 0;
    const puntajeGestante = gestante === "Si" ? 3 : 0;
    const factorEdad = Math.abs(edad - 20) * 0.03;

    if (discapacidad && !DISCAPACIDAD_CON_PUNTAJE.includes(discapacidad) && !DISCAPACIDAD_SIN_PUNTAJE.includes(discapacidad)) {
        return puntajeEdad + puntajeGestante + factorEdad;
    }

    return puntajeDiscapacidad + puntajeEdad + puntajeGestante + factorEdad;
}
