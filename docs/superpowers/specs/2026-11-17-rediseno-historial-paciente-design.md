# Rediseño de las tarjetas solicitud → cita → llamada

Fecha: 2026-11-17 · Autor de la spec: Renzo · Origen: reunión de equipo "Rediseño del historial del
paciente" (transcripción en la bóveda Obsidian) y maqueta en Google Sheets (abajo, en ASCII).

## Intención

El bloque que apila **solicitud → citas → llamadas** se ve en varias pantallas y hoy cuesta leerlo:
las líneas son sutiles, todos los estados tienen el mismo color gris, y no se distingue rápido si una
cita está abierta o cerrada, si tuvo llamadas o qué pasó en ellas. El caso típico es el
administrativo u orientador que recibe en ventanilla a un paciente que pregunta "¿qué pasó con lo
mío?" y debe responder **desde una sola pantalla**, sin moverse entre perfiles ni preguntarle a otra
persona.

Además, el mismo bloque se ve distinto según la pantalla. La reunión pidió que **se vea igual en todas**,
para que quien aprende a leerlo en una lo lea igual en las demás (premisa de integralidad centrada en
el paciente, `AGENTS.md`).

## Alcance: tres pantallas

| Pantalla | Archivo actual | Qué muestra | Qué conserva |
|---|---|---|---|
| Historial del paciente | `src/modules/historial/components/HistorialPacienteView.tsx` | Todo el historial del paciente en el centro | Botón "Reimprimir voucher" en solicitudes En Curso |
| Ingresar solicitud (orientador) | `src/modules/solicitudes/components/PendientesCascada.tsx` (`PendientesCascada`) | Solicitudes En Curso con **todas** sus citas (pendientes y cerradas), más las citas pendientes sin solicitud En Curso | Su botón "Reimprimir voucher", fecha estimada y priorización clínica |
| Revisar solicitudes (gestor) | `RevisarSolicitudesView.tsx` vía `ListaPendientes` | Contexto: otras solicitudes En Curso del paciente con todas sus citas | **Todos sus botones tal cual** (Realizar, Rechazar, Usuario, Cerrar cita, Editar prioridad, Editar fecha estimada) y el badge "Validada" |

## Objetivos

1. Una sola apariencia del bloque solicitud → cita → llamada en las tres pantallas.
2. Estados legibles de un vistazo con un **semáforo** común.
3. Rótulos explícitos en cada dato (nadie debe adivinar qué es cada texto).
4. Fechas y responsables agrupados en un solo lugar, "como una factura".
5. Acordeón en dos niveles para que un paciente con muchas solicitudes no sea un muro de texto.

## No objetivos

- Rediseñar la botonera de Revisar solicitudes (en la reunión se dijo que tiene demasiados botones;
  se postergó explícitamente). Los botones se mueven de lugar solo lo necesario para encajar en la
  nueva tarjeta; no se agregan, quitan ni renombran.
- Cambiar qué datos devuelve cada pantalla más allá de lo listado en "Datos".
- El modal "Otras citas del paciente" del comunicador (`OtrasCitasPacienteModal.tsx`): queda para
  una etapa siguiente.
- Renombrar estados en BD o cambiar reglas de cierre (`utils/cierre.ts` se mantiene).

## Anti-objetivos (sería un fracaso aunque funcione)

- **Quitar información que hoy se ve.** En particular, **todas las observaciones se mantienen**
  (descripción del paciente, observación del gestor, observación de la llamada). Se debatió
  quitarlas y se decidió no hacerlo: "si las quitamos, en dos semanas hay que volver a ponerlas".
  Sirvieron, por ejemplo, para investigar reclamos.
- Que la vista del gestor pierda o cambie el comportamiento de algún botón.
- Ocultar el código de la solicitud o de la cita: el equipo refiere los casos por código.

## Maqueta acordada

