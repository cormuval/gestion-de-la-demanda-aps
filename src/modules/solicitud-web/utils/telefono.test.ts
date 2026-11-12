// lib
import { describe, expect, it } from 'vitest';

// utils
import { normalizarTelefono } from './telefono';

describe('normalizarTelefono', () => {
    it.each(['+56 9 1234 5678', '912345678', '56912345678', '(9) 1234-5678'])('normaliza %j', (texto) => {
        expect(normalizarTelefono(texto)).toBe('+56912345678');
    });

    it('acepta teléfonos fijos de nueve dígitos', () => {
        expect(normalizarTelefono('322123456')).toBe('+56322123456');
    });

    it.each(['12345', '+5491234567890', 'abc', '', '+912345678', '9.1234.5678'])('rechaza %j', (texto) => {
        expect(normalizarTelefono(texto)).toBeNull();
    });
});
