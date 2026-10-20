import type { Metadata } from "next";
// config
import { tituloPagina } from "@/config/navegacion";
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { IngresarSolicitudView } from "@/modules/solicitudes/components/IngresarSolicitudView";

export const metadata: Metadata = { title: tituloPagina("/solicitudes/crear") };

export default async function IngresarSolicitudPage() {
    await requirePermisoPagina("solicitudes.ver");
    return <IngresarSolicitudView />;
}
