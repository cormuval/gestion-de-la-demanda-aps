import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
// components
import { Sheet, SheetContent, SheetTitle } from "./sheet";

describe("Sheet", () => {
    it("mantiene overlay y contenido sobre headers sticky", () => {
        render(
            <Sheet open>
                <SheetContent data-testid="sheet-content">
                    <SheetTitle>Menu movil</SheetTitle>
                </SheetContent>
            </Sheet>
        );

        const content = screen.getByTestId("sheet-content");
        const overlay = content.previousElementSibling;

        expect(overlay).toHaveClass("z-50");
        expect(content).toHaveClass("z-50");
    });
});
