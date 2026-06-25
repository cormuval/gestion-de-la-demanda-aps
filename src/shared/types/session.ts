export interface MenuItem {
    id: number;
    nombre: string;
    descripcion: string | null;
    ruta: string;
    imagen: string | null;
}

export interface SessionUser {
    rut: string;
    email: string;
    nombre: string;
    rol: { id: number; nombre: string };
    menu: MenuItem[];
}
