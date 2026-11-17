import { describe, expect, it } from "vitest";
import { ESTADO_CITA, RESPUESTA_LLAMADA } from "@/modules/comunicador/types/comunicador";
import { tonoEstadoCita, tonoEstadoSolicitud, tonoRespuestaLlamada } from "./semaforoEstado";

describe("semáforo", () => {
    it.each([...Object.values(ESTADO_CITA).map((estado, i) => [estado, i < 4 ? "amarillo" : i === 4 ? "verde" : "rojo"]), [null, "gris"], ["Estado legado", "gris"]])("cita %s", (estado, tono) => expect(tonoEstadoCita(estado)).toBe(tono));
    it.each([...Object.values(RESPUESTA_LLAMADA).map((estado, i) => [estado, i < 2 ? "amarillo" : i === 2 ? "verde" : "rojo"]), [null, "gris"], ["Otra", "gris"]])("llamada %s", (estado, tono) => expect(tonoRespuestaLlamada(estado)).toBe(tono));
    it.each([["En Curso", "amarillo"], ["Realizado", "verde"], ["Rechazado", "rojo"], ["Otro", "gris"], [null, "gris"]])("solicitud %s", (estado, tono) => expect(tonoEstadoSolicitud(estado)).toBe(tono));
});
