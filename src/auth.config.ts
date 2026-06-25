import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            authorization: {
                params: { prompt: "consent", access_type: "offline", response_type: "code" }
            }
        })
    ],
    pages: {
        signIn: "/auth/login",
        error: "/auth/error"
    },
    callbacks: {
        // Usado por el middleware para proteger rutas (corre en edge, sin Prisma)
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = Boolean(auth?.user);
            const isAuthPage = nextUrl.pathname.startsWith("/auth");
            if (isAuthPage) return true;
            return isLoggedIn;
        }
    }
} satisfies NextAuthConfig;
