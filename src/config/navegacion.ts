import { BarChart3, ClipboardList, ClipboardCheck, History, Megaphone, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
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
    { label: "Historial del paciente", href: "/historial", icon: History, permiso: "historial.ver" },
    { label: "Dashboard", href: "/dashboard", icon: BarChart3, permiso: "dashboard.ver" },
    { label: "SOME", href: "/some", icon: ShieldCheck, permiso: "some.ver" },
    { label: "Configuracion", href: "/configuracion/usuarios-roles", icon: Settings, permiso: "config.ver" }
];

// Titulo de la pestana del navegador: el mismo nombre que ve el usuario en el menu.
export function tituloPagina(href: string): string {
    const item = NAV.find((nav) => nav.href === href);
    if (!item) throw new Error(`Ruta sin item de menu: ${href}`);
    return item.label;
}

export function navVisible(permisos: readonly Permiso[]): NavItem[] {
    return NAV.filter((item) => permisos.includes(item.permiso));
}
