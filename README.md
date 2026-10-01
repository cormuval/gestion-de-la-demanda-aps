# Gestion de la Demanda — APS Valparaiso

Sistema web que apoya a los centros de salud de atencion primaria de Valparaiso a gestionar la
demanda de atencion de sus pacientes: desde que se recibe una solicitud hasta que el paciente queda
coordinado para recibir su prestacion.

## Como funciona

1. **Ingreso de solicitudes.** El equipo registra lo que el paciente necesita (prestacion, motivo,
   prioridad), viendo antes lo que ya tiene pendiente para no duplicar solicitudes.
2. **Revision y gestion.** Las solicitudes se revisan, se realizan o se rechazan. Al gestionarlas se
   generan las citas y, en el mismo espacio, quedan a la vista las demas solicitudes y citas
   pendientes del paciente.
3. **Contacto telefonico.** Desde la cola de llamadas se contacta al paciente para coordinar la
   entrega de la prestacion, registrando cada intento y su resultado.

El sistema esta pensado **en el paciente completo**: en cada etapa muestra lo que ya existe para el,
de modo que no se repitan acciones y las revisiones y llamadas sean eficientes.

## Complementos

- **Dashboard:** indicadores de solicitudes, citas y llamados.
- **SOME:** panel de seguimiento de citas por centro.
- **Configuracion:** funcionarios, roles y permisos, y catalogos (tipos de solicitud, motivos,
  prestaciones, profesionales).

## Acceso

Ingresan solo funcionarios registrados y activos, con su cuenta Google. Lo que cada
uno ve y puede hacer depende de los permisos de su rol y de su centro.

## Desarrollo

Aplicacion Next.js + MySQL. Stack, puesta en marcha local, convenciones y metodologia de trabajo:
ver [AGENTS.md](./AGENTS.md). Decisiones de diseno de cada funcionalidad: `docs/superpowers/specs/`.
