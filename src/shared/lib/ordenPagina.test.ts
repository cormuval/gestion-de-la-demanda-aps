import { describe, expect, it } from "vitest";

import { ordenarPagina, siguienteOrden } from "./ordenPagina";

describe("siguienteOrden", () => {
    it("cicla ascendente, descendente y orden recibido; otra columna comienza ascendente", () => {
        expect(siguienteOrden(null, "fecha")).toEqual({ columna: "fecha", direccion: "asc" });
        expect(siguienteOrden({ columna: "fecha", direccion: "asc" }, "fecha")).toEqual({ columna: "fecha", direccion: "desc" });
        expect(siguienteOrden({ columna: "fecha", direccion: "desc" }, "fecha")).toBeNull();
        expect(siguienteOrden({ columna: "fecha", direccion: "desc" }, "tipo")).toEqual({ columna: "tipo", direccion: "asc" });
    });
});

describe("ordenarPagina", () => {
    it.each([
        ["asc", ["menor", "empate-1", "empate-2", "mayor", "nulo-1", "nulo-2"]],
        ["desc", ["mayor", "empate-1", "empate-2", "menor", "nulo-1", "nulo-2"]]
    ] as const)("ordena números %s con nulos finales y empates en orden recibido", (direccion, esperado) => {
        const filas = Object.freeze([
            Object.freeze({ id: "empate-1", valor: 2 }),
            Object.freeze({ id: "nulo-1", valor: null }),
            Object.freeze({ id: "mayor", valor: 10 }),
            Object.freeze({ id: "empate-2", valor: 2 }),
            Object.freeze({ id: "nulo-2", valor: null }),
            Object.freeze({ id: "menor", valor: 1 })
        ]);

        const resultado = ordenarPagina(filas, (fila) => fila.valor, direccion);

        expect(resultado.map((fila) => fila.id)).toEqual(esperado);
        expect(resultado).not.toBe(filas);
        expect(resultado.find((fila) => fila.id === "empate-1")).toBe(filas[0]);
        expect(filas.map((fila) => fila.id)).toEqual(["empate-1", "nulo-1", "mayor", "empate-2", "nulo-2", "menor"]);
    });

    it("compara texto según español, incluidos acentos y ñ", () => {
        expect(ordenarPagina(["Ñandú", "Zorro", "Árbol", "Nido"], (fila) => fila, "asc"))
            .toEqual(["Árbol", "Nido", "Ñandú", "Zorro"]);
    });
});
