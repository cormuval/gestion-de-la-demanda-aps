// lib
import { prisma } from "@/shared/lib/prisma";
// utils
import { getColumnaTipoSolicitudPorCentro } from "@/modules/catalogos/utils/centroTipoSolicitud";

// El catálogo de referencia y el ingreso interno usan "1" para activo y habilitado.
const VALOR_HABILITADO = "1";

export async function tiposHabilitados(centro_id: string): Promise<Array<{ id: number; nombre: string }>> {
    const centro = await prisma.centro.findUnique({
        where: { id_centro: centro_id },
        select: { nombre_centro: true }
    });
    const columna = getColumnaTipoSolicitudPorCentro(centro?.nombre_centro);
    if (!columna) return [];

    const tipos = await prisma.tipoSolicitud.findMany({
        where: { estado: VALOR_HABILITADO, [columna]: VALOR_HABILITADO },
        select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true },
        orderBy: { nombre_tipo_solicitud: "asc" }
    });

    return tipos.map((tipo) => ({ id: tipo.id_tipo_solicitud, nombre: tipo.nombre_tipo_solicitud }));
}
