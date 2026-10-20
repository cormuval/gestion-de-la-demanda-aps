import type { Metadata } from "next";
// config
import { tituloPagina } from "@/config/navegacion";
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { HistorialPacienteView } from "@/modules/historial/components/HistorialPacienteView";

export const metadata: Metadata = { title: tituloPagina("/historial") };

export default async function HistorialPage() {
    await requirePermisoPagina("historial.ver");
    return <HistorialPacienteView />;
}
