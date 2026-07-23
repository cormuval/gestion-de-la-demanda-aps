// lib
import { requirePermisoPagina } from "@/shared/lib/permisos";
// components
import { ComunicadorView } from "@/modules/comunicador/components/ComunicadorView";

export default async function ComunicadorPage() {
    await requirePermisoPagina("comunicador.ver");
    return <ComunicadorView />;
}
