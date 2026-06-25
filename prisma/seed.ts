import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "demo123";

type MenuTuple = [nombre: string, ruta: string, descripcion: string];

const roleMenus: Record<string, MenuTuple[]> = {
    Administrador: [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"],
        ["Llamados", "/comunicador", "Gestion de llamadas"],
        ["Dashboard", "/dashboard", "Indicadores principales"],
        ["Configuracion", "/configuracion/usuarios-roles", "Usuarios, roles y catalogos"]
    ],
    Orientador: [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"]
    ],
    Comunicador: [["Llamados", "/comunicador", "Gestion de llamadas"]],
    SOME: [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"],
        ["Llamados", "/comunicador", "Gestion de llamadas"],
        ["Dashboard", "/dashboard", "Indicadores principales"],
        ["Usuarios y Roles", "/configuracion/usuarios-roles", "Configuracion permitida para SOME"]
    ],
    "Orientador y Comunicador": [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Llamados", "/comunicador", "Gestion de llamadas"]
    ],
    "Gestor y Comunicador": [
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"],
        ["Llamados", "/comunicador", "Gestion de llamadas"]
    ],
    Full: [
        ["Solicitudes", "/solicitudes/ingresar", "Registro y revision de solicitudes"],
        ["Gestion de Citas", "/comunicador", "Agenda y seguimiento de citas"],
        ["Llamados", "/comunicador", "Gestion de llamadas"],
        ["Dashboard", "/dashboard", "Indicadores principales"]
    ]
};

const funcionarios: [rut: string, email: string, nombre: string, roleName: string][] = [
    ["11.111.111-1", "admin@demo.local", "Administrador Demo", "Administrador"],
    ["22.222.222-2", "orientador@demo.local", "Orientador Demo", "Orientador"],
    ["33.333.333-3", "comunicador@demo.local", "Comunicador Demo", "Comunicador"],
    ["44.444.444-4", "some@demo.local", "SOME Demo", "SOME"],
    ["55.555.555-5", "orientador.comunicador@demo.local", "Orientador Comunicador Demo", "Orientador y Comunicador"],
    ["66.666.666-6", "gestor.comunicador@demo.local", "Gestor Comunicador Demo", "Gestor y Comunicador"],
    ["77.777.777-7", "full@demo.local", "Full Demo", "Full"],
    ["10.000.000-0", "rvergara@cmvalparaiso.cl", "Renzo Vergara", "Administrador"]
];

async function main() {
    const password_hash = await bcrypt.hash(PASSWORD, 10);
    const roleByName = new Map<string, { id_rol: number }>();

    const roleNames = Object.keys(roleMenus);
    for (const roleName of roleNames) {
        const role = await prisma.role.upsert({
            where: { id_rol: roleNames.indexOf(roleName) + 1 },
            update: { nombre_rol: roleName, estado: "Activo" },
            create: { nombre_rol: roleName, estado: "Activo" }
        });
        roleByName.set(roleName, role);
    }

    await prisma.menu.deleteMany();
    for (const [roleName, menus] of Object.entries(roleMenus)) {
        const role = roleByName.get(roleName)!;
        for (const [nombre, ruta, descripcion] of menus) {
            await prisma.menu.create({
                data: { nombre, ruta, descripcion, imagen: null, role_id: role.id_rol }
            });
        }
    }

    for (const [rut, email, nombre, roleName] of funcionarios) {
        const role = roleByName.get(roleName)!;
        await prisma.funcionario.upsert({
            where: { rut },
            update: { email, nombre, rol_id: role.id_rol, estado: "Activo", password_hash },
            create: {
                rut,
                email,
                nombre,
                rol_id: role.id_rol,
                estado: "Activo",
                codigo: roleName.toUpperCase().replaceAll(" ", "_"),
                centro_id: "CENTRO-01",
                programa_asociado: "Demanda",
                invitacion_app: "Si",
                password_hash
            }
        });
    }

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
            centro_id: "CENTRO-01"
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
            centro_id: "CENTRO-01"
        }
    });

    await prisma.llamada.upsert({
        where: { id_llamada: "LLAM-DEMO-001" },
        update: {},
        create: {
            id_llamada: "LLAM-DEMO-001",
            cita_id: "SOL-DEMO-001",
            rut_usuario: "12.345.678-9",
            rut_comunicador: "33.333.333-3",
            respuesta_usuario: "Sin llamadas",
            observacion: "Gestion demo pendiente.",
            centro_id: "CENTRO-01"
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
