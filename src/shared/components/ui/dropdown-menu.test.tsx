import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

// components
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";

function DropdownDialogFixture() {
    const [menuOpen, setMenuOpen] = useState(true);
    const [open, setOpen] = useState(false);

    return (
        <>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button type="button">Gestionar</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        onSelect={() => {
                            setMenuOpen(false);
                            setOpen(true);
                        }}
                    >
                        Otras solicitudes y citas
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogTitle>Solicitudes y citas en curso</DialogTitle>
                    <Button type="button" onClick={() => setOpen(false)}>
                        Cerrar
                    </Button>
                </DialogContent>
            </Dialog>
        </>
    );
}

afterEach(() => {
    document.body.style.pointerEvents = "";
});

describe("DropdownMenu con Dialog", () => {
    it("restaura la interaccion del body al cerrar un dialog abierto desde el menu", async () => {
        render(<DropdownDialogFixture />);

        expect(await screen.findByRole("menuitem", { name: "Otras solicitudes y citas" })).toBeInTheDocument();
        expect(document.body.style.pointerEvents).not.toBe("none");

        fireEvent.click(await screen.findByRole("menuitem", { name: "Otras solicitudes y citas" }));

        const dialog = await screen.findByRole("dialog", { name: "Solicitudes y citas en curso" });
        fireEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" })[0]);

        await waitFor(() => expect(dialog).not.toBeInTheDocument());
        expect(document.body.style.pointerEvents).not.toBe("none");

        expect(screen.getByRole("button", { name: "Gestionar" })).toHaveStyle({ pointerEvents: "auto" });
    });
});
