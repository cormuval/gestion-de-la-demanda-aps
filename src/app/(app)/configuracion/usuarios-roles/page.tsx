// lib
import { requirePermisoPagina, getSessionPermisos } from "@/shared/lib/permisos";
// components
import { UsuariosRolesView } from "@/modules/configuracion/components/UsuariosRolesView";

export default async function UsuariosRolesPage() {
    await requirePermisoPagina("config.ver");
    const contexto = await getSessionPermisos();
    return <UsuariosRolesView permisos={contexto ? [...contexto.permisos] : []} />;
}
