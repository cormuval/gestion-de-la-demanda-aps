export const LOG_CATEGORY = {
    AUTH: "AUTH",
    DATA_ACCESS: "DATA_ACCESS",
    SECURITY: "SECURITY",
    SYSTEM: "SYSTEM"
} as const;

export const LOG_ACTION = {
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
    READ: "READ",
    SEARCH: "SEARCH",
    CREATE: "CREATE",
    UPDATE: "UPDATE",
    DELETE: "DELETE"
} as const;

export type LogCategory = (typeof LOG_CATEGORY)[keyof typeof LOG_CATEGORY];
export type LogAction = (typeof LOG_ACTION)[keyof typeof LOG_ACTION];

export interface LogUser {
    id?: string;
    name?: string;
    rut?: string;
}

export interface LogMetadata {
    resourceId?: string;
    details?: string;
    error?: string;
}
