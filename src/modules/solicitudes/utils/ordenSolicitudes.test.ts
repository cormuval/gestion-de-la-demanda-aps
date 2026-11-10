import { describe, expect, expectTypeOf, it } from "vitest";

import { ordenarSolicitudes } from "./ordenSolicitudes";

const filas = Object.freeze([
    Object.freeze({ id: "enero", fecha_inicio: "2027-01-01T00:30:00Z", tipoSolicitud: { nombre_tipo_solicitud: "Ñandú" }, prioridad: 20 }),
    Object.freeze({ id: "diciembre", fecha_inicio: new Date("2026-12-31T23:00:00Z"), tipoSolicitud: null, prioridad: 100 }),
    Object.freeze({ id: "noviembre", fecha_inicio: "2026-11-30T23:30:00Z", tipoSolicitud: { nombre_tipo_solicitud: "Árbol" }, prioridad: 10 }),
    Object.freeze({ id: "instante-igual", fecha_inicio: "2026-12-31T20:00:00-03:00", tipoSolicitud: { nombre_tipo_solicitud: "Árbol" }, prioridad: 1 })
]);

describe("ordenarSolicitudes", () => {
    it.each([
        ["asc", ["noviembre", "diciembre", "instante-igual", "enero"]],
        ["desc", ["enero", "diciembre", "instante-igual", "noviembre"]]
    ] as const)("ordena fechas %s por instante al cruzar mes y año sin invertir empates", (direccion, esperado) => {
        const resultado = ordenarSolicitudes(filas, { columna: "fecha", direccion });
        expect(resultado.map((fila) => fila.id)).toEqual(esperado);
        expectTypeOf(resultado).toEqualTypeOf<Array<(typeof filas)[number]>>();
    });

    it.each([
        ["asc", ["noviembre", "instante-igual", "enero", "diciembre"]],
        ["desc", ["enero", "noviembre", "instante-igual", "diciembre"]]
    ] as const)("ordena tipos %s con empates estables y tipo nulo final", (direccion, esperado) => {
        expect(ordenarSolicitudes(filas, { columna: "tipo", direccion }).map((fila) => fila.id)).toEqual(esperado);
    });

    it("devuelve una copia en el orden recibido al quitar el criterio", () => {
        const resultado = ordenarSolicitudes(filas, null);
        expect(resultado.map((fila) => fila.id)).toEqual(["enero", "diciembre", "noviembre", "instante-igual"]);
        expect(resultado).not.toBe(filas);
        expect(resultado[0]).toBe(filas[0]);
    });

    it("coloca fechas inválidas al final en ambas direcciones", () => {
        const solicitudes = [
            { id: "invalida", fecha_inicio: "sin fecha", tipoSolicitud: null },
            { id: "valida", fecha_inicio: "2026-11-10", tipoSolicitud: null }
        ];
        expect(ordenarSolicitudes(solicitudes, { columna: "fecha", direccion: "asc" }).map((fila) => fila.id)).toEqual(["valida", "invalida"]);
        expect(ordenarSolicitudes(solicitudes, { columna: "fecha", direccion: "desc" }).map((fila) => fila.id)).toEqual(["valida", "invalida"]);
    });
});
