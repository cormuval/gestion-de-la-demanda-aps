// config
import { PERMISOS, type Permiso } from "@/config/permisos";

export const NOMBRE_ROL_RESERVADO = "Administrador";

export const MENSAJES_PRIVILEGIOS = {
    funcionarioSuperior: "No puedes editar a un funcionario con mas privilegios que tu",
    autoFuncionario: "No puedes cambiar tu propio rol, estado o centro",
    autoRol: "No puedes renombrar ni desactivar tu propio rol",
    rolSuperior: "No puedes editar un rol con mas privilegios que el tuyo",
    nombreReservado: "El nombre «Administrador» esta reservado",
    quitarConfigRolesPropio: "No puedes quitar el permiso de editar roles a tu propio rol",
    ultimoAdministrador: "Debe quedar al menos un administrador activo"
} as const;

export interface RolEvaluado {
    id_rol: number;
    nombre_rol: string;
    estado: string;
    permisos: ReadonlySet<Permiso>;
}

export interface FuncionarioEvaluado {
    rut: string;
    rol_id: number;
    estado: string;
    centro_id: string | null;
    rol: RolEvaluado;
}

export interface AdminEvaluado {
    rut: string;
    rol_id: number;
}

export type CambioAdmin = { tipo: "funcionario"; rut: string } | { tipo: "rol"; rol_id: number };

export interface EdicionFuncionarioCtx {
    actorRut: string;
    actorPermisos: ReadonlySet<Permiso>;
    funcionarioActual: FuncionarioEvaluado | null;
    rolDestino: RolEvaluado;
    data: { rol_id: number; estado: string; centro_id: string | null };
    quedaAdmin: boolean;
}

export interface EdicionRolCtx {
    actorRolId: number;
    actorPermisos: ReadonlySet<Permiso>;
    rolActual: RolEvaluado | null;
    data: { nombre_rol: string; estado: string };
    quedaAdmin: boolean;
}

export interface PermisosRolCtx {
    actorRolId: number;
    actorPermisos: ReadonlySet<Permiso>;
    rolActual: RolEvaluado;
    permisosResultantes: Permiso[];
    quedaAdmin: boolean;
}

export function esSubconjunto(permisos: Iterable<Permiso>, de: ReadonlySet<Permiso>): boolean {
    for (const permiso of permisos) {
        if (!de.has(permiso)) return false;
    }
    return true;
}

export function permisosFaltantes(permisos: Iterable<Permiso>, de: ReadonlySet<Permiso>): Permiso[] {
    return [...permisos].filter((permiso) => !de.has(permiso));
}

export function esNombreReservado(nombre: string): boolean {
    return nombre.trim().toLocaleLowerCase("es-CL") === NOMBRE_ROL_RESERVADO.toLocaleLowerCase("es-CL");
}

export function rolTienePermiso(rol: RolEvaluado | null, permiso: Permiso): boolean {
    return Boolean(rol?.permisos.has(permiso));
}

export function quedaAdministrador(admins: AdminEvaluado[], cambio: CambioAdmin): boolean {
    return admins.some((admin) => {
        if (cambio.tipo === "funcionario") return admin.rut !== cambio.rut;
        return admin.rol_id !== cambio.rol_id;
    });
}

export function validarAsignacionRol(actor: ReadonlySet<Permiso>, rolDestino: RolEvaluado): string | null {
    if (!esSubconjunto(rolDestino.permisos, actor)) {
        return `No puedes asignar el rol «${rolDestino.nombre_rol}»: incluye permisos que tu rol no tiene`;
    }
    return null;
}

export function validarEdicionFuncionario(ctx: EdicionFuncionarioCtx): string | null {
    if (!ctx.funcionarioActual) return null;

    if (!esSubconjunto(ctx.funcionarioActual.rol.permisos, ctx.actorPermisos)) {
        return MENSAJES_PRIVILEGIOS.funcionarioSuperior;
    }

    if (
        ctx.funcionarioActual.rut === ctx.actorRut &&
        (ctx.funcionarioActual.rol_id !== ctx.data.rol_id ||
            ctx.funcionarioActual.estado !== ctx.data.estado ||
            (ctx.funcionarioActual.centro_id ?? "") !== (ctx.data.centro_id ?? ""))
    ) {
        return MENSAJES_PRIVILEGIOS.autoFuncionario;
    }

    const eraAdmin = ctx.funcionarioActual.estado === "Activo" && ctx.funcionarioActual.rol.estado === "Activo" && ctx.funcionarioActual.rol.permisos.has("config.roles");
    const sigueAdmin = ctx.data.estado === "Activo" && ctx.rolDestino.estado === "Activo" && ctx.rolDestino.permisos.has("config.roles");

    if (eraAdmin && !sigueAdmin && !ctx.quedaAdmin) {
        return MENSAJES_PRIVILEGIOS.ultimoAdministrador;
    }

    return null;
}

export function validarEdicionRol(ctx: EdicionRolCtx): string | null {
    const nombreActualReservado = ctx.rolActual ? esNombreReservado(ctx.rolActual.nombre_rol) : false;
    const nombreNuevoReservado = esNombreReservado(ctx.data.nombre_rol);
    const renombra = ctx.rolActual ? ctx.rolActual.nombre_rol.trim() !== ctx.data.nombre_rol.trim() : false;
    if ((!ctx.rolActual && nombreNuevoReservado) || (ctx.rolActual && renombra && (nombreActualReservado || nombreNuevoReservado))) {
        return MENSAJES_PRIVILEGIOS.nombreReservado;
    }

    if (!ctx.rolActual) return null;

    if (ctx.rolActual.id_rol === ctx.actorRolId && (ctx.rolActual.nombre_rol !== ctx.data.nombre_rol || ctx.rolActual.estado !== ctx.data.estado)) {
        return MENSAJES_PRIVILEGIOS.autoRol;
    }

    if (!esSubconjunto(ctx.rolActual.permisos, ctx.actorPermisos)) {
        return MENSAJES_PRIVILEGIOS.rolSuperior;
    }

    if (ctx.rolActual.estado === "Activo" && ctx.rolActual.permisos.has("config.roles") && ctx.data.estado !== "Activo" && !ctx.quedaAdmin) {
        return MENSAJES_PRIVILEGIOS.ultimoAdministrador;
    }

    return null;
}

export function validarPermisosRol(ctx: PermisosRolCtx): string | null {
    if (!esSubconjunto(ctx.rolActual.permisos, ctx.actorPermisos)) {
        return MENSAJES_PRIVILEGIOS.rolSuperior;
    }

    const faltantes = permisosFaltantes(ctx.permisosResultantes, ctx.actorPermisos);
    if (faltantes.length > 0) {
        const etiquetas = faltantes.map((permiso) => PERMISOS[permiso].etiqueta).join(", ");
        return `No puedes otorgar permisos que tu rol no tiene: ${etiquetas}`;
    }

    if (ctx.rolActual.id_rol === ctx.actorRolId && !ctx.permisosResultantes.includes("config.roles")) {
        return MENSAJES_PRIVILEGIOS.quitarConfigRolesPropio;
    }

    if (ctx.rolActual.permisos.has("config.roles") && !ctx.permisosResultantes.includes("config.roles") && !ctx.quedaAdmin) {
        return MENSAJES_PRIVILEGIOS.ultimoAdministrador;
    }

    return null;
}
