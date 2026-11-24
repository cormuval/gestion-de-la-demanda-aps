// lib
import { prisma } from "@/shared/lib/prisma";
// config
import { TIPOS_EXCLUIDOS_WEB, aplicarCatalogoWeb } from "@/modules/solicitud-web/config/catalogoWeb";
// utils
import { getColumnaTipoSolicitudPorCentro } from "@/modules/catalogos/utils/centroTipoSolicitud";
// types
import type { TipoSolicitudPublico } from "@/modules/solicitud-web/types/solicitudWeb";

// El catálogo de referencia y el ingreso interno usan "1" para activo y habilitado.
const VALOR_HABILITADO = "1";

export async function tiposHabilitados(centro_id: string): Promise<TipoSolicitudPublico[]> {
    const centro = await prisma.centro.findUnique({
        where: { id_centro: centro_id },
        select: { nombre_centro: true }
    });
    const columna = getColumnaTipoSolicitudPorCentro(centro?.nombre_centro);
    if (!columna) return [];

    const excluidos = [...TIPOS_EXCLUIDOS_WEB];
    const tipos = await prisma.tipoSolicitud.findMany({
        where: { estado: VALOR_HABILITADO, [columna]: VALOR_HABILITADO, id_tipo_solicitud: { notIn: excluidos } },
        select: { id_tipo_solicitud: true, nombre_tipo_solicitud: true },
        orderBy: { nombre_tipo_solicitud: "asc" }
    });

    // Se vuelve a filtrar por si una consulta o un mock devuelve tipos excluidos.
    const visibles = tipos.filter((tipo) => !TIPOS_EXCLUIDOS_WEB.has(tipo.id_tipo_solicitud));
    if (!visibles.length) return [];
    const motivos = await prisma.motivo.findMany({
        where: { estado: VALOR_HABILITADO, tipo_solicitud_id: { in: visibles.map((tipo) => tipo.id_tipo_solicitud) } },
        select: { id_motivo: true, tipo_solicitud_id: true, nombre_motivo: true },
        orderBy: { nombre_motivo: "asc" }
    });
    return aplicarCatalogoWeb(visibles.map((tipo) => ({
        id: tipo.id_tipo_solicitud,
        nombre: tipo.nombre_tipo_solicitud,
        submotivos: motivos
            .filter((motivo) => motivo.tipo_solicitud_id === tipo.id_tipo_solicitud)
            .map((motivo) => ({ id: motivo.id_motivo, nombre: motivo.nombre_motivo }))
    })));
}
