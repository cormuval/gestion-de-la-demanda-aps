import type { Metadata } from "next";
// config
import { tituloPagina } from "@/config/navegacion";
// lib
import { requirePermisoPagina, getSessionPermisos } from "@/shared/lib/permisos";
// components
import { UsuariosRolesView } from "@/modules/configuracion/components/UsuariosRolesView";

export const metadata: Metadata = { title: tituloPagina("/configuracion/usuarios-roles") };

export default async function UsuariosRolesPage() {
    await requirePermisoPagina("config.ver");
    const contexto = await getSessionPermisos();
    return (
        <UsuariosRolesView
            permisos={contexto ? [...contexto.permisos] : []}
            actor={contexto ? { rut: contexto.user.rut, rolId: contexto.user.rol.id } : null}
        />
    );
}
