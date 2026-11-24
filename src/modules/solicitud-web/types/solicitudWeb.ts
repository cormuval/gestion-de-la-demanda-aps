export interface PayloadToken {
    rut: string;
    exp: number;
    // Opcional para seguir aceptando tokens emitidos antes de R1.
    centro_id?: string;
}

export interface SubmotivoPublico {
    id: number;
    nombre: string;
}

export interface TipoSolicitudPublico {
    id: number;
    nombre: string;
    submotivos: SubmotivoPublico[];
}

export interface CentroPublico {
    id: string;
    nombre: string;
}

export interface PacientePercapita {
    nombre: string;
    apellido: string;
    fecha_nacimiento: Date | null;
    genero: string | null;
    centro_id: string;
}

export type ResultadoPercapita =
    | { estado: "INSCRITO"; paciente: PacientePercapita }
    | { estado: "NO_INSCRITO" }
    | { estado: "NO_DISPONIBLE" };
