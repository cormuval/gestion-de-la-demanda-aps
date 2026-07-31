import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { CLAVES_PERMISOS, type Permiso } from "../src/config/permisos";

const prisma = new PrismaClient();

const PASSWORD = "demo123";

// Datos demo (funcionarios .local + paciente/solicitud/cita/llamada de prueba).
// En produccion se desactiva con SEED_DEMO=false; por defecto activo (no cambia dev).
const SEED_DEMO = process.env.SEED_DEMO !== "false";


const rolePermisos: Record<string, Permiso[]> = {
    Administrador: ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente", "dashboard.ver", "some.ver", "config.ver", "config.funcionarios", "config.roles", "config.catalogos"],
    Orientador: ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente"],
    Comunicador: ["comunicador.ver", "comunicador.llamar", "comunicador.paciente"],
    SOME: ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente", "dashboard.ver", "some.ver", "config.ver", "config.funcionarios"],
    "Orientador y Comunicador": ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente"],
    "Gestor y Comunicador": ["comunicador.ver", "comunicador.llamar", "comunicador.paciente"],
    Full: ["solicitudes.ver", "solicitudes.crear", "solicitudes.gestionar", "comunicador.ver", "comunicador.llamar", "comunicador.paciente", "dashboard.ver", "config.ver", "config.funcionarios", "config.roles", "config.catalogos"]
};

type FuncionarioTuple = [rut: string, email: string, nombre: string, roleName: string];

// Funcionarios reales: se siembran siempre (dev y produccion).
const funcionariosReales: FuncionarioTuple[] = [
    ["10.000.000-0", "rvergara@cmvalparaiso.cl", "Renzo Vergara", "Administrador"],
    ["15.000.000-0", "dsantibanez@cmvalparaiso.cl", "Daniel Santibanez", "Administrador"]
];

// Funcionarios demo (.local): solo cuando SEED_DEMO esta activo.
const funcionariosDemo: FuncionarioTuple[] = [
    ["11.111.111-1", "admin@demo.local", "Administrador Demo", "Administrador"],
    ["22.222.222-2", "orientador@demo.local", "Orientador Demo", "Orientador"],
    ["33.333.333-3", "comunicador@demo.local", "Comunicador Demo", "Comunicador"],
    ["44.444.444-4", "some@demo.local", "SOME Demo", "SOME"],
    ["55.555.555-5", "orientador.comunicador@demo.local", "Orientador Comunicador Demo", "Orientador y Comunicador"],
    ["66.666.666-6", "gestor.comunicador@demo.local", "Gestor Comunicador Demo", "Gestor y Comunicador"],
    ["77.777.777-7", "full@demo.local", "Full Demo", "Full"]
];

