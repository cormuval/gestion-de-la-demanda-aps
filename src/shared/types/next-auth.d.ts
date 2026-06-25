import { MenuItem } from "./session";

declare module "next-auth" {
    interface Session {
        user: {
            name?: string | null;
            email?: string | null;
            image?: string | null;
            rut: string;
            nombre: string;
            rol: { id: number; nombre: string };
            menu: MenuItem[];
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        rut?: string;
        nombre?: string;
        rol?: { id: number; nombre: string };
        menu?: MenuItem[];
    }
}
