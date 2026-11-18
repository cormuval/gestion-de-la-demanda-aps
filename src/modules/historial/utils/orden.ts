export function ordenarSolicitudesHistorial<T extends { estado_solicitud: string; fecha_inicio: Date | string }>(solicitudes: T[]): T[] {
    return [...solicitudes].sort((a, b) => {
        const prioridad = Number(b.estado_solicitud === "En Curso") - Number(a.estado_solicitud === "En Curso");
        return prioridad || new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime();
    });
}
