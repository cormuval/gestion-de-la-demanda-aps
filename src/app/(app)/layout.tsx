import { redirect } from "next/navigation";
// lib
import { getSessionPermisos } from "@/shared/lib/permisos";
// components
import { AppShell } from "@/shared/components/layout/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const contexto = await getSessionPermisos();
    if (!contexto) redirect("/auth/login");
    return (
        <AppShell user={contexto.user} permisos={[...contexto.permisos]}>
            {children}
        </AppShell>
    );
}
