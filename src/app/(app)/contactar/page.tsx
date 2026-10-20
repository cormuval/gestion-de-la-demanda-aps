import type { Metadata } from "next";
// config
import { tituloPagina } from "@/config/navegacion";
// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { ComunicadorView } from "@/modules/comunicador/components/ComunicadorView";

export const metadata: Metadata = { title: tituloPagina("/contactar") };

export default async function ComunicadorPage() {
    await requirePermisoPagina("comunicador.ver");
    return <ComunicadorView />;
}
