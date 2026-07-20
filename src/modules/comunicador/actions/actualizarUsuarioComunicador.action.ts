"use server";

// lib
import { requireSessionUser } from "@/shared/lib/auth";
import { puedeAccederComunicador } from "@/shared/lib/access";
// actions (núcleo compartido)
import { persistirActualizacionUsuario } from "@/modules/solicitudes/actions/usuarioUpdate";
// schemas
import type { UsuarioSolicitudInput } from "@/modules/solicitudes/schemas/usuario.schema";

export async function actualizarUsuarioComunicador(input: UsuarioSolicitudInput) {
    const user = await requireSessionUser();
    if (!puedeAccederComunicador(user.rol.nombre)) throw new Error("No tienes permiso para el comunicador");
    return persistirActualizacionUsuario({ email: user.email, nombre: user.nombre, rut: user.rut }, input, "comunicador");
}
