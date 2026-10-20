import { afterEach, describe, expect, it } from "vitest";
import { debeRegistrarBusqueda, limpiarDedupBusquedas, VENTANA_DEDUP_BUSQUEDA_MS } from "./auditoriaBusquedas";

afterEach(() => {
    limpiarDedupBusquedas();
});

describe("debeRegistrarBusqueda", () => {
    it("primera vez con una clave devuelve true", () => {
        expect(debeRegistrarBusqueda("11.111.111-1|LISTADO_SOLICITUDES|Filtros: {}")).toBe(true);
    });

    it("la misma clave a los 4 minutos devuelve false", () => {
        const ahora = Date.now();
        const clave = "11.111.111-1|LISTADO_SOLICITUDES|Filtros: {}";

        expect(debeRegistrarBusqueda(clave, ahora)).toBe(true);
        expect(debeRegistrarBusqueda(clave, ahora + 4 * 60_000)).toBe(false);
    });

    it("la misma clave a los 5 minutos y 1 ms vuelve a devolver true", () => {
        const ahora = Date.now();
        const clave = "11.111.111-1|LISTADO_SOLICITUDES|Filtros: {}";

        expect(debeRegistrarBusqueda(clave, ahora)).toBe(true);
        expect(debeRegistrarBusqueda(clave, ahora + VENTANA_DEDUP_BUSQUEDA_MS + 1)).toBe(true);
    });

    it("distinto rut en la clave devuelve true", () => {
        const ahora = Date.now();

        expect(debeRegistrarBusqueda("11.111.111-1|LISTADO_SOLICITUDES|Filtros: {}", ahora)).toBe(true);
        expect(debeRegistrarBusqueda("22.222.222-2|LISTADO_SOLICITUDES|Filtros: {}", ahora)).toBe(true);
    });

    it("distinto recurso en la clave devuelve true", () => {
        const ahora = Date.now();

        expect(debeRegistrarBusqueda("11.111.111-1|LISTADO_SOLICITUDES|Filtros: {}", ahora)).toBe(true);
        expect(debeRegistrarBusqueda("11.111.111-1|COLA_COMUNICADOR|Filtros: {}", ahora)).toBe(true);
    });

    it("distintos details en la clave devuelve true", () => {
        const ahora = Date.now();

        expect(debeRegistrarBusqueda("11.111.111-1|LISTADO_SOLICITUDES|Filtros: {}", ahora)).toBe(true);
        expect(debeRegistrarBusqueda("11.111.111-1|LISTADO_SOLICITUDES|Filtros: {\"rut\":\"1\"}", ahora)).toBe(true);
    });

    it("poda las entradas vencidas antes de registrar una clave nueva", () => {
        const ahora = Date.now();
        const claveVieja = "11.111.111-1|LISTADO_SOLICITUDES|Filtros: {}";
        const claveNueva = "22.222.222-2|LISTADO_SOLICITUDES|Filtros: {}";

        expect(debeRegistrarBusqueda(claveVieja, ahora)).toBe(true);
        // Pasado el tiempo de vencimiento, la clave vieja debe poderse volver a registrar
        // (si no se podara, seguiria ocupando memoria para siempre).
        expect(debeRegistrarBusqueda(claveNueva, ahora + VENTANA_DEDUP_BUSQUEDA_MS + 1)).toBe(true);
        expect(debeRegistrarBusqueda(claveVieja, ahora + VENTANA_DEDUP_BUSQUEDA_MS + 1)).toBe(true);
    });
});
