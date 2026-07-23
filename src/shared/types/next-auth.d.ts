export {};

declare module "next-auth" {
    interface Session {
        user: {
            name?: string | null;
            email?: string | null;
            image?: string | null;
            rut: string;
            nombre: string;
            centro_id: string | null;
            centro_nombre: string | null;
            rol: { id: number; nombre: string };
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        rut?: string;
        nombre?: string;
        centro_id?: string | null;
        centro_nombre?: string | null;
        rol?: { id: number; nombre: string };
    }
}
