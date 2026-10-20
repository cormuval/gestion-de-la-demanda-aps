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
});
