# Reporte — Tarea 3: Modal restringido e integración en Revisar solicitudes

## Alcance implementado

- Se agregó `Field` oficial con `npx shadcn@latest add field` y se revisó el archivo generado.
- `RegistrarLlamadaModal` ahora exporta `CitaParaLlamada` y `RegistrarLlamadaModalProps`, usa `Dialog` y `FieldGroup`/`Field`, y admite `modo="gestion_solicitudes"`.
- En Gestión, la respuesta queda fijada a `Cita Rechazada (No Necesaria)`, se ocultan el selector y la hora, y la única entrada de formulario es la observación opcional, con máximo y contador de 350 caracteres.
- `RevisarSolicitudesView` crea la cita de llamada a partir de la solicitud contextual asociada por `solicitud_id`, muestra la acción solo con `puedeRegistrarRechazo`, y recarga el contexto tras éxito o `ERROR_CITA_CERRADA`.

## Evidencia RED

Antes de implementar, se agregaron pruebas para:

1. El modo Gestión: respuesta fija, ausencia de selector/hora, contador y payload con origen Gestión, observación recortada y hora vacía.
2. La integración: acción condicionada por `puedeRegistrarRechazo`, apertura con los datos de la solicitud asociada, cierre y recarga en éxito y cita cerrada concurrentemente.

La ejecución RED escalada de `npm test -- src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx` falló como se esperaba para los comportamientos aún ausentes: el modal mantenía el combobox y no exponía la observación etiquetada, y no existía el botón `Registrar rechazo`. La misma ejecución también descubrió pruebas de `.worktrees/reimpresion-voucher-mantener-usuario` con error preexistente de doble React (`Invalid hook call`), ajenas a este cambio.

## Evidencia GREEN

```text
npx vitest run src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/solicitudes/components/PendientesCascada.test.tsx --exclude=.worktrees/**
Test Files  3 passed (3)
Tests  65 passed (65)
```

```text
npx tsc --noEmit
exit 0
```

```text
npx vitest run --exclude=.worktrees/**
Test Files  98 passed | 1 skipped (99)
Tests  901 passed | 70 skipped (971)
```

`git diff --check` también finalizó sin errores.

## Limitaciones y seguimiento

- El comando literal `npm test -- ...` sigue descubriendo el worktree ajeno y falla con 46 pruebas por `Invalid hook call`; la comprobación aislada anterior excluye ese directorio y valida las 65 pruebas relevantes.
- `registrarLlamada.action.ts` actualmente rechaza todo origen distinto de `comunicador`, incluso después de que el schema valida Gestión. La UI envía `ORIGEN_LLAMADA.GESTION_SOLICITUDES` según el brief; se requiere el fix backend indicado por el controlador antes de habilitar persistencia real.
