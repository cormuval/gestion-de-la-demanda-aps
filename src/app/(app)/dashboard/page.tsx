import type { Metadata } from "next";
// config
import { tituloPagina } from "@/config/navegacion";
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { DashboardView } from "@/modules/dashboard/components/DashboardView";

export const metadata: Metadata = { title: tituloPagina("/dashboard") };

export default async function DashboardPage() {
    await requirePermisoPagina("dashboard.ver");
    return <DashboardView />;
}
