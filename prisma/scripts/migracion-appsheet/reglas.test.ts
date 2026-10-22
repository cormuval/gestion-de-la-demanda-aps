// reglas
import {
    aEntero,
    deduplicarFuncionarios,
    deduplicarUsuarios,
    estadoFuncionario,
    estadoSolicitud,
    horaChileAInstante,
    nombreRolDestino,
    correoAlias,
    resolverPrestacion,
    rutNormalizado,
    transformarCita,
    transformarFuncionario,
    transformarLlamada,
    transformarSolicitud,
    transformarUsuario,
    vacioANull,
    type Catalogos,
    type CitaOrigen,
    type FuncionarioDestino,
    type LlamadaOrigen,
    type Referencias,
    type SolicitudOrigen,
    type UsuarioDestino,
    type UsuarioOrigen
} from "./reglas";

const catalogos: Catalogos = {
    tiposSolicitud: new Set([3]),
    motivos: new Set([1]),
    profesionales: new Set([2]),
    prestaciones: new Set([5]),
    prestacionPorNombre: new Map([["Otras Consultas (Abreviadas)", 5]])
};

const referencias: Referencias = {
    funcionarios: new Set(["11121161-2"]),
    usuarios: new Set(["19154200-2"]),
    solicitudes: new Set(["SOL-1"]),
    citas: new Set(["CITA-1"])
};

const solicitud: SolicitudOrigen = {
    id_solicitud: "SOL-1",
    fecha_inicio: new Date("2025-03-01T10:00:00Z"),
    rut_orientador: "11121161-2",
    rut_usuario: "19.154.200-2",
    tipo_solicitud_id: "3",
    motivo_id: "null",
    ultimo_control: "",
    descripcion: "Control",
    disponibilidad_llamada: "AM/PM",
    priorizacion_admin: 1,
    rut_gestor: "99999999-9",
    accion: "Realizar solicitud",
    razon_rechazo: null,
    fecha_validacion: null,
    estado_solicitud: "En curso",
    centro_id: "600",
    observacion_rechazo: null
};

const cita: CitaOrigen = {
    id_cita: "CITA-1",
    solicitud_id: "SOL-1",
    rut_usuario: "191542002",
    rut_gestor: null,
    tipo_prestacion: "Agendar una hora con profesional",
    profesional_id: "",
    prestacion_id: "Otras Consultas (Abreviadas)",
    fecha_estimada_atencion: null,
    observacion: null,
    estado_cita: "Sin llamadas",
    priorizacion_clinica: "Alta",
    priorizacion: 60,
    centro_id: "600",
    fecha_creacion: new Date("2025-03-02T10:00:00Z"),
    razon_rechazo: null
};

const llamada: LlamadaOrigen = {
    id_llamada: "LL-1",
    cita_id: "CITA-1",
    rut_usuario: "19154200-2",
    rut_comunicador: "11121161-2",
    respuesta_usuario: "No contesta",
    observacion: null,
    hora_agendada: null,
    fecha_llamada: new Date("2025-03-03T10:00:00Z"),
    centro_id: "600"
};

function usuario(parcial: Partial<UsuarioOrigen>): UsuarioOrigen {
    return {
        rut: "19154200-2",
        nombre: "Ana",
        apellido: "Rojas",
        nombre_social: null,
        genero: null,
        otro_genero: null,
        fecha_nacimiento: null,
        sector: null,
        telefono: null,
        telefono_alternativo: null,
        correo_contacto: null,
        gestante: null,
        discapacidad: null,
        priorizacion_administrativa: null,
        centro_id: null,
        policonsultante: null,
        ...parcial
    };
}

