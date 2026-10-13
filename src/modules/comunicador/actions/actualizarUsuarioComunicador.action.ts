"use server";

// lib
import { requirePermiso } from "@/shared/lib/permisos";
// actions (núcleo compartido)
import { persistirActualizacionUsuario, type UsuarioGuardado } from "@/modules/solicitudes/actions/usuarioUpdate";
// schemas
import type { UsuarioSolicitudInput } from "@/modules/solicitudes/schemas/usuario.schema";
// types
import type { ResultadoAccion } from "@/shared/types/resultado";

export async function actualizarUsuarioComunicador(input: UsuarioSolicitudInput): Promise<ResultadoAccion<{ usuario: UsuarioGuardado }>> {
    const user = await requirePermiso("comunicador.paciente");
    return persistirActualizacionUsuario({ email: user.email, nombre: user.nombre, rut: user.rut }, input, "comunicador");
}
