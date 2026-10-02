// Migracion de datos AppSheet -> nuevo sistema (tarea 2.3 del plan de migracion).
//
// Uso:
//   ORIGEN_DATABASE_URL=mysql://...@46.202.151.191/gestionDemanda \
//   DESTINO_DATABASE_URL=mysql://...@localhost/gestion_demanda_ensayo \
//   npm run migracion:appsheet -- [--ejecutar] [--vaciar=<base_destino>] [--salida=<dir>]
//
// Sin --ejecutar solo simula: lee, transforma y escribe el reporte, sin tocar el destino.
// --vaciar=<base> borra llamadas, citas, solicitudes y usuarios del destino antes de cargar;
// exige repetir el nombre de la base de destino para evitar vaciar la equivocada.
// Re-ejecutar no duplica: se inserta por clave primaria original (INSERT IGNORE).

// lib
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

// reglas
import {
    deduplicarFuncionarios,
    deduplicarUsuarios,
    esCitaPendiente,
    FECHA_CORTE,
    nombreRolDestino,
    solicitudEnAlcance,
    transformarCita,
    transformarFuncionario,
    transformarLlamada,
    transformarSolicitud,
    transformarUsuario,
    vacioANull,
    type Catalogos,
    type CitaDestino,
    type CitaOrigen,
    type FuncionarioDestino,
    type FuncionarioOrigen,
    type LlamadaDestino,
    type LlamadaOrigen,
    type Rechazo,
    type Resultado,
    type SolicitudDestino,
    type SolicitudOrigen,
    type Tabla,
    type UsuarioDestino,
    type UsuarioOrigen
} from "./reglas";

const LOTE = 1000;

interface Opciones {
    ejecutar: boolean;
    vaciar: string | null;
    salida: string;
}

interface Resumen {
    tabla: Tabla;
    leidos: number;
    enAlcance: number;
    aceptados: number;
    rechazados: number;
    advertencias: number;
    insertados: number;
}

function leerOpciones(): Opciones {
    const args = process.argv.slice(2);
    const valor = (nombre: string) => args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=") ?? null;
    const marca = new Date().toISOString().replace(/[:.]/g, "-");
    return {
        ejecutar: args.includes("--ejecutar"),
        vaciar: valor("vaciar"),
        salida: valor("salida") ?? `migracion-appsheet-${marca}`
    };
}

function requerirEnv(nombre: string): string {
    const valor = process.env[nombre];
    if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
    return valor;
}

