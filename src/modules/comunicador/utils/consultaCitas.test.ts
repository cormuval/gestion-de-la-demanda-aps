import { describe, expect, it } from "vitest";
// schemas
import { citasFiltrosSchema } from "../schemas/llamada.schema";
// utils
import { construirConsultaCitas } from "./consultaCitas";

const ahora = new Date(2026, 10, 10, 12);

// Fallan si se pierde un predicado al compartirlo entre pagina y total o si
// el conteo introduce joins ajenos a los filtros que realmente necesita.
describe("construirConsultaCitas", () => {
    it("mantiene centro y pendientes cuando los filtros estan vacios", () => {
        const consulta = construirConsultaCitas(citasFiltrosSchema.parse({ texto: "   " }), "501", ahora);
        expect(consulta.where.sql).toBe("WHERE c.centro_id = ? AND c.estado_cita IN (?,?,?,?)");
        expect(consulta.where.values).toEqual(["501", "Sin llamadas", "No contesta (1)", "No contesta (2)", "Solo llamada de aviso"]);
        expect(consulta.fromConteo.sql.trim()).toBe("FROM citas c");
        expect(consulta.fromPagina.sql).toContain("JOIN usuarios u ON u.rut = c.rut_usuario");
        expect(consulta.fromPagina.sql).toContain("JOIN solicitudes s ON s.id_solicitud = c.solicitud_id");
        expect(consulta.fromPagina.sql).toContain("LEFT JOIN profesionales p");
        expect(consulta.fromPagina.sql).toContain("LEFT JOIN prestaciones pr");
    });

    it("busca solo observacion de cita mediante parametro literal escapado", () => {
        const consulta = construirConsultaCitas(citasFiltrosSchema.parse({ texto: "50%_! ruta\\control O'Brien" }), "501", ahora);
        expect(consulta.where.sql).toContain("c.observacion LIKE ? ESCAPE '!'");
        expect(consulta.where.values.at(-1)).toBe("%50!%!_!! ruta\\control O'Brien%");
        expect(consulta.where.sql).not.toContain("llamadas");
        expect(consulta.fromConteo.sql).not.toContain("JOIN");
    });

    it.each([{ sector: "Amarillo" }, { edadMin: 0 }, { edadMax: 80 }, { sector: "Amarillo", edadMin: 20, edadMax: 50 }])("incluye usuario en conteo cuando un filtro lo necesita: %j", (filtros) => {
        const consulta = construirConsultaCitas(citasFiltrosSchema.parse(filtros), "501", ahora);
        expect(consulta.fromConteo.sql).toContain("JOIN usuarios u ON u.rut = c.rut_usuario");
        expect(consulta.fromConteo.sql).not.toContain("solicitudes");
        expect(consulta.fromConteo.sql).not.toContain("profesionales");
    });

    it("conserva limites de edad y fechas, sector, rut, profesional y subconsulta de prestacion", () => {
        const consulta = construirConsultaCitas(citasFiltrosSchema.parse({ estado: "No contesta (1)", texto: "observacion", profesional_id: 3, prestacion: "Control", rut: "12.345-6", sector: "Amarillo", edadMin: 20, edadMax: 50, temporalidad: "Agendamientos próximos", fechaDesde: "2026-11-01", fechaHasta: "2026-11-30" }), "501", ahora);
        expect(consulta.where.sql).toContain("c.prestacion_id IN (SELECT id_prestacion FROM prestaciones WHERE nombre_prestacion = ?)");
        expect(consulta.where.sql).toContain("REPLACE(REPLACE(c.rut_usuario, '.', ''), '-', '') LIKE ?");
        expect(consulta.where.values).toEqual(["501", "No contesta (1)", 3, "Control", "%123456%", "%Amarillo%", new Date(2026, 9, 26, 12), new Date(2026, 11, 10, 12), new Date("2026-11-01T00:00:00"), new Date("2026-11-30T23:59:59"), new Date(1975, 10, 11), new Date(2006, 10, 10), "%observacion%"]);
        expect(consulta.where.sql).toContain("u.fecha_nacimiento >= ? AND u.fecha_nacimiento <= ?");
    });

    it.each([
        ["Agendamientos atrasados", "c.fecha_estimada_atencion < ?", new Date(2026, 9, 26, 12)],
        ["Agendamientos futuros", "c.fecha_estimada_atencion >= ?", new Date(2026, 11, 11, 12)]
    ])("mantiene la temporalidad %s", (temporalidad, condicion, limite) => {
        const consulta = construirConsultaCitas(citasFiltrosSchema.parse({ temporalidad }), "501", ahora);
        expect(consulta.where.sql).toContain(condicion);
        expect(consulta.where.values.at(-1)).toEqual(limite);
    });
});
