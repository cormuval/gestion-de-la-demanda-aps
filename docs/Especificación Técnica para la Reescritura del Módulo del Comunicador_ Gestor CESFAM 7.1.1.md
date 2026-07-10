### Especificación Técnica para la Reescritura del Módulo del Comunicador: Gestor CESFAM 7.1.1

#### 1\. Contexto Estratégico y Objetivo de la Migración

El proyecto  **Gestor CESFAM 7.1.1**  es el núcleo de la gestión de demanda de salud primaria para la Corporación Municipal de Valparaíso. Este documento técnico define la hoja de ruta estructural para migrar la actual arquitectura "no-code" de AppSheet hacia un ecosistema moderno basado en  **Next.js** . La prioridad absoluta de esta transición es capturar la lógica de negocio proactiva y asegurar la continuidad operativa de los centros de salud.El  **Módulo del Comunicador**  actúa como el orquestador de interacciones entre pacientes y servicios. Su estabilidad depende de la interconexión precisa entre las tablas de llamadas, solicitudes y citas. Una interpretación superficial de estos metadatos durante la migración no solo generaría deuda técnica, sino que comprometería la seguridad del paciente. Como arquitectos, nuestra misión es transformar un sistema de hojas de datos en una aplicación robusta con integridad referencial garantizada.

#### 2\. Arquitectura de Datos: Entidades y Estrategia de Normalización

En el sistema AppSheet original, la data está distribuida en tablas que suman  **417 columnas** , lo que representa un riesgo crítico de redundancia y "God Tables". La reescritura en Next.js exige una estrategia de  **normalización de base de datos**  para descomponer estas entidades en sub-tablas relacionadas mediante Prisma o Drizzle.

##### 2.1. Análisis de Entidades Críticas

Un desafío técnico inmediato es el manejo del  **RUT como Clave Primaria (PK)** . En Chile, el RUT es un string con dígito verificador; para el nuevo backend, se recomienda el uso de  **UUIDs**  como llaves primarias internas, manteniendo el RUT como un campo unique indexado y aplicando funciones de sanitización (limpieza de puntos y guiones) antes de la persistencia.| Entidad de Origen | Claves Primarias / Foráneas | Impacto y Transformación en Next.js || \------ | \------ | \------ || **llamadas** | id\_llamada (PK), rut\_usuario (FK), id\_centro (FK) | **Acción:**  Implementar como tabla transaccional. Las relaciones REF\_ROWS deben resolverse mediante .findMany({ include: { usuario: true } }). || **usuarios** | rut (PK), centro\_id (FK) | **Alerta:**  Posee excesivas columnas. Se debe normalizar dividiendo datos demográficos de datos clínicos/administrativos. || **solicitudes** | id\_solicitud (PK), rut\_usuario (FK) | **Virtual Aggregation:**  La columna cantidad\_solicitudes (COUNT SELECT) debe ser una consulta agregada dinámica (prisma.solicitud.count) para evitar desincronización de caché. || **centros** | id\_centro (PK) | Base para la segmentación multi-tenancy. El id\_centro debe inyectarse en el contexto de la sesión del funcionario. |

#### 3\. Lógica de Negocio y Transformación de Columnas Virtuales

Las "App Formulas" de AppSheet contienen la inteligencia clínica del sistema. Estas deben portarse como lógica de servidor (Server-side utilities) para evitar discrepancias entre la base de datos y la interfaz.

##### 3.1. Cálculo de Edad y Priorización (Crítico)

Para el cálculo de la  **Priorización Administrativa (PA)** , no basta con una resta de años. Debemos replicar la fórmula exacta de la columna edad (Imagen 34\) para evitar errores de redondeo en pacientes pediátricos o geriátricos:

* **Lógica**  **edad**  **:**  (YEAR(TODAY()) \- YEAR(Fecha\_Nacimiento)) \- Offset.  
* **Offset:**  1 si el mes actual es menor al de nacimiento, o si siendo el mismo mes, el día actual es menor. De lo contrario, 0\.

  ##### 3.2. Fórmula de Priorización Administrativa (PA)

  El score de atención se reconstruye bajo estos parámetros (Imagen 30):  
