# ResultadoAccion en Server Actions: errores de negocio visibles en produccion

Fecha: 2026-10-07
Rama: `Issues-resultado-accion`
Origen: issue #22, "Deuda: errores de negocio genericos en produccion (migrar actions a ResultadoAccion)".
Relacionados: `2026-09-15-rbac-anti-escalada-design.md` y `2026-09-15-solicitud-duplicada-design.md`.

## Problema

Next.js reemplaza en produccion el mensaje de los errores lanzados desde Server Actions. Por eso una
condicion esperada, como una cita cerrada o un nombre duplicado, llega a la interfaz como una falla
generica del sistema.

El issue se abrio con 42 apariciones. El estado actual, despues de S1 y S2, contiene **29**
`throw new Error` explicitos en `src/modules/**/actions/*.action.ts`. Ademas existe un lanzamiento en
`src/modules/solicitudes/actions/usuarioUpdate.ts`, helper compartido por las actions de actualizacion
de pacientes. Excluirlo dejaria afectadas rutas mencionadas expresamente por el issue.

La deuda actual abarca 30 condiciones esperadas. Tambien hay consumidores que suponen que una promesa
resuelta siempre significa exito, especialmente los que usan `.then(() => loadData())`; al cambiar el
contrato, esos puntos podrian fallar en silencio si no revisan `res.ok`.

## Objetivo

Que todos los errores de negocio y configuracion esperados de las rutas inventariadas sean visibles en
produccion mediante `ResultadoAccion<T>`, y que ningun consumidor trate un resultado fallido como
exito.

## Decisiones

| Decision | Eleccion | Motivo |
| --- | --- | --- |
| Contrato | `ResultadoAccion<T>` en todas las actions afectadas, incluidas las lecturas | Un contrato uniforme evita rutas especiales y datos vacios ambiguos |
| Control de flujo | Retornos explicitos, no excepciones de dominio ni wrapper global | Sigue el patron vigente y deja visible la frontera negocio/sistema |
| Transacciones | Union discriminada interna y conversion al contrato publico | Permite rechazar sin escribir y deja que Prisma siga lanzando fallos tecnicos |
| Validacion manual | Devuelve `ok: false` | RUT vacio/invalido y fechas fuera de rango son condiciones esperadas de estas interfaces |
| Zod | Sigue lanzando | Un fallo despues de validar la UI representa input manipulado o un defecto de integracion |
| Autorizacion e infraestructura | Siguen lanzando | No son errores de negocio recuperables por la interfaz |
| Configuracion estructural | `ok: false` con indicacion de contactar a soporte | El usuario necesita una salida accionable sin confundirla con una caida del sistema |
| Auditoria | Conservar exitos y registros de seguridad actuales | Redisenar la politica de auditoria no es necesario para resolver el issue |

## Contrato comun y frontera de errores

Se reutiliza sin cambios `src/shared/types/resultado.ts`:

```ts
export type ResultadoAccion<T> = { ok: true; data: T } | { ok: false; error: string };
```

Devuelven `{ ok: false, error }`:

- duplicados de catalogos o pacientes;
- recursos inexistentes, desactualizados o que ya cambiaron de estado;
- recursos que no pertenecen al centro del actor;
- RUT vacio o invalido validado manualmente;
- fecha estimada invalida o fuera de rango;
- funcionario sin centro y ausencia de un centro consultable;
- centro seleccionado inexistente en la actualizacion de un paciente.

Siguen rechazando la promesa:

- `requirePermiso(...)`;
- `schema.parse(...)` y otros errores Zod;
- errores inesperados de Prisma, auditoria o infraestructura.

No se agrega un `try/catch` general en las actions: hacerlo podria convertir fallos tecnicos en errores
recuperables y ocultar incidentes reales.

## Inventario y diseno por modulo

### Solicitudes

#### `guardarUsuario.action.ts` y `usuarioUpdate.ts`

- `crearUsuario`: "Centro no encontrado" y "El usuario ya existe" pasan a resultado fallido.
- `actualizarUsuario`: propaga como resultado fallido "Centro no encontrado" desde el nucleo
  compartido.
- `persistirActualizacionUsuario`: devuelve `ResultadoAccion<{ usuario: UsuarioGuardado }>`.
- `validarCentro` deja de lanzar y devuelve una representacion explicita que el nucleo convierte en
  `ResultadoAccion`. La consulta o el logger siguen lanzando si fallan tecnicamente.
- `actualizarUsuarioComunicador` reutiliza el mismo resultado sin reinterpretar el error.

El parseo Zod permanece en el nucleo compartido, por lo que una entrada manipulada sigue rechazando la
promesa.

