import { useEffect, useRef } from "react";

const INTERVALO_MS_POR_DEFECTO = 60_000;

interface OpcionesRefrescoAutomatico {
    intervaloMs?: number;
    pausado?: boolean;
}

/**
 * Ejecuta `recargar` cada `intervaloMs` mientras la pestana esta visible y no
 * esta pausado. Si la pestana estuvo oculta, al volver a visible fuerza un
 * unico refresco (sin ráfaga acumulada por los intervalos perdidos).
 */
export function useRefrescoAutomatico(recargar: () => void, opciones?: OpcionesRefrescoAutomatico): void {
    const intervaloMs = opciones?.intervaloMs ?? INTERVALO_MS_POR_DEFECTO;
    const pausado = opciones?.pausado ?? false;

    const recargarRef = useRef(recargar);
    const pausadoRef = useRef(pausado);

    useEffect(() => {
        recargarRef.current = recargar;
    }, [recargar]);

    useEffect(() => {
        pausadoRef.current = pausado;
    }, [pausado]);

    useEffect(() => {
        // Evita el refresco acumulado: solo recarga una vez al volver a estar
        // visible, sin importar cuantos intervalos pasaron oculta. Si ya
        // esta visible al montar, no hay refresco pendiente por hacer.
        // Si la pestana sigue pausada al volver a estar visible, el refresco
        // pendiente se descarta: no queda guardado para cuando se despause,
        // ya que el intervalo normal se encarga de retomar mas adelante.
        let hayRefrescoPendienteAlVolver = document.visibilityState !== "visible";
        let intervalId: ReturnType<typeof setInterval>;

        const tick = () => {
            if (!pausadoRef.current && document.visibilityState === "visible") {
                recargarRef.current();
            }
        };

        const iniciarIntervalo = () => {
            intervalId = setInterval(tick, intervaloMs);
        };

        iniciarIntervalo();

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                if (hayRefrescoPendienteAlVolver && !pausadoRef.current) {
                    recargarRef.current();
                    // Reinicia el intervalo para que el tick que ya estaba en curso no
                    // dispare una segunda recarga a los pocos instantes de esta.
                    clearInterval(intervalId);
                    iniciarIntervalo();
                }
                hayRefrescoPendienteAlVolver = false;
            } else {
                hayRefrescoPendienteAlVolver = true;
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [intervaloMs]);
}
