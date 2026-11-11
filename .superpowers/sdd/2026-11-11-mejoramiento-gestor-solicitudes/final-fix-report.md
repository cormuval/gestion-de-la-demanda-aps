# Reporte de fixes de revision final

Fecha: 2026-11-11

## Resultado

Se resolvieron todos los hallazgos de `final-fix-brief.md` en una sola ola:

- `registrarLlamada` conserva el guard exclusivo `comunicador.llamar` antes del parseo y de cualquier transaccion.
- La falta contractual de permiso retorna `{ ok: false, error: "No tienes permiso para esta operacion" }`.
- Solo se reconoce el mensaje estable que hoy expone `requirePermiso`; cualquier error distinto se vuelve a lanzar y el modal lo reduce a `Error al registrar la llamada`, sin filtrar detalles tecnicos.
- El modo Gestion muestra el error estructurado mediante `toast.error(resultado.error)`.
- El boton de la cita ahora dice `Registrar llamada`.
- La respuesta fija informativa usa `FieldTitle`.
- La prueba contextual diferencia los datos de la solicitud base y la asociada, y confirma que el modal recibe nombre legal, nombre social, telefonos y correo de la solicitud enlazada por `solicitud_id`.

## TDD: RED

Comando aislado:

```text
npx vitest run --exclude ".worktrees/**" src/modules/comunicador/actions/registrarLlamada.action.test.ts src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx --reporter=dot
```

Resultado esperado antes del codigo de produccion:

- 3 archivos con fallos.
- 4 pruebas fallaron y 74 pasaron.
- Fallos observados: la denegacion aun rechazaba la promesa; `Respuesta registrada` aun era un `LABEL`; las dos interacciones contextuales aun exponian `Registrar rechazo`.

La primera ejecucion sin `--exclude` tambien recogio un worktree ajeno y produjo fallos de doble instancia de React; se repitio con la exclusion exigida para aislar esta rama.

## GREEN focalizado

```text
npx vitest run --exclude ".worktrees/**" src/modules/comunicador/schemas/llamada.schema.test.ts src/modules/comunicador/actions/registrarLlamada.action.test.ts src/modules/comunicador/components/RegistrarLlamadaModal.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx --reporter=dot
```

Resultado: 4 archivos, 97 pruebas pasaron, 0 fallaron.

## Verificacion completa

```text
npx tsc --noEmit
```

Resultado: exit code 0, sin errores.

```text
npx vitest run --exclude ".worktrees/**" --reporter=dot
```

Resultado: 98 archivos pasaron, 1 archivo omitido; 911 pruebas pasaron y 70 quedaron omitidas; 0 fallaron.

## Observaciones

La suite completa conserva advertencias no bloqueantes ya emitidas por pruebas fuera de esta ola: actualizaciones sin `act(...)` en `ComunicadorView.test.tsx` y contenedores de graficos con dimensiones cero en `DashboardView.test.tsx`. No hubo fallos asociados.