#### `getUsuarioPorRut.action.ts`

Devuelve `ResultadoAccion<{ usuario: Usuario | null }>` y convierte "RUT usuario es requerido" y
"RUT invalido". Que el paciente no exista sigue siendo un exito con `usuario: null`.

#### `getPendientes.action.ts`

Devuelve `ResultadoAccion<PendientesPaciente>` y convierte "rutUsuario es requerido". Un paciente sin
pendientes sigue siendo un exito con listas vacias.

#### `getSolicitudes.action.ts`, `getOtrasSolicitudes.action.ts` y `getRevisionCatalogos.action.ts`

Convierten la ausencia de centro en:

> El funcionario activo no tiene centro asignado. Contacta a soporte para corregir tu configuracion.

`getOtrasSolicitudes` tambien convierte "rutUsuario es requerido". Los resultados legitimos sin filas
continuan siendo exitosos.

#### `gestionarSolicitud.action.ts`

Devuelve `ResultadoAccion<GestionSolicitudOk>`. Convierte:

- funcionario sin centro;
- fecha estimada invalida o fuera de rango;
- solicitud que ya no esta pendiente o no pertenece al centro;
- prestacion que no pertenece a un profesional activo del centro;
- profesional de examenes inexistente o inactivo.

El callback de `prisma.$transaction` devuelve una union interna de exito o error. Todas las
validaciones que pueden fallar ocurren antes de las escrituras de la rama correspondiente. Si devuelve
error, no se actualiza la solicitud, no se crean citas y no se registra auditoria de exito. Prisma
sigue revirtiendo y lanzando cualquier error tecnico.

### Comunicador

#### `getCitasPendientes.action.ts` y `getCitasPendientesPaciente.action.ts`

Devuelven `ResultadoAccion<T>` y convierten la ausencia de centro al mensaje accionable de soporte.
Una consulta sin citas permanece como exito con una lista vacia.

#### `getHistorialLlamadas.action.ts`

Devuelve `ResultadoAccion<HistorialLlamada[]>`. Convierte la ausencia de centro y la cita inexistente o
ajena al centro. Una cita valida sin llamadas permanece como exito con una lista vacia.

#### `getUsuarioParaEdicion.action.ts`

Devuelve `ResultadoAccion<{ usuario: UsuarioEditable | null }>` y convierte RUT requerido o invalido.
Un paciente inexistente permanece como exito con `usuario: null`.

#### `registrarLlamada.action.ts`

Devuelve `ResultadoAccion<{ estadoCita: string; solicitudRealizada: boolean }>`. Mantiene el
`SELECT ... FOR UPDATE` y convierte cita inexistente, cita de otro centro y cita cerrada.

El callback transaccional devuelve una union interna. Los tres rechazos ocurren antes de crear la
llamada o actualizar la cita. La auditoria de exito se ejecuta solo con `ok: true`.

#### `actualizarUsuarioComunicador.action.ts`

Expone directamente el `ResultadoAccion` producido por `persistirActualizacionUsuario`; no captura
autorizacion, Zod ni fallos tecnicos.

### Configuracion

En `mantenedores.action.ts` se migran:

- `guardarTipoSolicitud`: nombre duplicado;
- `guardarMotivo`: tipo inexistente y nombre duplicado dentro del tipo;
- `guardarProfesional`: nombre duplicado;
- `guardarPrestacion`: profesional inexistente y nombre duplicado dentro del profesional.

Cada action devuelve `ResultadoAccion<EntidadGuardada>`. Ningun resultado fallido ejecuta la escritura
ni la auditoria de exito. `guardarRol`, `guardarFuncionario` y `guardarPermisosRol` ya usan el contrato
y no cambian salvo por ajustes de consumidores o tests necesarios para mantener consistencia.

### SOME

`getSomePanel.action.ts` devuelve `ResultadoAccion<SomePanelData>` y convierte "No hay centro
disponible para consultar productividad SOME". Un panel sin actividad, pero con centro valido,
permanece como exito con metricas vacias o en cero.

## Consumidores y experiencia de usuario

Todos los puntos de llamada discriminan el resultado antes de leer los datos:

```ts
const res = await accion(input);
if (!res.ok) {
    toast.error(res.error);
    return;
}
const data = res.data;
```

Reglas obligatorias:

