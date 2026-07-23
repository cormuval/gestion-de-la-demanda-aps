import { cache } from "react";
import { auth } from "@/auth";
import { SessionUser } from "@/shared/types/session";

// Se cachea por request: requirePermiso/requirePermisoPagina llaman a getSessionUser en cada
// guard (pagina + cada action), y sin cache cada llamada re-dispara auth() y con eso el callback
// jwt de src/auth.ts, que consulta funcionario (y a veces centro) contra la BD.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
    const session = await auth();
    if (!session?.user?.rut) return null;
    const u = session.user;
    return { rut: u.rut, email: u.email ?? "", nombre: u.nombre, centro_id: u.centro_id, centro_nombre: u.centro_nombre, rol: u.rol };
});
