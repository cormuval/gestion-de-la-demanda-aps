import { CLAVES_PERMISOS, type Permiso } from "../../src/config/permisos";

// Copias congeladas de las listas hardcodeadas que existian antes del RBAC.
// Se conservan aqui porque representan el estado de acceso a preservar.
const ROLES_SOLICITUDES_LEGADO = ["Administrador", "Orientador", "SOME", "Orientador y Comunicador", "Full"];
const ROLES_COMUNICADOR_LEGADO = ["Administrador", "Comunicador", "SOME", "Orientador y Comunicador", "Gestor y Comunicador", "Full"];
const ROLES_CONFIGURACION_LEGADO = ["Administrador", "SOME", "Full"];

// Union de lo que otorga el menu y lo que otorgaban las listas hardcodeadas.
export function derivarPermisos(nombreRol: string, rutasMenu: string[]): Permiso[] {
    const permisos = new Set<Permiso>();
    const tieneRuta = (prefijo: string) => rutasMenu.some((ruta) => ruta.startsWith(prefijo));

    if (tieneRuta("/solicitudes")) {
        permisos.add("solicitudes.ver");
        permisos.add("solicitudes.crear");
    }
    if (ROLES_SOLICITUDES_LEGADO.includes(nombreRol)) {
        permisos.add("solicitudes.ver");
        permisos.add("solicitudes.crear");
        permisos.add("solicitudes.gestionar");
    }
    if (tieneRuta("/comunicador") || ROLES_COMUNICADOR_LEGADO.includes(nombreRol)) {
        permisos.add("comunicador.ver");
        permisos.add("comunicador.llamar");
        permisos.add("comunicador.paciente");
    }
    if (tieneRuta("/dashboard")) {
        permisos.add("dashboard.ver");
    }
    if (tieneRuta("/configuracion")) {
        permisos.add("config.ver");
    }
    if (ROLES_CONFIGURACION_LEGADO.includes(nombreRol)) {
        permisos.add("config.ver");
        permisos.add("config.funcionarios");
        permisos.add("config.roles");
        permisos.add("config.catalogos");
    }

    return CLAVES_PERMISOS.filter((clave) => permisos.has(clave));
}

// Este script ya fue aplicado en produccion y la tabla `menu` de la que derivaba
// los permisos fue eliminada del esquema. Se conserva por trazabilidad de la
// migracion a RBAC (docs/superpowers/specs/2026-07-23-rbac-permisos-design.md); la
// funcion pura `derivarPermisos` sigue exportada y cubierta por derivar-permisos.test.ts.
function main() {
    console.log("Este script ya fue aplicado: la tabla `menu` fue eliminada del esquema.");
    console.log("Se conserva por trazabilidad de la migracion a RBAC. La derivacion sigue testeada en derivar-permisos.test.ts.");
}

main();
