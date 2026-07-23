// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { RevisarSolicitudesView } from "@/modules/solicitudes/components/RevisarSolicitudesView";

export default async function RevisarSolicitudesPage() {
    await requirePermisoPagina("solicitudes.gestionar");
    return <RevisarSolicitudesView />;
}
