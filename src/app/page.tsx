import { redirect } from "next/navigation";
// lib
import { getSessionPermisos } from "@/shared/lib/permisos";
// config
import { navVisible } from "@/config/navegacion";

export default async function HomePage() {
    const contexto = await getSessionPermisos();
    if (!contexto) redirect("/auth/login");

    const [primerItem] = navVisible([...contexto.permisos]);
    redirect(primerItem ? primerItem.href : "/sin-acceso");
}
