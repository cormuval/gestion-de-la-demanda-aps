import * as React from "react"

const INTERVALO_MS_POR_DEFECTO = 60_000

interface OpcionesRefrescoAutomatico {
    intervaloMs?: number
    pausado?: boolean
}

/**
 * Ejecuta `recargar` cada `intervaloMs` mientras la pestana esta visible y no
 * esta pausado. Si la pestana estuvo oculta, al volver a visible fuerza un
 * unico refresco (sin ráfaga acumulada por los intervalos perdidos).
 */
export function useRefrescoAutomatico(recargar: () => void, opciones?: OpcionesRefrescoAutomatico): void {
    const intervaloMs = opciones?.intervaloMs ?? INTERVALO_MS_POR_DEFECTO
    const pausado = opciones?.pausado ?? false

    const recargarRef = React.useRef(recargar)
    const pausadoRef = React.useRef(pausado)

    React.useEffect(() => {
        recargarRef.current = recargar
    }, [recargar])

    React.useEffect(() => {
        pausadoRef.current = pausado
    }, [pausado])

    React.useEffect(() => {
        // Evita el refresco acumulado: solo recarga una vez al volver a estar
        // visible, sin importar cuantos intervalos pasaron oculta. Si ya
        // esta visible al montar, no hay refresco pendiente por hacer.
        let hayRefrescoPendienteAlVolver = document.visibilityState !== "visible"

        const intervalId = setInterval(() => {
            if (!pausadoRef.current && document.visibilityState === "visible") {
                recargarRef.current()
            }
        }, intervaloMs)

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                if (hayRefrescoPendienteAlVolver && !pausadoRef.current) {
                    recargarRef.current()
                }
                hayRefrescoPendienteAlVolver = false
            } else {
                hayRefrescoPendienteAlVolver = true
            }
        }

        document.addEventListener("visibilitychange", onVisibilityChange)

        return () => {
            clearInterval(intervalId)
            document.removeEventListener("visibilitychange", onVisibilityChange)
        }
    }, [intervaloMs])
}
