// lib
import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prismaMock } = vi.hoisted(() => {
    const tx = {
        solicitud: { findFirst: vi.fn(), create: vi.fn() },
        usuario: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        tipoSolicitud: { findUnique: vi.fn() },
        funcionario: { findUnique: vi.fn() }
    };
    return {
        tx,
        prismaMock: { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) }
    };
});
vi.mock("@/shared/lib/prisma", () => ({ prisma: prismaMock }));

// schemas
import { DISCAPACIDAD_USUARIO } from "@/modules/solicitudes/schemas/usuario.schema";

// services
import { registrarSolicitudWeb } from "./registrarSolicitudWeb";

const entrada = {
    rut: "12345678-5",
    centro_id: "615",
    ahora: new Date("2026-11-12T12:00:00Z"),
    envio: {
        token: "token-ficticio",
        nombre_social: null,
        telefono: "+56912345678",
        telefono_alternativo: null,
        correo: "prueba@example.test",
        discapacidad: "Ninguna de las anteriores" as const,
        tipo_solicitud_id: 1,
        descripcion: "Necesito solicitar una hora",
        disponibilidad_llamada: "AM" as const
    },
    percapita: {
        nombre: "Paciente",
        apellido: "Ficticio",
        fecha_nacimiento: new Date("2000-01-01T00:00:00Z"),
        genero: "No informado",
        centro_id: "999"
    }
};
const paciente = {
    rut: entrada.rut,
    nombre_social: "Social",
    telefono: "+56900000000",
    telefono_alternativo: "+56322123456",
    correo_contacto: null,
    discapacidad: "Ninguna de las anteriores",
    centro_id: null,
    fecha_nacimiento: new Date("1980-01-01T00:00:00Z"),
    priorizacion_administrativa: 7
};

beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation((fn) => fn(tx));
    tx.solicitud.findFirst.mockResolvedValue(null);
    tx.usuario.findUnique.mockResolvedValue(null);
    tx.tipoSolicitud.findUnique.mockResolvedValue({ id_tipo_solicitud: 1 });
    tx.funcionario.findUnique.mockResolvedValue({ rut: "11111113-8", estado: "Inactivo" });
});

