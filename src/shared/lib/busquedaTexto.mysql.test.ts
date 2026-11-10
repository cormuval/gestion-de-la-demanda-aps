// @vitest-environment node

import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// BD real; solo se sustituyen dependencias de sesion y auditoria.
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { requirePermiso } from "@/shared/lib/permisos";
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

describe.skipIf(!habilitada)("contrato MySQL de busqueda del Gestor (opt-in, BD local exclusiva)", () => {
    const token = randomUUID().slice(0, 8);
    const centroA = `TEST-BUSQUEDA-A-${token}`;
    const centroB = `TEST-BUSQUEDA-B-${token}`;
    const rut = `TEST-BUSQUEDA-${token}`;
    const idObjetivo = `BUSQUEDA-${token}-100`;
    const descripcion = "contról de presión 50%_! ruta\\control O'Brien ' OR 1=1 --";
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
        await db.usuario.create({ data: { rut, nombre: "Paciente", apellido: "Sintetico", sector: "Sector prueba", centro_id: centroA } });
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
    });

    afterAll(async () => {
        if (!db) return;
        try {
            await db.solicitud.deleteMany({ where: { rut_usuario: rut } });
            await db.usuario.deleteMany({ where: { rut } });
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
});
