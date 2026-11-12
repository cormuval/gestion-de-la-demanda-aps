// lib
import { describe, expect, it, vi } from 'vitest';
import { crearLimitador } from './limiteIp';

describe('limitador por IP', () => {
    it('elimina claves vencidas de otras IP y limita el barrido a una vez por ventana', () => {
        const limitador = crearLimitador(1, 1000);
        const eliminar = vi.spyOn(Map.prototype, 'delete');
        const recorrer = vi.spyOn(Map.prototype, Symbol.iterator);
        let clavesEliminadas: unknown[][] = [];
        let barridos: number = 0;
        try {
            limitador.permitir('ip-a', 0);
            limitador.permitir('ip-b', 1);
            limitador.permitir('ip-b', 1000);
            limitador.permitir('ip-b', 1001);
            clavesEliminadas = [...eliminar.mock.calls];
            barridos = recorrer.mock.calls.length;
        } finally {
            eliminar.mockRestore();
            recorrer.mockRestore();
        }
        expect(clavesEliminadas).toContainEqual(['ip-a']);
        expect(barridos).toBe(2);
    });

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
