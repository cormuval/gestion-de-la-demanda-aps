# Tarea 4 — Límite de rechazo y orientador en modales

## RED

Se agregaron pruebas antes de modificar la implementación para verificar:

- Una observación de rechazo de 350 caracteres se acepta y se persiste.
- Una observación de 351 caracteres se rechaza antes de abrir la transacción.
- Una observación compuesta solo por espacios se normaliza a `null`.
- El modal de rechazo limita el textarea a 350 caracteres y muestra los contadores `0/350` y `350/350`.
- Los modales Realizar y Rechazar muestran el orientador, incluyendo el fallback `Sin registro` y el orientador propio de una solicitud abierta desde Otras solicitudes.

La ejecución RED confirmó los fallos esperados: el esquema aún tenía un máximo de 200 caracteres y los modales no contenían límite, contador ni orientador.

## GREEN

Cambios mínimos realizados:

- El esquema de rechazo ahora usa `z.string().trim().max(350, "Observacion maximo 350 caracteres").optional().default("")`.
- El textarea de observación usa `maxLength={350}`, un contador con `aria-live` y una relación `aria-describedby`.
- `SolicitudMeta` muestra el orientador de la solicitud o el fallback exacto `Sin registro`; los dos modales lo reutilizan, también cuando reciben la solicitud contextual.

## Verificación

- `npx vitest run --exclude "**/.worktrees/**" src/modules/solicitudes/actions/gestionarSolicitud.action.test.ts src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx src/modules/solicitudes/actions/getSolicitudes.action.test.ts`: 88/88 pruebas aprobadas.
- `npx tsc --noEmit`: aprobado sin diagnósticos.
- `npx vitest run --exclude "**/.worktrees/**"`: suite completa aprobada (código de salida 0).

Nota: el worktree local `.worktrees/reimpresion-voucher-mantener-usuario` contiene otra copia de React y falla por `Invalid hook call` si Vitest lo descubre; se excluyó explícitamente de la verificación, sin modificarlo.
