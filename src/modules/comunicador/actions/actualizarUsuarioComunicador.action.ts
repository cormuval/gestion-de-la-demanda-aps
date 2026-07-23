"use server";

// lib
import { requirePermiso } from "@/shared/lib/permisos";
// actions (núcleo compartido)
import { persistirActualizacionUsuario } from "@/modules/solicitudes/actions/usuarioUpdate";
// schemas
import type { UsuarioSolicitudInput } from "@/modules/solicitudes/schemas/usuario.schema";

export async function actualizarUsuarioComunicador(input: UsuarioSolicitudInput) {
    const user = await requirePermiso("comunicador.paciente");
    return persistirActualizacionUsuario({ email: user.email, nombre: user.nombre, rut: user.rut }, input, "comunicador");
}
