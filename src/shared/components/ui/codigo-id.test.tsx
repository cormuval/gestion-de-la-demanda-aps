import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() }
}));

import { CodigoId } from "./codigo-id";
import { toast } from "sonner";

const ID = "SOL-550e8400-e29b-41d4-a716-446655440000";

const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

beforeEach(() => {
    vi.clearAllMocks();
});

describe("CodigoId", () => {
    it("muestra el codigo acortado", () => {
        render(<CodigoId id={ID} />);
        expect(screen.getByRole("button")).toHaveTextContent("SOL-40000");
    });

    it("expone el id completo en el title", () => {
        render(<CodigoId id={ID} />);
        expect(screen.getByRole("button")).toHaveAttribute("title", ID);
    });

    it("al hacer click copia el id completo y avisa con un toast", async () => {
        render(<CodigoId id={ID} />);
        fireEvent.click(screen.getByRole("button"));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(ID));
        expect(toast.success).toHaveBeenCalledWith("Codigo copiado");
    });
});
