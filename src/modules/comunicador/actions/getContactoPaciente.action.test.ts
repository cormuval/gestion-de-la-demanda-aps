import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/prisma", () => ({
    prisma: {
        usuario: { findUnique: vi.fn() }
    }
}));
vi.mock("@/shared/lib/permisos", () => ({
    requirePermiso: vi.fn()
}));

import { prisma } from "@/shared/lib/prisma";
import { requirePermiso } from "@/shared/lib/permisos";
import { getContactoPaciente } from "./getContactoPaciente.action";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getContactoPaciente", () => {
    it("rol comunicador obtiene contacto formateado", async () => {
        (requirePermiso as any).mockResolvedValue({ rut: "1-9", email: "c@x.cl", nombre: "Com", centro_id: "501", rol: { id: 3, nombre: "Comunicador" } });
        (prisma.usuario.findUnique as any).mockResolvedValue({
            telefono: "+56912345678",
            telefono_alternativo: null,
            correo_contacto: "paciente@demo.local"
        });

        const contacto = await getContactoPaciente("12.345.678-9");

        expect(contacto).toEqual({ telefonos: "+56912345678", correo: "paciente@demo.local" });
    });

    it("propaga el rechazo cuando falta el permiso", async () => {
        (requirePermiso as any).mockRejectedValue(new Error("No tienes permiso para esta operacion"));

        await expect(getContactoPaciente("12.345.678-9")).rejects.toThrow("No tienes permiso");
        expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });
});
