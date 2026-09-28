"use server";
// schemas
import {
    CENTRO_COLUMNAS,
    ConfiguracionFiltros,
    funcionarioConfigSchema,
    motivoConfigSchema,
    permisosRolSchema,
    prestacionConfigSchema,
    profesionalConfigSchema,
    rolConfigSchema,
    tipoSolicitudConfigSchema,
    type FuncionarioConfigInput,
    type MotivoConfigInput,
    type PermisosRolInput,
    type PrestacionConfigInput,
    type ProfesionalConfigInput,
    type RolConfigInput,
    type TipoSolicitudConfigInput
} from "../schemas/mantenedores.schema";
// lib
import { getPermisosRol, requirePermiso } from "@/shared/lib/permisos";
import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";
import type { Role } from "@prisma/client";
// config
import { CLAVES_PERMISOS, esPermiso, type Permiso } from "@/config/permisos";
// utils
import {
    quedaAdministrador,
    validarEdicionRol,
    validarPermisosRol,
    type AdminEvaluado,
    type RolEvaluado
} from "../utils/privilegios";

function centroData(centros: Partial<Record<(typeof CENTRO_COLUMNAS)[number], "1" | "0">>) {
    return CENTRO_COLUMNAS.reduce(
        (acc, columna) => {
            acc[columna] = centros[columna] ?? "0";
            return acc;
        },
        {} as Record<(typeof CENTRO_COLUMNAS)[number], string>
    );
}

function searchContains(search?: string) {
    const value = search?.trim();
    return value ? { contains: value } : undefined;
}

function permisosValidos(filas: { permiso: string }[]): Set<Permiso> {
    return new Set(filas.map((fila) => fila.permiso).filter(esPermiso));
}

function rolEvaluado(rol: { id_rol: number; nombre_rol: string; estado: string; permisos: { permiso: string }[] }): RolEvaluado {
    return {
        id_rol: rol.id_rol,
        nombre_rol: rol.nombre_rol,
        estado: rol.estado,
        permisos: permisosValidos(rol.permisos)
    };
}

async function adminsActivos(): Promise<AdminEvaluado[]> {
    const funcionarios = await prisma.funcionario.findMany({
        where: {
            estado: "Activo",
            role: { estado: "Activo", permisos: { some: { permiso: "config.roles" } } }
        },
        select: { rut: true, rol_id: true }
    });
    return funcionarios;
}

async function logBloqueo(accion: "CREATE" | "UPDATE", user: { rut: string; nombre: string }, resourceId: string, regla: string, error: string) {
    await AuditLogger.logSecurity(accion, false, { rut: user.rut, name: user.nombre }, { resourceId, details: regla, error });
}

export async function getMantenedoresConfig(filtros: ConfiguracionFiltros = {}) {
    await requirePermiso("config.ver");
    const search = searchContains(filtros.search);

    const [tiposSolicitud, motivos, roles, profesionales, prestaciones, funcionarios, centros] = await Promise.all([
        prisma.tipoSolicitud.findMany({
            where: search ? { nombre_tipo_solicitud: search } : undefined,
            orderBy: { nombre_tipo_solicitud: "asc" },
            take: 300
        }),
        prisma.motivo.findMany({
            where: search ? { nombre_motivo: search } : undefined,
            include: { tipoSolicitud: { select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true } } },
            orderBy: { nombre_motivo: "asc" },
            take: 300
        }),
        prisma.role.findMany({
            where: search ? { nombre_rol: search } : undefined,
            include: { permisos: { select: { permiso: true } } },
            orderBy: { nombre_rol: "asc" },
            take: 300
        }),
        prisma.profesional.findMany({
            where: search ? { nombre: search } : undefined,
            orderBy: { nombre: "asc" },
            take: 300
        }),
        prisma.prestacion.findMany({
            where: search ? { nombre_prestacion: search } : undefined,
            include: { profesional: { select: { id_profesional: true, nombre: true } } },
            orderBy: { nombre_prestacion: "asc" },
            take: 300
        }),
        prisma.funcionario.findMany({
            where: search
                ? {
                      OR: [{ rut: search }, { email: search }, { nombre: search }, { programa_asociado: search }]
                  }
                : undefined,
            include: { role: { select: { id_rol: true, nombre_rol: true } } },
            orderBy: { nombre: "asc" },
            take: 300
        }),
        prisma.centro.findMany({
            orderBy: { nombre_centro: "asc" }
        })
    ]);

    return { tiposSolicitud, motivos, roles, profesionales, prestaciones, funcionarios, centros };
}

