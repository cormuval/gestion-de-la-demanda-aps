// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { DashboardView } from "@/modules/dashboard/components/DashboardView";

export default async function DashboardPage() {
    await requirePermisoPagina("dashboard.ver");
    return <DashboardView />;
}
