# Claridad de filtros y ordenamiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer explícitos los filtros del Comunicador y estabilizar sus controles, priorizando RUT y neutralizando el color del ordenamiento.

**Architecture:** Reutilizar PanelFiltros y EncabezadoOrdenable. Los cambios de campos y temporalidad pertenecen a cada módulo; la distribución adaptable y el estilo del encabezado permanecen compartidos.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind, shadcn/ui, Vitest y Testing Library.

**Spec:** Diseño acotado aprobado en conversación el 2026-11-11, recogido íntegramente en los criterios siguientes. El usuario autorizó delegar la ejecución al terminar este plan, mediante OpenCode y GLM 5.3 Flash.

## Global Constraints

- Gestor: RUT primero. Comunicador: Temporalidad primero y RUT segundo; conservar el orden relativo de los demás campos.
- Mostrar siempre el badge de temporalidad aplicada: incluye «Agendamientos próximos» inicial y «Todas». Los cambios del formulario no modifican badges hasta aplicar.
- Limpiar restaura «Agendamientos próximos» y conserva su badge. Conservar el conteo actual de filtros adicionales y la visibilidad actual de Limpiar; mostrar el badge inicial no convierte el valor base en modificación del usuario.
- Botón Filtros al extremo derecho de su área, sin desplazarse por la cantidad de badges; detalle a su izquierda, alineado a la derecha y creciendo en nuevas filas cuando no cabe. Sin desplazamiento horizontal. Conservar orden de lectura, sin invertir textos ni usar direction:rtl.
- Encabezados ordenables con colores neutros en reposo, hover, foco y activación; conservar foco visible, flechas, aria-sort y ciclo ascendente/descendente/original. Cambio local al encabezado, sin alterar el tema ni Button global.
- Preservar búsqueda global, paginación, prioridad, continuidad de llamadas, edad y nombres del paciente. Sin cambios de backend, permisos, BD o dependencias.

## Review Focus

- Pantalla estrecha y valores largos: badges ajustan líneas sin empujar el botón ni desbordar horizontalmente (verificación visual Task 2).
- Formulario editado sin aplicar: badges siguen representando la consulta vigente (Task 1).
- Limpiar después de elegir Todas: vuelve el badge de próximos y la consulta existente por defecto (Task 1).
- Consumidores compartidos sin detalle: botón y limpieza siguen funcionando, revisar todos los usos de PanelFiltros (Task 2).
- Teclado: foco visible neutro y ciclo de orden intacto; comprobar también hover después del clic (Task 3).

### Task 1: Orden de campos y temporalidad explícita

**Files:** `src/modules/comunicador/components/CitasFiltros.tsx`, sus tests; `ComunicadorView.test.tsx`; `src/modules/solicitudes/components/RevisarSolicitudesView.tsx` y sus tests solo si se necesita verificar o corregir RUT.

**Interfaces:** Mantener CitasFiltros y detalleFiltrosActivos(valor, opciones). No cambiar contratos de acciones.

- [ ] Actualizar pruebas: detalle inicial contiene `{ etiqueta: "Temporalidad", valor: "Agendamientos próximos" }`; Todas también aparece; borrador sin aplicar no cambia detalle; limpiar restaura próximos. Verificar orden DOM de campos: Temporalidad/RUT/Estado en Comunicador y RUT primero en Gestor (ya primero en el checkout actual).
- [ ] Ejecutar `npx vitest run src/modules/comunicador/components/CitasFiltros.test.tsx src/modules/comunicador/components/ComunicadorView.test.tsx src/modules/solicitudes/components/RevisarSolicitudesView.test.tsx`; confirmar fallos esperados antes del cambio.
- [ ] Mover RUT y eliminar la exclusión de la temporalidad base en detalleFiltrosActivos; actualizar comentario. Conservar contarFiltrosActivos y la base del contador.
- [ ] Repetir pruebas y confirmar PASS. Commitear cambios de esta tarea con mensaje en español.

### Task 2: Botón fijo a la derecha y badges adaptables

**Files:** `src/shared/components/filtros/panel-filtros.tsx`, `panel-filtros.test.tsx`; contenedores CardHeader de Gestor y Comunicador si necesitan ajustar ancho.

**Interfaces:** Conservar PanelFiltrosProps, FiltroActivo y callbacks existentes.

- [ ] Revisar consumidores con `rg -n 'PanelFiltros' src`. Conservar Sheet y apertura por botón/badges, limpieza y envío de formulario.
- [ ] Distribuir el área con detalle flexible a la izquierda y botón sin encogerse a la derecha. Badges con flex-wrap, ancho acotado y min-width cero; Limpiar en área flexible para no desplazar Filtros. Adaptar contenedor exterior si el título y los filtros compiten por ancho.
- [ ] Ejecutar `npx vitest run src/shared/components/filtros/panel-filtros.test.tsx` y pruebas de las dos vistas. No sustituir verificación visual con tests de clases CSS.
- [ ] Verificar visualmente escritorio y móvil: sin filtros adicionales, muchos filtros y texto largo; botón a la derecha, nuevas filas, sin scroll horizontal. Revisar consumidor sin badges y apertura por teclado. Registrar evidencia o limitación real si no se puede iniciar sesión localmente.
- [ ] Commitear cambios de esta tarea con mensaje en español.

### Task 3: Ordenamiento neutro y verificación final

**Files:** `src/shared/components/tablas/encabezado-ordenable.tsx` y sus tests.

**Interfaces:** Mantener EncabezadoOrdenableProps, siguienteOrden y callbacks sin cambios.

- [ ] Aplicar estilo neutro local: el verde proviene de Button ghost, que usa hover:bg-accent y hover:text-accent-foreground. Sobrescribir hover/focus/active con tokens neutros y conservar indicador visible de foco. No modificar Button global.
- [ ] Ejecutar `npx vitest run src/shared/components/tablas/encabezado-ordenable.test.tsx` y confirmar ciclo, flechas y aria-sort intactos. Verificar visualmente hover, clic y foco de teclado en ambas tablas.
- [ ] Ejecutar `npm test -- --run`, `npm run lint`, `npx tsc --noEmit` y `npm run build`. Reportar comandos, resultados y limitaciones; no acceder a producción para esta tarea.
- [ ] Revisar diff completo contra los criterios aprobados. Commitear y entregar resumen, commits y evidencia; no hacer merge ni deploy, ni actualizar el PR 54 ya aceptado.
