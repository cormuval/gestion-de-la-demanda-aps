// lib
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { firmarToken, verificarToken } from './token';

// types
import type { PayloadToken } from '../types/solicitudWeb';

const secreto: string = 'secreto-ficticio-de-prueba';
const payload: PayloadToken = { rut: '12345678-5', centro_id: 'centro-prueba', exp: 2000 };

describe('token de solicitud web', () => {
    it('no firma con un secreto vacío', () => {
        expect(() => firmarToken(payload, '')).toThrow(Error);
    });

    it('rechaza verificar con un secreto vacío incluso una firma válida para esa clave', () => {
        const json: string = JSON.stringify(payload);
        const firma: string = createHmac('sha256', '').update(json).digest('base64url');
        expect(verificarToken(`${Buffer.from(json).toString('base64url')}.${firma}`, '', 1000)).toBeNull();
    });

    it('rechaza una firma truncada con el payload intacto', () => {
        const [contenido, firma] = firmarToken(payload, secreto).split('.');
        expect(verificarToken(`${contenido}.${firma.slice(0, -4)}`, secreto, 1000)).toBeNull();
    });

    it('conserva el payload al firmar y verificar', () => {
        expect(verificarToken(firmarToken(payload, secreto), secreto, 1000)).toEqual(payload);
    });

    it('firma el JSON del payload con HMAC-SHA256', () => {
        const json: string = JSON.stringify(payload);
        const firma: string = createHmac('sha256', secreto).update(json).digest('base64url');
        expect(firmarToken(payload, secreto)).toBe(`${Buffer.from(json).toString('base64url')}.${firma}`);
    });

    it('rechaza un RUT alterado sin volver a firmar', () => {
        const firma: string = firmarToken(payload, secreto).split('.')[1];
        const alterado: string = Buffer.from(JSON.stringify({ ...payload, rut: '11111111-1' })).toString('base64url');
        expect(verificarToken(`${alterado}.${firma}`, secreto, 1000)).toBeNull();
    });

    it('rechaza otro secreto', () => {
        expect(verificarToken(firmarToken(payload, secreto), 'otro-secreto-ficticio', 1000)).toBeNull();
    });

    it.each([1999, 2000])('rechaza exp=%i cuando ahora es 2000', (exp) => {
        expect(verificarToken(firmarToken({ ...payload, exp }, secreto), secreto, 2000)).toBeNull();
    });

    it.each(['basura', '', 'a.b.c', 'a.b', '.'])('rechaza formato inválido %j sin lanzar', (token) => {
        expect(verificarToken(token, secreto, 1000)).toBeNull();
    });

    it.each([null, {}, { ...payload, exp: '2000' }, { ...payload, rut: 123 }])('rechaza payload firmado con estructura inválida %j', (valor) => {
        const json: string = JSON.stringify(valor);
        const firma: string = createHmac('sha256', secreto).update(json).digest('base64url');
        expect(verificarToken(`${Buffer.from(json).toString('base64url')}.${firma}`, secreto, 1000)).toBeNull();
    });
});
