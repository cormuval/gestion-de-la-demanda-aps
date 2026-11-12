// utils
import { esRutChilenoValido, normalizarRut } from "@/modules/solicitudes/utils/rut";

// types
import type { PacientePercapita, ResultadoPercapita } from "../types/solicitudWeb";

function parsearFecha(valor: unknown): Date | null {
    if (typeof valor !== "string") return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    const local = /^(\d{2})-(\d{2})-(\d{4})$/.exec(valor);
    if (!iso && !local) return null;
    const anio = Number(iso ? iso[1] : local![3]);
    const mes = Number(iso ? iso[2] : local![2]);
    const dia = Number(iso ? iso[3] : local![1]);
    const fecha = new Date(0);
    fecha.setUTCFullYear(anio, mes - 1, dia);
    return fecha.getUTCFullYear() === anio
        && fecha.getUTCMonth() === mes - 1
        && fecha.getUTCDate() === dia ? fecha : null;
}

export function mapearPercapita(registro: Record<string, unknown>): PacientePercapita | null {
    if (typeof registro.NOMBRES !== "string" || !registro.NOMBRES.trim()
        || registro.COD_CENTRO === null || registro.COD_CENTRO === undefined
        || String(registro.COD_CENTRO).trim() === "") return null;

    const apellido = [registro.APELLIDO_PATERNO, registro.APELLIDO_MATERNO]
        .filter((valor): valor is string => typeof valor === "string" && Boolean(valor.trim()))
        .map((valor) => valor.trim())
        .join(" ")
        .slice(0, 50);

    return {
        nombre: registro.NOMBRES.slice(0, 50),
        apellido,
        fecha_nacimiento: parsearFecha(registro.FECHA_NACIMIENTO),
        genero: typeof registro.GENERO === "string" && registro.GENERO ? registro.GENERO : null,
        centro_id: String(registro.COD_CENTRO),
    };
}

export async function consultarPercapita(rut: string): Promise<ResultadoPercapita> {
    const url = process.env.GI_PERCAPITA_URL;
    const clave = process.env.GI_API_KEY;
    if (!url || !clave || !esRutChilenoValido(rut)) return { estado: "NO_DISPONIBLE" };

    try {
        const destino = new URL(url);
        destino.searchParams.set("rut", normalizarRut(rut));
        const respuesta = await fetch(destino.toString(), {
            headers: { "api-key": clave },
            signal: AbortSignal.timeout(10_000),
        });
        if (respuesta.status === 404) return { estado: "NO_INSCRITO" };
        if (respuesta.status !== 200) return { estado: "NO_DISPONIBLE" };
        const registro: unknown = await respuesta.json();
        if (!registro || typeof registro !== "object" || Array.isArray(registro)) {
            return { estado: "NO_DISPONIBLE" };
        }
        const paciente = mapearPercapita(registro as Record<string, unknown>);
        return paciente ? { estado: "INSCRITO", paciente } : { estado: "NO_DISPONIBLE" };
    } catch {
        return { estado: "NO_DISPONIBLE" };
    }
}
