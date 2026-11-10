# Validación — Mejoras transversales (REQ-8, REQ-13, REQ-21, REQ-25)

Fecha: 2026-11-10 · Rama: `Mejoras-generales` · Commits de feature: `d71278d` (tarea 1, REQ-25), `c3deba8` (tarea 2, REQ-21), `00101a0` (tarea 3, REQ-13), `4435832` (tarea 4, REQ-13), `3d14718` (tarea 5, REQ-13), `6018551` (tarea 6, REQ-8), `c37e552` (tarea 7, REQ-8). Este documento corresponde a la tarea 8 del plan [2026-11-10-mejoras-transversales.md](../plans/2026-11-10-mejoras-transversales.md).

## 1. Entorno local aislado

- BD desechable exclusiva: contenedor MySQL 8.4 `aps-mejoras-mysql` en `127.0.0.1:3310`, base `aps_mejoras_test`, usuario `aps_test`. Nunca se usó el servicio de compose del proyecto (3308, otro proyecto) ni datos de producción. El contenedor se creó con `--rm`: al detenerlo, la BD y toda la fixture desaparecen.
- Esquema: `prisma generate` + `prisma db push` con `DATABASE_URL` local. El puerto 3310 está en la *allowlist* de `src/shared/lib/busquedaTexto.mysql.test.ts`, que rechaza cualquier otra base por seguridad.
- Volumen sintético (scaffolding temporal en `gitignored` `.superpowers/sdd/2026-11-10-mejoras-transversales/semilla-volumen.ts`): 1 centro `TEST-VOLUMEN-MEDICION` con **3.655 solicitudes** (3.613 quedan `En Curso`; 42 cerradas) y **15.125 citas pendientes** (`ESTADOS_PENDIENTES`), 500 pacientes con sectores Rojo/Azul/Verde, edades 8–90, textos cortos con coincidencias dispersas (`control` ≈ 2,5 %, `dental` ≈ 2 %, nulos históricos) y fechas estimadas entre −150 y +210 días. Los extremos coinciden con el orden de magnitud indicado en el plan para un centro real.
- Datos de experiencia: `db:seed` + `db:seed:ref` para catálogos/roles, más funcionario sintético activo (rol Administrador, centro sintético), dos pacientes especiales (nombre social «Nanda» y nombre legal extenso), cita aceptada con agenda (`hora_agendada` 2026-11-19T15:30Z) vía 2 llamadas, y cita aceptada sin agenda.

## 2. Contrato MySQL (tareas 3–4)

