// Pagina de destino cuando requirePermisoPagina rechaza el acceso.
// No lleva guard: es accesible para cualquier sesion valida (ver paginas-protegidas.test.ts).
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin acceso" };

export default function SinAccesoPage() {
    return (
        <div className="mx-auto max-w-lg rounded-lg border bg-card p-8 text-center">
            <h1 className="text-lg font-semibold">Sin acceso</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                Tu rol no tiene permisos para ver esta seccion. Si crees que es un error, contacta al administrador del sistema.
            </p>
        </div>
    );
}
