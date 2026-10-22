// services
import { ErrorIntegracion } from "./errores";
import type { Tx } from "./paciente";

interface IdsCatalogo {
    tipo_solicitud_id: number;
    motivo_id: number | null;
    rut_funcionario: string;
    profesional_id?: number;
    prestacion_id?: number;
}

// Falla con CATALOGO por el primer id que no exista.
export async function verificarCatalogos(tx: Tx, ids: IdsCatalogo): Promise<void> {
    const comprobaciones: Array<[string, string | number | null | undefined, () => Promise<unknown>]> = [
        ["tipo_solicitud_id", ids.tipo_solicitud_id, () => tx.tipoSolicitud.findUnique({ where: { id_tipo_solicitud: ids.tipo_solicitud_id } })],
        ["motivo_id", ids.motivo_id, () => tx.motivo.findUnique({ where: { id_motivo: ids.motivo_id as number } })],
        ["rut_funcionario", ids.rut_funcionario, () => tx.funcionario.findUnique({ where: { rut: ids.rut_funcionario } })],
        ["profesional_id", ids.profesional_id, () => tx.profesional.findUnique({ where: { id_profesional: ids.profesional_id as number } })],
        ["prestacion_id", ids.prestacion_id, () => tx.prestacion.findUnique({ where: { id_prestacion: ids.prestacion_id as number } })]
    ];

    for (const [campo, valor, buscar] of comprobaciones) {
        if (valor === null || valor === undefined) continue;
        if (!(await buscar())) throw new ErrorIntegracion("CATALOGO", `${campo} ${valor} no existe`);
    }
}
