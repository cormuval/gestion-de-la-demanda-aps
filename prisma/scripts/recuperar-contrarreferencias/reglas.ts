// Reglas puras para recuperar las contrarreferencias que el Apps Script envio a la BD antigua
// (vps-das gestionDemanda) entre el 04-11-2026 y el 17-11-2026.

// schemas
import { contrarreferenciaSchema, type Contrarreferencia } from "@/modules/integraciones/schemas/contrarreferencia.schema";

// utils
import { esRutChilenoValido, normalizarRut } from "@/modules/solicitudes/utils/rut";

// Fila del archivo de entrada: solicitud + paciente + cita (si la hay) tal como estan en la BD antigua.
export interface CasoOrigen {
    id_solicitud: string;
    fecha_inicio: string; // "YYYY-MM-DD HH:mm:ss" en hora de Chile
    descripcion: string | null;
    centro_id: string;
    rut_usuario: string;
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    id_cita: string | null;
    profesional_id: string | null;
    prestacion_id: string | null;
    fecha_estimada_atencion: string | null; // "YYYY-MM-DD"
    observacion_cita: string | null;
}

export type Armado = { ok: true; payload: Contrarreferencia } | { ok: false; motivo: string };

// Mismo criterio que el servicio: el separador evita que 43 calce con 4321.
const PATRON_MARCA = /Registro Contrarreferencia ID: (\d+)(?= \||$)/;

export function idContrarreferencia(descripcion: string | null): number | null {
    const m = PATRON_MARCA.exec(descripcion ?? "");
    return m === null ? null : Number(m[1]);
}

function entero(valor: string | null): number | null {
    return valor !== null && /^\d+$/.test(valor.trim()) ? Number(valor) : null;
}

// Arma el mismo cuerpo que envia el Apps Script, conservando id, fecha de ingreso y fecha estimada originales.
// Si el paciente ya existe no se envia el telefono: el servicio lo actualizaria con un dato posiblemente mas antiguo.
export function armarPayload(caso: CasoOrigen, pacienteExiste: boolean): Armado {
    const contrarreferenciaId = idContrarreferencia(caso.descripcion);
    if (contrarreferenciaId === null) return { ok: false, motivo: "Sin marca de contrarreferencia" };
    if (!esRutChilenoValido(caso.rut_usuario)) return { ok: false, motivo: "RUT inválido" };

    const validada = caso.id_cita !== null;
    const resultado = contrarreferenciaSchema.safeParse({
        contrarreferencia_id: contrarreferenciaId,
        modo: validada ? "validada" : "pendiente",
        paciente: {
            rut: normalizarRut(caso.rut_usuario),
            nombre: caso.nombre,
            apellido: caso.apellido,
            telefono: pacienteExiste ? null : caso.telefono
        },
        solicitud: {
            id_solicitud: caso.id_solicitud,
            fecha_inicio: caso.fecha_inicio,
            descripcion: caso.descripcion,
            centro_id: caso.centro_id
        },
        cita: validada
            ? {
                  id_cita: caso.id_cita,
                  profesional_id: entero(caso.profesional_id),
                  prestacion_id: entero(caso.prestacion_id),
                  fecha_estimada_atencion: caso.fecha_estimada_atencion,
                  observacion: caso.observacion_cita
              }
            : null
    });

    if (!resultado.success) {
        const detalle = resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return { ok: false, motivo: `Datos inválidos (${detalle})` };
    }
    return { ok: true, payload: resultado.data };
}
