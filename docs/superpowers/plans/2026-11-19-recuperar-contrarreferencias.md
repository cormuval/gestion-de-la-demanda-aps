# Recuperar contrarreferencias enviadas a la BD antigua (04-11 al 17-11-2026)

## Contexto

Una version antigua del Apps Script de contrarreferencias quedo activa y, entre el 04-11 y el 17-11-2026,
escribio por JDBC en la BD antigua (`gestionDemanda`, vps-das) en vez de llamar al endpoint de gd. Son
234 solicitudes de tipo 18 (214 pendientes de validacion y 20 validadas con una cita cada una). Nadie
las trabajo en la BD antigua: no tienen llamadas.

Esa version no normalizaba el RUT ni el estado: 3 RUT con `k` minuscula (MySQL los une con el paciente
guardado con `K`, pero Prisma no, y `getSolicitudes` cae en el panic "Expected parent IDs") y estado
`En curso`. Por eso **no se copian por SQL**.

## Decision

Script `prisma/scripts/recuperar-contrarreferencias/` (`npm run recuperar:contrarreferencias`) que
registra cada caso con el mismo servicio del endpoint (`registrarContrarreferencia`):

- Valida con `contrarreferenciaSchema`, normaliza el RUT, verifica catalogos y no duplica (por
  `id_solicitud` y por la marca `Registro Contrarreferencia ID: n`). Re-ejecutar es seguro.
- Conserva el `id_solicitud`, la fecha de ingreso y, en las validadas, la cita con su fecha estimada
  original (reenviar desde el Apps Script la recalcularia desde hoy).
- Si el paciente ya existe no envia el telefono, para no reemplazar un dato mas reciente.
- Rechaza RUT con digito verificador invalido (2 casos, CR 4144 y 4464): se revisan en el origen y se
  cargan despues por el flujo normal.
- Sin `--ejecutar` solo simula. `--ejecutar` exige `--base=<base_destino>` igual a la de `DATABASE_URL`.

El archivo de entrada (JSON con datos de pacientes) se genera por solo lectura desde la BD antigua,
vive fuera del repo en el servidor y se borra al terminar.

## Ejecucion

1. Simulacion en `gestion_demanda_ensayo`: simular, `--limite=3`, carga completa, re-ejecucion
   (todo duplicado) y consulta Prisma con `include` de `getSolicitudes` sin panic. **Hecho 19-11-2026:**
   232 cargadas, 2 rechazadas, 20 citas con su fecha estimada original, horas iguales a las del endpoint.
2. Produccion (`gestion_demanda`), solo con orden explicita: respaldo `mysqldump` de `solicitudes`,
   `citas` y `usuarios`; simular; `--limite=3` y revisar; carga completa; re-ejecucion; revision en la app.
3. Avisar a los gestores que entran contrarreferencias del 04-11 al 17-11 con su fecha original.
4. La BD antigua queda intacta.
