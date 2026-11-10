import { describe, expect, it } from "vitest";
import { resolverPrioridadCita, SIMBOLOGIA_PRIORIDAD } from "./prioridadCita";

describe("prioridadCita", () => {
    it("expone la simbologia de prioridad en orden descendente", () => {
        expect(SIMBOLOGIA_PRIORIDAD.map((item) => item.textoSimbologia)).toEqual([
            "Urgente (80–100)",
            "Alta (60–79)",
            "Media (40–59)",
            "Baja (< 40)"
        ]);
    });

    it("resuelve nivel explicito con puntaje numerico y estilos correspondientes", () => {
        expect(resolverPrioridadCita("Urgente", 85)).toEqual({
            nivel: "Urgente",
            etiqueta: "Urgente · 85",
            badgeClassName: expect.stringContaining("bg-red-100"),
            dotClassName: expect.stringContaining("bg-red-600")
        });
    });

    it("resuelve nivel explicito sin puntaje numerico", () => {
        expect(resolverPrioridadCita("Alta", null)).toMatchObject({
            nivel: "Alta",
            etiqueta: "Alta"
        });
    });

    it("infiere el nivel por tramo de puntaje cuando priorizacion_clinica es nula o desconocida", () => {
        expect(resolverPrioridadCita(null, 80)?.etiqueta).toBe("Urgente · 80");
        expect(resolverPrioridadCita(null, 60)?.etiqueta).toBe("Alta · 60");
        expect(resolverPrioridadCita("", 40)?.etiqueta).toBe("Media · 40");
        expect(resolverPrioridadCita("Desconocida", 20)?.etiqueta).toBe("Baja · 20");
    });

    it("clasifica por el tramo del puntaje numerico aunque priorizacion_clinica difiera (ej. Media con 60 -> Alta · 60)", () => {
        expect(resolverPrioridadCita("Media", 60)).toMatchObject({
            nivel: "Alta",
            etiqueta: "Alta · 60"
        });
        expect(resolverPrioridadCita("Alta", 80)).toMatchObject({
            nivel: "Urgente",
            etiqueta: "Urgente · 80"
        });
        expect(resolverPrioridadCita("Media", 59)?.etiqueta).toBe("Media · 59");
        expect(resolverPrioridadCita("Baja", 39)?.etiqueta).toBe("Baja · 39");
    });

    it("devuelve null cuando no hay nivel clinico ni puntaje numerico", () => {
        expect(resolverPrioridadCita(null, null)).toBeNull();
        expect(resolverPrioridadCita(undefined, undefined)).toBeNull();
    });
});
