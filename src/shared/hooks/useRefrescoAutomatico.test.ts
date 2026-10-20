import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// hooks
import { useRefrescoAutomatico } from "./useRefrescoAutomatico";

function definirVisibilidad(estado: DocumentVisibilityState): void {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => estado
    });
}

function dispararCambioVisibilidad(): void {
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("useRefrescoAutomatico", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        definirVisibilidad("visible");
    });

    afterEach(() => {
        vi.useRealTimers();
        definirVisibilidad("visible");
    });

    it("recarga cada intervalo con la pestana visible", () => {
        const recargar = vi.fn();
        renderHook(() => useRefrescoAutomatico(recargar));

        vi.advanceTimersByTime(60_000);
        expect(recargar).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(60_000);
        expect(recargar).toHaveBeenCalledTimes(2);
    });

    it("no recarga con la pestana oculta y recarga una vez al volver", () => {
        const recargar = vi.fn();
        definirVisibilidad("hidden");
        renderHook(() => useRefrescoAutomatico(recargar));

        vi.advanceTimersByTime(60_000 * 5);
        expect(recargar).toHaveBeenCalledTimes(0);

        definirVisibilidad("visible");
        dispararCambioVisibilidad();
        expect(recargar).toHaveBeenCalledTimes(1);
    });

    it("no recarga mientras esta pausado y reanuda al despausar", () => {
        const recargar = vi.fn();
        const { rerender } = renderHook(
            ({ pausado }) => useRefrescoAutomatico(recargar, { pausado }),
            { initialProps: { pausado: true } }
        );

        vi.advanceTimersByTime(60_000);
        dispararCambioVisibilidad();
        expect(recargar).toHaveBeenCalledTimes(0);

        rerender({ pausado: false });
        expect(recargar).toHaveBeenCalledTimes(0);

        vi.advanceTimersByTime(60_000);
        expect(recargar).toHaveBeenCalledTimes(1);
    });

    it("usa la ultima funcion recargar sin reiniciar el intervalo", () => {
        const recargarInicial = vi.fn();
        const recargarNueva = vi.fn();
        const { rerender } = renderHook(
            ({ recargar }) => useRefrescoAutomatico(recargar),
            { initialProps: { recargar: recargarInicial } }
        );

        vi.advanceTimersByTime(30_000);
        rerender({ recargar: recargarNueva });
        vi.advanceTimersByTime(30_000);

        expect(recargarInicial).not.toHaveBeenCalled();
        expect(recargarNueva).toHaveBeenCalledTimes(1);
    });

    it("reinicia el intervalo al refrescar por volver a estar visible", () => {
        const recargar = vi.fn();
        definirVisibilidad("hidden");
        renderHook(() => useRefrescoAutomatico(recargar));

        vi.advanceTimersByTime(50_000);
        expect(recargar).toHaveBeenCalledTimes(0);

        definirVisibilidad("visible");
        dispararCambioVisibilidad();
        expect(recargar).toHaveBeenCalledTimes(1);

        // El intervalo original (a los 60s desde el montaje, es decir a los 10s de esto) no debe
        // disparar una recarga extra: se reinicio junto con el refresco de la visibilidad.
        vi.advanceTimersByTime(30_000);
        expect(recargar).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(30_000);
        expect(recargar).toHaveBeenCalledTimes(2);
    });

    it("limpia el intervalo y el listener al desmontar", () => {
        const recargar = vi.fn();
        const { unmount } = renderHook(() => useRefrescoAutomatico(recargar));

        unmount();

        vi.advanceTimersByTime(60_000 * 2);
        dispararCambioVisibilidad();
        expect(recargar).not.toHaveBeenCalled();
    });
});
