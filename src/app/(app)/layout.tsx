import { cookies } from "next/headers";
import { redirect } from "next/navigation";
// lib
import { getSessionPermisos } from "@/shared/lib/permisos";
import { prisma } from "@/shared/lib/prisma";
// components
import { AppShell } from "@/shared/components/layout/app-shell";
// utils
import { puedeCambiarCentroPropio } from "@/modules/configuracion/utils/privilegios";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const contexto = await getSessionPermisos();
    if (!contexto) redirect("/auth/login");

    const cookieStore = await cookies();
    const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

    const centros = puedeCambiarCentroPropio(contexto.permisos)
        ? await prisma.centro.findMany({
              select: { id_centro: true, nombre_centro: true },
              orderBy: { nombre_centro: "asc" }
          })
        : undefined;

    return (
        <AppShell user={contexto.user} permisos={[...contexto.permisos]} defaultOpen={defaultOpen} centros={centros}>
            {children}
        </AppShell>
    );
}
