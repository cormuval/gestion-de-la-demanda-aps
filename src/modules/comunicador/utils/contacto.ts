function limpiar(valor?: string | null): string {
    return (valor ?? "").trim();
}

export function formatearTelefonos(telefono?: string | null, telefonoAlternativo?: string | null): string {
    const t1 = limpiar(telefono);
    const t2 = limpiar(telefonoAlternativo);
    if (t1 && t2) return `${t1} - ${t2}`;
    if (t1) return t1;
    if (t2) return t2;
    return "Sin telefono(s) registrados";
}

export function formatearCorreo(correoContacto?: string | null): string {
    const correo = limpiar(correoContacto);
    return correo || "Correo electrónico de contacto no registrado";
}