`RUN_MYSQL_SEARCH_TESTS=1 DATABASE_URL=<local> npx vitest run src/shared/lib/busquedaTexto.mysql.test.ts` → **70/70 pasan (≈1 s)**, ejecutado también con el volumen ya sembrado. Cubre Gestor y Comunicador: coincidencias fuera de la primera página, totales estables, literalidad de `%`, `_`, `!`, `\`, comillas, apóstrofe e inyección, comparación numérica de `ultimo_control` exclusión de nulos, temporalidades y equivalencia del conteo optimizado contra el conteo con JOINs para 18 combinaciones de filtros. Los mocks unitarios por sí solos no prueban esta semántica SQL.

## 3. Mediciones de acciones completas (volumen real)

Método: scaffolding temporal (eliminado tras la medición, nunca commiteado) que invoca las acciones de producción (`getSolicitudes`, `getCitasPendientes`) contra la BD local con permisos/auditoría simulados; primer intento = primera ejecución, 5 repeticiones para mediana/máximo. La latencia es completa (validación Zod + subconsultas de página + auditoría + serialización). CSV crudo: `.superpowers/.../medicion-resultados.csv` (no versionado).

| Acción | Criterio | Total | Primera | Mediana | Máx |
| --- | --- | ---: | ---: | ---: | ---: |
| Gestor | sin texto · página 1 | 3.576 | 35 ms | 35 ms | 76 ms |
| Gestor | sin texto · última página | 3.576 | 31 ms | 30 ms | 33 ms |
| Gestor | texto `control` | 96 | 32 ms | 31 ms | 32 ms |
| Gestor | texto `dental` | 86 | 30 ms | 30 ms | 32 ms |
| Gestor | texto sin resultados | 0 | 20 ms | 20 ms | 20 ms |
| Gestor | sector | 1.199 | 23 ms | 21 ms | 23 ms |
| Gestor | edad 60–80 | 905 | 36 ms | 38 ms | 40 ms |
| Gestor | fechas 01-09→28-10 | 3.576 | 32 ms | 31 ms | 32 ms |
| Comunicador | sin texto · página 1 | 15.125 | 294 ms | 294 ms | 299 ms |
| Comunicador | sin texto · última página | 15.125 | 321 ms | 311 ms | 321 ms |
| Comunicador | texto `control` | 522 | 144 ms | 149 ms | 169 ms |
| Comunicador | texto `dental` | 339 | 142 ms | 142 ms | 147 ms |
| Comunicador | texto sin resultados | 0 | 134 ms | 134 ms | 161 ms |
| Comunicador | sector | 5.052 | 182 ms | 184 ms | 184 ms |
| Comunicador | edad 60–80 | 3.801 | 166 ms | 166 ms | 168 ms |
| Comunicador | fechas | 2.400 | 158 ms | 158 ms | 163 ms |

Comparación conteo original (JOINs completos, criterio previo) vs optimizado en las mismas condiciones: totales **idénticos en 6/6 criterios** (sin texto 15.125; `control` 522; sector 5.052; edad 3.801; fechas 2.400; sin resultados 0). El conteo crudo original tarda 33–163 ms por criterio; la acción optimizada completa tarda 133–301 ms porque incluye consulta de página + campos de presentación + auditoría, por lo que ambas cifras no son comparables 1:1 — el punto del plan era incidencia, y el conteo no dominó ninguna medición. Sin regresión reproducible ni timeouts (umbral 5 s solo se contempló para producción; nunca se alcanzó el 2 % en local).

`EXPLAIN` del conteo con texto: usa `citas_centro_id_estado_cita_idx` (ref por centro, ≈7.591 filas) con `eq_ref` por PK en usuarios y solicitudes («Using index»); sin full scan ni filesort.

**Límites de las mediciones:** BD local (MySQL 8.4 en contenedor, `utf8mb4_unicode_ci`), datos sintéticos con distribución acotada, sin carga concurrente, sin cache frío (hay 1 corrida de calentamiento), lo que excluye prometer latencia de producción. En producción se aplicó la salvaguarda acordada: solo lecturas agregadas acotadas (`EXPLAIN` sin `ANALYZE`), sin fixtures — no se ejecutó ninguna lectura contra producción en esta sesión.

## 4. Verificación de experiencia (navegador, datos sintéticos)

`npm run dev` en local con la BD desechable y sesión Auth.js JWT firmada con `AUTH_SECRET` local ficticio sobre funcionario sintético activo (sin tocar auth de producto ni rutas de bypass). Verificado en el navegador embebido:

| Check | Resultado |
| --- | --- |
| Gestor: campo «Buscar en descripción» + Enter real envía el formulario | ✅ 96 resultados («Control de presión») |
| Gestor: encabezado «Solicitud / Fecha» via teclado real (Enter/Espacio) cicla asc→desc→natural, `aria-sort` correcto y descripción «Ordena esta página» | ✅ |
| Comunicador: búsqueda «revisión dental» con chip «Observación clínica: revisión dental» | ✅ |
| Comunicador: encabezado «Estado» via teclado real → «Orden manual de esta página» → tras tercer clic vuelve a «Ordenadas de mayor a menor prioridad. sin consultar | ✅ |
| Comunicador: fila con nombre legal extenso completo y línea «Nombre social: Nanda» | ✅ |
| Comunicador: modal de llamada muestra ambos nombres, teléfonos, RUT y contexto integral | ✅ |
| Historial: cabecera con nombre legal + «Nombre social: Nanda»; paciente con nombre extenso sin línea social | ✅ |
| Historial: cita aceptada con llamadas plegadas muestra agenda «Fecha y hora agendadas — 19-11-2026, 12:30» (19:30Z convertida a Santiago) | ✅ |
| Historial: cita aceptada sin agenda muestra «Fecha y hora no registradas»; estados no aceptados no muestran agenda ni etiqueta | ✅ |
| Voucher reimpreso: comprobante con RUT y teléfonos, sin nombre legal ni social (modal y PDF de impresión renderizado) | ✅ |
| Voucher: nombres visibles detrás del modal no aparecen en el área impresa (PDF vía print CSS) | ✅ |
| Cambio de centro activo: la cola queda vacía para el otro centro, sin filtrar datos ni identidad del centro anterior | ✅ |

La emisión inicial de voucher comparte modal/contrato con la reimpresión; la exclusión de claves de nombre en `data.usuario` está demostrada por los tests de `getVoucherSolicitud.action.test.ts` (tarea 1) y el contrato del voucher permaneció intacto.

## 5. Checks finales

| Comando | Resultado |
| --- | --- |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm test` | exit 0 — **98 archivos, 874 tests pasan** (70 opt-in MySQL saltados sin la variable; 99.º archivo es la suite MySQL opt-in) |
| `npm run build` | exit 0 (con variables ficticias como CI, `.env` local no expuesto) |

