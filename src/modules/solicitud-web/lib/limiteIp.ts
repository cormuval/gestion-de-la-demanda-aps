interface Ventana {
    inicio: number;
    consultas: number;
}

export interface Limitador {
    permitir(clave: string, ahora?: number): boolean;
}

export function crearLimitador(maximo: number, ventanaMs: number): Limitador {
    const ventanas: Map<string, Ventana> = new Map();
    let ultimaLimpieza: number | undefined;

    return {
        permitir(clave: string, ahora: number = Date.now()): boolean {
            const actual: Ventana | undefined = ventanas.get(clave);
            if (actual && ahora - actual.inicio >= ventanaMs) {
                ventanas.delete(clave);
            }

            if (ultimaLimpieza === undefined || ahora - ultimaLimpieza >= ventanaMs) {
                for (const [claveActual, ventana] of ventanas) {
                    if (ahora - ventana.inicio >= ventanaMs) {
                        ventanas.delete(claveActual);
                    }
                }
                ultimaLimpieza = ahora;
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
