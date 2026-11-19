// Recupera las contrarreferencias que el Apps Script envio a la BD antigua (04-11 al 17-11-2026)
// y las registra en la BD de DATABASE_URL con el mismo servicio del endpoint de integracion.
//
// Uso (en el servidor, con DATABASE_URL apuntando a la base de destino):
//   npm run recuperar:contrarreferencias -- --entrada=<casos.json> [--limite=N] [--salida=<dir>]
//   npm run recuperar:contrarreferencias -- --entrada=<casos.json> --ejecutar --base=<base_destino> [--limite=N]
//
// Sin --ejecutar solo simula: valida cada caso y revisa si ya existe, sin escribir.
// --ejecutar exige repetir el nombre de la base de destino para no escribir en la equivocada.
// Re-ejecutar no duplica: el servicio rechaza por id_solicitud y por la marca de contrarreferencia.
// El archivo de entrada contiene datos de pacientes: no se versiona y se borra al terminar.

// lib
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/shared/lib/prisma";

// services
import { registrarContrarreferencia } from "@/modules/integraciones/services/registrarContrarreferencia";

// reglas
import { armarPayload, idContrarreferencia, type CasoOrigen } from "./reglas";

const TIPO_SOLICITUD_CR = 18;

type Estado = "por cargar" | "cargado" | "duplicado" | "rechazado" | "error";

interface Fila {
    id_solicitud: string;
    contrarreferencia_id: number | null;
    modo: string;
    paciente_nuevo: boolean | null;
    estado: Estado;
    detalle: string;
}

interface Opciones {
    entrada: string;
    ejecutar: boolean;
    base: string | null;
    limite: number | null;
    salida: string;
}

function leerOpciones(): Opciones {
    const args = process.argv.slice(2);
    const valor = (nombre: string) => args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=") ?? null;
    const entrada = valor("entrada");
    if (entrada === null) throw new Error("Falta --entrada=<casos.json>");
    const limite = valor("limite");
    const marca = new Date().toISOString().replace(/[:.]/g, "-");
    return {
        entrada,
        ejecutar: args.includes("--ejecutar"),
        base: valor("base"),
        limite: limite === null ? null : Number(limite),
        salida: valor("salida") ?? `recuperar-contrarreferencias-${marca}`
    };
}

function nombreBase(): string {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta la variable de entorno DATABASE_URL");
    return new URL(url).pathname.replace(/^\//, "");
}

async function yaExiste(idSolicitud: string, contrarreferenciaId: number): Promise<boolean> {
    if (await prisma.solicitud.findUnique({ where: { id_solicitud: idSolicitud }, select: { id_solicitud: true } })) return true;
    const marca = `Registro Contrarreferencia ID: ${contrarreferenciaId}`;
    const candidatas = await prisma.solicitud.findMany({
        where: { tipo_solicitud_id: TIPO_SOLICITUD_CR, descripcion: { contains: marca } },
        select: { descripcion: true }
    });
    const patron = new RegExp(`${marca}( \\||$)`);
    return candidatas.some((s) => patron.test(s.descripcion ?? ""));
}

async function procesar(caso: CasoOrigen, ejecutar: boolean): Promise<Fila> {
    const base = { id_solicitud: caso.id_solicitud, contrarreferencia_id: idContrarreferencia(caso.descripcion), modo: caso.id_cita ? "validada" : "pendiente", paciente_nuevo: null };
    const armadoPrevio = armarPayload(caso, true);
    if (!armadoPrevio.ok) return { ...base, estado: "rechazado", detalle: armadoPrevio.motivo };

    const rut = armadoPrevio.payload.paciente.rut;
    const pacienteExiste = (await prisma.usuario.findUnique({ where: { rut }, select: { rut: true } })) !== null;
    const armado = armarPayload(caso, pacienteExiste);
    if (!armado.ok) return { ...base, estado: "rechazado", detalle: armado.motivo };

    const fila = { ...base, paciente_nuevo: !pacienteExiste };
    if (!ejecutar) {
        const existe = await yaExiste(caso.id_solicitud, armado.payload.contrarreferencia_id);
        return { ...fila, estado: existe ? "duplicado" : "por cargar", detalle: "" };
    }

    const resultado = await registrarContrarreferencia(armado.payload);
    if (resultado.ok) return { ...fila, estado: "cargado", detalle: "" };
    if (resultado.codigo === "DUPLICADO") return { ...fila, estado: "duplicado", detalle: resultado.error };
    return { ...fila, estado: "error", detalle: `${resultado.codigo}: ${resultado.error}` };
}

function csv(valor: unknown): string {
    return `"${String(valor ?? "").replace(/"/g, '""')}"`;
}

async function main(): Promise<void> {
    const opciones = leerOpciones();
    const baseDestino = nombreBase();
    if (opciones.ejecutar && opciones.base !== baseDestino) {
        throw new Error(`--ejecutar exige --base=${baseDestino} (repetir el nombre de la base de destino)`);
    }

    const casos = (JSON.parse(readFileSync(opciones.entrada, "utf8")) as CasoOrigen[])
        .slice()
        .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio) || a.id_solicitud.localeCompare(b.id_solicitud));
    const alcance = opciones.limite === null ? casos : casos.slice(0, opciones.limite);
    console.log(`Destino: ${baseDestino} · Modo: ${opciones.ejecutar ? "EJECUCION" : "simulacion"} · Casos: ${alcance.length} de ${casos.length}`);

    const filas: Fila[] = [];
    for (const caso of alcance) {
        filas.push(await procesar(caso, opciones.ejecutar));
    }

    mkdirSync(opciones.salida, { recursive: true });
    const columnas: (keyof Fila)[] = ["id_solicitud", "contrarreferencia_id", "modo", "paciente_nuevo", "estado", "detalle"];
    const lineas = [columnas.join(","), ...filas.map((f) => columnas.map((c) => csv(f[c])).join(","))];
    writeFileSync(join(opciones.salida, "reporte.csv"), lineas.join("\n") + "\n", "utf8");

    const conteo = (estado: Estado) => filas.filter((f) => f.estado === estado).length;
    const resumen = {
        destino: baseDestino,
        modo: opciones.ejecutar ? "ejecucion" : "simulacion",
        casos: filas.length,
        por_cargar: conteo("por cargar"),
        cargados: conteo("cargado"),
        duplicados: conteo("duplicado"),
        rechazados: conteo("rechazado"),
        errores: conteo("error"),
        validadas: filas.filter((f) => f.modo === "validada").length,
        pacientes_nuevos: filas.filter((f) => f.paciente_nuevo === true).length
    };
    writeFileSync(join(opciones.salida, "resumen.json"), JSON.stringify(resumen, null, 4) + "\n", "utf8");
    console.log(resumen);
    for (const f of filas.filter((x) => x.estado === "rechazado" || x.estado === "error")) {
        console.log(`  ${f.estado}: ${f.id_solicitud} (CR ${f.contrarreferencia_id ?? "?"}) ${f.detalle}`);
    }
    console.log(`Reporte en ${opciones.salida}/`);
}

main()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
