// lib
import type { Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

interface DatosPaciente {
    rut: string;
    nombre: string | null;
    centro_id: string;
    telefono?: string | null;
    correo?: string | null;
}

const MAX_TELEFONO = 150;
const MAX_CORREO = 100;

// El contacto es de mejor esfuerzo: si no cabe en la columna se descarta para no perder la solicitud.
function contactoValido(valor: string | null | undefined, maximo: number): string | undefined {
    return valor && valor.length <= maximo ? valor : undefined;
}

export async function asegurarPaciente(
    tx: Tx,
    datos: DatosPaciente,
    opciones: { actualizarContacto: boolean }
): Promise<void> {
    const telefono = contactoValido(datos.telefono, MAX_TELEFONO);
    const correo = contactoValido(datos.correo, MAX_CORREO);

    const existente = await tx.usuario.findUnique({ where: { rut: datos.rut }, select: { rut: true } });

    if (!existente) {
        await tx.usuario.create({
            data: {
                rut: datos.rut,
                nombre: datos.nombre ?? "Sin registro",
                apellido: "",
                centro_id: datos.centro_id,
                telefono,
                correo_contacto: correo
            }
        });
        return;
    }

    if (!opciones.actualizarContacto) return;
    const data: Prisma.UsuarioUpdateInput = {};
    if (telefono) data.telefono = telefono;
    if (correo) data.correo_contacto = correo;
    if (Object.keys(data).length === 0) return;
    await tx.usuario.update({ where: { rut: datos.rut }, data });
}
