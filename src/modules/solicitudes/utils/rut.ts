export function normalizarRut(rut: string): string {
    const limpio = rut.replace(/\./g, "").replace(/-/g, "").replace(/\s/g, "").toUpperCase();
    if (limpio.length < 2) return limpio;
    return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

export function esRutChilenoValido(rut: string): boolean {
    const limpio = normalizarRut(rut);
    if (!/^\d{7,8}-[\dK]$/.test(limpio)) return false;

    const cuerpo = limpio.slice(0, -1).replace("-", "");
    const dv = limpio.slice(-1);
    let suma = 0;
    let multiplicador = 2;

    for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
        suma += Number(cuerpo[i]) * multiplicador;
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = 11 - (suma % 11);
    const dvEsperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
    return dv === dvEsperado;
}
