"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
// components
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
// lib
import { cn } from "@/shared/lib/utils";
// config
import { navVisible } from "@/config/navegacion";
import type { Permiso } from "@/config/permisos";
// types
import type { SessionUser } from "@/shared/types/session";

interface AppShellProps {
    user: SessionUser;
    permisos: Permiso[];
    children: React.ReactNode;
}

export function AppShell({ user, permisos, children }: AppShellProps) {
    const pathname = usePathname();
    const navLinks = navVisible(permisos);
    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    return (
        <div className="min-h-screen bg-background">
            <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-card md:flex md:flex-col">
                <div className="border-b p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md">
                            <Image
                                src="/assets/logo-cmv.png"
                                alt="Corporacion Municipal Valparaiso"
                                width={40}
                                height={40}
                                className="h-10 w-auto"
                                priority
                            />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Gestion Demanda</p>
                            <p className="text-xs text-muted-foreground">Valparaiso</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 p-3">
                    {navLinks.map(({ href, label, icon: Icon }) => {
                        const active = isActive(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon size={18} />
                                <span>{label}</span>
                            </Link>
                        );
                    })}
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
                        <div className="flex items-center gap-2">
                            <Image
                                src="/assets/logo-cmv.png"
                                alt="Corporacion Municipal Valparaiso"
                                width={32}
                                height={32}
                                className="h-8 w-auto"
                            />
                            <span className="text-sm font-semibold">Gestion Demanda</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => signOut({ redirectTo: "/auth/login" })}>
                            Salir
                        </Button>
                    </div>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {navLinks.map(({ href, label }) => (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "whitespace-nowrap rounded-md border px-3 py-2 text-sm",
                                    isActive(href) ? "bg-primary text-primary-foreground" : ""
                                )}
                            >
                                {label}
                            </Link>
                        ))}
                    </div>
                </header>
                <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
            </div>
        </div>
    );
}