Historial, solicitud expandida, una cita expandida con sus llamadas:

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Solicitud: RII-882C7 [copiar]                      [ Estado de la solicitud: Realizado ]│ ← verde
│ Motivo: Consulta de morbilidad odontológica   (grande)          Orientador/a: S. Aguilera│
│                                                                    Gestor/a: F. Rojas │
│                                                          Fecha de creación: 30-12-2025│
│                                                            Fecha de cierre: 10-07-2026│
│ Descripción del paciente: SOLICITA CONTROL ... (usa todo el ancho, admite texto largo)│
│ [Reimprimir voucher]  ← solo si En Curso                                              │
│ [Ver citas (1)]                                                                        │
│ ┃ ┌────────────────────────────────────────────────────────────────────────────────┐ │
│ ┃ │ Cita: 29775f3f [copiar]                       [ Estado de la cita: Aceptada ]  │ │ ← verde pastel
│ ┃ │ Médico · Control de salud mental                         Gestor/a: M. Rebeco    │ │
│ ┃ │ Observación del gestor/a: CITAR A CONTROL PSM ...      Cierre de la cita: 26-03-2026│
│ ┃ │                                      Fecha y hora agendadas: 09-04-2026 10:45   │ │
│ ┃ │ [Ver llamadas (1)]                                                             │ │
│ ┃ │ ┌────────────────────────────────────────────────────────────────────────────┐ │ │
│ ┃ │ │ Comunicador/a: E. Ponce            [ Resultado de la llamada: Cita Aceptada ]│ │ │
│ ┃ │ │ Observación de la llamada: Se dio aviso ...   Fecha y hora: 04-10-2026 09:16 │ │ │
│ ┃ │ └────────────────────────────────────────────────────────────────────────────┘ │ │
│ ┃ └────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
  ┃ = barra lateral que agrupa las citas, más visible que la actual (border-muted)
