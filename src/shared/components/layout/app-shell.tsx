"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { BarChart3, CalendarDays, LogOut, Megaphone, Settings, ShieldCheck, ClipboardList, UserCog } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
// lib
import { cn } from "@/shared/lib/utils";
// types
import type { MenuItem } from "@/shared/types/session";

const iconByName: Record<string, typeof ClipboardList> = {
    Solicitudes: ClipboardList,
    "Gestion de Citas": CalendarDays,
    Llamados: Megaphone,
    Dashboard: BarChart3,
    Configuracion: Settings,
    "Usuarios y Roles": UserCog
};

const protectedPrefixes = ["/solicitudes", "/comunicador", "/dashboard", "/configuracion"];

function canAccess(menu: MenuItem[], pathname: string): boolean {
    if (pathname.startsWith("/solicitudes")) return menu.some((item) => item.nombre === "Solicitudes");
    return menu.some((item) => pathname === item.ruta || pathname.startsWith(`${item.ruta}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status } = useSession();
    const user = session?.user;
    const loading = status === "loading";

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.replace("/auth/login");
            return;
        }
        const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
        if (isProtected && !canAccess(user.menu, pathname)) {
            router.replace(user.menu?.[0]?.ruta || "/auth/login");
        }
    }, [loading, user, pathname, router]);

    const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
    if (loading || !user || (isProtected && !canAccess(user.menu, pathname))) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">Cargando acceso...</div>
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-card md:flex md:flex-col">
                <div className="border-b p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Gestion Demanda</p>
                            <p className="text-xs text-muted-foreground">Valparaiso</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 p-3">
                    {user.menu.map((item) => {
                        const Icon = iconByName[item.nombre] || ClipboardList;
                        const active = pathname === item.ruta || pathname.startsWith(`${item.ruta}/`);
                        return (
                            <Link
                                key={`${item.id}-${item.ruta}`}
                                href={item.ruta}
                                className={cn(
                                    "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon size={18} />
                                <span>{item.nombre}</span>
                            </Link>
                        );
                    })}
                    {user.menu.some((item) => item.nombre === "Solicitudes") && (
                        <Link
                            href="/solicitudes/revisar"
                            className={cn(
                                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                                pathname.startsWith("/solicitudes/revisar") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <ClipboardList size={18} />
                            <span>Revisar solicitudes</span>
                        </Link>
                    )}
                </nav>

                <div className="border-t p-4">
                    <div className="mb-3 space-y-2">
                        <p className="truncate text-sm font-medium">{user.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.centro_nombre || "Sin centro"}</p>
                        <div className="flex items-center gap-2">
                            <Badge variant="muted">{user.rol.nombre}</Badge>
                        </div>
                    </div>
                    <Button variant="outline" className="w-full justify-start" onClick={() => signOut({ redirectTo: "/auth/login" })}>
                        <LogOut size={16} />
                        Salir
                    </Button>
                </div>
            </aside>

            <div className="md:pl-72">
                <header className="sticky top-0 z-10 border-b bg-card/95 px-4 py-3 backdrop-blur md:hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Gestion Demanda</span>
                        <Button variant="ghost" size="sm" onClick={() => signOut({ redirectTo: "/auth/login" })}>
                            Salir
                        </Button>
                    </div>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {user.menu.map((item) => (
                            <Link key={item.id} href={item.ruta} className="whitespace-nowrap rounded-md border px-3 py-2 text-sm">
                                {item.nombre}
                            </Link>
                        ))}
                    </div>
                </header>
                <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
            </div>
        </div>
    );
}
