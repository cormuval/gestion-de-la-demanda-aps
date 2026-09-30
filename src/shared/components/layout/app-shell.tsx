"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
// components
import { Badge } from "@/shared/components/ui/badge";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
    useSidebar
} from "@/shared/components/ui/sidebar";
// config
import { navVisible } from "@/config/navegacion";
import type { Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

interface AppShellProps {
    user: SessionUser;
    permisos: Permiso[];
    children: React.ReactNode;
    defaultOpen?: boolean;
}

interface AppSidebarProps {
    user: SessionUser;
    permisos: Permiso[];
}

export function AppShell({ user, permisos, children, defaultOpen = true }: AppShellProps) {
    return (
        <SidebarProvider
            defaultOpen={defaultOpen}
            style={
                {
                    "--sidebar-width": "16rem",
                    "--sidebar-width-icon": "3rem"
                } as React.CSSProperties
            }
        >
            <AppSidebar user={user} permisos={permisos} />
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-6">
                    <SidebarTrigger aria-label="Alternar menu lateral" />
                    <div className="flex items-center gap-2 md:hidden">
                        <Image src="/assets/logo-cmv.png" alt="Corporacion Municipal Valparaiso" width={32} height={32} className="h-8 w-auto" />
                        <span className="text-sm font-semibold">Gestion Demanda</span>
                    </div>
                </header>
                <div className="px-4 py-6 md:px-8">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}

function AppSidebar({ user, permisos }: AppSidebarProps) {
    const pathname = usePathname();
    const { state, setOpenMobile } = useSidebar();
    const navLinks = navVisible(permisos);
    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    function closeMobileNav() {
        setOpenMobile(false);
    }

    return (
        <Sidebar collapsible="icon" data-testid="app-sidebar-wrapper" data-state={state}>
            <SidebarHeader className="border-b">
                <div className="flex h-14 items-center gap-3 px-2">
                    <div className="flex size-10 items-center justify-center overflow-hidden rounded-md">
                        <Image
                            src="/assets/logo-cmv.png"
                            alt="Corporacion Municipal Valparaiso"
                            width={40}
                            height={40}
                            className="h-10 w-auto"
                            priority
                        />
                    </div>
                    <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                        <p className="truncate text-sm font-semibold">Gestion Demanda</p>
                        <p className="truncate text-xs text-muted-foreground">Valparaiso</p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {navLinks.map(({ href, label, icon: Icon }) => {
                            const active = isActive(href);
                            return (
                                <SidebarMenuItem key={href}>
                                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                                        <Link href={href} onClick={closeMobileNav}>
                                            <Icon />
                                            <span>{label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t">
                <SidebarMenu>
                    <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
                        <div className="flex flex-col gap-2 rounded-md px-2 py-1.5">
                            <p className="truncate text-sm font-medium">{user.nombre}</p>
                            <p className="truncate text-xs text-muted-foreground">{user.centro_nombre || "Sin centro"}</p>
                            <div className="flex">
                                <Badge variant="muted">{user.rol.nombre}</Badge>
                            </div>
                        </div>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Salir" onClick={() => signOut({ redirectTo: "/auth/login" })}>
                            <LogOut />
                            <span>Salir</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
