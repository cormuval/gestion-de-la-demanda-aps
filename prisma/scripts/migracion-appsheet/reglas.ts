// Reglas de transformacion AppSheet -> nuevo sistema (tarea 2.2 del plan de migracion).
// Funciones puras: no tocan la base de datos, para poder testearlas sin MySQL.

// utils
import { normalizarRut } from "../../../src/modules/solicitudes/utils/rut";
// types
import { esEstadoPendiente } from "../../../src/modules/comunicador/types/comunicador";

export type Tabla = "roles" | "funcionarios" | "usuarios" | "solicitudes" | "citas" | "llamadas";

export type Regla =
    | "R2 paciente duplicado por RUT"
    | "R5 relacion inexistente"
    | "R6 campo obligatorio vacio"
    | "valor fuera de catalogo"
    | "correo duplicado"
    | "funcionario duplicado por RUT"
    | "advertencia: referencia opcional anulada"
    | "advertencia: correo duplicado con alias"
    | "advertencia: RUT de destino reemplazado"
    | "advertencia: aviso de rechazo cerrado";

export interface Rechazo {
    tabla: Tabla;
    clave: string;
    regla: Regla;
    detalle: string;
}

export type Resultado<T> = { ok: true; data: T; advertencias: Rechazo[] } | { ok: false; rechazo: Rechazo };

// ---------- Filas de origen (AppSheet) ----------

export interface FuncionarioOrigen {
    rut: string;
    email: string | null;
    nombre: string | null;
    rol_id: number | null;
    estado: string | null;
    codigo: string | null;
    rut_consulta: string | null;
    centro_id: string | null;
    programa_asociado: string | null;
    invitacion_app: string | null;
}

export interface UsuarioOrigen {
    rut: string;
    nombre: string | null;
    apellido: string | null;
    nombre_social: string | null;
    genero: string | null;
    otro_genero: string | null;
    fecha_nacimiento: Date | null;
    sector: string | null;
    telefono: string | null;
    telefono_alternativo: string | null;
    correo_contacto: string | null;
    gestante: string | null;
    discapacidad: string | null;
    priorizacion_administrativa: number | null;
    centro_id: string | null;
    policonsultante: string | null;
}

export interface SolicitudOrigen {
    id_solicitud: string;
    fecha_inicio: Date | null;
    rut_orientador: string | null;
    rut_usuario: string | null;
    tipo_solicitud_id: string | null;
    motivo_id: string | null;
    ultimo_control: string | null;
    descripcion: string | null;
    disponibilidad_llamada: string | null;
    priorizacion_admin: number | null;
    rut_gestor: string | null;
    accion: string | null;
    razon_rechazo: string | null;
    fecha_validacion: Date | null;
    estado_solicitud: string | null;
    centro_id: string | null;
    observacion_rechazo: string | null;
}

export interface CitaOrigen {
    id_cita: string;
    solicitud_id: string | null;
    rut_usuario: string | null;
    rut_gestor: string | null;
    tipo_prestacion: string | null;
    profesional_id: string | null;
    prestacion_id: string | null;
    fecha_estimada_atencion: Date | null;
    observacion: string | null;
    estado_cita: string | null;
    priorizacion_clinica: string | null;
    priorizacion: number | null;
    centro_id: string | null;
    fecha_creacion: Date | null;
    razon_rechazo: string | null;
}

export interface LlamadaOrigen {
    id_llamada: string;
    cita_id: string | null;
    rut_usuario: string | null;
    rut_comunicador: string | null;
    respuesta_usuario: string | null;
    observacion: string | null;
    hora_agendada: Date | null;
    fecha_llamada: Date | null;
    centro_id: string | null;
}

// ---------- Filas de destino (nuevo sistema) ----------

export interface FuncionarioDestino {
    rut: string;
    email: string;
    nombre: string;
    rol_id: number;
    estado: string;
    codigo: string | null;
    rut_consulta: string | null;
    centro_id: string | null;
    programa_asociado: string | null;
    invitacion_app: string | null;
}

