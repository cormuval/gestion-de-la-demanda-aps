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
    it("acepta captcha de 2048 caracteres y rechaza 2049", () => {
        expect(verificarSchema.safeParse({ rut: "12345678-5", captcha: "a".repeat(2048) }).success).toBe(true);
        const resultado = verificarSchema.safeParse({ rut: "12345678-5", captcha: "a".repeat(2049) });
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["captcha"]);
    });

    it("limita el RUT original a 20 caracteres antes de normalizar", () => {
        expect(verificarSchema.parse({ rut: " ".repeat(10) + "12345678-5", captcha: "captcha" }).rut).toBe("12345678-5");
        const resultado = verificarSchema.safeParse({ rut: " ".repeat(11) + "12345678-5", captcha: "captcha" });
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["rut"]);
    });

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
    it.each([
        ["token", 512], ["sitio_web", 200]
    ])("acepta el límite de %s y rechaza un carácter adicional", (campo, limite) => {
        expect(envioSchema.safeParse({ ...minimo, [campo]: "a".repeat(limite) }).success).toBe(true);
        const resultado = envioSchema.safeParse({ ...minimo, [campo]: "a".repeat(limite + 1) });
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual([campo]);
    });

    it.each(["telefono", "telefono_alternativo"])("limita %s a 30 caracteres antes de normalizar", (campo) => {
        expect(envioSchema.parse({ ...minimo, [campo]: " ".repeat(21) + "912345678" })[campo as "telefono" | "telefono_alternativo"])
            .toBe("+56912345678");
        const resultado = envioSchema.safeParse({ ...minimo, [campo]: " ".repeat(22) + "912345678" });
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual([campo]);
    });

    it("limita también el teléfono alternativo vacío antes de recortar espacios", () => {
        expect(envioSchema.parse({ ...minimo, telefono_alternativo: " ".repeat(30) }).telefono_alternativo).toBeNull();
        const resultado = envioSchema.safeParse({ ...minimo, telefono_alternativo: " ".repeat(31) });
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["telefono_alternativo"]);
    });

    it("acepta un id textual de 10 dígitos y rechaza 11 aunque normalice al mismo número", () => {
        expect(envioSchema.parse({ ...minimo, tipo_solicitud_id: "0000000003" }).tipo_solicitud_id).toBe(3);
        const resultado = envioSchema.safeParse({ ...minimo, tipo_solicitud_id: "00000000003" });
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["tipo_solicitud_id"]);
    });

    it.each([1, "1", 2147483647, "2147483647"])("acepta el id en el límite entero %s", (tipo_solicitud_id) => {
        expect(envioSchema.parse({ ...minimo, tipo_solicitud_id }).tipo_solicitud_id).toBe(Number(tipo_solicitud_id));
    });

    it.each([0, "0", 2147483648, "2147483648"])("rechaza el id fuera del rango entero %s", (tipo_solicitud_id) => {
        const resultado = envioSchema.safeParse({ ...minimo, tipo_solicitud_id });
        expect(resultado.success).toBe(false);
        if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["tipo_solicitud_id"]);
    });

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