export async function guardarTipoSolicitud(input: TipoSolicitudConfigInput) {
    const user = await requirePermiso("config.catalogos");
    const data = tipoSolicitudConfigSchema.parse(input);
    const duplicated = await prisma.tipoSolicitud.findFirst({
        where: {
            nombre_tipo_solicitud: data.nombre_tipo_solicitud,
            ...(data.id_tipo_solicitud ? { NOT: { id_tipo_solicitud: data.id_tipo_solicitud } } : {})
        },
        select: { id_tipo_solicitud: true }
    });
    if (duplicated) throw new Error("Ya existe un tipo de solicitud con ese nombre");

    const saved = data.id_tipo_solicitud
        ? await prisma.tipoSolicitud.update({
              where: { id_tipo_solicitud: data.id_tipo_solicitud },
              data: { nombre_tipo_solicitud: data.nombre_tipo_solicitud, estado: data.estado, ...centroData(data.centros) }
          })
        : await prisma.tipoSolicitud.create({
              data: { nombre_tipo_solicitud: data.nombre_tipo_solicitud, estado: data.estado, ...centroData(data.centros) }
          });

    await AuditLogger.logDataAccess(data.id_tipo_solicitud ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `tipo_solicitud:${saved.id_tipo_solicitud}`);
    return saved;
}

export async function guardarMotivo(input: MotivoConfigInput) {
    const user = await requirePermiso("config.catalogos");
    const data = motivoConfigSchema.parse(input);
    const tipo = await prisma.tipoSolicitud.findUnique({ where: { id_tipo_solicitud: data.tipo_solicitud_id }, select: { id_tipo_solicitud: true } });
    if (!tipo) throw new Error("Tipo de solicitud no existe");

    const duplicated = await prisma.motivo.findFirst({
        where: {
            tipo_solicitud_id: data.tipo_solicitud_id,
            nombre_motivo: data.nombre_motivo,
            ...(data.id_motivo ? { NOT: { id_motivo: data.id_motivo } } : {})
        },
        select: { id_motivo: true }
    });
    if (duplicated) throw new Error("Ya existe un motivo con ese nombre para el tipo seleccionado");

    const saved = data.id_motivo
        ? await prisma.motivo.update({ where: { id_motivo: data.id_motivo }, data: { tipo_solicitud_id: data.tipo_solicitud_id, nombre_motivo: data.nombre_motivo, estado: data.estado } })
        : await prisma.motivo.create({ data: { tipo_solicitud_id: data.tipo_solicitud_id, nombre_motivo: data.nombre_motivo, estado: data.estado } });

    await AuditLogger.logDataAccess(data.id_motivo ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `motivo:${saved.id_motivo}`);
    return saved;
}

