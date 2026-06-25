import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
// lib
import { prisma } from "@/shared/lib/prisma";
import { AuditLogger } from "@/shared/lib/logger";
// types
import { MenuItem } from "@/shared/types/session";

export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user }) {
            if (!user.email) {
                await AuditLogger.logAuth("LOGIN", false, { name: user.name ?? "Desconocido" }, { error: "Sin email", details: "Proveedor: google" });
                return false;
            }
            const funcionario = await prisma.funcionario.findUnique({ where: { email: user.email } });
            if (!funcionario || funcionario.estado !== "Activo") {
                await AuditLogger.logAuth("LOGIN", false, { name: user.name ?? "Desconocido" }, { error: "Funcionario no encontrado o inactivo", details: `Email: ${user.email}` });
                return false;
            }
            await AuditLogger.logAuth("LOGIN", true, { id: user.email, name: user.name ?? funcionario.nombre, rut: funcionario.rut }, { details: "Proveedor: google" });
            return true;
        },
        async jwt({ token, user }) {
            if (user?.email) {
                const funcionario = await prisma.funcionario.findUnique({
                    where: { email: user.email },
                    include: { role: { include: { menus: { orderBy: { id_menu: "asc" } } } } }
                });
                if (funcionario) {
                    token.rut = funcionario.rut;
                    token.nombre = funcionario.nombre;
                    token.rol = { id: funcionario.role.id_rol, nombre: funcionario.role.nombre_rol };
                    token.menu = funcionario.role.menus.map(
                        (m): MenuItem => ({ id: m.id_menu, nombre: m.nombre, descripcion: m.descripcion, ruta: m.ruta, imagen: m.imagen })
                    );
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.rut = (token.rut ?? "") as string;
                session.user.nombre = (token.nombre ?? "") as string;
                session.user.rol = (token.rol ?? { id: 0, nombre: "" }) as { id: number; nombre: string };
                session.user.menu = (token.menu ?? []) as MenuItem[];
            }
            return session;
        }
    },
    events: {
        async signOut(message) {
            const email = "token" in message && message.token ? (message.token.email as string) : "Desconocido";
            await AuditLogger.logAuth("LOGOUT", true, { id: email }, { details: `Email: ${email}` });
        }
    }
});
