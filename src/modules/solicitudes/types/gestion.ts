export const ERROR_SOLICITUD_NO_PENDIENTE = "La solicitud no esta pendiente de validacion o no pertenece a tu centro";

export interface EstadoPendiente {
    pendiente: boolean;
    estado: string | null;
}