describe("reglas transversales", () => {
    it("trata '' y 'null' como ausencia de valor", () => {
        expect(vacioANull("")).toBeNull();
        expect(vacioANull("  ")).toBeNull();
        expect(vacioANull("NULL")).toBeNull();
        expect(vacioANull("Alta")).toBe("Alta");
    });

    it("normaliza el RUT como la app", () => {
        expect(rutNormalizado("27244773K")).toBe("27244773-K");
        expect(rutNormalizado("19.154.200-2")).toBe("19154200-2");
        expect(rutNormalizado("7763116-k")).toBe("7763116-K");
        expect(rutNormalizado("")).toBeNull();
    });

    it("convierte IDs de texto a entero o los marca invalidos", () => {
        expect(aEntero("12")).toBe(12);
        expect(aEntero("null")).toBeNull();
        expect(aEntero("Otras Consultas")).toBe("invalido");
    });

    it("normaliza estados", () => {
        expect(estadoFuncionario("1")).toBe("Activo");
        expect(estadoFuncionario("0")).toBe("Inactivo");
        expect(estadoSolicitud("En curso")).toBe("En Curso");
        expect(estadoSolicitud("Realizado")).toBe("Realizado");
    });

    it("interpreta la fecha de AppSheet como hora de Chile y la convierte al instante real", () => {
        // Prisma entrega el DATETIME naive con sus componentes en UTC.
        expect(horaChileAInstante(new Date("2026-10-19T16:33:51Z"))?.toISOString()).toBe("2026-10-19T19:33:51.000Z");
        expect(horaChileAInstante(new Date("2026-07-15T10:00:00Z"))?.toISOString()).toBe("2026-07-15T14:00:00.000Z");
        expect(horaChileAInstante(null)).toBeNull();
    });

    it("deja sin convertir las fechas con año imposible (datos erróneos de AppSheet)", () => {
        // 170 llamadas tienen hora_agendada como 0026-01-20: Date.UTC lee años < 100 como 19xx.
        const erronea = new Date("0026-01-20T09:29:15Z");
        expect(horaChileAInstante(erronea)).toBe(erronea);
        expect(horaChileAInstante(new Date("0720-01-07T02:14:45Z"))?.toISOString()).toBe("0720-01-07T02:14:45.000Z");
    });

    it("resuelve los cambios de hora de Chile", () => {
        // 05/04/2026: a las 00:00 (-03) vuelve a 23:00 (-04); 23:30 ocurre dos veces y se toma la primera.
        expect(horaChileAInstante(new Date("2026-04-04T23:30:00Z"))?.toISOString()).toBe("2026-04-05T02:30:00.000Z");
        // 06/09/2026: a las 00:00 (-04) salta a 01:00 (-03); 00:30 no existe y se corre a 01:30 (-03).
        expect(horaChileAInstante(new Date("2026-09-06T00:30:00Z"))?.toISOString()).toBe("2026-09-06T04:30:00.000Z");
    });

    it("mapea roles por nombre", () => {
        expect(nombreRolDestino("Some")).toBe("SOME");
        expect(nombreRolDestino("Vizualizador")).toBe("Visualizador");
        expect(nombreRolDestino("Gestor")).toBe("Gestor");
    });
});

describe("funcionarios", () => {
    const roles = new Map([[3, 8]]);

    it("mapea el rol y normaliza estado y correo", () => {
        const r = transformarFuncionario(
            { rut: "11121161-2", email: "Ana@CMValparaiso.cl ", nombre: "Ana", rol_id: 3, estado: "1", codigo: null, rut_consulta: null, centro_id: "600", programa_asociado: null, invitacion_app: null },
            roles
        );
        expect(r.ok && r.data).toMatchObject({ rol_id: 8, estado: "Activo", email: "ana@cmvalparaiso.cl" });
    });

    it("con correo repetido, el activo conserva el correo y el otro se migra con alias", () => {
        const base: FuncionarioDestino = { rut: "1111111-6", email: "x@cmv.cl", nombre: "X", rol_id: 8, estado: "Activo", codigo: null, rut_consulta: null, centro_id: null, programa_asociado: null, invitacion_app: null };
        const { aceptados, rechazos, advertencias } = deduplicarFuncionarios([{ ...base, rut: "11111112-2", estado: "Inactivo" }, base]);
        expect(rechazos).toHaveLength(0);
        expect(aceptados.find((f) => f.rut === "1111111-6")?.email).toBe("x@cmv.cl");
        expect(aceptados.find((f) => f.rut === "11111112-2")?.email).toBe("x+11111112-2@cmv.cl");
        expect(advertencias[0]).toMatchObject({ clave: "11111112-2", regla: "advertencia: correo duplicado con alias" });
        expect(correoAlias("sin-arroba", "1-9")).toBe("sin-arroba+1-9");
    });
});

describe("usuarios", () => {
    it("rechaza pacientes sin nombre o apellido", () => {
        const r = transformarUsuario(usuario({ apellido: null }));
        expect(!r.ok && r.rechazo.regla).toBe("R6 campo obligatorio vacio");
    });

    it("conserva un paciente por RUT, el de datos mas completos", () => {
        const original = new Map<UsuarioDestino, string>();
        const a = transformarUsuario(usuario({ rut: "27244773K" }));
        const b = transformarUsuario(usuario({ rut: "27244773-K", telefono: "912345678" }));
        if (!a.ok || !b.ok) throw new Error("fixture invalido");
        original.set(a.data, "27244773K");
        original.set(b.data, "27244773-K");
        const { aceptados, rechazos } = deduplicarUsuarios([a.data, b.data], original);
        expect(aceptados).toHaveLength(1);
        expect(aceptados[0].telefono).toBe("912345678");
        expect(rechazos[0]).toMatchObject({ clave: "27244773K", regla: "R2 paciente duplicado por RUT" });
    });
});

