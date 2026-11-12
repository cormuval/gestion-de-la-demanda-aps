interface Ventana {
    inicio: number;
    consultas: number;
}

interface Limitador {
    permitir(clave: string, ahora?: number): boolean;
}

export function crearLimitador(maximo: number, ventanaMs: number): Limitador {
    const ventanas: Map<string, Ventana> = new Map();

    return {
        permitir(clave: string, ahora: number = Date.now()): boolean {
            for (const [claveActual, ventana] of ventanas) {
                if (ahora - ventana.inicio >= ventanaMs) {
                    ventanas.delete(claveActual);
                }
            }

            const ventana: Ventana = ventanas.get(clave) ?? { inicio: ahora, consultas: 0 };
            if (ventana.consultas >= maximo) {
                return false;
            }

            ventana.consultas += 1;
            ventanas.set(clave, ventana);
            return true;
        }
    };
}
