// lib
import { describe, expect, it } from 'vitest';
import { crearLimitador } from './limiteIp';

describe('limitador por IP', () => {
    it('permite dos consultas y rechaza la tercera dentro de la ventana', () => {
        const limitador = crearLimitador(2, 1000);
        expect(limitador.permitir('ip-prueba', 0)).toBe(true);
        expect(limitador.permitir('ip-prueba', 1)).toBe(true);
        expect(limitador.permitir('ip-prueba', 2)).toBe(false);
        expect(limitador.permitir('ip-prueba', 1001)).toBe(true);
    });

    it('reinicia al alcanzar exactamente el vencimiento sin prolongar la ventana', () => {
        const limitador = crearLimitador(1, 1000);
        expect(limitador.permitir('ip-prueba', 0)).toBe(true);
        expect(limitador.permitir('ip-prueba', 999)).toBe(false);
        expect(limitador.permitir('ip-prueba', 1000)).toBe(true);
    });

    it('mantiene contadores independientes para cada clave', () => {
        const limitador = crearLimitador(1, 1000);
        expect(limitador.permitir('ip-a', 0)).toBe(true);
        expect(limitador.permitir('ip-b', 1)).toBe(true);
        expect(limitador.permitir('ip-a', 2)).toBe(false);
    });
});
