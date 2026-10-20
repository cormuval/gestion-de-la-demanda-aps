import type { Metadata } from "next";
// config
import { tituloPagina } from "@/config/navegacion";
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { RevisarSolicitudesView } from "@/modules/solicitudes/components/RevisarSolicitudesView";

export const metadata: Metadata = { title: tituloPagina("/solicitudes/gestionar") };

export default async function RevisarSolicitudesPage() {
    await requirePermisoPagina("solicitudes.gestionar");
    return <RevisarSolicitudesView />;
}
