// lib
import { createHmac, timingSafeEqual } from 'node:crypto';

// types
import type { PayloadToken } from '../types/solicitudWeb';

export function firmarToken(payload: PayloadToken, secreto: string): string {
    if (secreto === '') {
        throw new Error('El secreto del token no puede estar vacío.');
    }

    const json: string = JSON.stringify(payload);
    const firma: string = createHmac('sha256', secreto).update(json).digest('base64url');
    return `${Buffer.from(json).toString('base64url')}.${firma}`;
}

export function verificarToken(token: string, secreto: string, ahora: number = Date.now()): PayloadToken | null {
    if (secreto === '') {
        return null;
    }

    try {
        const partes: string[] = token.split('.');
        if (partes.length !== 2 || partes.some((parte) => !/^[A-Za-z0-9_-]+$/.test(parte))) {
            return null;
        }

        const [contenido, firma] = partes;
        const json: string = Buffer.from(contenido, 'base64url').toString('utf8');
        const esperada: Buffer = createHmac('sha256', secreto).update(json).digest();
        const recibida: Buffer = Buffer.from(firma, 'base64url');
        if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
            return null;
        }

        const payload: unknown = JSON.parse(json);
        if (typeof payload !== 'object' || payload === null
            || !('rut' in payload) || typeof payload.rut !== 'string'
            || !('exp' in payload) || typeof payload.exp !== 'number'
            || !Number.isFinite(payload.exp) || payload.exp <= ahora) {
            return null;
        }

        return { rut: payload.rut, exp: payload.exp };
    } catch {
        return null;
    }
}
