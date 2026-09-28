import { describe, expect, it } from "vitest";
// config
import { esPermiso, type Permiso } from "@/config/permisos";
// utils
import {
    MENSAJES_PRIVILEGIOS,
    esNombreReservado,
    esSubconjunto,
    permisosFaltantes,
    quedaAdministrador,
    validarAsignacionRol,
    validarEdicionFuncionario,
    validarEdicionRol,
    validarPermisosRol
} from "./privilegios";

function set(permisos: Permiso[]): ReadonlySet<Permiso> {
    return new Set(permisos);
}

const actorBase = set(["config.ver", "config.funcionarios", "config.roles"]);
const rolBase = { id_rol: 2, nombre_rol: "SOME", estado: "Activo", permisos: set(["config.ver", "config.funcionarios"]) };
const rolSuperior = { id_rol: 1, nombre_rol: "Administrador", estado: "Activo", permisos: set(["config.ver", "config.funcionarios", "config.roles", "config.catalogos"]) };

describe("privilegios: helpers", () => {
    it("detecta subconjuntos y permisos faltantes", () => {
        expect(esSubconjunto(["config.ver"], actorBase)).toBe(true);
        expect(esSubconjunto(["config.catalogos"], actorBase)).toBe(false);
        expect(permisosFaltantes(["config.catalogos", "config.roles"], actorBase)).toEqual(["config.catalogos"]);
    });

    it("detecta el nombre reservado con espacios y mayusculas", () => {
        expect(esNombreReservado(" Administrador ")).toBe(true);
        expect(esNombreReservado("ADMINISTRADOR")).toBe(true);
        expect(esNombreReservado("Admin")).toBe(false);
    });
});

describe("privilegios: F1-F4 funcionarios", () => {
    it("F1 permite asignar roles cuyo permiso es subconjunto del actor", () => {
        expect(validarAsignacionRol(actorBase, rolBase)).toBeNull();
    });

    it("F1 bloquea asignar un rol con permisos que el actor no tiene", () => {
        expect(validarAsignacionRol(actorBase, rolSuperior)).toBe("No puedes asignar el rol «Administrador»: incluye permisos que tu rol no tiene");
    });

    it("F2 bloquea editar a un funcionario superior", () => {
        expect(
            validarEdicionFuncionario({
                actorRut: "11.111.111-1",
                actorPermisos: actorBase,
                rolDestino: rolBase,
                funcionarioActual: { rut: "22.222.222-2", rol_id: 1, estado: "Activo", centro_id: "650", rol: rolSuperior },
                data: { rol_id: 2, estado: "Activo", centro_id: "650" },
                quedaAdmin: true
            })
        ).toBe(MENSAJES_PRIVILEGIOS.funcionarioSuperior);
    });

    it("F3 bloquea cambiar rol, estado o centro propio", () => {
        const base = {
            actorRut: "11.111.111-1",
            actorPermisos: actorBase,
            rolDestino: rolBase,
            funcionarioActual: { rut: "11.111.111-1", rol_id: 2, estado: "Activo" as const, centro_id: "650", rol: rolBase },
            quedaAdmin: true
        };

        expect(validarEdicionFuncionario({ ...base, data: { rol_id: 3, estado: "Activo", centro_id: "650" } })).toBe(MENSAJES_PRIVILEGIOS.autoFuncionario);
        expect(validarEdicionFuncionario({ ...base, data: { rol_id: 2, estado: "Inactivo", centro_id: "650" } })).toBe(MENSAJES_PRIVILEGIOS.autoFuncionario);
        expect(validarEdicionFuncionario({ ...base, data: { rol_id: 2, estado: "Activo", centro_id: "700" } })).toBe(MENSAJES_PRIVILEGIOS.autoFuncionario);
    });

    it("F4 bloquea degradar al ultimo administrador activo", () => {
        expect(
            validarEdicionFuncionario({
                actorRut: "99.999.999-9",
                actorPermisos: rolSuperior.permisos,
                rolDestino: rolBase,
                funcionarioActual: { rut: "11.111.111-1", rol_id: 1, estado: "Activo", centro_id: "650", rol: rolSuperior },
                data: { rol_id: 2, estado: "Activo", centro_id: "650" },
                quedaAdmin: false
            })
        ).toBe(MENSAJES_PRIVILEGIOS.ultimoAdministrador);
    });
});

