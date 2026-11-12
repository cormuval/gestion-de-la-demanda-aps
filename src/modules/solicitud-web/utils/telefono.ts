export function normalizarTelefono(texto: string): string | null {
    const limpio: string = texto.replace(/[\s()\-]/g, '');
    if (!/^(?:\+?56)?\d{9}$/.test(limpio)) {
        return null;
    }

    return `+56${limpio.slice(-9)}`;
}
