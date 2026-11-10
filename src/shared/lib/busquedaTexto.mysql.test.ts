// @vitest-environment node

import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// BD real; solo se sustituyen dependencias de sesion y auditoria.
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { requirePermiso } from "@/shared/lib/permisos";
import { getCitasPendientes } from "@/modules/comunicador/actions/getCitasPendientes.action";
import { citasFiltrosSchema } from "@/modules/comunicador/schemas/llamada.schema";
import { construirConsultaCitas } from "@/modules/comunicador/utils/consultaCitas";
import { getSolicitudes } from "@/modules/solicitudes/actions/getSolicitudes.action";
import { prisma } from "./prisma";

const habilitada = process.env.RUN_MYSQL_SEARCH_TESTS === "1";

// Opt-in y allowlist de la BD desechable: nunca usar .env ni otros hosts/bases.
function validarBaseDesechable(): void {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (url.protocol !== "mysql:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "3310" || url.pathname !== "/aps_mejoras_test" || url.username !== "aps_test") {
        throw new Error("El contrato MySQL requiere la BD local exclusiva aps_mejoras_test en localhost:3310 con usuario aps_test");
    }
}

describe.skipIf(!habilitada)("contrato MySQL de busqueda del Gestor y Comunicador (opt-in, BD local exclusiva)", () => {
    const token = randomUUID().slice(0, 8);
    const centroA = `TEST-BUSQUEDA-A-${token}`;
    const centroB = `TEST-BUSQUEDA-B-${token}`;
    const rut = `TEST-BUSQUEDA-${token}`;
    const idObjetivo = `BUSQUEDA-${token}-100`;
    const descripcion = "contról de presión 50%_! ruta\\control O'Brien ' OR 1=1 --";
    const rutJoven = `TEST-JOVEN-${token}`;
    const idCitaObjetivo = `CITA-${token}-100`;
    let profesionalId: number | undefined;
    let prestacionId: number | undefined;
    const nombrePrestacion = `Control ${token}`;
    const hoy = new Date();
    const fechaHoy = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
    const fechaPasada = new Date(fechaHoy.getTime() - 120 * 86400000);
    const desdePasada = new Date(fechaPasada.getTime() - 86400000).toISOString().slice(0, 10);
    const hastaPasada = new Date(fechaPasada.getTime() + 86400000).toISOString().slice(0, 10);
    const fechaFutura = new Date(fechaHoy.getTime() + 60 * 86400000);
    const fechaAtrasada = new Date(fechaHoy.getTime() - 60 * 86400000);
    let tipoId: number | undefined;
    let db: PrismaClient | undefined;

    beforeAll(async () => {
        validarBaseDesechable();
        db = prisma;
        vi.mocked(requirePermiso).mockResolvedValue({
            rut: "TEST-GESTOR", email: "test@example.invalid", nombre: "Prueba", centro_id: centroA,
            centro_nombre: "Centro sintetico", rol: { id: 1, nombre: "Gestor" }
        });
        const tipo = await db.tipoSolicitud.create({ data: { nombre_tipo_solicitud: `Busqueda ${token}` } });
        tipoId = tipo.id_tipo_solicitud;
        await db.usuario.create({ data: { rut, nombre: "Paciente", apellido: "Sintetico", sector: "Sector prueba", centro_id: centroA, fecha_nacimiento: new Date("1961-01-01"), nombre_social: "Social sintetico" } });
        const filas = Array.from({ length: 101 }, (_, indice) => ({
            id_solicitud: `BUSQUEDA-${token}-${indice}`, rut_usuario: rut, tipo_solicitud_id: tipo.id_tipo_solicitud,
            centro_id: centroA, accion: "En espera de validación", estado_solicitud: "En Curso", ultimo_control: "65",
            priorizacion_admin: 0, fecha_inicio: new Date(Date.UTC(2026, 0, 1, 0, indice)),
            descripcion: indice === 100 ? descripcion : indice === 0 ? null : "Relleno sintetico sin coincidencia"
        }));
        await db.solicitud.createMany({ data: filas });
        await db.solicitud.createMany({ data: [
            { ...filas[100], id_solicitud: `BUSQUEDA-${token}-otro-centro`, centro_id: centroB },
            { ...filas[100], id_solicitud: `BUSQUEDA-${token}-cerrada`, estado_solicitud: "Cerrada" },
            { ...filas[100], id_solicitud: `BUSQUEDA-${token}-gestionada`, accion: "Validada" },
            { ...filas[100], id_solicitud: `BUSQUEDA-${token}-sin-edad`, ultimo_control: null, descripcion: "Sin edad registrada" },
            { ...filas[100], id_solicitud: `BUSQUEDA-${token}-edad-9`, ultimo_control: "9", descripcion: "Edad numerica" },
            { ...filas[100], id_solicitud: `BUSQUEDA-${token}-edad-100`, ultimo_control: "100", descripcion: "Edad numerica" }
        ] });
        await db.solicitud.updateMany({ where: { rut_usuario: rut }, data: { disponibilidad_llamada: "Tarde" } });
        await db.usuario.create({ data: { rut: rutJoven, nombre: "Joven", apellido: "Sintetico", sector: "Azul", fecha_nacimiento: new Date("2000-01-01"), centro_id: centroA } });
        await db.solicitud.create({ data: { ...filas[100], id_solicitud: `BUSQUEDA-${token}-joven`, rut_usuario: rutJoven, accion: "Validada" } });
        const profesional = await db.profesional.create({ data: { nombre: `Profesional ${token}` } });
        profesionalId = profesional.id_profesional;
        const prestacion = await db.prestacion.create({ data: { profesional_id: profesionalId, nombre_prestacion: nombrePrestacion } });
        prestacionId = prestacion.id_prestacion;
        const citas = Array.from({ length: 101 }, (_, indice) => ({
            id_cita: `CITA-${token}-${String(indice).padStart(3, "0")}`,
            solicitud_id: filas[indice].id_solicitud, rut_usuario: rut, centro_id: centroA,
            tipo_prestacion: "Control", estado_cita: "Sin llamadas", priorizacion: 1,
            fecha_estimada_atencion: fechaPasada,
            observacion: indice === 100 ? descripcion : indice === 0 ? null : "Relleno sintetico sin coincidencia",
            profesional_id: indice === 100 ? profesionalId : null,
            prestacion_id: indice === 100 ? prestacionId : null
        }));
        await db.cita.createMany({ data: citas });
        await db.cita.createMany({ data: [
            { ...citas[100], id_cita: `CITA-${token}-joven`, rut_usuario: rutJoven, solicitud_id: `BUSQUEDA-${token}-joven`, estado_cita: "No contesta (1)", fecha_estimada_atencion: fechaHoy },
            { ...citas[0], id_cita: `CITA-${token}-aviso`, estado_cita: "Solo llamada de aviso", observacion: "Aviso", fecha_estimada_atencion: fechaFutura },
            { ...citas[0], id_cita: `CITA-${token}-no2`, estado_cita: "No contesta (2)", observacion: "Otra observacion", fecha_estimada_atencion: fechaAtrasada },
            { ...citas[100], id_cita: `CITA-${token}-cerrada`, estado_cita: "Cita Aceptada" },
            { ...citas[100], id_cita: `CITA-${token}-otro-centro`, centro_id: centroB }
        ] });
        await db.llamada.createMany({ data: [
            { id_llamada: `LLAMADA-${token}-1`, cita_id: idCitaObjetivo, rut_usuario: rut, respuesta_usuario: "No contesta", observacion: "solo llamada secreta", fecha_llamada: new Date(), centro_id: centroA },
            { id_llamada: `LLAMADA-${token}-2`, cita_id: idCitaObjetivo, rut_usuario: rut, respuesta_usuario: "No contesta", centro_id: centroA }
        ] });
    });

    afterAll(async () => {
        if (!db) return;
        try {
            await db.llamada.deleteMany({ where: { rut_usuario: { in: [rut, rutJoven] } } });
            await db.cita.deleteMany({ where: { rut_usuario: { in: [rut, rutJoven] } } });
            await db.solicitud.deleteMany({ where: { rut_usuario: { in: [rut, rutJoven] } } });
            await db.usuario.deleteMany({ where: { rut: { in: [rut, rutJoven] } } });
            if (prestacionId !== undefined) await db.prestacion.delete({ where: { id_prestacion: prestacionId } });
            if (profesionalId !== undefined) await db.profesional.delete({ where: { id_profesional: profesionalId } });
            if (tipoId !== undefined) await db.tipoSolicitud.delete({ where: { id_tipo_solicitud: tipoId } });
        } finally {
            await db.$disconnect();
        }
    });

    it.each([false, true])("encuentra coincidencias fuera de la primera pagina y mantiene total/centro/pendientes (edad=%s)", async (conEdad) => {
        const edad = conEdad ? { edadDesde: "60", edadHasta: "80" } : {};
        const primera = await getSolicitudes({ ...edad });
        expect(primera.ok).toBe(true);
        if (!primera.ok) throw new Error(primera.error);
        expect(primera.data.solicitudes).toHaveLength(100);
        expect(primera.data.solicitudes.map((fila) => fila.id_solicitud)).not.toContain(idObjetivo);
        expect(primera.data.total).toBe(conEdad ? 101 : 104);
        expect(primera.data.totalPages).toBe(2);

        const segunda = await getSolicitudes({ ...edad, page: 2 });
        expect(segunda.ok).toBe(true);
        if (!segunda.ok) throw new Error(segunda.error);
        expect(segunda.data.solicitudes.map((fila) => fila.id_solicitud)).toContain(idObjetivo);
        expect(segunda.data.total).toBe(primera.data.total);

        const resultado = await getSolicitudes({ ...edad, texto: "  control de presion  ", centroId: centroB });
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) throw new Error(resultado.error);
        expect(resultado.data.total).toBe(1);
        expect(resultado.data.solicitudes.map((fila) => fila.id_solicitud)).toEqual([idObjetivo]);
    });

    describe.each([false, true])("literales y colacion (edad=%s)", (conEdad) => {
        it.each(["CONTROL", "contról", "control de presión", "%", "_", "!", "\\", "O'Brien", "' OR 1=1 --", "50%_!", "ruta\\control"])("busca %s como fragmento literal sin coincidir con nulos", async (texto) => {
            const resultado = await getSolicitudes({ texto, ...(conEdad ? { edadDesde: "60", edadHasta: "80" } : {}) });
            expect(resultado.ok).toBe(true);
            if (!resultado.ok) throw new Error(resultado.error);
            expect(resultado.data.total).toBe(1);
            expect(resultado.data.solicitudes.map((fila) => fila.id_solicitud)).toEqual([idObjetivo]);
        });

        it("una frase ausente devuelve cero filas y total cero", async () => {
            const resultado = await getSolicitudes({ texto: "presion de control", ...(conEdad ? { edadDesde: "60", edadHasta: "80" } : {}) });
            expect(resultado).toEqual({ ok: true, data: { solicitudes: [], total: 0, page: 1, pageSize: 100, totalPages: 1 } });
        });
    });

    it("compara ultimo_control numericamente y excluye nulos", async () => {
        const resultado = await getSolicitudes({ texto: "Edad numerica", edadDesde: "8", edadHasta: "10" });
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) throw new Error(resultado.error);
        expect(resultado.data.total).toBe(1);
        expect(resultado.data.solicitudes.map((fila) => fila.id_solicitud)).toEqual([`BUSQUEDA-${token}-edad-9`]);

        const nulos = await getSolicitudes({ texto: "Sin edad registrada", edadDesde: "0" });
        expect(nulos).toEqual({ ok: true, data: { solicitudes: [], total: 0, page: 1, pageSize: 100, totalPages: 1 } });
    });
    describe("Comunicador", () => {
        it("busca fuera de la primera pagina conservando total y datos de presentacion", async () => {
            const primera = await getCitasPendientes({});
            if (!primera.ok) throw new Error(primera.error);
            expect(primera.data.total).toBe(104);
            expect(primera.data.filas).toHaveLength(100);
            expect(primera.data.filas.map((fila) => fila.id_cita)).not.toContain(idCitaObjetivo);
            const segunda = await getCitasPendientes({ pagina: 2 });
            if (!segunda.ok) throw new Error(segunda.error);
            expect(segunda.data.total).toBe(104);
            expect(segunda.data.filas).toHaveLength(4);
            const objetivo = segunda.data.filas.find((fila) => fila.id_cita === idCitaObjetivo);
            expect(objetivo).toMatchObject({ disponibilidad: "Tarde", nombre_social: "Social sintetico", intentos: 2, tiene_llamada_hoy: true });
            const vacio = await getCitasPendientes({ texto: "  " });
            expect(vacio).toEqual(primera);
        });

        describe.each([false, true])("literales y colacion (edad=%s)", (conEdad) => {
            it.each(["CONTROL", "contról", "control de presión", "%", "_", "!", "\\", "O'Brien", "' OR 1=1 --", "50%_!", "ruta\\control"])("busca %s solo en observacion de cita", async (texto) => {
                const resultado = await getCitasPendientes({ texto, ...(conEdad ? { edadMin: 60, edadMax: 80 } : {}) });
                if (!resultado.ok) throw new Error(resultado.error);
                expect(resultado.data.total).toBe(conEdad ? 1 : 2);
                expect(resultado.data.filas.map((fila) => fila.id_cita).sort()).toEqual(conEdad ? [idCitaObjetivo] : [idCitaObjetivo, `CITA-${token}-joven`].sort());
            });
        });

        it.each(["solo llamada secreta", "presion de control"])("no busca fuera del fragmento y campo acordados: %s", async (texto) => {
            await expect(getCitasPendientes({ texto })).resolves.toEqual({ ok: true, data: { filas: [], total: 0, pagina: 1, porPagina: 100 } });
        });

        // El total con joins antiguos es el control de equivalencia; los totales
        // esperados son literales derivados de los fixtures, no del constructor.
        it.each([
            [{}, 104], [{ texto: "control de presion" }, 2], [{ sector: "Azul" }, 1],
            [{ edadMin: 60, edadMax: 80 }, 103], [{ edadMin: 0 }, 104], [{ edadMax: 40 }, 1],
            [{ estado: "No contesta (1)" }, 1], [{ estado: "No contesta (2)" }, 1],
            [{ estado: "Solo llamada de aviso" }, 1], [{ estado: "Sin llamadas" }, 101],
            [{ estado: "Cita Aceptada" }, 104],
            [{ texto: "control", sector: "Azul", edadMax: 40 }, 1],
            [{ texto: "control", sector: "Sector prueba", edadMin: 60, edadMax: 80, fechaDesde: desdePasada, fechaHasta: hastaPasada }, 1],
            [{ temporalidad: "Agendamientos próximos" }, 1],
            [{ temporalidad: "Agendamientos futuros" }, 1],
            [{ temporalidad: "Agendamientos atrasados" }, 102],
            [{ rut: "ausente" }, 0]
        ])("equivale al conteo con joins para %j", async (filtros, esperado) => {
            const consulta = construirConsultaCitas(citasFiltrosSchema.parse(filtros), centroA, new Date());
            const control = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
                SELECT COUNT(*) AS total FROM citas c
                JOIN usuarios u ON u.rut = c.rut_usuario
                JOIN solicitudes s ON s.id_solicitud = c.solicitud_id
                ${consulta.where}
            `);
            const resultado = await getCitasPendientes(filtros);
            if (!resultado.ok) throw new Error(resultado.error);
            expect(Number(control[0].total)).toBe(esperado);
            expect(resultado.data.total).toBe(esperado);
            if (esperado <= 100) expect(resultado.data.filas).toHaveLength(esperado);
        });

        it("filtra por profesional/prestacion sin perder equivalencia del conteo", async () => {
            for (const filtros of [{ profesional_id: profesionalId }, { prestacion: nombrePrestacion }, { profesional_id: profesionalId, prestacion: nombrePrestacion, sector: "Azul", texto: "control" }]) {
                const consulta = construirConsultaCitas(citasFiltrosSchema.parse(filtros), centroA, new Date());
                const control = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total FROM citas c JOIN usuarios u ON u.rut = c.rut_usuario JOIN solicitudes s ON s.id_solicitud = c.solicitud_id ${consulta.where}`);
                const resultado = await getCitasPendientes(filtros);
                if (!resultado.ok) throw new Error(resultado.error);
                expect(resultado.data.total).toBe("sector" in filtros ? 1 : 2);
                expect(resultado.data.total).toBe(Number(control[0].total));
            }
        });
    });

});