describe("privilegios: R1-R4 roles", () => {
    it("R1 bloquea crear, renombrar a, o renombrar desde el nombre reservado", () => {
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: null, data: { nombre_rol: "Administrador", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.nombreReservado);
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: { ...rolBase, nombre_rol: "Operador" }, data: { nombre_rol: " administrador ", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.nombreReservado);
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: rolSuperior.permisos, rolActual: rolSuperior, data: { nombre_rol: "Admin base", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.nombreReservado);
    });

    it("R2 bloquea renombrar o desactivar el rol propio", () => {
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolBase, data: { nombre_rol: "Nuevo", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.autoRol);
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolBase, data: { nombre_rol: "SOME", estado: "Inactivo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.autoRol);
    });

    it("R3 bloquea editar un rol superior", () => {
        expect(validarEdicionRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolSuperior, data: { nombre_rol: "Administrador", estado: "Activo" }, quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.rolSuperior);
    });

    it("R4 bloquea desactivar un rol administrador si no queda otro administrador", () => {
        expect(validarEdicionRol({ actorRolId: 99, actorPermisos: rolSuperior.permisos, rolActual: rolSuperior, data: { nombre_rol: "Administrador", estado: "Inactivo" }, quedaAdmin: false })).toBe(MENSAJES_PRIVILEGIOS.ultimoAdministrador);
    });
});

describe("privilegios: P1-P4 permisos de rol", () => {
    it("P1 bloquea editar permisos de un rol superior", () => {
        expect(validarPermisosRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolSuperior, permisosResultantes: ["config.ver"], quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.rolSuperior);
    });

    it("P2 bloquea otorgar permisos que el actor no tiene con etiquetas", () => {
        expect(validarPermisosRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolBase, permisosResultantes: ["config.ver", "config.catalogos"], quedaAdmin: true })).toBe("No puedes otorgar permisos que tu rol no tiene: Editar catalogos");
    });

    it("P3 bloquea quitar config.roles al rol propio", () => {
        expect(validarPermisosRol({ actorRolId: 2, actorPermisos: actorBase, rolActual: rolBase, permisosResultantes: ["config.ver"], quedaAdmin: true })).toBe(MENSAJES_PRIVILEGIOS.quitarConfigRolesPropio);
    });

    it("P4 bloquea quitar config.roles al ultimo rol administrador", () => {
        expect(validarPermisosRol({ actorRolId: 99, actorPermisos: rolSuperior.permisos, rolActual: rolSuperior, permisosResultantes: ["config.ver"], quedaAdmin: false })).toBe(MENSAJES_PRIVILEGIOS.ultimoAdministrador);
    });

    it("permite conjuntos iguales: administrador edita administrador sin escalada", () => {
        expect(validarPermisosRol({ actorRolId: 99, actorPermisos: rolSuperior.permisos, rolActual: rolSuperior, permisosResultantes: [...rolSuperior.permisos], quedaAdmin: true })).toBeNull();
    });
});

describe("privilegios: quedaAdministrador", () => {
    it("responde true si queda otro administrador activo fuera del funcionario cambiado", () => {
        expect(quedaAdministrador([{ rut: "1", rol_id: 1 }, { rut: "2", rol_id: 1 }], { tipo: "funcionario", rut: "1" })).toBe(true);
    });

    it("responde false si el cambio afecta al unico administrador activo", () => {
        expect(quedaAdministrador([{ rut: "1", rol_id: 1 }], { tipo: "funcionario", rut: "1" })).toBe(false);
        expect(quedaAdministrador([{ rut: "1", rol_id: 1 }, { rut: "2", rol_id: 1 }], { tipo: "rol", rol_id: 1 })).toBe(false);
    });
});
