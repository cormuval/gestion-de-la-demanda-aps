import { describe, expect, it } from "vitest";
import { calcularEdad, calcularPriorizacionAdministrativa } from "./priorizacion";

const fechaReferencia = new Date("2026-07-02T12:00:00");

describe("calcularEdad", () => {
    it("calcula años cumplidos", () => {
        expect(calcularEdad("1990-07-02", fechaReferencia)).toBe(36);
        expect(calcularEdad("1990-07-03", fechaReferencia)).toBe(35);
    });

    it("retorna null sin fecha", () => {
        expect(calcularEdad(null, fechaReferencia)).toBeNull();
    });
});

describe("calcularPriorizacionAdministrativa", () => {
    it("calcula puntaje por discapacidad, gestante y factor edad", () => {
        expect(
            calcularPriorizacionAdministrativa({
                discapacidad: "El usuario poseé una credencial de discapacidad.",
                fechaNacimiento: "1990-07-02",
                gestante: "Si",
                fechaReferencia
            })
        ).toBeCloseTo(8.48);
    });

    it("calcula puntaje adulto mayor", () => {
        expect(
            calcularPriorizacionAdministrativa({
                discapacidad: "El usuario no poseé una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
                fechaNacimiento: "1960-01-01",
                gestante: "No",
                fechaReferencia
            })
        ).toBeCloseTo(2.38);
    });

    it("calcula puntaje menor de 5 años", () => {
        expect(
            calcularPriorizacionAdministrativa({
                discapacidad: "El usuario no poseé una credencial de discapacidad y no es cuidador(a) de una persona con discapacidad.",
                fechaNacimiento: "2022-01-01",
                gestante: "No",
                fechaReferencia
            })
        ).toBeCloseTo(3.48);
    });

    it("retorna null sin fecha de nacimiento", () => {
        expect(
            calcularPriorizacionAdministrativa({
                discapacidad: "El usuario poseé una credencial de discapacidad.",
                fechaNacimiento: null,
                gestante: "Si",
                fechaReferencia
            })
        ).toBeNull();
    });
});
