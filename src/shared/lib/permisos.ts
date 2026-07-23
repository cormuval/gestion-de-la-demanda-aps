import { cache } from "react";
import { redirect } from "next/navigation";
// lib
import { prisma } from "@/shared/lib/prisma";
import { getSessionUser } from "@/shared/lib/auth";
import { esEstadoActivo } from "@/shared/lib/access";
// config
import { esPermiso, type Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

export interface ContextoPermisos {
    user: SessionUser;
    permisos: Set<Permiso>;
}

// Lee los permisos del rol una sola vez por request.
// Un rol inactivo o inexistente se resuelve como conjunto vacio.
export const getPermisosRol = cache(async (rolId: number): Promise<Set<Permiso>> => {
    const rol = await prisma.role.findUnique({
        where: { id_rol: rolId },
        select: { estado: true, permisos: { select: { permiso: true } } }
    });
    if (!rol || !esEstadoActivo(rol.estado)) return new Set<Permiso>();
    return new Set(rol.permisos.map((fila) => fila.permiso).filter(esPermiso));
});

export async function getSessionPermisos(): Promise<ContextoPermisos | null> {
    const user = await getSessionUser();
    if (!user) return null;
    return { user, permisos: await getPermisosRol(user.rol.id) };
}

function cumple(permisos: Set<Permiso>, requeridos: Permiso[]): boolean {
    return requeridos.some((permiso) => permisos.has(permiso));
}

// Para Server Actions: lanza si falta el permiso. Semantica OR entre los requeridos.
export async function requirePermiso(...requeridos: Permiso[]): Promise<SessionUser> {
    const contexto = await getSessionPermisos();
    if (!contexto) throw new Error("No autenticado");
    if (!cumple(contexto.permisos, requeridos)) throw new Error("No tienes permiso para esta operacion");
    return contexto.user;
}

// Para paginas server: redirige en vez de lanzar. Semantica OR entre los requeridos.
export async function requirePermisoPagina(...requeridos: Permiso[]): Promise<SessionUser> {
    const contexto = await getSessionPermisos();
    if (!contexto) redirect("/auth/login");
    if (!cumple(contexto.permisos, requeridos)) redirect("/sin-acceso");
    return contexto.user;
}