* **Discapacidad:**  \+5 puntos si el usuario tiene credencial o es cuidador principal.  
* **Ciclo Vital:**  
* Mayores de 60 años: \+1 punto.  
* Menores de 5 años: \+3 puntos.  
* **Gestación:**  \+3 puntos si gestante \== "Si".  
* **Factor de Desviación:**  ABS(edad \- 20\) \* 0.03.

  ##### 3.3. Gestión de Contacto y Fallbacks

* **telefonos**  **:**  Lógica de concatenación proactiva. Si existen ambos teléfonos, usar el separador " \- ". Si ambos son nulos, mostrar "Sin telefono(s) registrados".  
* **correo**  **:**  Priorizar correo\_contacto. Si es nulo, el sistema  **debe**  devolver exactamente el literal: "Correo electrónico de contacto no registrado" (Imagen 33).

  #### 4\. Matriz de Permisos y Control de Acceso (RBAC)

  El análisis del "Update Mode" revela inconsistencias graves en la arquitectura original que deben resolverse durante la migración. No existe un permiso uniforme por rol.

  ##### 4.1. Conflictos de Permisos Identificados

  Como se observa en los esquemas de seguridad (Imágenes 2, 4, 5), los permisos para el  **Rol 10**  varían arbitrariamente:  
* **Tabla**  **usuarios**  **:**  READ\_ONLY.  
* **Tabla**  **solicitudes**  **:**  ADDS\_AND\_UPDATES.  
* **Tabla**  **citas**  **:**  ALL\_CHANGES.**Recomendación de Seguridad:**  Se debe unificar la jerarquía. Además, es imperativo eliminar el "Backdoor" identificado en la tabla funcionarios (Imagen 3), donde correos específicos como modernizacion@cmvalparaiso.cl tienen ALL\_CHANGES hardcoded. Esto se reemplazará por un rol de  **Super Admin**  gestionado vía Auth.js.

  ##### 4.2. Implementación Técnica

  La seguridad no puede limitarse al Middleware de rutas. Para replicar el "Update Mode" de AppSheet, se debe implementar  **seguridad a nivel de campo** :  
* **Zod Schemas:**  Definir esquemas de validación que omitan campos protegidos según el rol\_id.  
* **Prisma Middleware/Extensions:**  Bloquear mutaciones en tablas específicas (motivos, prestaciones) para roles operativos, permitiendo solo lectura.

  #### 5\. Procesos de Automatización y Workflows

  Los procesos automáticos identificados en las State Tables y StepOutput (Imagen 7, 8\) deben migrarse como operaciones atómicas.  
1. **Generar cita de rechazo:**  Proceso crítico cuando la demanda supera la oferta.  
2. **Detectar Policonsultantes:**  Análisis histórico de la tabla solicitudes.  
3. **Integridad Transaccional:**  Al registrar una llamada que genera un rechazo, se debe utilizar  **prisma.$transaction** . Esto garantiza que el log de la llamada y la generación de la cita de rechazo ocurran simultáneamente o fallen juntas, evitando huérfanos de datos.Estos workflows deben ejecutarse como  **Server Actions**  en Next.js para asegurar que la lógica de negocio nunca quede expuesta en el lado del cliente.

   #### 6\. Hoja de Ruta para la Implementación en Next.js

   Para transformar exitosamente las 21 tablas y 417 columnas, el equipo de desarrollo debe adherirse a las siguientes directrices:  
* **Estrategia de Tipado:**  Modelar interfaces estrictas de TypeScript para cada entidad normalizada. La sanitización de RUTs debe ser parte de la capa de servicios.  
* **Componentización de UI:**  Crear componentes "Smart" para el Comunicador que encapsulen la lógica de telefonos y el cálculo de PA en tiempo real, permitiendo supervisión clínica inmediata.  
* **Optimización de Datos:**  Utilizar  **React Server Components (RSC)**  para la visualización de listas de solicitudes, aprovechando el fetching en el servidor para filtrar por id\_centro antes de enviar datos al cliente.  
* **Gestión de Agregados:**  Migrar columnas como cantidad\_solicitudes a queries SQL de agregación para evitar la sobrecarga de datos en el cliente.Este documento técnico constituye la base estructural definitiva para la modernización del sistema, garantizando un entorno escalable que proteja la integridad de la salud pública en Valparaíso.  
  