import type { TipoSolicitud, Motivo } from "@prisma/client";

export interface Catalogos {
    tiposSolicitud: TipoSolicitud[];
    motivos: Motivo[];
}
