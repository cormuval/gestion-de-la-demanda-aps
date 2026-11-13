// lib
import { describe, expect, it } from "vitest";
// schemas
import { envioSchema, verificarSchema } from "./solicitudWeb.schema";

const minimo = {
    token: "token-ficticio",
    telefono: "912345678",
    discapacidad: "Ninguna de las anteriores",
    tipo_solicitud_id: 3,
    descripcion: "Necesito una consulta",
    disponibilidad_llamada: "AM"
};

describe("verificarSchema", () => {
    it("normaliza el RUT antes de validarlo", () => {
        expect(verificarSchema.parse({ rut: "12.345.678-5", captcha: "captcha" }).rut).toBe("12345678-5");
    });

    it.each([
        { rut: "12345678-9", captcha: "captcha", campo: "rut" },
        { rut: "12345678-5", captcha: "", campo: "captcha" }
    ])("rechaza $campo inválido", ({ campo, ...datos }) => {
        const resultado = verificarSchema.safeParse(datos);
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual([campo]);
    });
});

describe("envioSchema", () => {
    it("normaliza el teléfono y convierte opcionales omitidos en null", () => {
        expect(envioSchema.parse(minimo)).toMatchObject({
            telefono: "+56912345678", correo: null, nombre_social: null, telefono_alternativo: null
        });
    });

    it("recorta textos, normaliza el teléfono alternativo y convierte el id textual", () => {
        expect(envioSchema.parse({
            ...minimo, telefono: "+56 9 1234 5678", telefono_alternativo: "322123456",
            nombre_social: " Nombre ", correo: " contacto@example.test ",
            descripcion: " Una descripción válida ", tipo_solicitud_id: "3"
        })).toMatchObject({
            telefono: "+56912345678", telefono_alternativo: "+56322123456",
            nombre_social: "Nombre", correo: "contacto@example.test",
            descripcion: "Una descripción válida", tipo_solicitud_id: 3
        });
    });

    it("convierte opcionales vacíos en null", () => {
        expect(envioSchema.parse({ ...minimo, nombre_social: " ", correo: "", telefono_alternativo: " " }))
            .toMatchObject({ nombre_social: null, correo: null, telefono_alternativo: null });
    });

    it.each([
        ["token", ""], ["telefono", ""], ["telefono", "123"],
        ["telefono_alternativo", "123"], ["nombre_social", "a".repeat(51)],
        ["correo", "sin-arroba"], ["correo", `${"a".repeat(90)}@example.test`],
        ["descripcion", "123456789"], ["descripcion", " ".repeat(10)],
        ["descripcion", "a".repeat(1001)], ["discapacidad", "cuidador(a)"],
        ["disponibilidad_llamada", "Noche"], ["tipo_solicitud_id", 0],
        ["tipo_solicitud_id", -1], ["tipo_solicitud_id", 1.5],
        ["tipo_solicitud_id", "3.0"], ["tipo_solicitud_id", "3e1"],
        ["tipo_solicitud_id", ""], ["tipo_solicitud_id", true], ["sitio_web", 42]
    ])("rechaza el valor inválido de %s: %s", (campo, valor) => {
        const resultado = envioSchema.safeParse({ ...minimo, [campo]: valor });
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual([campo]);
    });

    it.each([
        "Tengo credencial de discapacidad",
        "Cuido de forma principal a una persona con discapacidad",
        "Ninguna de las anteriores"
    ])("acepta la opción de discapacidad %s", (discapacidad) => {
        expect(envioSchema.safeParse({ ...minimo, discapacidad }).success).toBe(true);
    });

    it.each(["AM", "PM", "AM/PM"])("acepta disponibilidad %s y descripción en el límite", (disponibilidad_llamada) => {
        expect(envioSchema.safeParse({ ...minimo, disponibilidad_llamada, descripcion: "a".repeat(1000) }).success).toBe(true);
        expect(envioSchema.safeParse({ ...minimo, disponibilidad_llamada, descripcion: "a".repeat(10) }).success).toBe(true);
    });
});