export type UsuarioDestino = Omit<UsuarioOrigen, "nombre" | "apellido"> & { nombre: string; apellido: string };

export interface SolicitudDestino {
    id_solicitud: string;
    fecha_inicio: Date;
    rut_orientador: string | null;
    rut_usuario: string;
    tipo_solicitud_id: number;
    motivo_id: number | null;
    ultimo_control: string | null;
    descripcion: string | null;
    disponibilidad_llamada: string | null;
    priorizacion_admin: number | null;
    rut_gestor: string | null;
    accion: string | null;
    razon_rechazo: string | null;
    fecha_validacion: Date | null;
    estado_solicitud: string;
    centro_id: string | null;
    observacion_rechazo: string | null;
}

export interface CitaDestino {
    id_cita: string;
    solicitud_id: string;
    rut_usuario: string;
    rut_gestor: string | null;
    tipo_prestacion: string;
    profesional_id: number | null;
    prestacion_id: number | null;
    fecha_estimada_atencion: Date | null;
    observacion: string | null;
    estado_cita: string | null;
    priorizacion_clinica: string | null;
    priorizacion: number | null;
    centro_id: string | null;
    fecha_creacion: Date;
    razon_rechazo: string | null;
}

export interface LlamadaDestino {
    id_llamada: string;
    cita_id: string;
    rut_usuario: string;
    rut_comunicador: string | null;
    respuesta_usuario: string;
    observacion: string | null;
    hora_agendada: Date | null;
    fecha_llamada: Date | null;
    centro_id: string | null;
}

// ---------- Contexto de referencias ya aceptadas ----------

export interface Catalogos {
    tiposSolicitud: ReadonlySet<number>;
    motivos: ReadonlySet<number>;
    profesionales: ReadonlySet<number>;
    prestaciones: ReadonlySet<number>;
    prestacionPorNombre: ReadonlyMap<string, number>;
}

export interface Referencias {
    funcionarios: ReadonlySet<string>;
    usuarios: ReadonlySet<string>;
    solicitudes: ReadonlySet<string>;
    citas: ReadonlySet<string>;
}

// ---------- Reglas transversales ----------

// Roles: se mapean por nombre (los IDs de AppSheet no coinciden con los del nuevo sistema).
const NOMBRE_ROL_DESTINO: Readonly<Record<string, string>> = { Some: "SOME", Vizualizador: "Visualizador" };

export function nombreRolDestino(nombreOrigen: string): string {
    const limpio = nombreOrigen.trim();
    return NOMBRE_ROL_DESTINO[limpio] ?? limpio;
}

// R3: '' y el texto 'null' (cualquier mayuscula) se tratan como ausencia de valor.
export function vacioANull(valor: string | null | undefined): string | null {
    if (valor === null || valor === undefined) return null;
    const limpio = valor.trim();
    if (limpio === "" || limpio.toLowerCase() === "null") return null;
    return valor;
}

// R1: mismo formato que la app (sin puntos ni espacios, guion antes del DV, K mayuscula).
export function rutNormalizado(valor: string | null | undefined): string | null {
    const limpio = vacioANull(valor);
    return limpio === null ? null : normalizarRut(limpio);
}

// IDs que AppSheet guarda como texto. Devuelve "invalido" si no es un entero.
export function aEntero(valor: string | null | undefined): number | null | "invalido" {
    const limpio = vacioANull(valor);
    if (limpio === null) return null;
    return /^\d+$/.test(limpio.trim()) ? Number(limpio.trim()) : "invalido";
}

// AppSheet guarda los DATETIME en hora de Chile y Prisma los lee como si fueran UTC; la app guarda
// instantes reales. Se reinterpretan los componentes como hora de America/Santiago (con cambio de hora).
const FORMATO_CHILE = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
});

function desfaseChileMs(instante: number): number {
    const partes = Object.fromEntries(FORMATO_CHILE.formatToParts(new Date(instante)).map((p) => [p.type, p.value]));
    const comoUtc = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
    return comoUtc - (instante - (instante % 1000));
}

