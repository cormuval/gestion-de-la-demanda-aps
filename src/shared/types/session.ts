export interface SessionUser {
    rut: string;
    email: string;
    nombre: string;
    centro_id: string | null;
    centro_nombre: string | null;
    rol: { id: number; nombre: string };
}
