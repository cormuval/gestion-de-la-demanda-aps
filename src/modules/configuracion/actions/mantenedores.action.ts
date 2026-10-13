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
import type { Funcionario, Motivo, Prestacion, Profesional, Role, TipoSolicitud } from "@prisma/client";
// config
import { CLAVES_PERMISOS, esPermiso, type Permiso } from "@/config/permisos";
// utils
import { normalizarRut } from "@/modules/solicitudes/utils/rut";
import {
    quedaAdministrador,
    validarAsignacionRol,
    validarEdicionFuncionario,
    validarEdicionRol,
    validarPermisosRol,
    type AdminEvaluado,
    type RolEvaluado
} from "../utils/privilegios";
import { logBloqueo } from "../utils/auditoria";

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

function rutSinFormato(rut: string): string {
    return normalizarRut(rut).replace("-", "");
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

export async function guardarTipoSolicitud(input: TipoSolicitudConfigInput): Promise<ResultadoAccion<TipoSolicitud>> {
    const user = await requirePermiso("config.catalogos");
    const data = tipoSolicitudConfigSchema.parse(input);
    const duplicated = await prisma.tipoSolicitud.findFirst({
        where: {
            nombre_tipo_solicitud: data.nombre_tipo_solicitud,
            ...(data.id_tipo_solicitud ? { NOT: { id_tipo_solicitud: data.id_tipo_solicitud } } : {})
        },
        select: { id_tipo_solicitud: true }
    });
    if (duplicated) return { ok: false, error: "Ya existe un tipo de solicitud con ese nombre" };

    const saved = data.id_tipo_solicitud
        ? await prisma.tipoSolicitud.update({
              where: { id_tipo_solicitud: data.id_tipo_solicitud },
              data: { nombre_tipo_solicitud: data.nombre_tipo_solicitud, estado: data.estado, ...centroData(data.centros) }
          })
        : await prisma.tipoSolicitud.create({
              data: { nombre_tipo_solicitud: data.nombre_tipo_solicitud, estado: data.estado, ...centroData(data.centros) }
          });

    await AuditLogger.logDataAccess(data.id_tipo_solicitud ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `tipo_solicitud:${saved.id_tipo_solicitud}`);
    return { ok: true, data: saved };
}

export async function guardarMotivo(input: MotivoConfigInput): Promise<ResultadoAccion<Motivo>> {
    const user = await requirePermiso("config.catalogos");
    const data = motivoConfigSchema.parse(input);
    const tipo = await prisma.tipoSolicitud.findUnique({ where: { id_tipo_solicitud: data.tipo_solicitud_id }, select: { id_tipo_solicitud: true } });
    if (!tipo) return { ok: false, error: "Tipo de solicitud no existe" };

    const duplicated = await prisma.motivo.findFirst({
        where: {
            tipo_solicitud_id: data.tipo_solicitud_id,
            nombre_motivo: data.nombre_motivo,
            ...(data.id_motivo ? { NOT: { id_motivo: data.id_motivo } } : {})
        },
        select: { id_motivo: true }
    });
    if (duplicated) return { ok: false, error: "Ya existe un motivo con ese nombre para el tipo seleccionado" };

    const saved = data.id_motivo
        ? await prisma.motivo.update({ where: { id_motivo: data.id_motivo }, data: { tipo_solicitud_id: data.tipo_solicitud_id, nombre_motivo: data.nombre_motivo, estado: data.estado } })
        : await prisma.motivo.create({ data: { tipo_solicitud_id: data.tipo_solicitud_id, nombre_motivo: data.nombre_motivo, estado: data.estado } });

    await AuditLogger.logDataAccess(data.id_motivo ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `motivo:${saved.id_motivo}`);
    return { ok: true, data: saved };
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
    if (duplicated) return { ok: false, error: "Ya existe un rol con ese nombre" };

    const saved = data.id_rol
        ? await prisma.role.update({ where: { id_rol: data.id_rol }, data: { nombre_rol: data.nombre_rol, estado: data.estado } })
        : await prisma.role.create({ data: { nombre_rol: data.nombre_rol, estado: data.estado } });

    const details = rolActual
        ? `Rol guardado: nombre_rol ${rolActual.nombre_rol}->${saved.nombre_rol} estado ${rolActual.estado}->${saved.estado}`
        : `Rol creado: nombre_rol ${saved.nombre_rol} estado ${saved.estado}`;
    await AuditLogger.logDataAccess(accion, true, { rut: user.rut, name: user.nombre }, `rol:${saved.id_rol}`, { details });
    return { ok: true, data: saved };
}

export async function guardarProfesional(input: ProfesionalConfigInput): Promise<ResultadoAccion<Profesional>> {
    const user = await requirePermiso("config.catalogos");
    const data = profesionalConfigSchema.parse(input);
    const duplicated = await prisma.profesional.findFirst({
        where: { nombre: data.nombre, ...(data.id_profesional ? { NOT: { id_profesional: data.id_profesional } } : {}) },
        select: { id_profesional: true }
    });
    if (duplicated) return { ok: false, error: "Ya existe un profesional con ese nombre" };

    const saved = data.id_profesional
        ? await prisma.profesional.update({ where: { id_profesional: data.id_profesional }, data: { nombre: data.nombre, estado: data.estado, ...centroData(data.centros) } })
        : await prisma.profesional.create({ data: { nombre: data.nombre, estado: data.estado, ...centroData(data.centros) } });

    await AuditLogger.logDataAccess(data.id_profesional ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `profesional:${saved.id_profesional}`);
    return { ok: true, data: saved };
}

export async function guardarPrestacion(input: PrestacionConfigInput): Promise<ResultadoAccion<Prestacion>> {
    const user = await requirePermiso("config.catalogos");
    const data = prestacionConfigSchema.parse(input);
    const profesional = await prisma.profesional.findUnique({ where: { id_profesional: data.profesional_id }, select: { id_profesional: true } });
    if (!profesional) return { ok: false, error: "Profesional no existe" };

    const duplicated = await prisma.prestacion.findFirst({
        where: {
            profesional_id: data.profesional_id,
            nombre_prestacion: data.nombre_prestacion,
            ...(data.id_prestacion ? { NOT: { id_prestacion: data.id_prestacion } } : {})
        },
        select: { id_prestacion: true }
    });
    if (duplicated) return { ok: false, error: "Ya existe una prestacion con ese nombre para el profesional" };

    const saved = data.id_prestacion
        ? await prisma.prestacion.update({ where: { id_prestacion: data.id_prestacion }, data: { profesional_id: data.profesional_id, nombre_prestacion: data.nombre_prestacion, estado: data.estado } })
        : await prisma.prestacion.create({ data: { profesional_id: data.profesional_id, nombre_prestacion: data.nombre_prestacion, estado: data.estado } });

    await AuditLogger.logDataAccess(data.id_prestacion ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `prestacion:${saved.id_prestacion}`);
    return { ok: true, data: saved };
}

export async function guardarFuncionario(input: FuncionarioConfigInput): Promise<ResultadoAccion<Funcionario>> {
    const user = await requirePermiso("config.funcionarios");
    const data = funcionarioConfigSchema.parse(input);
    const actorPermisos = await getPermisosRol(user.rol.id);
    const rutOriginal = input.rut.trim();
    const funcionarioSelect = {
        rut: true,
        rol_id: true,
        estado: true,
        centro_id: true,
        role: {
            select: {
                id_rol: true,
                nombre_rol: true,
                estado: true,
                permisos: { select: { permiso: true } }
            }
        }
    } as const;
    const [rolDestino, centro, funcionarioPorRutNormalizado] = await Promise.all([
        prisma.role.findUnique({
            where: { id_rol: data.rol_id },
            include: { permisos: { select: { permiso: true } } }
        }),
        prisma.centro.findUnique({ where: { id_centro: data.centro_id }, select: { id_centro: true } }),
        prisma.funcionario.findUnique({
            where: { rut: data.rut },
            select: funcionarioSelect
        })
    ]);
    let funcionarioActual = funcionarioPorRutNormalizado;
    if (!funcionarioActual && rutOriginal !== data.rut) {
        funcionarioActual = await prisma.funcionario.findUnique({
            where: { rut: rutOriginal },
            select: funcionarioSelect
        });
    }
    if (!funcionarioActual) {
        const filasRut = await prisma.$queryRaw<{ rut: string }[]>`
            SELECT rut
            FROM funcionarios
            WHERE UPPER(REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '')) = ${rutSinFormato(data.rut)}
            LIMIT 1
        `;
        const rutEquivalente = filasRut[0]?.rut;
        if (rutEquivalente) {
            funcionarioActual = await prisma.funcionario.findUnique({
                where: { rut: rutEquivalente },
                select: funcionarioSelect
            });
        }
    }
    const rutsIdentidad = Array.from(new Set([data.rut, rutOriginal, funcionarioActual?.rut].filter((rut): rut is string => Boolean(rut))));
    const emailDuplicado = await prisma.funcionario.findFirst({ where: { email: data.email, NOT: { rut: { in: rutsIdentidad } } }, select: { rut: true } });

    if (!rolDestino) return { ok: false, error: "Rol no existe" };
    if (!centro) return { ok: false, error: "Centro no existe" };
    if (emailDuplicado) return { ok: false, error: "Ya existe un funcionario con ese email" };

    const rolDestinoEvaluado = rolEvaluado(rolDestino);
    const errorAsignacion = validarAsignacionRol(actorPermisos, rolDestinoEvaluado);
    if (errorAsignacion) {
        await logBloqueo(funcionarioActual ? "UPDATE" : "CREATE", user, `funcionario:${data.rut}`, `regla=F1 rol_destino=${data.rol_id}`, errorAsignacion);
        return { ok: false, error: errorAsignacion };
    }

    const requiereAdmins = Boolean(
        funcionarioActual &&
            funcionarioActual.estado === "Activo" &&
            funcionarioActual.role.estado === "Activo" &&
            permisosValidos(funcionarioActual.role.permisos).has("config.roles") &&
            (data.estado !== "Activo" || data.rol_id !== funcionarioActual.rol_id)
    );
    const admins = requiereAdmins ? (await adminsActivos()).map((admin) => ({ ...admin, rut: normalizarRut(admin.rut) })) : [];
    const errorEdicion = validarEdicionFuncionario({
        actorRut: normalizarRut(user.rut),
        actorPermisos,
        rolDestino: rolDestinoEvaluado,
        funcionarioActual: funcionarioActual
            ? {
                  rut: normalizarRut(funcionarioActual.rut),
                  rol_id: funcionarioActual.rol_id,
                  estado: funcionarioActual.estado,
                  centro_id: funcionarioActual.centro_id,
                  rol: rolEvaluado(funcionarioActual.role)
              }
            : null,
        data: { rol_id: data.rol_id, estado: data.estado, centro_id: data.centro_id },
        quedaAdmin: !requiereAdmins || quedaAdministrador(admins, { tipo: "funcionario", rut: data.rut })
    });

    if (errorEdicion) {
        await logBloqueo(funcionarioActual ? "UPDATE" : "CREATE", user, `funcionario:${data.rut}`, `regla=guardarFuncionario rut=${data.rut}`, errorEdicion);
        return { ok: false, error: errorEdicion };
    }

    const payload = {
        email: data.email,
        nombre: data.nombre,
        rol_id: data.rol_id,
        centro_id: data.centro_id,
        programa_asociado: data.programa_asociado,
        estado: data.estado
    };

    const saved = funcionarioActual
        ? await prisma.funcionario.update({ where: { rut: funcionarioActual.rut }, data: payload })
        : await prisma.funcionario.create({ data: { rut: data.rut, ...payload } });

    const details = funcionarioActual
        ? `Funcionario guardado: rol_id ${funcionarioActual.rol_id}->${saved.rol_id} estado ${funcionarioActual.estado}->${saved.estado} centro ${funcionarioActual.centro_id ?? "-"}->${saved.centro_id ?? "-"}`
        : `Funcionario creado: rol_id ${saved.rol_id} estado ${saved.estado} centro ${saved.centro_id ?? "-"}`;
    await AuditLogger.logDataAccess(funcionarioActual ? "UPDATE" : "CREATE", true, { rut: user.rut, name: user.nombre }, `funcionario:${saved.rut}`, { details });
    return { ok: true, data: saved };
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