export function horaChileAInstante(valor: Date): Date;
export function horaChileAInstante(valor: Date | null): Date | null;
export function horaChileAInstante(valor: Date | null): Date | null {
    if (valor === null) return null;
    const pared = valor.getTime();
    const desfase = desfaseChileMs(pared);
    const candidato = pared - desfase;
    if (desfaseChileMs(candidato) === desfase) return new Date(candidato);
    // Cerca de un cambio de hora: se reintenta con el desfase del candidato.
    const ajustado = pared - desfaseChileMs(candidato);
    // Si tampoco calza, la hora no existe (salto de septiembre) y se corre hacia adelante.
    return new Date(desfaseChileMs(ajustado) === desfaseChileMs(candidato) ? ajustado : candidato);
}

export function estadoFuncionario(valor: string | null): string | null {
    const limpio = vacioANull(valor);
    if (limpio === "1") return "Activo";
    if (limpio === "0") return "Inactivo";
    return limpio;
}

export function estadoSolicitud(valor: string | null): string | null {
    const limpio = vacioANull(valor);
    if (limpio !== null && limpio.trim().toLowerCase() === "en curso") return "En Curso";
    return limpio;
}

// En AppSheet rechazar una solicitud la deja "En curso" y crea una cita "Rechazar cita" para avisar al
// paciente; la solicitud pasa a "Realizado" recien con ese aviso. El nuevo sistema la cierra como
// "Rechazado" sin cita, asi que se migran con ese estado y los avisos pendientes quedan cerrados.
export const ACCION_RECHAZAR_SOLICITUD = "Rechazar solicitud";
export const ESTADO_SOLICITUD_RECHAZADA = "Rechazado";
export const TIPO_PRESTACION_RECHAZO = "Rechazar cita";
export const ESTADO_CITA_RECHAZO_CERRADA = "Cita Rechazada (Gestor)";

function rechazo(tabla: Tabla, clave: string, regla: Regla, detalle: string): { ok: false; rechazo: Rechazo } {
    return { ok: false, rechazo: { tabla, clave, regla, detalle } };
}

// Referencia opcional a un funcionario: si no existe se anula y se informa como advertencia.
function funcionarioOpcional(tabla: Tabla, clave: string, campo: string, valor: string | null, ref: Referencias, advertencias: Rechazo[]): string | null {
    const rut = rutNormalizado(valor);
    if (rut === null) return null;
    if (ref.funcionarios.has(rut)) return rut;
    advertencias.push({ tabla, clave, regla: "advertencia: referencia opcional anulada", detalle: `${campo}=${rut} no existe en funcionarios` });
    return null;
}

// ---------- Transformaciones por tabla ----------

export function transformarFuncionario(f: FuncionarioOrigen, rolPorIdOrigen: ReadonlyMap<number, number>): Resultado<FuncionarioDestino> {
    const rut = rutNormalizado(f.rut);
    const email = vacioANull(f.email)?.trim().toLowerCase() ?? null;
    const nombre = vacioANull(f.nombre);
    const estado = estadoFuncionario(f.estado);
    const clave = rut ?? f.rut;
    if (rut === null || email === null || nombre === null || estado === null || f.rol_id === null) {
        return rechazo("funcionarios", clave, "R6 campo obligatorio vacio", "rut, email, nombre, rol o estado vacio");
    }
    const rol_id = rolPorIdOrigen.get(f.rol_id);
    if (rol_id === undefined) return rechazo("funcionarios", clave, "valor fuera de catalogo", `rol_id ${f.rol_id} sin equivalente`);
    return {
        ok: true,
        advertencias: [],
        data: {
            rut,
            email,
            nombre,
            rol_id,
            estado,
            codigo: vacioANull(f.codigo),
            rut_consulta: vacioANull(f.rut_consulta),
            centro_id: vacioANull(f.centro_id),
            programa_asociado: vacioANull(f.programa_asociado),
            invitacion_app: vacioANull(f.invitacion_app)
        }
    };
}

