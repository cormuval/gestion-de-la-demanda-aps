// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { UsuariosRolesView } from "@/modules/configuracion/components/UsuariosRolesView";

export default async function UsuariosRolesPage() {
    await requirePermisoPagina("config.ver");
    return <UsuariosRolesView />;
}
