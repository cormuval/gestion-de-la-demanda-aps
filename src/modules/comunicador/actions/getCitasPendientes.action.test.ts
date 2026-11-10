import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { getCitasPendientes } from "./getCitasPendientes.action";
import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { AuditLogger } from "@/shared/lib/logger";
import { limpiarDedupBusquedas } from "@/shared/lib/auditoriaBusquedas";

const funcionario = { rut: "1-9", email: "comunicador@aps.cl", nombre: "Comunicador", centro_id: "501", rol: { id: 3, nombre: "Comunicador" } };

beforeEach(() => {
    vi.clearAllMocks();
    limpiarDedupBusquedas();
    vi.mocked(requirePermiso).mockResolvedValue(funcionario as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
});

describe("getCitasPendientes", () => {
    it("informa el problema de configuracion cuando el funcionario no tiene centro", async () => {
        vi.mocked(requirePermiso).mockResolvedValue({ ...funcionario, centro_id: null } as never);

        await expect(getCitasPendientes({ pagina: 1 })).resolves.toEqual({
            ok: false,
            error: "El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion."
        });
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("envuelve una lista vacia como lectura exitosa", async () => {
        await expect(getCitasPendientes({ pagina: 1 })).resolves.toEqual({
            ok: true,
            data: { filas: [], total: 0, pagina: 1, porPagina: 100 }
        });
    });

    it("propaga los fallos de permisos", async () => {
        vi.mocked(requirePermiso).mockRejectedValue(new Error("No tienes permiso para esta operacion"));

        await expect(getCitasPendientes({ pagina: 1 })).rejects.toThrow("No tienes permiso");
    });

    it("propaga los fallos de Prisma", async () => {
        vi.mocked(prisma.$queryRaw).mockReset().mockRejectedValueOnce(new Error("Base de datos no disponible"));

        await expect(getCitasPendientes({ pagina: 1 })).rejects.toThrow("Base de datos no disponible");
    });

    it("no repite el registro de auditoria si la misma busqueda se repite enseguida", async () => {
        await getCitasPendientes({ pagina: 1 });
        await getCitasPendientes({ pagina: 1 });

        expect(AuditLogger.logDataAccess).toHaveBeenCalledTimes(1);
    });

    it("registra la auditoria de nuevo si la misma busqueda se hace en otro centro", async () => {
        await getCitasPendientes({ pagina: 1 });
        vi.mocked(requirePermiso).mockResolvedValue({ ...funcionario, centro_id: "655" } as never);
        await getCitasPendientes({ pagina: 1 });

        expect(AuditLogger.logDataAccess).toHaveBeenCalledTimes(2);
    });

    it("registra la auditoria de nuevo si los filtros cambian", async () => {
        await getCitasPendientes({ pagina: 1 });
        await getCitasPendientes({ pagina: 1, rut: "11.111.111-1" });

        expect(AuditLogger.logDataAccess).toHaveBeenCalledTimes(2);
    });

    it("selecciona priorizacion_clinica y ordena por priorizacion DESC con desempate por fecha estimada e id", async () => {
        await getCitasPendientes({ pagina: 1 });

        const llamada = vi.mocked(prisma.$queryRaw).mock.calls[0] ?? [];
        const textoSql = llamada
            .map((arg) => {
                if (Array.isArray(arg)) return arg.join(" ");
                if (arg && typeof arg === "object" && "sql" in arg) return String((arg as { sql: string }).sql);
                return String(arg ?? "");
            })
            .join(" ");

        expect(textoSql).toContain("u.nombre_social AS nombre_social");
        expect(textoSql).toContain("c.priorizacion_clinica AS priorizacion_clinica");
        expect(textoSql).toContain("ORDER BY c.priorizacion DESC, c.fecha_estimada_atencion ASC, c.id_cita ASC");
        expect(textoSql).not.toContain("FIELD(c.estado_cita");
    });
});

// Prisma se sustituye en el limite externo; se inspecciona el SQL realmente emitido.
describe("busqueda de observaciones de citas", () => {
    it.each([{ texto: "a".repeat(201) }, { texto: null }, { pagina: 0 }, { edadMin: -1 }])("devuelve ResultadoAccion para filtros invalidos sin consultar BD", async (filtros) => {
        const resultado = await getCitasPendientes(filtros);
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) expect(resultado.error).toContain("Filtros invalidos");
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
        expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
    });

    it("aplica el fragmento literal en pagina y total conservando 100 filas y offset", async () => {
        await getCitasPendientes({ texto: "  50%_! O'Brien  ", pagina: 2 });
        const consultas = vi.mocked(prisma.$queryRaw).mock.calls.map((args) =>
            Prisma.sql(args[0] as TemplateStringsArray, ...args.slice(1))
        );
        expect(consultas).toHaveLength(2);
        for (const consulta of consultas) {
            expect(consulta.sql).toContain("c.observacion LIKE ? ESCAPE '!'");
            expect(consulta.values).toContain("%50!%!_!! O'Brien%");
            expect(consulta.sql).not.toContain("O'Brien");
        }
        expect(consultas[0].values.slice(-2)).toEqual([100, 100]);
        expect(consultas[0].sql).toContain("s.disponibilidad_llamada AS disponibilidad");
        expect(consultas[0].sql).toContain("u.nombre_social AS nombre_social");
        expect(consultas[0].sql).toContain("SELECT COUNT(*) FROM llamadas ll");
        expect(consultas[0].sql).toContain("EXISTS(SELECT 1 FROM llamadas lh");
        expect(consultas[1].sql).not.toContain("JOIN");
    });
});
