// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { IngresarSolicitudView } from "@/modules/solicitudes/components/IngresarSolicitudView";

export default async function IngresarSolicitudPage() {
    await requirePermisoPagina("solicitudes.ver");
    return <IngresarSolicitudView />;
}
