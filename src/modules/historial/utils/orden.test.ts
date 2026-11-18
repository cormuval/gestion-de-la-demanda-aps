import { expect, it } from "vitest";
import { ordenarSolicitudesHistorial } from "./orden";

it("ordena En Curso primero y por fecha descendente sin mutar", () => {
    const entrada = [
        { id: "A", estado_solicitud: "Realizado", fecha_inicio: new Date("2026-11-02") },
        { id: "B", estado_solicitud: "En Curso", fecha_inicio: new Date("2026-05-01") },
        { id: "C", estado_solicitud: "Rechazado", fecha_inicio: new Date("2026-10-19") },
        { id: "D", estado_solicitud: "En Curso", fecha_inicio: new Date("2026-07-01") }
    ];
    expect(ordenarSolicitudesHistorial(entrada).map((s) => s.id)).toEqual(["D", "B", "A", "C"]);
    expect(entrada.map((s) => s.id)).toEqual(["A", "B", "C", "D"]);
});
