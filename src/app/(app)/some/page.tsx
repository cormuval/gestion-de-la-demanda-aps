import type { Metadata } from "next";
// config
import { tituloPagina } from "@/config/navegacion";
import { requirePermisoPagina } from "@/shared/lib/permisos";
import { SomeView } from "@/modules/some/components/SomeView";

export const metadata: Metadata = { title: tituloPagina("/some") };

export default async function SomePage() {
    await requirePermisoPagina("some.ver");
    return <SomeView />;
}
