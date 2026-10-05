# Revisar solicitudes: bloqueo post-modal por pointer-events

Fecha: 2026-10-05
Rama: `Bloqueo-Post-Modal`
Origen: reproduccion manual asistida con Playwright CLI en `/solicitudes/revisar`.
Relacionado:
- `docs/superpowers/specs/2026-09-15-sidebar-colapsable-tabla-design.md`
- `docs/superpowers/specs/2026-09-15-gestor-contexto-edicion-citas-design.md`

## Problema

En `/solicitudes/revisar`, el usuario abre `Gestionar -> Otras solicitudes y citas`, cierra el dialog
"Solicitudes y citas en curso" y luego la pantalla queda visualmente activa pero no recibe clics.

Playwright confirmo el estado bloqueado:

- No queda ningun `[role="dialog"]`.
- No queda ningun `[data-state="open"]`.
- `document.body.style.pointerEvents === "none"`.
- Los botones `Gestionar` siguen en el DOM, pero heredan `pointer-events: none`; `elementFromPoint`
  cae en `HTML` en vez del boton.

La causa observable es la composicion de capas modales de Radix: `DropdownMenu` abre como modal por
defecto y puede dejar el `body` bloqueado cuando desde una opcion se abre un `Dialog` modal.

## Objetivo

Cerrar cualquier dialog abierto desde un menu desplegable debe restaurar la interaccion completa de la
pagina. El arreglo debe vivir en el wrapper compartido de `DropdownMenu`, no como limpieza local en
`RevisarSolicitudesView`, para evitar la misma regresion en otros flujos.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Alcance | `DropdownMenu` compartido | El bug nace en la capa comun de menus + dialogs |
| Comportamiento por defecto | `modal={false}` | Un menu de acciones no debe bloquear el resto del documento como un dialog |
| Escape hatch | Permitir `modal={true}` explicito | Conserva compatibilidad si un flujo futuro necesita menu modal |
| Limpieza manual | No tocar `document.body.style.pointerEvents` a mano | Seria un workaround fragil y podria romper dialogs realmente abiertos |
| UI de solicitudes | Sin cambios visibles | El flujo y textos actuales se mantienen |

## Diseno

### 1. Wrapper compartido

Modificar `src/shared/components/ui/dropdown-menu.tsx` para que `DropdownMenu` deje de ser un alias directo
de `DropdownMenuPrimitive.Root` y pase a ser un wrapper tipado:

```tsx
function DropdownMenu({
    modal = false,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
    return <DropdownMenuPrimitive.Root modal={modal} {...props} />;
}
```

Todos los exports existentes se conservan. Los usos actuales no cambian porque siguen importando
`DropdownMenu` desde el mismo modulo.

### 2. Prueba de regresion compartida

Crear una prueba en `src/shared/components/ui/dropdown-menu.test.tsx` con componentes reales
`DropdownMenu` y `Dialog`:

1. Renderizar un dropdown abierto con opcion "Otras solicitudes y citas".
2. Confirmar que el menu abierto no deja `document.body.style.pointerEvents` en `none`.
3. Abrir un dialog desde la opcion.
4. Cerrar el dialog.
5. Confirmar que `document.body.style.pointerEvents` no queda en `none` y que el trigger sigue
   interactuable.

La prueba cubre el contrato compartido; Playwright cubre el flujo integrado real.

### 3. Verificacion Playwright

Con la app local levantada:

1. Entrar a `/solicitudes/revisar`.
2. Abrir `Gestionar -> Otras solicitudes y citas`.
3. Cerrar el dialog.
4. Verificar en el navegador:
   - `document.body.style.pointerEvents !== "none"`.
   - No quedan dialogs abiertos.
   - Otro boton `Gestionar` puede abrir su menu.

## Fuera de alcance

- Cambiar logica de solicitudes, citas, permisos o base de datos.
- Redisenar la tabla, los dialogs o el menu `Gestionar`.
- Agregar limpieza global de estilos en `body`.
- Versionar artefactos `.playwright-cli/`.

## Criterios de aceptacion

- [ ] `DropdownMenu` usa `modal={false}` por defecto y permite `modal={true}` explicito.
- [ ] La prueba compartida reproduce el fallo antes del cambio y queda verde despues.
- [ ] En `/solicitudes/revisar`, cerrar "Solicitudes y citas en curso" deja la pantalla clickeable.
- [ ] Playwright confirma que `body.style.pointerEvents` no queda en `none`.
- [ ] `npm test`, `npx tsc --noEmit` y `npm run lint` quedan en verde.