```

En móvil, la columna derecha (estado, responsables, fechas) pasa debajo del contenido.

## Decisiones (tomadas en la reunión o por Renzo)

### Estructura y acordeón
- Tres niveles: Solicitud → Citas → Llamadas.
- Botón "Ver citas (n)" para abrir y cerrar las citas. **En Historial las citas parten
  colapsadas**; **en las vistas de pendientes (orientador y gestor) parten abiertas**, porque ahí
  viven las acciones y la fecha estimada y colapsarlas agregaría un clic al flujo del gestor. Es un
  parámetro de la tarjeta. Cada cita mantiene "Ver llamadas (n)", siempre colapsado al cargar. Una llamada se muestra en su propio recuadro: si hubo tres intentos, son tres
  recuadros.
- Si la solicitud no tiene citas: "Sin citas registradas" (historial) o el texto actual de las vistas
  de pendientes, sin botón.

### Encabezados y rótulos
- Solicitud: "Solicitud: {código}" con copiar (`CodigoId`), y debajo **"Motivo: {motivo}" como el
  texto más destacado** de la tarjeta.
- Cita: "Cita: {código}" con copiar; debajo "{estamento} · {prestación}".
- Rótulos explícitos: "Descripción del paciente", "Observación del gestor/a", "Comunicador/a",
  "Observación de la llamada", "Resultado de la llamada", "Estado de la solicitud:", "Estado de la
  cita:". Hay que usar formas inclusivas ("Gestor/a", "Orientador/a", "Comunicador/a").
- El campo "tipo" de la solicitud deja de mostrarse como título. Puede ir como dato secundario si
  el builder lo considera útil.

### Columna derecha (fechas y responsables)
- Solicitud: estado (badge) → Orientador/a → Gestor/a → Fecha de creación → Fecha de cierre (o
  "—" si no tiene).
- Cita: estado (badge) → Gestor/a → Cierre de la cita → Fecha y hora agendadas (solo si está
  aceptada, igual que hoy).
- Llamada: resultado (badge) → Fecha y hora de la llamada.
- **Gestor/a en ambos niveles.** En la solicitud es quien la validó o rechazó (`Solicitud.rut_gestor`).
  En cada cita es quien la creó (`Cita.rut_gestor`). En producción suelen ser personas distintas, y
  hay unas 4.000 solicitudes rechazadas sin citas: quitar el gestor de la solicitud borraría quién
  las rechazó. La maqueta lo mostraba solo en la cita; se corrigió tras la revisión.

### Razón de rechazo
- Se mantiene, como hoy, en el cuerpo de la tarjeta de solicitud, con el rótulo "Razón de rechazo"
  y solo cuando la solicitud está Rechazada. Decisión del builder-check.

### Semáforo de estados
Tres colores con la misma lógica en los tres niveles:

| Color | Solicitud | Cita | Resultado de llamada |
|---|---|---|---|
| Amarillo (en curso/pendiente) | En Curso | Sin llamadas, No contesta (1), No contesta (2), Solo llamada de aviso | No contesta, Llamada de aviso |
| Verde (resuelto bien) | Realizado | Cita Aceptada | Cita Aceptada |
| Rojo (rechazado) | Rechazado | Cita Rechazada (cualquier variante) | Cita Rechazada (cualquier variante) |
| Gris (fallback) | estado desconocido | `null` / desconocido | desconocido |

- El verde de la cita es **más pastel** que el de la solicitud, para distinguir los niveles.
- Una sola función pura de estado a tono, con tests para los 9 estados de cita y las 6 respuestas
  de llamada (`ESTADO_CITA`, `RESPUESTA_LLAMADA` en `src/modules/comunicador/types/comunicador.ts`).
- Colores con tokens del tema y legibles en modo oscuro. El color nunca es la única señal: el texto
  del estado siempre se ve (accesibilidad).

### Orden
- Historial: primero las solicitudes **En Curso** y después el resto; dentro de cada grupo, de la
  más reciente a la más antigua (`fecha_inicio`). Las citas dentro de la solicitud y las llamadas
  dentro de la cita mantienen su orden actual (ascendente por creación o fecha).
- Pendientes (orientador y gestor): se mantiene su orden actual (ya son todas En Curso).

### Formato de fechas
- Uno solo en todas las tarjetas: fecha `dd-mm-aaaa` y fecha y hora `dd-mm-aaaa HH:mm` (24 h, zona
  `America/Santiago`). La maqueta tenía formatos mezclados; esto lo resuelve.

### Qué no se muestra en el historial
- La fecha estimada de atención y la priorización clínica **no** se muestran en el historial
  (decisión de la reunión). Sí se mantienen en las vistas de pendientes.

### Pantallas de pendientes
- Usan las mismas tarjetas. Además de lo que ya muestran, incorporan lo que pide el diseño:
  orientador/a, gestor/a y fecha de creación en la solicitud, gestor/a en la cita, y el acordeón de
  llamadas de la cita (una cita "No contesta (2)" ya tuvo llamadas, y verlas responde "¿me
  llamaron?").
- **Cada solicitud En Curso muestra todas sus citas**, no solo las pendientes. Las cerradas se ven
  con su verde o rojo del semáforo; "Ver citas (n)" cuenta todas. Así se resuelve en un solo
  llamado (premisa de integralidad). En producción hay unas 10.800 citas cerradas dentro de
  solicitudes En Curso que hoy no se ven en estas pantallas.
- Las acciones de cada vista se inyectan en la tarjeta (como hoy con `accionesSolicitud` y
  `accionesCita`) y aparecen en la columna derecha, bajo los datos. **Las citas cerradas no
  muestran acciones de cita.** Los flags actuales (`editable`, `puedeRegistrarRechazo`) deben dar
  `false` para ellas; las reglas de edición no cambian.
- La fecha estimada y la priorización clínica se muestran en las citas pendientes, como hoy.
- Las "Otras citas" (citas pendientes sin solicitud En Curso asociada) siguen en su grupo aparte,
  con la misma tarjeta de cita.

## Datos

- `getHistorialPaciente.action.ts`: agregar `gestor: { select: { nombre: true } }` en la cita y
  exponer `gestor` en `CitaHistorial`. El gestor de la solicitud se mantiene.
- `getPendientes.action.ts` (orientador) y la acción que arma el contexto del gestor
  (`getOtrasSolicitudes` o equivalente): agregar el orientador y el gestor (nombre) de la solicitud,
  el gestor de la cita, **todas las citas de cada solicitud En Curso** y las llamadas de cada cita
  (mismos campos que el historial). Las "Otras citas" sin solicitud En Curso siguen siendo solo las
  pendientes. Hoy `getPendientes` usa `include: true` sobre relaciones: al tocarlo, pasar a `select`
  con solo los campos mostrados, como el historial (no traer filas completas de `Funcionario`).
- **No debe cambiar la lógica que hoy consume `citasPendientes`**, como la detección de duplicados
  al ingresar o los conteos. Si la forma de los datos cambia, la parte "pendiente" debe seguir
  disponible tal como antes para esos usos.
- Alcance por centro: la vista del orientador **no** filtra por centro (igual que hoy), y las
  llamadas también se muestran para citas de otros centros. Lo decidió Renzo. El historial
  sigue filtrando por centro, y la vista del gestor mantiene su filtro actual.
- Las fechas de cierre se siguen calculando con `utils/cierre.ts` (sin cambios de regla).

## Enfoques considerados

- **A. Tarjetas de presentación compartidas (elegido).** `SolicitudTarjeta`, `CitaTarjeta` y
  `LlamadaTarjeta` en `src/shared/components/pacientes/`, más la función del semáforo. Cada pantalla
  adapta sus datos a un tipo común y aporta sus botones. Es la única opción que garantiza que las
  vistas se vean iguales y sigan iguales. Costo: adaptar los tipos de pendientes y tocar la vista del
  gestor.
- B. Rediseñar cada vista por separado y compartir solo los colores. Más rápido, pero las vistas
  vuelven a divergir, que es el problema de origen.
- C. Un componente único con "modo" por pantalla. Se llena de condiciones según el modo. Descartado.

## Restricciones

- shadcn/ui y componentes existentes de `src/shared/components/ui` (Badge, Button, Card, CodigoId).
  Si hacen falta variantes de Badge para el semáforo, se agregan ahí.
- Convenciones del repo: módulos, 4 espacios, `interface` para objetos, imports categorizados.
- Accesibilidad: los botones de acordeón usan `aria-expanded`/`aria-controls` (como hoy "Ver
  llamadas") y las tarjetas usan regiones con nombre.
- Hay que mantener las protecciones actuales del historial: descarte de respuestas obsoletas,
  auditoría, filtro por centro y reimpresión de voucher sin duplicados.

## Criterios de aceptación

1. Las tres pantallas muestran solicitud, cita y llamada con las mismas tarjetas compartidas.
2. En Historial las citas parten colapsadas y en las vistas de pendientes parten abiertas. "Ver
   citas (n)" y "Ver llamadas (n)" muestran el conteo correcto y alternan entre abrir y cerrar.
2b. En las vistas de pendientes, cada solicitud En Curso muestra también sus citas cerradas, con
   color y sin acciones de cita. La detección de duplicados del ingreso no cambia.
3. El semáforo asigna el color de la tabla a cada uno de los 9 estados de cita, las 6 respuestas y
   los 3 estados de solicitud, con test unitario.
4. El historial ordena En Curso primero y luego por fecha descendente.
5. El gestor/a aparece en la solicitud (`Solicitud.rut_gestor`) y en cada cita (`Cita.rut_gestor`).
6. Todas las observaciones que hoy se ven siguen viéndose, con su rótulo.
7. Revisar solicitudes conserva todos sus botones y su comportamiento (los tests existentes de
   la vista pasan, ajustando solo los selectores visuales si cambian).
8. Fechas en el formato único definido.
9. Se ve bien en móvil (sin scroll horizontal, columna derecha apilada).

## Lo que queda al builder

- Nombres finales y API de las tarjetas, y el tipo común que adapta cada fuente de datos.
- Los tonos exactos dentro de los tokens del tema, y si el "tipo" de solicitud se muestra como dato
  secundario.
- El estado del acordeón (local por tarjeta o elevado), siempre que una búsqueda nueva lo reinicie.
- Cómo dividir el trabajo en tareas y en qué orden migrar las tres pantallas.

## Después del despliegue

- Hay que enviar un instructivo breve a los equipos (son unos mil funcionarios): el cambio es una
  reorganización de campos, pero se pidió avisar para evitar consultas del tipo "¿dónde quedó X?".

## Nota de privacidad

Las observaciones pueden contener datos casi clínicos (p. ej. "control PSM con Dra. X"). Hoy la
descripción y la observación de la cita ya se muestran a estos perfiles. **Esta spec sí amplía lo
que ve el orientador en Ingresar solicitud.** Agrega las observaciones de las llamadas y las citas
cerradas, y como esa vista no filtra por centro, incluye las de otros centros. Renzo lo aceptó de
forma explícita (2026-11-17) para que el orientador resuelva todo en un solo contacto. El historial
mantiene su filtro por centro.