export async function guardarRol(input: RolConfigInput): Promise<ResultadoAccion<Role>> {
    const user = await requirePermiso("config.roles");
    const data = rolConfigSchema.parse(input);
    const accion = data.id_rol ? "UPDATE" : "CREATE";
    const actorPermisos = await getPermisosRol(user.rol.id);

    const [duplicated, rolActual] = await Promise.all([
        prisma.role.findFirst({
            where: { nombre_rol: data.nombre_rol, ...(data.id_rol ? { NOT: { id_rol: data.id_rol } } : {}) },
            select: { id_rol: true }
        }),
        data.id_rol
            ? prisma.role.findUnique({
                  where: { id_rol: data.id_rol },
                  include: { permisos: { select: { permiso: true } } }
              })
            : Promise.resolve(null)
    ]);
    if (duplicated) return { ok: false, error: "Ya existe un rol con ese nombre" };
    if (data.id_rol && !rolActual) return { ok: false, error: "Rol no existe" };

    const requiereAdmins = Boolean(rolActual && rolActual.estado === "Activo" && data.estado !== "Activo" && permisosValidos(rolActual.permisos).has("config.roles"));
    const admins = requiereAdmins ? await adminsActivos() : [];
    const quedaAdmin = !requiereAdmins || quedaAdministrador(admins, { tipo: "rol", rol_id: data.id_rol ?? 0 });
    const error = validarEdicionRol({
        actorRolId: user.rol.id,
        actorPermisos,
        rolActual: rolActual ? rolEvaluado(rolActual) : null,
        data: { nombre_rol: data.nombre_rol, estado: data.estado },
        quedaAdmin
    });

    if (error) {
        await logBloqueo(accion, user, data.id_rol ? `rol:${data.id_rol}` : "rol:nuevo", `regla=guardarRol rol=${data.id_rol ?? "nuevo"}`, error);
        return { ok: false, error };
    }

    const saved = data.id_rol
        ? await prisma.role.update({ where: { id_rol: data.id_rol }, data: { nombre_rol: data.nombre_rol, estado: data.estado } })
        : await prisma.role.create({ data: { nombre_rol: data.nombre_rol, estado: data.estado } });

    const details = rolActual
        ? `Rol guardado: nombre_rol ${rolActual.nombre_rol}->${saved.nombre_rol} estado ${rolActual.estado}->${saved.estado}`
        : `Rol creado: nombre_rol ${saved.nombre_rol} estado ${saved.estado}`;
    await AuditLogger.logDataAccess(accion, true, { rut: user.rut, name: user.nombre }, `rol:${saved.id_rol}`, { details });
    return { ok: true, data: saved };
}

export async function guardarProfesional(input: ProfesionalConfigInput) {
    const user = await requirePermiso("config.catalogos");
    const data = profesionalConfigSchema.parse(input);
    const duplicated = await prisma.profesional.findFirst({
        where: { nombre: data.nombre, ...(data.id_profesional ? { NOT: { id_profesional: data.id_profesional } } : {}) },
        select: { id_profesional: true }
    });
    if (duplicated) throw new Error("Ya existe un profesional con ese nombre");

    const saved = data.id_profesional
        ? await prisma.profesional.update({ where: { id_profesional: data.id_profesional }, data: { nombre: data.nombre, estado: data.estado, ...centroData(data.centros) } })
        : await prisma.profesional.create({ data: { nombre: data.nombre, estado: data.estado, ...centroData(data.centros) } });

    await AuditLogger.logDataAccess(data.id_profesional ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `profesional:${saved.id_profesional}`);
    return saved;
}

export async function guardarPrestacion(input: PrestacionConfigInput) {
    const user = await requirePermiso("config.catalogos");
    const data = prestacionConfigSchema.parse(input);
    const profesional = await prisma.profesional.findUnique({ where: { id_profesional: data.profesional_id }, select: { id_profesional: true } });
    if (!profesional) throw new Error("Profesional no existe");

    const duplicated = await prisma.prestacion.findFirst({
        where: {
            profesional_id: data.profesional_id,
            nombre_prestacion: data.nombre_prestacion,
            ...(data.id_prestacion ? { NOT: { id_prestacion: data.id_prestacion } } : {})
        },
        select: { id_prestacion: true }
    });
    if (duplicated) throw new Error("Ya existe una prestacion con ese nombre para el profesional");

    const saved = data.id_prestacion
        ? await prisma.prestacion.update({ where: { id_prestacion: data.id_prestacion }, data: { profesional_id: data.profesional_id, nombre_prestacion: data.nombre_prestacion, estado: data.estado } })
        : await prisma.prestacion.create({ data: { profesional_id: data.profesional_id, nombre_prestacion: data.nombre_prestacion, estado: data.estado } });

    await AuditLogger.logDataAccess(data.id_prestacion ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `prestacion:${saved.id_prestacion}`);
    return saved;
}

