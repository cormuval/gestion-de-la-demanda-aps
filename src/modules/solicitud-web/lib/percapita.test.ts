// lib
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarPercapita, mapearPercapita } from "./percapita";

const registro = {
    NOMBRES: "PACIENTE",
    APELLIDO_PATERNO: "PEREZ",
    APELLIDO_MATERNO: "SOTO",
    FECHA_NACIMIENTO: "2000-02-29",
    GENERO: "F",
    COD_CENTRO: 615,
};
const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.stubEnv("GI_PERCAPITA_URL", "https://gi.example.test/api/data/percapita");
    vi.stubEnv("GI_API_KEY", "clave-ficticia");
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("consultarPercapita", () => {
    it.each([
        ["12.345.678-5", "12345678-5"],
        [" 12 345 678 - 5 ", "12345678-5"],
        ["6.000.000-k", "6000000-K"],
    ])("normaliza %s antes de consultar gi", async (rut, normalizado) => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify(registro), { status: 200 }));
        expect(await consultarPercapita(rut)).toMatchObject({ estado: "INSCRITO" });
        expect(fetchMock).toHaveBeenCalledWith(
            `https://gi.example.test/api/data/percapita?rut=${normalizado}`,
            expect.objectContaining({
                headers: { "api-key": "clave-ficticia" },
                signal: expect.any(AbortSignal),
            }),
        );
    });
    it.each([[404, "NO_INSCRITO"], [500, "NO_DISPONIBLE"], [201, "NO_DISPONIBLE"]])(
        "traduce HTTP %s a %s", async (status, estado) => {
            fetchMock.mockResolvedValue(new Response("{}", { status }));
            expect(await consultarPercapita("12345678-5")).toEqual({ estado });
        },
    );
    it("maneja errores de red", async () => {
        fetchMock.mockRejectedValue(new Error("red"));
        expect(await consultarPercapita("12345678-5")).toEqual({ estado: "NO_DISPONIBLE" });
    });
    it.each(["GI_API_KEY", "GI_PERCAPITA_URL"])("no consulta sin %s", async (variable) => {
        vi.stubEnv(variable, "");
        expect(await consultarPercapita("12345678-5")).toEqual({ estado: "NO_DISPONIBLE" });
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it("no consulta un RUT inválido", async () => {
        expect(await consultarPercapita("12345678-0")).toEqual({ estado: "NO_DISPONIBLE" });
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each([{}, null, [], { NOMBRES: "PACIENTE" }])("rechaza registros incompletos %j", async (datos) => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify(datos), { status: 200 }));
        expect(await consultarPercapita("12345678-5")).toEqual({ estado: "NO_DISPONIBLE" });
    });
    it("maneja JSON inválido", async () => {
        fetchMock.mockResolvedValue(new Response("no-json", { status: 200 }));
        expect(await consultarPercapita("12345678-5")).toEqual({ estado: "NO_DISPONIBLE" });
    });
    it("configura el timeout de diez segundos", async () => {
        const timeout = vi.spyOn(AbortSignal, "timeout");
        fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
        await consultarPercapita("12345678-5");
        expect(timeout).toHaveBeenCalledWith(10_000);
        timeout.mockRestore();
    });
});

describe("mapearPercapita", () => {
    it("mapea un registro completo", () => {
        expect(mapearPercapita(registro)).toEqual({
            nombre: "PACIENTE", apellido: "PEREZ SOTO", centro_id: "615",
            fecha_nacimiento: new Date("2000-02-29T00:00:00.000Z"), genero: "F",
        });
    });
    it.each([null, ""])("omite apellido materno %s", (materno) => {
        expect(mapearPercapita({ ...registro, APELLIDO_MATERNO: materno })?.apellido).toBe("PEREZ");
    });
    it("recorta nombres y apellidos a cincuenta caracteres", () => {
        const paciente = mapearPercapita({ ...registro, NOMBRES: "A".repeat(60), APELLIDO_PATERNO: "B".repeat(60) });
        expect(paciente?.nombre).toBe("A".repeat(50));
        expect(paciente?.apellido).toBe("B".repeat(50));
    });
    it.each(["2000-02-29", "29-02-2000"])("parsea fecha %s", (fecha) => {
        expect(mapearPercapita({ ...registro, FECHA_NACIMIENTO: fecha })?.fecha_nacimiento)
            .toEqual(new Date("2000-02-29T00:00:00.000Z"));
    });
    it.each(["2001-02-29", "31-04-2000", "basura", null])("descarta fecha inválida %s", (fecha) => {
        expect(mapearPercapita({ ...registro, FECHA_NACIMIENTO: fecha })?.fecha_nacimiento).toBeNull();
    });
    it("usa null sin género", () => {
        expect(mapearPercapita({ ...registro, GENERO: null })?.genero).toBeNull();
    });
    it.each([{ COD_CENTRO: 615 }, { NOMBRES: "PACIENTE" }, { NOMBRES: "", COD_CENTRO: 615 }])(
        "rechaza campos obligatorios ausentes %j", (datos) => {
            expect(mapearPercapita(datos)).toBeNull();
        },
    );
});

describe("saneamiento del per cápita", () => {
    it("rechaza redirecciones al consultar gi", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify(registro), { status: 200 }));
        await consultarPercapita("12345678-5");
        expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
    });
    it("limpia espacios del nombre antes de recortarlo", () => {
        expect(mapearPercapita({ ...registro, NOMBRES: "  " + "A".repeat(60) + "  " })?.nombre)
            .toBe("A".repeat(50));
        expect(mapearPercapita({ ...registro, NOMBRES: " PACIENTE " })?.nombre).toBe("PACIENTE");
    });
    it("elimina el espacio final que puede producir el recorte del apellido", () => {
        expect(mapearPercapita({ ...registro, APELLIDO_PATERNO: "A".repeat(49) })?.apellido)
            .toBe("A".repeat(49));
    });
    it.each([true, false, {}, [], null, undefined, "", "   "])(
        "rechaza código de centro inválido %j", (centro) => {
            expect(mapearPercapita({ ...registro, COD_CENTRO: centro })).toBeNull();
        },
    );
    it.each([615, "615"])("acepta código de centro %j", (centro) => {
        expect(mapearPercapita({ ...registro, COD_CENTRO: centro })?.centro_id).toBe("615");
    });
});
