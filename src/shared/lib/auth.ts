import { auth } from "@/auth";
import { SessionUser } from "@/shared/types/session";

export async function getSessionUser(): Promise<SessionUser | null> {
    const session = await auth();
    if (!session?.user?.rut) return null;
    const u = session.user;
    return { rut: u.rut, email: u.email ?? "", nombre: u.nombre, centro_id: u.centro_id, centro_nombre: u.centro_nombre, rol: u.rol, menu: u.menu };
}

export async function requireSessionUser(): Promise<SessionUser> {
    const user = await getSessionUser();
    if (!user) throw new Error("No autenticado");
    return user;
}
