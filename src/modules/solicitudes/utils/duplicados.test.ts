import { describe, expect, it } from "vitest";

// utils
import { buscarSolicitudDuplicada, mensajeSolicitudDuplicada } from "./duplicados";

const solicitudes = [
    { id_solicitud: "SOL-11111111-1111-1111-1111-111111111111", fecha_inicio: "2026-09-08T03:00:00Z", tipo_solicitud_id: 1, motivo_id: 10 },
    { id_solicitud: "SOL-22222222-2222-2222-2222-222222222222", fecha_inicio: "2026-09-09T12:00:00Z", tipo_solicitud_id: 1, motivo_id: null },
    { id_solicitud: "SOL-33333333-3333-3333-3333-333333333333", fecha_inicio: "2026-09-10T12:00:00Z", tipo_solicitud_id: 2, motivo_id: 10 }
];

describe("buscarSolicitudDuplicada", () => {
    it("coincide por mismo tipo y motivo", () => {
        expect(buscarSolicitudDuplicada(solicitudes, { tipo_solicitud_id: 1, motivo_id: 10 })?.id_solicitud).toBe(solicitudes[0].id_solicitud);
    });

    it("coincide null solo con null", () => {
        expect(buscarSolicitudDuplicada(solicitudes, { tipo_solicitud_id: 1, motivo_id: null })?.id_solicitud).toBe(solicitudes[1].id_solicitud);
        expect(buscarSolicitudDuplicada(solicitudes, { tipo_solicitud_id: 2, motivo_id: null })).toBeNull();
    });

    it("no coincide si cambia tipo o motivo", () => {
        expect(buscarSolicitudDuplicada(solicitudes, { tipo_solicitud_id: 1, motivo_id: 99 })).toBeNull();
        expect(buscarSolicitudDuplicada([], { tipo_solicitud_id: 1, motivo_id: 10 })).toBeNull();
    });
});

describe("mensajeSolicitudDuplicada", () => {
    it("incluye ID corto y fecha en zona America/Santiago", () => {
        expect(
            mensajeSolicitudDuplicada({
                id_solicitud: "SOL-68bb9abc-def0-1234-5678-abcdefabcdef",
                fecha_inicio: "2026-09-09T02:30:00Z"
            })
        ).toBe("Ya existe la solicitud SOL-bcdef del 08-09-2026 en curso para este tipo y motivo. Debe cerrarse antes de ingresar una nueva.");
    });
});
