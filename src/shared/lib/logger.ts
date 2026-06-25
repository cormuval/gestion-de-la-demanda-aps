import { prisma } from "./prisma";
// types
import { LOG_CATEGORY, LogAction, LogCategory, LogMetadata, LogUser } from "@/shared/types/logger";

class AuditLoggerService {
    async log(
        category: LogCategory,
        action: LogAction,
        success: boolean,
        user: LogUser = {},
        metadata: LogMetadata = {}
    ): Promise<void> {
        try {
            await prisma.auditLog.create({
                data: {
                    category,
                    action,
                    success,
                    user_id: user.id ?? null,
                    user_name: user.name ?? null,
                    user_rut: user.rut ?? null,
                    resource_id: metadata.resourceId ?? null,
                    details: metadata.details?.substring(0, 1000) ?? null,
                    error: metadata.error ?? null
                }
            });
        } catch (error) {
            console.error("❌ Fallo critico al escribir log de auditoria:", { error, intendedLog: { category, action, user, metadata } });
        }
    }

    async logAuth(action: Extract<LogAction, "LOGIN" | "LOGOUT">, success: boolean, user: LogUser = {}, metadata: LogMetadata = {}) {
        await this.log(LOG_CATEGORY.AUTH, action, success, user, metadata);
    }

    async logDataAccess(
        action: Extract<LogAction, "READ" | "SEARCH" | "CREATE" | "UPDATE" | "DELETE">,
        success: boolean,
        user: LogUser,
        resourceId: string,
        metadata: LogMetadata = {}
    ) {
        await this.log(LOG_CATEGORY.DATA_ACCESS, action, success, user, { ...metadata, resourceId });
    }

    async logSecurity(action: LogAction, success: boolean, user: LogUser = {}, metadata: LogMetadata = {}) {
        await this.log(LOG_CATEGORY.SECURITY, action, success, user, metadata);
    }
}

export const AuditLogger = new AuditLoggerService();