Advertencias de salida de tests: avisos `act()` preexistentes en suites anteriores a este plan (baseline) y de Recharts en Dashboard; no introducidos por estas tareas.

## 6. Cobertura por requerimiento

| REQ | Tareas | Evidencia |
| --- | --- | --- |
| REQ-8 ordenamiento local | 6–7 | Suite unitaria/compartida (`ordenPagina`, `encabezado-ordenable`, `ordenSolicitudes`, `ordenCitas`), interacción en Gestor y Comunicador con 0 consultas al ordenar, continuidad de «siguiente cita» y teclado real en vivo (§4) |
| REQ-13 búsqueda global | 3–5 | Contrato MySQL real 70/70 (§2), mediciones (§3), UI en ambas bandejas con Enter real, chips y limpieza (§4) |
| REQ-21 agenda en historial | 2 | Utilidad `agendaCita` con horario estacional (`reglas.test.ts` de migración en verde), vistas verificadas en vivo para aceptada con/sin agenda y estados no aceptados (§4) |
| REQ-25 nombre social | 1 | Presentación `NombrePaciente` en las cinco superficies del inventario verificadas en vivo (§4); voucher excluido (modal + área impresa sin nombres, §4) |
| Transversal | 8 | Este documento: contrato SQL real, mediciones, experiencia, checks finales |

## 7. Revisión de integridad de la rama

- `git diff --check`: limpio (sin espacios/trailing issues).
- Rama por delante con 7 commits de feature, cada uno con su revisión independiente registrada en el ledger SDD (`.superpowers/sdd/2026-11-10-mejoras-transversales/tarea-N-report.md` + revisiones).
- Sin migraciones nuevas (la última migration previa al plan sigue siendo la última); sin cambios en `src/config/permisos.ts` ni en `roles_permisos`; sin cambios en el contrato ni render del voucher; sin dependencias nuevas en `package.json`.
- Scaffolding temporal (semilla, sesión JWT, medición) vive solo en `.superpowers/` (gitignored) y en `/tmp`; la BD se destruye al `docker stop aps-mejoras-mysql` por el `--rm` del contenedor.

## 8. Pendientes y límites conocidos

- Avisos `act()` y Recharts del baseline (previos al plan) siguen presentes; fuera de alcance de este plan.
- Deuda heredada documentada por la revisión final: los filtros RUT y sector (Comunicador) y el `contains` de sector del Gestor preceden al plan y no escapan `%`/`_`; el contrato de literalidad acordado cubre solo el campo `texto` nuevo. Anotar como candidato a REQ futuro.
- Desempate de `resolverAgendaCita` por ID es lexicográfico (determinista, cumple el spec); documentar la convención si las IDs reales cambian de longitud.
- Persistencia del orden manual entre visitas: fuera de alcance (el orden es «de esta página» por diseño).
- Límites de medición según §3; no se promete latencia de producción a partir de la muestra local.