async function main() {
    console.log(`Seed: modo ${SEED_DEMO ? "completo (roles + permisos + funcionarios reales + demo)" : "produccion (roles + permisos + funcionarios reales)"}`);

    const password_hash = await bcrypt.hash(PASSWORD, 10);
    const roleByName = new Map<string, { id_rol: number }>();

    const funcionarios = SEED_DEMO ? [...funcionariosReales, ...funcionariosDemo] : funcionariosReales;

    const roleNames = Object.keys(rolePermisos);
    for (const roleName of roleNames) {
        const role = await prisma.role.upsert({
            where: { id_rol: roleNames.indexOf(roleName) + 1 },
            update: { nombre_rol: roleName, estado: "Activo" },
            create: { nombre_rol: roleName, estado: "Activo" }
        });
        roleByName.set(roleName, role);
    }

    // La tabla roles_permisos es configuracion viva, editable desde el mantenedor, y el seed
    // corre en cada deploy. Por eso solo se siembran los permisos de un rol que aun NO tiene
    // ninguno (instalacion nueva o rol recien creado): una vez que el rol tiene permisos, el
    // mantenedor es la unica fuente de verdad y el seed no lo toca. Asi, un permiso que el
    // administrador quito no reaparece en el siguiente deploy, y uno nuevo del catalogo no se
    // otorga solo: debe asignarse a proposito desde el mantenedor.
    let rolesSembrados = 0;
    for (const [roleName, permisos] of Object.entries(rolePermisos)) {
        const role = roleByName.get(roleName);
        if (!role) continue;
        const yaConfigurado = await prisma.rolPermiso.count({ where: { rol_id: role.id_rol } });
        if (yaConfigurado > 0) continue;
        await prisma.rolPermiso.createMany({
            data: permisos.map((permiso) => ({ rol_id: role.id_rol, permiso }))
        });
        rolesSembrados++;
    }
    console.log(`Seed: permisos sembrados para ${rolesSembrados} rol(es) sin configurar (los ya configurados se respetan)`);

    const huerfanos = await prisma.rolPermiso.findMany({
        where: { permiso: { notIn: CLAVES_PERMISOS } },
        select: { rol_id: true, permiso: true }
    });
    for (const fila of huerfanos) {
        console.warn(`WARN  Permiso desconocido en BD: rol ${fila.rol_id} -> "${fila.permiso}" (se ignora al leer)`);
    }

    for (const [rut, email, nombre, roleName] of funcionarios) {
        const role = roleByName.get(roleName)!;
        const funcionarioExistente = await prisma.funcionario.findFirst({
            where: { OR: [{ rut }, { email }] },
            select: { rut: true }
        });
        const payload = { email, nombre, rol_id: role.id_rol, estado: "Activo", password_hash };

        if (funcionarioExistente) {
            await prisma.funcionario.update({
                where: { rut: funcionarioExistente.rut },
                data: payload
            });
        } else {
            await prisma.funcionario.create({
                data: {
                    rut,
                    ...payload,
                    codigo: roleName.toUpperCase().replaceAll(" ", "_"),
                    centro_id: "501",
                    programa_asociado: "Demanda",
                    invitacion_app: "Si"
                }
            });
        }
    }

    if (!SEED_DEMO) {
        return;
    }

    // ----- Datos demo (solo con SEED_DEMO): dependen de funcionarios .local -----
    const tipoSolicitud = await prisma.tipoSolicitud.upsert({
        where: { id_tipo_solicitud: 1 },
        update: { nombre_tipo_solicitud: "Atencion general", estado: "Activo" },
        create: { nombre_tipo_solicitud: "Atencion general", estado: "Activo" }
    });

    const motivo = await prisma.motivo.upsert({
        where: { id_motivo: 1 },
        update: { tipo_solicitud_id: tipoSolicitud.id_tipo_solicitud, nombre_motivo: "Consulta inicial", estado: "Activo" },
        create: { tipo_solicitud_id: tipoSolicitud.id_tipo_solicitud, nombre_motivo: "Consulta inicial", estado: "Activo" }
    });

    await prisma.usuario.upsert({
        where: { rut: "12.345.678-9" },
        update: {},
        create: {
            rut: "12.345.678-9",
            nombre: "Paciente",
            apellido: "Demo",
            genero: "No informado",
            telefono: "+56912345678",
            correo_contacto: "paciente.demo@local",
            centro_id: "501"
        }
    });

    await prisma.solicitud.upsert({
        where: { id_solicitud: "SOL-DEMO-001" },
        update: {},
        create: {
            id_solicitud: "SOL-DEMO-001",
            rut_orientador: "22.222.222-2",
            rut_usuario: "12.345.678-9",
            tipo_solicitud_id: tipoSolicitud.id_tipo_solicitud,
            motivo_id: motivo.id_motivo,
            descripcion: "Solicitud demo en curso para probar pendientes.",
            disponibilidad_llamada: "Manana",
            priorizacion_admin: 1,
            estado_solicitud: "En Curso",
            centro_id: "501"
        }
    });

    await prisma.cita.upsert({
        where: { id_cita: "CITA-DEMO-001" },
        update: {},
        create: {
            id_cita: "CITA-DEMO-001",
            solicitud_id: "SOL-DEMO-001",
            rut_usuario: "12.345.678-9",
            rut_gestor: "22.222.222-2",
            tipo_prestacion: "Agendar una hora con profesional",
            fecha_estimada_atencion: null,
            estado_cita: "Sin llamadas",
            priorizacion: 1,
            centro_id: "501"
        }
    });

    await prisma.llamada.upsert({
        where: { id_llamada: "LLAM-DEMO-001" },
        update: {},
        create: {
            id_llamada: "LLAM-DEMO-001",
            cita_id: "CITA-DEMO-001",
            rut_usuario: "12.345.678-9",
            rut_comunicador: "33.333.333-3",
            respuesta_usuario: "Sin llamadas",
            observacion: "Gestion demo pendiente.",
            centro_id: "501"
        }
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });
