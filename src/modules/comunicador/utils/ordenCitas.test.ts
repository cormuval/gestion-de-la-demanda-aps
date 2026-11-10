import { describe, expect, it } from "vitest";

// types
import type { CitaFila } from "../actions/getCitasPendientes.action";
// utils
import { ordenarCitas } from "./ordenCitas";

const base: CitaFila = {
    id_cita: "base", priorizacion_clinica: null, priorizacion: 10, disponibilidad: null,
    rut_usuario: "11.111.111-1", nombre_usuario: "Paciente", nombre_social: null,
    profesion: null, prestacion: null, fecha_estimada_atencion: null, estado_cita: null,
    observacion: null, intentos: 0, tiene_llamada_hoy: false
};

const filas: readonly CitaFila[] = Object.freeze([
    Object.freeze({ ...base, id_cita: "enero", fecha_estimada_atencion: new Date("2027-01-01T00:30:00Z"), estado_cita: "Sin llamadas" }),
    Object.freeze({ ...base, id_cita: "sin-datos", priorizacion: 100 }),
    Object.freeze({ ...base, id_cita: "diciembre", fecha_estimada_atencion: new Date("2026-12-31T23:00:00Z"), estado_cita: "No contesta (2)" }),
    Object.freeze({ ...base, id_cita: "noviembre", fecha_estimada_atencion: new Date("2026-11-30T23:30:00Z"), estado_cita: "No contesta (1)" }),
    Object.freeze({ ...base, id_cita: "empate", fecha_estimada_atencion: new Date("2026-12-31T20:00:00-03:00"), estado_cita: "No contesta (2)" })
]);

describe("ordenarCitas", () => {
    it.each([
        ["asc", ["noviembre", "diciembre", "empate", "enero", "sin-datos"]],
        ["desc", ["enero", "diciembre", "empate", "noviembre", "sin-datos"]]
    ] as const)("ordena fecha %s por instante, mantiene empates y deja nulos al final", (direccion, esperado) => {
        expect(ordenarCitas(filas, { columna: "fecha", direccion }).map((fila) => fila.id_cita)).toEqual(esperado);
    });

    it.each([
        ["asc", ["noviembre", "diciembre", "empate", "enero", "sin-datos"]],
        ["desc", ["enero", "diciembre", "empate", "noviembre", "sin-datos"]]
    ] as const)("ordena estado %s alfabéticamente con nulos al final", (direccion, esperado) => {
        expect(ordenarCitas(filas, { columna: "estado", direccion }).map((fila) => fila.id_cita)).toEqual(esperado);
    });

    it("recupera el orden recibido del servidor sin mutar filas ni datos clínicos", () => {
        const resultado = ordenarCitas(filas, null);
        expect(resultado.map((fila) => fila.id_cita)).toEqual(["enero", "sin-datos", "diciembre", "noviembre", "empate"]);
        expect(resultado).not.toBe(filas);
        expect(resultado[0]).toBe(filas[0]);
    });

    it.each(["asc", "desc"] as const)("deja una fecha inválida al final en dirección %s", (direccion) => {
        const citas = [{ ...base, id_cita: "invalida", fecha_estimada_atencion: new Date("inválida") }, filas[0]];
        expect(ordenarCitas(citas, { columna: "fecha", direccion }).map((fila) => fila.id_cita)).toEqual(["enero", "invalida"]);
    });
});
