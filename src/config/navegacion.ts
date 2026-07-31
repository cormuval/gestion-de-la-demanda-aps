import { BarChart3, ClipboardList, ClipboardCheck, Megaphone, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
// config
import type { Permiso } from "@/config/permisos";

export interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    permiso: Permiso;
}

// Orden del menu lateral. Reemplaza a la tabla `menu`: la visibilidad la da el permiso.
export const NAV: readonly NavItem[] = [
    { label: "Solicitudes", href: "/solicitudes/ingresar", icon: ClipboardList, permiso: "solicitudes.ver" },
    { label: "Revisar solicitudes", href: "/solicitudes/revisar", icon: ClipboardCheck, permiso: "solicitudes.gestionar" },
    { label: "Llamadas", href: "/comunicador", icon: Megaphone, permiso: "comunicador.ver" },
    { label: "Dashboard", href: "/dashboard", icon: BarChart3, permiso: "dashboard.ver" },
    { label: "SOME", href: "/some", icon: ShieldCheck, permiso: "some.ver" },
    { label: "Configuracion", href: "/configuracion/usuarios-roles", icon: Settings, permiso: "config.ver" }
];

export function navVisible(permisos: readonly Permiso[]): NavItem[] {
    return NAV.filter((item) => permisos.includes(item.permiso));
}