describe("registrarSolicitudWeb", () => {
    it("crea paciente desde per cápita y formulario y solicitud con prioridad y edad", async () => {
        const resultado = await registrarSolicitudWeb(entrada);
        expect(tx.usuario.create).toHaveBeenCalledWith({ data: {
            rut: "12345678-5", nombre: "Paciente", apellido: "Ficticio",
            fecha_nacimiento: entrada.percapita.fecha_nacimiento, genero: null,
            priorizacion_administrativa: 0.18,
            centro_id: "615", nombre_social: null, telefono: "+56912345678",
            telefono_alternativo: null, correo_contacto: "prueba@example.test",
            discapacidad: DISCAPACIDAD_USUARIO[0]
        } });
        expect(tx.solicitud.create).toHaveBeenCalledWith({ data: {
            id_solicitud: expect.stringMatching(/^WEB-[a-f0-9]{32}$/),
            fecha_inicio: entrada.ahora, rut_usuario: "12345678-5",
            tipo_solicitud_id: 1, motivo_id: null, descripcion: entrada.envio.descripcion,
            disponibilidad_llamada: "AM", centro_id: "615", estado_solicitud: "En Curso",
            accion: "En espera de validación", rut_orientador: "11111113-8",
            rut_gestor: null, fecha_validacion: null, priorizacion_admin: 0.18, ultimo_control: "26"
        } });
        expect(resultado).toEqual({ ok: true, estado: "CREADA", id_solicitud: expect.stringMatching(/^WEB-/) });
        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    });

    it("completa solo correo vacío y agrega nota si difiere el teléfono", async () => {
        tx.usuario.findUnique.mockResolvedValue(paciente);
        await registrarSolicitudWeb(entrada);
        expect(tx.usuario.update).toHaveBeenCalledWith({
            where: { rut: entrada.rut }, data: { correo_contacto: "prueba@example.test" }
        });
        expect(tx.solicitud.create.mock.calls[0][0].data.descripcion).toBe(
            "Necesito solicitar una hora\n\nTeléfono indicado en el formulario web: +56912345678"
        );
    });

    it("no agrega nota si el teléfono coincide ni actualiza campos completos", async () => {
        tx.usuario.findUnique.mockResolvedValue({
            ...paciente, telefono: entrada.envio.telefono, correo_contacto: "existente@example.test"
        });
        await registrarSolicitudWeb(entrada);
        expect(tx.usuario.update).not.toHaveBeenCalled();
        expect(tx.solicitud.create.mock.calls[0][0].data.descripcion).toBe(entrada.envio.descripcion);
    });

    it("completa null y cadenas vacías sin cambiar centro ni identidad", async () => {
        tx.usuario.findUnique.mockResolvedValue({
            ...paciente, nombre_social: "", telefono: null, telefono_alternativo: "",
            discapacidad: null
        });
        await registrarSolicitudWeb({
            ...entrada, envio: { ...entrada.envio, nombre_social: "Social nuevo", telefono_alternativo: "+56322123456" }
        });
        expect(tx.usuario.update).toHaveBeenCalledWith({
            where: { rut: entrada.rut }, data: {
                nombre_social: "Social nuevo", telefono: "+56912345678",
                telefono_alternativo: "+56322123456", correo_contacto: "prueba@example.test",
                discapacidad: DISCAPACIDAD_USUARIO[0]
            }
        });
    });

    it.each([
        ["Tengo credencial de discapacidad", 2],
        ["Cuido de forma principal a una persona con discapacidad", 1],
        ["Ninguna de las anteriores", 0]
    ] as const)("guarda discapacidad canónica para %s", async (discapacidad, indice) => {
        await registrarSolicitudWeb({ ...entrada, envio: { ...entrada.envio, discapacidad } });
        expect(tx.usuario.create.mock.calls[0][0].data.discapacidad).toBe(DISCAPACIDAD_USUARIO[indice]);
        expect(tx.solicitud.create.mock.calls[0][0].data.priorizacion_admin).toBe(indice === 0 ? 0.18 : 5.18);
    });

    it.each([["F", "Femenino"], ["femenino", "Femenino"], ["m", "Masculino"], ["MASCULINO", "Masculino"], ["otro", null]])("normaliza género %s", async (genero, esperado) => {
        await registrarSolicitudWeb({ ...entrada, percapita: { ...entrada.percapita, genero } });
        expect(tx.usuario.create.mock.calls[0][0].data.genero).toBe(esperado);
    });

    it("reutiliza prioridad existente y calcula edad con fecha del paciente", async () => {
        tx.usuario.findUnique.mockResolvedValue(paciente);
        await registrarSolicitudWeb(entrada);
        expect(tx.solicitud.create.mock.calls[0][0].data).toMatchObject({ priorizacion_admin: 7, ultimo_control: "46" });
        expect(tx.usuario.update.mock.calls[0][0].data).not.toHaveProperty("priorizacion_administrativa");
    });

    it("calcula y guarda prioridad vacía con discapacidad existente y fecha del paciente", async () => {
        tx.usuario.findUnique.mockResolvedValue({ ...paciente, priorizacion_administrativa: null, discapacidad: DISCAPACIDAD_USUARIO[2] });
        await registrarSolicitudWeb(entrada);
        expect(tx.usuario.update.mock.calls[0][0].data.priorizacion_administrativa).toBe(5.78);
        expect(tx.solicitud.create.mock.calls[0][0].data.priorizacion_admin).toBe(5.78);
    });

    it("deja edad y prioridad nulas sin fecha de nacimiento", async () => {
        await registrarSolicitudWeb({ ...entrada, percapita: { ...entrada.percapita, fecha_nacimiento: null } });
        expect(tx.solicitud.create.mock.calls[0][0].data).toMatchObject({ priorizacion_admin: null, ultimo_control: null });
    });

    it("no agrega nota para teléfono local equivalente", async () => {
        tx.usuario.findUnique.mockResolvedValue({ ...paciente, telefono: "912345678" });
        await registrarSolicitudWeb(entrada);
        expect(tx.solicitud.create.mock.calls[0][0].data.descripcion).toBe(entrada.envio.descripcion);
    });

    it("agrega nota para teléfono guardado que no normaliza", async () => {
        tx.usuario.findUnique.mockResolvedValue({ ...paciente, telefono: "sin número" });
        await registrarSolicitudWeb(entrada);
        expect(tx.solicitud.create.mock.calls[0][0].data.descripcion).toContain("Teléfono indicado");
    });

    it("duplicado En Curso del mismo tipo devuelve éxito sin escribir paciente ni solicitud", async () => {
        tx.solicitud.findFirst.mockResolvedValue({ id_solicitud: "WEB-anterior" });
        expect(await registrarSolicitudWeb(entrada)).toEqual({ ok: true, estado: "DUPLICADA" });
        expect(tx.solicitud.findFirst).toHaveBeenCalledWith({
            where: { rut_usuario: "12345678-5", tipo_solicitud_id: 1, estado_solicitud: "En Curso" }
        });
        expect(tx.usuario.findUnique).not.toHaveBeenCalled();
        expect(tx.usuario.create).not.toHaveBeenCalled();
        expect(tx.usuario.update).not.toHaveBeenCalled();
        expect(tx.solicitud.create).not.toHaveBeenCalled();
    });

    it("rechaza tipo inexistente sin crear datos", async () => {
        tx.tipoSolicitud.findUnique.mockResolvedValue(null);
        expect(await registrarSolicitudWeb(entrada)).toEqual({
            ok: false, codigo: "CATALOGO", error: "tipo_solicitud_id 1 no existe"
        });
        expect(tx.solicitud.create).not.toHaveBeenCalled();
    });

    it("rechaza orientador inexistente", async () => {
        tx.funcionario.findUnique.mockResolvedValue(null);
        expect(await registrarSolicitudWeb(entrada)).toMatchObject({ ok: false, codigo: "CATALOGO" });
    });

    it("oculta detalles internos de errores inesperados", async () => {
        tx.solicitud.create.mockRejectedValue(new Error("detalle privado"));
        const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
        expect(await registrarSolicitudWeb(entrada)).toEqual({
            ok: false, codigo: "INTERNO", error: "Error interno del servidor"
        });
        expect(consola.mock.calls).toEqual([["Error"]]);
        consola.mockRestore();
    });
});
