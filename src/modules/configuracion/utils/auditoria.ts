// lib
import { AuditLogger } from "@/shared/lib/logger";

export async function logBloqueo(accion: "CREATE" | "UPDATE", user: { rut: string; nombre: string }, resourceId: string, regla: string, error: string) {
    await AuditLogger.logSecurity(accion, false, { rut: user.rut, name: user.nombre }, { resourceId, details: regla, error });
}