- `ok: false` muestra el mensaje entregado por la action;
- no se presenta exito, no se cierra el modal y no se ejecutan callbacks de exito;
- formularios y modales conservan los datos ingresados;
- no se recargan datos despues de una mutacion fallida;
- los `.then(() => loadData())` de catalogos se reemplazan por un flujo que inspecciona `res.ok`;
- cargas iniciales muestran un estado de error existente o incorporan uno visible y recuperable;
- modales secundarios pueden mostrar toast y cerrarse de forma controlada si no pueden cargar;
- los `catch` quedan como respaldo tecnico y muestran copy generico, sin depender de `err.message` para
  recuperar errores de negocio.

En la carga paralela de ingreso de solicitudes, `getPendientes` y `getUsuarioPorRut` se esperan y se
validan antes de actualizar estado. Un resultado fallido no se convierte en datos vacios ni permite
continuar el flujo.

Los consumidores afectados se localizan, como minimo, en:

- `IngresarSolicitudView.tsx`;
- `RevisarSolicitudesView.tsx`;
- `UsuariosRolesView.tsx`;
- `ComunicadorView.tsx`;
- `RegistrarLlamadaModal.tsx`;
- `OtrasCitasPacienteModal.tsx`;
- `HistorialLlamadasModal.tsx`;
- `useUsuarioEdit.ts`;
- `SomeView.tsx`.

El plan debe volver a buscar todos los usos de cada action antes de implementar para no depender solo
de esta lista minima.

## Mensajes y auditoria

Se conservan los textos actuales de los errores de negocio, salvo el mensaje estructural de centro,
que agrega la indicacion de soporte. No se introducen codigos de error, clases de excepcion,
traducciones ni un wrapper global.

Se conserva la auditoria exitosa existente y los registros de seguridad de RBAC. Este trabajo no
agrega una politica transversal de auditoria para rechazos de negocio. Un rechazo no debe registrarse
como exito.

## Pruebas

La implementacion sigue TDD por grupo funcional.

### Actions y helper compartido

Para cada condicion migrada:

- afirmar el objeto `{ ok: false, error }` exacto;
- afirmar que no hubo escrituras posteriores;
- afirmar que no hubo auditoria de exito;
- mantener o agregar el caso exitoso `{ ok: true, data }`;
- comprobar que `requirePermiso`, Zod y un fallo simulado de Prisma siguen rechazando la promesa.

Las pruebas transaccionales de `gestionarSolicitud` y `registrarLlamada` verifican la ausencia de
escrituras ante cada resultado fallido. El helper `usuarioUpdate.ts` se cubre directamente o a traves
de sus actions consumidoras en ambos modulos.

### Consumidores

Por cada familia de UI se prueba que `ok: false`:

- muestra `toast.error` o el estado de error definido;
- no muestra exito;
- no cierra el formulario o modal antes de tiempo;
- no recarga ni ejecuta callbacks de exito;
- conserva los valores editados cuando corresponde.

Se cubren expresamente los toggles de catalogos basados hoy en `.then(...)` y las cargas paralelas de
ingreso de solicitudes.

### Salvaguarda estructural

Una prueba estructural inspecciona `src/modules/**/actions/*.action.ts` y falla si reaparece
`throw new Error`. La regla no prohibe que autorización, Zod o infraestructura rechacen la promesa ni
se extiende a codigo que no sea Server Action.

## Despliegue

No hay cambios de esquema, migraciones, permisos, dependencias ni seeds. Los contratos TypeScript de
las actions y sus consumidores cambian en el mismo despliegue.

## Fuera de alcance

- Cambiar reglas de negocio o validaciones.
- Convertir fallos tecnicos en resultados recuperables.
- Crear un sistema global de codigos de error, telemetria o traducciones.
- Redisenar visualmente las pantallas.
- Redisenar la politica de auditoria.
- Migrar funciones ajenas a Server Actions, salvo el helper compartido necesario para las rutas de
  actualizacion de pacientes.

## Criterios de aceptacion

- [ ] Las 29 apariciones actuales de `throw new Error` en `*.action.ts` se reducen a cero.
- [ ] "Centro no encontrado" en `usuarioUpdate.ts` tambien se comunica mediante `ResultadoAccion`.
- [ ] Las 30 condiciones esperadas inventariadas muestran su mensaje en produccion, no el generico de
      Next.js.
- [ ] Todos los consumidores inspeccionan `res.ok` antes de leer `res.data` o ejecutar efectos de
      exito.
- [ ] Las lecturas distinguen un resultado vacio valido de una falla de negocio o configuracion.
- [ ] Autorizacion, Zod y fallos inesperados de infraestructura siguen rechazando la promesa.
- [ ] Una salvaguarda estructural impide reintroducir `throw new Error` en Server Actions.
- [ ] `npm test`, `npx tsc --noEmit` y `npm run lint` finalizan correctamente.
