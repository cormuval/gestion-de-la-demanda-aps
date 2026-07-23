import { PrismaClient } from "@prisma/client";
import { CLAVES_PERMISOS, type Permiso } from "../../src/config/permisos";

const prisma = new PrismaClient();

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

async function main() {
    const roles = await prisma.role.findMany({
        select: {
            id_rol: true,
            nombre_rol: true,
            menus: { select: { ruta: true } },
            _count: { select: { funcionarios: true } }
        },
        orderBy: { id_rol: "asc" }
    });

    console.log(`Derivando permisos para ${roles.length} roles...`);
    let insertados = 0;

    for (const rol of roles) {
        const permisos = derivarPermisos(
            rol.nombre_rol,
            rol.menus.map((menu) => menu.ruta)
        );

        if (permisos.length === 0) {
            console.warn(`WARN  Rol "${rol.nombre_rol}" (id ${rol.id_rol}) queda sin permisos. Funcionarios afectados: ${rol._count.funcionarios}`);
            continue;
        }

        const resultado = await prisma.rolPermiso.createMany({
            data: permisos.map((permiso) => ({ rol_id: rol.id_rol, permiso })),
            skipDuplicates: true
        });
        insertados += resultado.count;
        console.log(`OK    ${rol.nombre_rol.padEnd(26)} ${permisos.length} permisos (${resultado.count} nuevos) · ${rol._count.funcionarios} funcionarios`);
        console.log(`      ${permisos.join(", ")}`);
    }

    console.log(`\nListo. Filas nuevas en roles_permisos: ${insertados}.`);
    console.log("Revisa las lineas WARN antes de desplegar el codigo nuevo.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
