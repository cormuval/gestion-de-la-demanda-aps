import { requirePermisoPagina } from "@/shared/lib/permisos";
import { SomeView } from "@/modules/some/components/SomeView";

export default async function SomePage() {
    await requirePermisoPagina("some.ver");
    return <SomeView />;
}