// "local@dominio" -> "local+<rut>@dominio": conserva al funcionario (y sus registros) con un correo unico.
export function correoAlias(email: string, rut: string): string {
    const arroba = email.lastIndexOf("@");
    return arroba < 0 ? `${email}+${rut}` : `${email.slice(0, arroba)}+${rut}${email.slice(arroba)}`;
}

// Correo unico en destino: entre repetidos, el activo conserva el correo (a igualdad, el primero) y los
// demas se migran con un alias, porque pueden tener solicitudes, citas o llamadas asociadas.
export function deduplicarFuncionarios(funcionarios: FuncionarioDestino[]): { aceptados: FuncionarioDestino[]; rechazos: Rechazo[]; advertencias: Rechazo[] } {
    const porRut = new Map<string, FuncionarioDestino>();
    const rechazos: Rechazo[] = [];
    const advertencias: Rechazo[] = [];
    for (const f of funcionarios) {
        if (porRut.has(f.rut)) {
            rechazos.push({ tabla: "funcionarios", clave: f.rut, regla: "funcionario duplicado por RUT", detalle: f.email });
            continue;
        }
        porRut.set(f.rut, f);
    }
    const porEmail = new Map<string, FuncionarioDestino[]>();
    for (const f of porRut.values()) porEmail.set(f.email, [...(porEmail.get(f.email) ?? []), f]);

    const aceptados: FuncionarioDestino[] = [];
    for (const grupo of porEmail.values()) {
        const titular = grupo.find((f) => f.estado === "Activo") ?? grupo[0];
        for (const f of grupo) {
            if (f === titular) {
                aceptados.push(f);
                continue;
            }
            const alias = correoAlias(f.email, f.rut);
            aceptados.push({ ...f, email: alias });
            advertencias.push({ tabla: "funcionarios", clave: f.rut, regla: "advertencia: correo duplicado con alias", detalle: `${f.email} es de ${titular.rut}; se migra como ${alias}` });
        }
    }
    return { aceptados, rechazos, advertencias };
}

export function transformarUsuario(u: UsuarioOrigen): Resultado<UsuarioDestino> {
    const rut = rutNormalizado(u.rut);
    const nombre = vacioANull(u.nombre);
    const apellido = vacioANull(u.apellido);
    if (rut === null || nombre === null || apellido === null) {
        return rechazo("usuarios", rut ?? u.rut, "R6 campo obligatorio vacio", "rut, nombre o apellido vacio");
    }
    return {
        ok: true,
        advertencias: [],
        data: {
            rut,
            nombre,
            apellido,
            nombre_social: vacioANull(u.nombre_social),
            genero: vacioANull(u.genero),
            otro_genero: vacioANull(u.otro_genero),
            fecha_nacimiento: u.fecha_nacimiento,
            sector: vacioANull(u.sector),
            telefono: vacioANull(u.telefono),
            telefono_alternativo: vacioANull(u.telefono_alternativo),
            correo_contacto: vacioANull(u.correo_contacto),
            gestante: vacioANull(u.gestante),
            discapacidad: vacioANull(u.discapacidad),
            priorizacion_administrativa: u.priorizacion_administrativa,
            centro_id: vacioANull(u.centro_id),
            policonsultante: vacioANull(u.policonsultante)
        }
    };
}

function completitud(u: UsuarioDestino): number {
    return Object.values(u).filter((v) => v !== null && v !== "").length;
}

