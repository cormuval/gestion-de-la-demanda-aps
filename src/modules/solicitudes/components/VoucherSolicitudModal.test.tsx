import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// components
import { VoucherSolicitudModal } from "./VoucherSolicitudModal";
// types
import type { VoucherSolicitud } from "@/modules/solicitudes/types/voucher";

const voucher: VoucherSolicitud = {
    id_solicitud: "SOL-2026-001",
    fecha_inicio: new Date("2026-07-03T12:00:00"),
    rut: "12345678-5",
    usuario: {
        rut: "12345678-5",
        nombre: "Paciente",
        apellido: "Demo",
        nombre_social: null,
        telefono: "+56911111111",
        telefono_alternativo: "+56922222222"
    },
    tipoSolicitud: { id_tipo_solicitud: 1, nombre_tipo_solicitud: "Atencion" },
    motivo: { id_motivo: 10, nombre_motivo: "Control" },
    centro: "CESFAM",
    disponibilidad_llamada: "Solo AM"
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe("VoucherSolicitudModal", () => {
    it("muestra los datos del comprobante sin el profesional", () => {
        render(<VoucherSolicitudModal voucher={voucher} onClose={vi.fn()} />);

        expect(screen.getByText("COMPROBANTE DE SOLICITUD")).toBeInTheDocument();
        expect(screen.getByText("Solicitud:")).toBeInTheDocument();
        expect(screen.getByText("Fecha:")).toBeInTheDocument();
        expect(screen.getByText("Hora:")).toBeInTheDocument();
        expect(screen.getByText("RUT:")).toBeInTheDocument();
        expect(screen.getByText("Tipo:")).toBeInTheDocument();
        expect(screen.getByText("Motivo:")).toBeInTheDocument();
        expect(screen.getByText("Disponibilidad:")).toBeInTheDocument();
        expect(screen.getByText("Telefonos:")).toBeInTheDocument();
        expect(screen.getByText("SOL-2026-001")).toBeInTheDocument();
        expect(screen.getByText("03-07-2026")).toBeInTheDocument();
        expect(screen.getByText(/^12:00 p\./)).toHaveTextContent("12:00 p. m.");
        expect(screen.getByText("12345678-5")).toBeInTheDocument();
        expect(screen.getByText("CESFAM")).toBeInTheDocument();
        expect(screen.getByText("Atencion")).toBeInTheDocument();
        expect(screen.getByText("Control")).toBeInTheDocument();
        expect(screen.getByText("Solo AM")).toBeInTheDocument();
        expect(screen.getByText("+56911111111 / +56922222222")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Corporacion Municipal Valparaiso" })).toHaveAttribute(
            "src",
            "/assets/CALUGA_LOGOS_2025.png"
        );
        expect(screen.queryByText("Profesional:")).not.toBeInTheDocument();
    });

    it("muestra Sin motivo cuando el voucher no tiene motivo", () => {
        render(<VoucherSolicitudModal voucher={{ ...voucher, motivo: null }} onClose={vi.fn()} />);

        expect(screen.getByText("Sin motivo")).toBeInTheDocument();
    });

    it("omite disponibilidad y telefonos cuando sus valores son nulos", () => {
        render(
            <VoucherSolicitudModal
                voucher={{
                    ...voucher,
                    disponibilidad_llamada: null,
                    usuario: { ...voucher.usuario, telefono: null, telefono_alternativo: null }
                }}
                onClose={vi.fn()}
            />
        );

        expect(screen.queryByText("Disponibilidad:")).not.toBeInTheDocument();
        expect(screen.queryByText("Telefonos:")).not.toBeInTheDocument();
    });

    it("omite disponibilidad y telefonos cuando sus valores son vacios", () => {
        render(
            <VoucherSolicitudModal
                voucher={{
                    ...voucher,
                    disponibilidad_llamada: "",
                    usuario: { ...voucher.usuario, telefono: "", telefono_alternativo: "" }
                }}
                onClose={vi.fn()}
            />
        );

        expect(screen.queryByText("Disponibilidad:")).not.toBeInTheDocument();
        expect(screen.queryByText("Telefonos:")).not.toBeInTheDocument();
    });

    it("cierra el comprobante al presionar Cerrar", () => {
        const onClose = vi.fn();
        render(<VoucherSolicitudModal voucher={voucher} onClose={onClose} />);

        fireEvent.click(screen.getByText("Cerrar"));

        expect(onClose).toHaveBeenCalledOnce();
    });

    it("imprime el comprobante al presionar Imprimir", () => {
        const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
        render(<VoucherSolicitudModal voucher={voucher} onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));

        expect(print).toHaveBeenCalledOnce();
    });
});
