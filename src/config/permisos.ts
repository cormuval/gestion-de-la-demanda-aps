// Catalogo unico de permisos del sistema.
// La fuente de verdad de que permisos existen es este archivo; la BD solo guarda
// que rol tiene cada clave (tabla roles_permisos).
export const PERMISOS = {
    "solicitudes.ver": { modulo: "Solicitudes", etiqueta: "Ver solicitudes" },
    "solicitudes.crear": { modulo: "Solicitudes", etiqueta: "Ingresar solicitud" },
    "solicitudes.gestionar": { modulo: "Solicitudes", etiqueta: "Revisar y gestionar" },
    "comunicador.ver": { modulo: "Comunicador", etiqueta: "Ver citas y llamados" },
    "comunicador.llamar": { modulo: "Comunicador", etiqueta: "Registrar llamada" },
    "comunicador.paciente": { modulo: "Comunicador", etiqueta: "Editar datos del paciente" },
    "dashboard.ver": { modulo: "Dashboard", etiqueta: "Ver indicadores" },
    "some.ver": { modulo: "SOME", etiqueta: "Ver panel SOME" },
    "config.ver": { modulo: "Configuracion", etiqueta: "Ver configuracion" },
    "config.funcionarios": { modulo: "Configuracion", etiqueta: "Editar funcionarios" },
    "config.roles": { modulo: "Configuracion", etiqueta: "Editar roles y permisos" },
    "config.catalogos": { modulo: "Configuracion", etiqueta: "Editar catalogos" },
    "historial.ver": { modulo: "Historial", etiqueta: "Ver historial del paciente" }
} as const;

export type Permiso = keyof typeof PERMISOS;

export const CLAVES_PERMISOS = Object.keys(PERMISOS) as Permiso[];

export interface PermisoDescrito {
    clave: Permiso;
    etiqueta: string;
}

export interface GrupoPermisos {
    modulo: string;
    permisos: PermisoDescrito[];
}

export function esPermiso(valor: string): valor is Permiso {
    return Object.prototype.hasOwnProperty.call(PERMISOS, valor);
}

// Agrupa el catalogo por modulo para pintar la matriz del mantenedor.
export function agruparPermisos(): GrupoPermisos[] {
    const grupos: GrupoPermisos[] = [];
    for (const clave of CLAVES_PERMISOS) {
        const { modulo, etiqueta } = PERMISOS[clave];
        const existente = grupos.find((grupo) => grupo.modulo === modulo);
        if (existente) {
            existente.permisos.push({ clave, etiqueta });
        } else {
            grupos.push({ modulo, permisos: [{ clave, etiqueta }] });
        }
    }
    return grupos;
}