// R2: un paciente por RUT normalizado; gana el de datos mas completos (a igualdad, el primero leido).
export function deduplicarUsuarios(usuarios: UsuarioDestino[], rutOriginal: ReadonlyMap<UsuarioDestino, string>): { aceptados: UsuarioDestino[]; rechazos: Rechazo[] } {
    const porRut = new Map<string, UsuarioDestino>();
    const rechazos: Rechazo[] = [];
    for (const u of usuarios) {
        const previo = porRut.get(u.rut);
        if (!previo) {
            porRut.set(u.rut, u);
            continue;
        }
        const ganador = completitud(u) > completitud(previo) ? u : previo;
        const perdedor = ganador === u ? previo : u;
        porRut.set(u.rut, ganador);
        rechazos.push({
            tabla: "usuarios",
            clave: rutOriginal.get(perdedor) ?? perdedor.rut,
            regla: "R2 paciente duplicado por RUT",
            detalle: `se conserva el registro ${rutOriginal.get(ganador) ?? ganador.rut} como ${ganador.rut}`
        });
    }
    return { aceptados: [...porRut.values()], rechazos };
}

export function transformarSolicitud(s: SolicitudOrigen, cat: Catalogos, ref: Referencias): Resultado<SolicitudDestino> {
    const clave = s.id_solicitud;
    const rut_usuario = rutNormalizado(s.rut_usuario);
    const accion = vacioANull(s.accion);
    const estadoOrigen = estadoSolicitud(s.estado_solicitud);
    const estado = estadoOrigen !== null && accion === ACCION_RECHAZAR_SOLICITUD ? ESTADO_SOLICITUD_RECHAZADA : estadoOrigen;
    const tipo = aEntero(s.tipo_solicitud_id);
    const motivo = aEntero(s.motivo_id);
    if (s.fecha_inicio === null || rut_usuario === null || estado === null || tipo === null) {
        return rechazo("solicitudes", clave, "R6 campo obligatorio vacio", "fecha_inicio, rut_usuario, estado_solicitud o tipo_solicitud_id vacio");
    }
    if (tipo === "invalido" || !cat.tiposSolicitud.has(tipo)) return rechazo("solicitudes", clave, "valor fuera de catalogo", `tipo_solicitud_id=${s.tipo_solicitud_id}`);
    if (motivo === "invalido" || (motivo !== null && !cat.motivos.has(motivo))) return rechazo("solicitudes", clave, "valor fuera de catalogo", `motivo_id=${s.motivo_id}`);
    if (!ref.usuarios.has(rut_usuario)) return rechazo("solicitudes", clave, "R5 relacion inexistente", `rut_usuario=${rut_usuario} no existe en usuarios`);

    const advertencias: Rechazo[] = [];
    return {
        ok: true,
        advertencias,
        data: {
            id_solicitud: s.id_solicitud,
            fecha_inicio: horaChileAInstante(s.fecha_inicio),
            rut_orientador: funcionarioOpcional("solicitudes", clave, "rut_orientador", s.rut_orientador, ref, advertencias),
            rut_usuario,
            tipo_solicitud_id: tipo,
            motivo_id: motivo,
            ultimo_control: vacioANull(s.ultimo_control),
            descripcion: vacioANull(s.descripcion),
            disponibilidad_llamada: vacioANull(s.disponibilidad_llamada),
            priorizacion_admin: s.priorizacion_admin,
            rut_gestor: funcionarioOpcional("solicitudes", clave, "rut_gestor", s.rut_gestor, ref, advertencias),
            accion,
            razon_rechazo: vacioANull(s.razon_rechazo),
            fecha_validacion: horaChileAInstante(s.fecha_validacion),
            estado_solicitud: estado,
            centro_id: vacioANull(s.centro_id),
            observacion_rechazo: vacioANull(s.observacion_rechazo)
        }
    };
}

// prestacion_id puede venir como nombre ("Otras Consultas (Abreviadas)"): se resuelve por catalogo.
export function resolverPrestacion(valor: string | null, cat: Catalogos): number | null | "invalido" {
    const entero = aEntero(valor);
    if (entero !== "invalido") return entero === null || cat.prestaciones.has(entero) ? entero : "invalido";
    return cat.prestacionPorNombre.get((valor ?? "").trim()) ?? "invalido";
}