describe("solicitudes", () => {
    it("normaliza y anula referencias opcionales inexistentes con advertencia", () => {
        const r = transformarSolicitud(solicitud, catalogos, referencias);
        if (!r.ok) throw new Error(r.rechazo.detalle);
        expect(r.data).toMatchObject({ rut_usuario: "19154200-2", motivo_id: null, estado_solicitud: "En Curso", ultimo_control: null, rut_gestor: null });
        expect(r.advertencias).toHaveLength(1);
    });

    it("convierte fecha_inicio y fecha_validacion de hora de Chile al instante real", () => {
        const r = transformarSolicitud({ ...solicitud, fecha_validacion: new Date("2025-03-01T12:00:00Z") }, catalogos, referencias);
        if (!r.ok) throw new Error(r.rechazo.detalle);
        expect(r.data.fecha_inicio.toISOString()).toBe("2025-03-01T13:00:00.000Z");
        expect(r.data.fecha_validacion?.toISOString()).toBe("2025-03-01T15:00:00.000Z");
    });

    it("rechaza si el paciente no existe (R5) o falta un obligatorio (R6)", () => {
        const sinPaciente = transformarSolicitud({ ...solicitud, rut_usuario: "1-9" }, catalogos, referencias);
        expect(!sinPaciente.ok && sinPaciente.rechazo.regla).toBe("R5 relacion inexistente");
        const sinFecha = transformarSolicitud({ ...solicitud, fecha_inicio: null }, catalogos, referencias);
        expect(!sinFecha.ok && sinFecha.rechazo.regla).toBe("R6 campo obligatorio vacio");
    });

    it("migra como Rechazado toda solicitud con accion de rechazo, este En curso o Realizado", () => {
        for (const estado_solicitud of ["En curso", "Realizado"]) {
            const r = transformarSolicitud({ ...solicitud, accion: "Rechazar solicitud", estado_solicitud }, catalogos, referencias);
            expect(r.ok && r.data.estado_solicitud).toBe("Rechazado");
        }
    });
});

describe("citas", () => {
    it("convierte fecha_creacion al instante real y deja la fecha estimada (DATE) sin cambios", () => {
        const estimada = new Date("2025-04-10T00:00:00Z");
        const r = transformarCita({ ...cita, fecha_estimada_atencion: estimada }, catalogos, referencias);
        if (!r.ok) throw new Error(r.rechazo.detalle);
        expect(r.data.fecha_creacion.toISOString()).toBe("2025-03-02T13:00:00.000Z");
        expect(r.data.fecha_estimada_atencion).toBe(estimada);
    });

    it("resuelve la prestacion por nombre y anula IDs vacios", () => {
        const r = transformarCita(cita, catalogos, referencias);
        if (!r.ok) throw new Error(r.rechazo.detalle);
        expect(r.data).toMatchObject({ prestacion_id: 5, profesional_id: null, rut_usuario: "19154200-2" });
        expect(resolverPrestacion("99", catalogos)).toBe("invalido");
    });

    it("rechaza citas cuya solicitud no se migro", () => {
        const r = transformarCita({ ...cita, solicitud_id: "SOL-X" }, catalogos, referencias);
        expect(!r.ok && r.rechazo.regla).toBe("R5 relacion inexistente");
    });

    it("cierra el aviso de rechazo pendiente con advertencia", () => {
        const r = transformarCita({ ...cita, tipo_prestacion: "Rechazar cita", prestacion_id: null, estado_cita: "No contesta (1)" }, catalogos, referencias);
        if (!r.ok) throw new Error(r.rechazo.detalle);
        expect(r.data.estado_cita).toBe("Cita Rechazada (Gestor)");
        expect(r.advertencias).toEqual([expect.objectContaining({ clave: "CITA-1", regla: "advertencia: aviso de rechazo cerrado" })]);
    });

    it("no toca avisos de rechazo ya cerrados ni citas pendientes con profesional", () => {
        const cerrado = transformarCita({ ...cita, tipo_prestacion: "Rechazar cita", estado_cita: "Cita Rechazada (No Necesaria)" }, catalogos, referencias);
        expect(cerrado.ok && cerrado.data.estado_cita).toBe("Cita Rechazada (No Necesaria)");
        const pendiente = transformarCita(cita, catalogos, referencias);
        expect(pendiente.ok && pendiente.data.estado_cita).toBe("Sin llamadas");
    });
});

describe("llamadas", () => {
    it("acepta llamadas de citas migradas", () => {
        const r = transformarLlamada(llamada, referencias);
        expect(r.ok && r.data.rut_comunicador).toBe("11121161-2");
    });

    it("convierte fecha_llamada y hora_agendada de hora de Chile al instante real", () => {
        const r = transformarLlamada({ ...llamada, hora_agendada: new Date("2025-03-10T09:30:00Z") }, referencias);
        if (!r.ok) throw new Error(r.rechazo.detalle);
        expect(r.data.fecha_llamada?.toISOString()).toBe("2025-03-03T13:00:00.000Z");
        expect(r.data.hora_agendada?.toISOString()).toBe("2025-03-10T12:30:00.000Z");
    });

    it("rechaza respuesta vacia y citas no migradas", () => {
        const vacia = transformarLlamada({ ...llamada, respuesta_usuario: "" }, referencias);
        expect(!vacia.ok && vacia.rechazo.regla).toBe("R6 campo obligatorio vacio");
        const huerfana = transformarLlamada({ ...llamada, cita_id: "CITA-X" }, referencias);
        expect(!huerfana.ok && huerfana.rechazo.regla).toBe("R5 relacion inexistente");
    });
});
