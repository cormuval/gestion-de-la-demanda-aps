// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { HistorialPacienteView } from "@/modules/historial/components/HistorialPacienteView";

export default async function HistorialPage() {
    await requirePermisoPagina("historial.ver");
    return <HistorialPacienteView />;
}
