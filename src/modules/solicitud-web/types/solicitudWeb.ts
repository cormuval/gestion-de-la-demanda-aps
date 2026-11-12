export interface PayloadToken {
    rut: string;
    centro_id: string;
    exp: number;
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