function nombreBase(url: string): string {
    return new URL(url).pathname.replace(/^\//, "");
}

function separar<T>(resultados: Resultado<T>[]): { aceptados: T[]; rechazos: Rechazo[]; advertencias: Rechazo[] } {
    const aceptados: T[] = [];
    const rechazos: Rechazo[] = [];
    const advertencias: Rechazo[] = [];
    for (const r of resultados) {
        if (r.ok) {
            aceptados.push(r.data);
            advertencias.push(...r.advertencias);
        } else {
            rechazos.push(r.rechazo);
        }
    }
    return { aceptados, rechazos, advertencias };
}

async function insertarEnLotes<T>(filas: T[], insertar: (lote: T[]) => Promise<{ count: number }>): Promise<number> {
    let total = 0;
    for (let i = 0; i < filas.length; i += LOTE) {
        total += (await insertar(filas.slice(i, i + LOTE))).count;
    }
    return total;
}

function csv(valor: string): string {
    return `"${valor.replace(/"/g, '""')}"`;
}

function escribirReporte(dir: string, resumen: Resumen[], rechazos: Rechazo[]): void {
    mkdirSync(dir, { recursive: true });
    const tablas = [...new Set(rechazos.map((r) => r.tabla))];
    for (const tabla of tablas) {
        const filas = rechazos.filter((r) => r.tabla === tabla).map((r) => [r.clave, r.regla, r.detalle].map(csv).join(","));
        writeFileSync(join(dir, `rechazos-${tabla}.csv`), ["clave,regla,detalle", ...filas].join("\n") + "\n", "utf8");
    }
    writeFileSync(join(dir, "resumen.json"), JSON.stringify(resumen, null, 4) + "\n", "utf8");
}

async function main(): Promise<void> {
    const opciones = leerOpciones();
    const urlOrigen = requerirEnv("ORIGEN_DATABASE_URL");
    const urlDestino = requerirEnv("DESTINO_DATABASE_URL");
    const baseDestino = nombreBase(urlDestino);

    if (opciones.vaciar !== null && (!opciones.ejecutar || opciones.vaciar !== baseDestino)) {
        throw new Error(`--vaciar exige --ejecutar y repetir el nombre de la base de destino (${baseDestino})`);
    }

    const origen = new PrismaClient({ datasourceUrl: urlOrigen });
    const destino = new PrismaClient({ datasourceUrl: urlDestino });
    console.log(`Origen: ${nombreBase(urlOrigen)} · Destino: ${baseDestino} · Modo: ${opciones.ejecutar ? "EJECUCION" : "simulacion"}`);

    try {
        // ---------- Lectura de origen ----------
        const rolesOrigen = await origen.$queryRawUnsafe<{ id_rol: number; nombre_rol: string | null }[]>("SELECT id_rol, nombre_rol FROM roles");
        const funcionariosOrigen = await origen.$queryRawUnsafe<FuncionarioOrigen[]>(
            "SELECT rut, email, nombre, rol_id, estado, codigo, rut_consulta, centro_id, programa_asociado, invitacion_app FROM funcionarios"
        );
        const usuariosOrigen = await origen.$queryRawUnsafe<UsuarioOrigen[]>(
            "SELECT rut, nombre, apellido, nombre_social, genero, otro_genero, fecha_nacimiento, sector, telefono, telefono_alternativo, correo_contacto, gestante, discapacidad, priorizacion_administrativa, centro_id, policonsultante FROM usuarios"
        );
        const solicitudesOrigen = await origen.$queryRawUnsafe<SolicitudOrigen[]>(
            "SELECT id_solicitud, fecha_inicio, rut_orientador, rut_usuario, tipo_solicitud_id, motivo_id, ultimo_control, descripcion, disponibilidad_llamada, priorizacion_admin, rut_gestor, accion, razon_rechazo, fecha_validacion, estado_solicitud, centro_id, observacion_rechazo FROM solicitudes"
        );
        const citasOrigen = await origen.$queryRawUnsafe<CitaOrigen[]>(
            "SELECT id_cita, solicitud_id, rut_usuario, rut_gestor, tipo_prestacion, profesional_id, prestacion_id, fecha_estimada_atencion, observacion, estado_cita, priorizacion_clinica, priorizacion, centro_id, fecha_creacion, razon_rechazo FROM citas"
        );
        const llamadasOrigen = await origen.$queryRawUnsafe<LlamadaOrigen[]>(
            "SELECT id_llamada, cita_id, rut_usuario, rut_comunicador, respuesta_usuario, observacion, hora_agendada, fecha_llamada, centro_id FROM llamadas"
        );

        // ---------- Catalogos y roles de destino ----------
        const [tipos, motivos, profesionales, prestaciones] = await Promise.all([
            destino.tipoSolicitud.findMany({ select: { id_tipo_solicitud: true } }),
            destino.motivo.findMany({ select: { id_motivo: true } }),
            destino.profesional.findMany({ select: { id_profesional: true } }),
            destino.prestacion.findMany({ select: { id_prestacion: true, nombre_prestacion: true } })
        ]);
        const nombresRepetidos = new Set(prestaciones.map((p) => p.nombre_prestacion).filter((n, i, todos) => todos.indexOf(n) !== i));
        const catalogos: Catalogos = {
            tiposSolicitud: new Set(tipos.map((t) => t.id_tipo_solicitud)),
            motivos: new Set(motivos.map((m) => m.id_motivo)),
            profesionales: new Set(profesionales.map((p) => p.id_profesional)),
            prestaciones: new Set(prestaciones.map((p) => p.id_prestacion)),
            prestacionPorNombre: new Map(prestaciones.filter((p) => !nombresRepetidos.has(p.nombre_prestacion)).map((p) => [p.nombre_prestacion, p.id_prestacion]))
        };

        const nombresRol = [...new Set(rolesOrigen.map((r) => vacioANull(r.nombre_rol)).filter((n): n is string => n !== null).map(nombreRolDestino))];
        let rolesDestino = await destino.role.findMany({ select: { id_rol: true, nombre_rol: true } });
        const rolesFaltantes = nombresRol.filter((n) => !rolesDestino.some((r) => r.nombre_rol === n));
        if (rolesFaltantes.length > 0) {
            console.log(`Roles a crear en destino (sin permisos): ${rolesFaltantes.join(", ")}`);
            if (opciones.ejecutar) {
                await destino.role.createMany({ data: rolesFaltantes.map((nombre_rol) => ({ nombre_rol, estado: "Activo" })) });
                rolesDestino = await destino.role.findMany({ select: { id_rol: true, nombre_rol: true } });
            } else {
                // En simulacion se asignan IDs ficticios para poder evaluar el resto de las reglas.
                rolesDestino = [...rolesDestino, ...rolesFaltantes.map((nombre_rol, i) => ({ id_rol: -(i + 1), nombre_rol }))];
            }
        }
        const idRolDestino = new Map(rolesDestino.map((r) => [r.nombre_rol, r.id_rol]));
        const rolPorIdOrigen = new Map<number, number>();
        for (const r of rolesOrigen) {
            const id = r.nombre_rol ? idRolDestino.get(nombreRolDestino(r.nombre_rol)) : undefined;
            if (id !== undefined) rolPorIdOrigen.set(r.id_rol, id);
        }

        // ---------- Funcionarios ----------
        const funcionariosT = separar(funcionariosOrigen.map((f) => transformarFuncionario(f, rolPorIdOrigen)));
        const funcionariosD = deduplicarFuncionarios(funcionariosT.aceptados);
        const existentes = await destino.funcionario.findMany({ select: { rut: true, email: true } });
        const rutPorEmailDestino = new Map(existentes.map((f) => [f.email.toLowerCase(), f.rut]));
        const funcionarios: FuncionarioDestino[] = [];
        const rechazosFuncionarios: Rechazo[] = [...funcionariosT.rechazos, ...funcionariosD.rechazos];
        for (const f of funcionariosD.aceptados) {
            const rutExistente = rutPorEmailDestino.get(f.email);
            if (rutExistente !== undefined && rutExistente !== f.rut) {
                rechazosFuncionarios.push({ tabla: "funcionarios", clave: f.rut, regla: "correo duplicado", detalle: `${f.email} ya existe en destino con RUT ${rutExistente}` });
                continue;
            }
            funcionarios.push(f);
        }
        const rutsFuncionarios = new Set([...funcionarios.map((f) => f.rut), ...existentes.map((f) => f.rut)]);

        // ---------- Usuarios (validos; luego se insertan solo los referenciados) ----------
        const rutOriginal = new Map<UsuarioDestino, string>();
        const usuariosT: Resultado<UsuarioDestino>[] = usuariosOrigen.map((u) => {
            const r = transformarUsuario(u);
            if (r.ok) rutOriginal.set(r.data, u.rut);
            return r;
        });
        const usuariosS = separar(usuariosT);
        const usuariosD = deduplicarUsuarios(usuariosS.aceptados, rutOriginal);
        const usuariosPorRut = new Map(usuariosD.aceptados.map((u) => [u.rut, u]));

        // ---------- Alcance ----------
        const conCitaPendiente = new Set(citasOrigen.filter((c) => esCitaPendiente(c.estado_cita) && c.solicitud_id).map((c) => c.solicitud_id as string));
        const solicitudesAlcance = solicitudesOrigen.filter((s) => solicitudEnAlcance(s, conCitaPendiente));
        const idsSolicitudesAlcance = new Set(solicitudesAlcance.map((s) => s.id_solicitud));
        const citasAlcance = citasOrigen.filter(
            (c) => (c.solicitud_id !== null && idsSolicitudesAlcance.has(c.solicitud_id)) || (c.fecha_creacion !== null && c.fecha_creacion >= FECHA_CORTE) || esCitaPendiente(c.estado_cita)
        );
        const idsCitasAlcance = new Set(citasAlcance.map((c) => c.id_cita));
        const llamadasAlcance = llamadasOrigen.filter(
            (l) => (l.cita_id !== null && idsCitasAlcance.has(l.cita_id)) || (l.fecha_llamada !== null && l.fecha_llamada >= FECHA_CORTE)
        );

        // ---------- Solicitudes, citas y llamadas ----------
        const referencias = { funcionarios: rutsFuncionarios, usuarios: new Set(usuariosPorRut.keys()), solicitudes: new Set<string>(), citas: new Set<string>() };
        const solicitudes = separar(solicitudesAlcance.map((s) => transformarSolicitud(s, catalogos, referencias)));
        referencias.solicitudes = new Set(solicitudes.aceptados.map((s) => s.id_solicitud));
        const citas = separar(citasAlcance.map((c) => transformarCita(c, catalogos, referencias)));
        referencias.citas = new Set(citas.aceptados.map((c) => c.id_cita));
        const llamadas = separar(llamadasAlcance.map((l) => transformarLlamada(l, referencias)));

        const rutsReferenciados = new Set([...solicitudes.aceptados.map((s) => s.rut_usuario), ...citas.aceptados.map((c) => c.rut_usuario)]);
        const usuarios = [...rutsReferenciados].map((rut) => usuariosPorRut.get(rut)).filter((u): u is UsuarioDestino => u !== undefined);
        // Los rechazos de usuarios solo importan si el paciente tenia registros en alcance.
        const rutsEnAlcance = new Set(
            [...solicitudesAlcance.map((s) => s.rut_usuario), ...citasAlcance.map((c) => c.rut_usuario)].filter((r): r is string => r !== null).map((r) => r.replace(/[.\s-]/g, "").toUpperCase())
        );
        const rechazosUsuarios = [...usuariosS.rechazos, ...usuariosD.rechazos].filter((r) => rutsEnAlcance.has(r.clave.replace(/[.\s-]/g, "").toUpperCase()));

        // ---------- Escritura ----------
        const insertados: Record<Tabla, number> = { roles: 0, funcionarios: 0, usuarios: 0, solicitudes: 0, citas: 0, llamadas: 0 };
        if (opciones.ejecutar) {
            if (opciones.vaciar !== null) {
                console.log(`Vaciando llamadas, citas, solicitudes y usuarios de ${baseDestino}...`);
                await destino.llamada.deleteMany();
                await destino.cita.deleteMany();
                await destino.solicitud.deleteMany();
                await destino.usuario.deleteMany();
            }
            insertados.funcionarios = await insertarEnLotes(funcionarios, (data) => destino.funcionario.createMany({ data, skipDuplicates: true }));
            insertados.usuarios = await insertarEnLotes(usuarios, (data) => destino.usuario.createMany({ data, skipDuplicates: true }));
            insertados.solicitudes = await insertarEnLotes<SolicitudDestino>(solicitudes.aceptados, (data) => destino.solicitud.createMany({ data, skipDuplicates: true }));
            insertados.citas = await insertarEnLotes<CitaDestino>(citas.aceptados, (data) => destino.cita.createMany({ data, skipDuplicates: true }));
            insertados.llamadas = await insertarEnLotes<LlamadaDestino>(llamadas.aceptados, (data) => destino.llamada.createMany({ data, skipDuplicates: true }));
        }

        // ---------- Reporte ----------
        const resumen: Resumen[] = [
            { tabla: "funcionarios", leidos: funcionariosOrigen.length, enAlcance: funcionariosOrigen.length, aceptados: funcionarios.length, rechazados: rechazosFuncionarios.length, advertencias: 0, insertados: insertados.funcionarios },
            { tabla: "usuarios", leidos: usuariosOrigen.length, enAlcance: rutsEnAlcance.size, aceptados: usuarios.length, rechazados: rechazosUsuarios.length, advertencias: 0, insertados: insertados.usuarios },
            { tabla: "solicitudes", leidos: solicitudesOrigen.length, enAlcance: solicitudesAlcance.length, aceptados: solicitudes.aceptados.length, rechazados: solicitudes.rechazos.length, advertencias: solicitudes.advertencias.length, insertados: insertados.solicitudes },
            { tabla: "citas", leidos: citasOrigen.length, enAlcance: citasAlcance.length, aceptados: citas.aceptados.length, rechazados: citas.rechazos.length, advertencias: citas.advertencias.length, insertados: insertados.citas },
            { tabla: "llamadas", leidos: llamadasOrigen.length, enAlcance: llamadasAlcance.length, aceptados: llamadas.aceptados.length, rechazados: llamadas.rechazos.length, advertencias: llamadas.advertencias.length, insertados: insertados.llamadas }
        ];
        const rechazos = [
            ...rechazosFuncionarios,
            ...rechazosUsuarios,
            ...solicitudes.rechazos,
            ...solicitudes.advertencias,
            ...citas.rechazos,
            ...citas.advertencias,
            ...llamadas.rechazos,
            ...llamadas.advertencias
        ];
        escribirReporte(opciones.salida, resumen, rechazos);
        console.table(resumen);
        console.log(`Reporte en ${opciones.salida}/`);
    } finally {
        await origen.$disconnect();
        await destino.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
