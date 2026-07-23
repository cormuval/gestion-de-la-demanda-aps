// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { StagePlaceholder } from "@/shared/components/layout/stage-placeholder";

export default async function DashboardPage() {
    await requirePermisoPagina("dashboard.ver");
    return <StagePlaceholder title="Dashboard" description="Modulo reservado para indicadores de solicitudes, citas y llamados." />;
}
