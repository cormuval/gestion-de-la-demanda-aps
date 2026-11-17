function formatear(valor: Date | string | null, zona: string, conHora: boolean): string {
    if (valor === null) return "—";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "—";
    const partes = new Intl.DateTimeFormat("es-CL", {
        timeZone: zona, day: "2-digit", month: "2-digit", year: "numeric",
        ...(conHora ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {})
    }).formatToParts(fecha);
    const parte = (tipo: Intl.DateTimeFormatPartTypes): string => partes.find((p) => p.type === tipo)?.value ?? "";
    const dia = `${parte("day")}-${parte("month")}-${parte("year")}`;
    return conHora ? `${dia} ${parte("hour")}:${parte("minute")}` : dia;
}

export function formatearFecha(valor: Date | string | null): string {
    return formatear(valor, "America/Santiago", false);
}
export function formatearFechaHora(valor: Date | string | null): string {
    return formatear(valor, "America/Santiago", true);
}
export function formatearFechaCalendario(valor: Date | string | null): string {
    return formatear(valor, "UTC", false);
}