export async function guardarFuncionario(input: FuncionarioConfigInput) {
    const user = await requirePermiso("config.funcionarios");
    const data = funcionarioConfigSchema.parse(input);
    const [rol, centro, funcionarioActual, emailDuplicado] = await Promise.all([
        prisma.role.findUnique({ where: { id_rol: data.rol_id }, select: { id_rol: true } }),
        prisma.centro.findUnique({ where: { id_centro: data.centro_id }, select: { id_centro: true } }),
        prisma.funcionario.findUnique({ where: { rut: data.rut }, select: { rut: true } }),
        prisma.funcionario.findFirst({ where: { email: data.email, NOT: { rut: data.rut } }, select: { rut: true } })
    ]);

    if (!rol) throw new Error("Rol no existe");
    if (!centro) throw new Error("Centro no existe");
    if (emailDuplicado) throw new Error("Ya existe un funcionario con ese email");

    const payload = {
        email: data.email,
        nombre: data.nombre,
        rol_id: data.rol_id,
        centro_id: data.centro_id,
        programa_asociado: data.programa_asociado,
        estado: data.estado
    };

    const saved = funcionarioActual
        ? await prisma.funcionario.update({ where: { rut: data.rut }, data: payload })
        : await prisma.funcionario.create({ data: { rut: data.rut, ...payload } });

    await AuditLogger.logDataAccess(funcionarioActual ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `funcionario:${saved.rut}`);
    return saved;
}

export async function guardarPermisosRol(input: PermisosRolInput): Promise<ResultadoAccion<{ id_rol: number; permisos: Permiso[] }>> {
    const user = await requirePermiso("config.roles");
    const data = permisosRolSchema.parse(input);
    const permisos = CLAVES_PERMISOS.filter((clave) => data.permisos.includes(clave));
    const actorPermisos = await getPermisosRol(user.rol.id);

    const rolActual = await prisma.role.findUnique({
        where: { id_rol: data.rol_id },
        include: { permisos: { select: { permiso: true } } }
    });
    if (!rolActual) return { ok: false, error: "Rol no existe" };

    const rol = rolEvaluado(rolActual);
    const requiereAdmins = rol.permisos.has("config.roles") && !permisos.includes("config.roles");
    const admins = requiereAdmins ? await adminsActivos() : [];
    const quedaAdmin = !requiereAdmins || quedaAdministrador(admins, { tipo: "rol", rol_id: data.rol_id });
    const error = validarPermisosRol({
        actorRolId: user.rol.id,
        actorPermisos,
        rolActual: rol,
        permisosResultantes: permisos,
        quedaAdmin
    });

    if (error) {
        await logBloqueo("UPDATE", user, `rol:${data.rol_id}`, `regla=guardarPermisosRol rol=${data.rol_id}`, error);
        return { ok: false, error };
    }

    const previos = rol.permisos;

    await prisma.$transaction([
        prisma.rolPermiso.deleteMany({ where: { rol_id: data.rol_id } }),
        prisma.rolPermiso.createMany({ data: permisos.map((permiso) => ({ rol_id: data.rol_id, permiso })) })
    ]);

    await AuditLogger.logDataAccess("UPDATE", true, { rut: user.rut, name: user.nombre }, `rol:${data.rol_id}`, {
        details: `Permisos de rol actualizados: antes=[${[...previos].join(",")}] despues=[${permisos.join(",")}]`
    });

    return { ok: true, data: { id_rol: data.rol_id, permisos } };
}

export type MantenedoresConfig = Awaited<ReturnType<typeof getMantenedoresConfig>>;
export type TipoSolicitudConfigRow = MantenedoresConfig["tiposSolicitud"][number];
export type MotivoConfigRow = MantenedoresConfig["motivos"][number];
export type RolConfigRow = MantenedoresConfig["roles"][number];
export type ProfesionalConfigRow = MantenedoresConfig["profesionales"][number];
export type PrestacionConfigRow = MantenedoresConfig["prestaciones"][number];
export type FuncionarioConfigRow = MantenedoresConfig["funcionarios"][number];