export function transformarCita(c: CitaOrigen, cat: Catalogos, ref: Referencias): Resultado<CitaDestino> {
    const clave = c.id_cita;
    const rut_usuario = rutNormalizado(c.rut_usuario);
    const tipo_prestacion = vacioANull(c.tipo_prestacion);
    const solicitud_id = vacioANull(c.solicitud_id);
    if (solicitud_id === null || rut_usuario === null || tipo_prestacion === null || c.fecha_creacion === null) {
        return rechazo("citas", clave, "R6 campo obligatorio vacio", "solicitud_id, rut_usuario, tipo_prestacion o fecha_creacion vacio");
    }
    if (!ref.solicitudes.has(solicitud_id)) return rechazo("citas", clave, "R5 relacion inexistente", `solicitud_id=${solicitud_id} no migrada`);
    if (!ref.usuarios.has(rut_usuario)) return rechazo("citas", clave, "R5 relacion inexistente", `rut_usuario=${rut_usuario} no existe en usuarios`);
    const profesional = aEntero(c.profesional_id);
    if (profesional === "invalido" || (profesional !== null && !cat.profesionales.has(profesional))) {
        return rechazo("citas", clave, "valor fuera de catalogo", `profesional_id=${c.profesional_id}`);
    }
    const prestacion = resolverPrestacion(c.prestacion_id, cat);
    if (prestacion === "invalido") return rechazo("citas", clave, "valor fuera de catalogo", `prestacion_id=${c.prestacion_id}`);

    const advertencias: Rechazo[] = [];
    let estado_cita = vacioANull(c.estado_cita);
    if (tipo_prestacion === TIPO_PRESTACION_RECHAZO && esEstadoPendiente(estado_cita)) {
        advertencias.push({ tabla: "citas", clave, regla: "advertencia: aviso de rechazo cerrado", detalle: `${estado_cita} -> ${ESTADO_CITA_RECHAZO_CERRADA}` });
        estado_cita = ESTADO_CITA_RECHAZO_CERRADA;
    }
    return {
        ok: true,
        advertencias,
        data: {
            id_cita: c.id_cita,
            solicitud_id,
            rut_usuario,
            rut_gestor: funcionarioOpcional("citas", clave, "rut_gestor", c.rut_gestor, ref, advertencias),
            tipo_prestacion,
            profesional_id: profesional,
            prestacion_id: prestacion,
            fecha_estimada_atencion: c.fecha_estimada_atencion,
            observacion: vacioANull(c.observacion),
            estado_cita,
            priorizacion_clinica: vacioANull(c.priorizacion_clinica),
            priorizacion: c.priorizacion,
            centro_id: vacioANull(c.centro_id),
            fecha_creacion: horaChileAInstante(c.fecha_creacion),
            razon_rechazo: vacioANull(c.razon_rechazo)
        }
    };
}

export function transformarLlamada(l: LlamadaOrigen, ref: Referencias): Resultado<LlamadaDestino> {
    const clave = l.id_llamada;
    const cita_id = vacioANull(l.cita_id);
    const rut_usuario = rutNormalizado(l.rut_usuario);
    const respuesta = vacioANull(l.respuesta_usuario);
    if (cita_id === null || rut_usuario === null || respuesta === null) {
        return rechazo("llamadas", clave, "R6 campo obligatorio vacio", "cita_id, rut_usuario o respuesta_usuario vacio");
    }
    if (!ref.citas.has(cita_id)) return rechazo("llamadas", clave, "R5 relacion inexistente", `cita_id=${cita_id} no migrada`);

    const advertencias: Rechazo[] = [];
    return {
        ok: true,
        advertencias,
        data: {
            id_llamada: l.id_llamada,
            cita_id,
            rut_usuario,
            rut_comunicador: funcionarioOpcional("llamadas", clave, "rut_comunicador", l.rut_comunicador, ref, advertencias),
            respuesta_usuario: respuesta,
            observacion: vacioANull(l.observacion),
            hora_agendada: horaChileAInstante(l.hora_agendada),
            fecha_llamada: horaChileAInstante(l.fecha_llamada),
            centro_id: vacioANull(l.centro_id)
        }
    };
}
