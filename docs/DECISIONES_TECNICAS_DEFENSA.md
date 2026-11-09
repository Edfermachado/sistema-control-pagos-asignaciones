# Guía de Estudio y Sustentación para la Defensa: Decisiones Técnicas y Arquitectónicas

**Universidad de Carabobo — Escuela de Computación**  
**Asignatura:** Sistemas de Información  
**Proyecto:** Sistema de Control de Pagos y Asignaciones (USD)

Este documento explica el **porqué** detrás de cada decisión arquitectónica, tecnológica y de modelado de base de datos del proyecto. Está diseñado como material de estudio para que los 4 integrantes del equipo puedan sustentar con rigor técnico cualquier pregunta del jurado durante la defensa.

---

## 1. Arquitectura General: ¿Por qué Cliente-Servidor Desacoplado con Arquitectura Modular?

### Decisión Tomada
Se implementó una arquitectura **Cliente-Servidor 100% desacoplada** dividida en tres contenedores/capas principales:
1. **Capa de Presentación (Cliente):** Single Page Application (SPA) con **React + Vite + TypeScript**.
2. **Capa de Aplicación y Dominio (Servidor API):** API RESTful con **NestJS + TypeScript** organizada en módulos y capas (`Controller` $\rightarrow$ `Service` $\rightarrow$ `Prisma/Repository`).
3. **Capa de Datos (Persistencia):** Base de datos relacional **PostgreSQL 16**.

### ¿Por qué se eligió esta arquitectura y no un monolito tradicional o SSR híbrido (como Next.js)?
* **Separación estricta de responsabilidades (Requerimiento de Arquitectura):** Al usar **React + Vite** en el frontend y **NestJS** en el backend, existe una frontera física y lógica clara entre el cliente (que solo renderiza la interfaz y gestiona estado visual) y el servidor (que ejecuta las reglas de negocio, validaciones financieras, seguridad y acceso a datos). Si se hubiese usado Next.js, existirían dos servidores Node.js (el de Next y el de la API), difuminando la frontera cliente-servidor.
* **Arquitectura Modular en Capas dentro del Servidor (NestJS):**
  * **Controladores (`*.controller.ts`):** Únicamente reciben peticiones HTTP, validan el formato de entrada mediante DTOs (`class-validator`) y devuelven códigos de estado HTTP. **No contienen lógica financiera.**
  * **Servicios (`*.service.ts`):** Contienen toda la lógica de negocio (cálculo de prorrateo, cola FIFO de pagos parciales, validación de transiciones de estado y reglas de cajas chicas).
  * **Capa de Acceso a Datos (`PrismaService` / Transacciones SQL):** Encapsula las consultas relacionales y garantiza la atomicidad (`ACID`).
* **Defensa ante el jurado:** *"Separamos las capas de manera que si mañana la empresa desea cambiar la interfaz web por una aplicación móvil, el Backend y sus reglas financieras (prorrateo, FIFO, inmutabilidad y auditoría) permanecen intactos sin modificar una sola línea de código."*

---

## 2. Decisiones del Stack Tecnológico

### 2.1. ¿Por qué TypeScript en todo el proyecto (Full-Stack)?
* En un sistema financiero que maneja dinero (USD), cálculos de días activos y saldos pendientes, un error de tipos en tiempo de ejecución (como concatenar `"100" + "50" = "10050"` en lugar de sumar `150`) sería crítico.
* TypeScript aporta **tipado estático compilado**, contratos claros mediante interfaces y DTOs, y autocompletado seguro entre el modelo de datos de Prisma y los servicios de NestJS.

### 2.2. ¿Por qué PostgreSQL como Base de Datos Relacional?
1. **Cumplimiento ACID y Nivel de Aislamiento Transaccional:** Cuando se registra una entrega de fondos con aplicación **FIFO**, se deben actualizar múltiples registros de causación (`accruals`), insertar el pago (`payments`), crear el desglose (`payment_allocations`) y registrar la auditoría (`audit_logs`). PostgreSQL ejecuta todo esto dentro de una transacción atómica (`BEGIN ... COMMIT`): o se aplica todo el pago correctamente, o se hace `ROLLBACK` completo ante cualquier fallo.
2. **Tipo de dato exacto `NUMERIC(12, 2)` / `DECIMAL`:** Jamás se debe usar `FLOAT` o `REAL` (IEEE 754) para representar dinero, porque en punto flotante binario `0.1 + 0.2 = 0.30000000000000004`. PostgreSQL maneja `NUMERIC(12, 2)` con precisión decimal exacta para almacenar dólares y centavos sin pérdida por redondeo.
3. **Soporte nativo para `JSONB`:** Ideal para la tabla `audit_logs`, permitiendo guardar la fotografía exacta del registro antes (`old_values`) y después (`new_values`) de cada operación sin perder la estructura relacional del resto del sistema.

### 2.3. ¿Por qué Docker y Docker Compose?
* Resuelve el problema clásico de *"en mi máquina sí funcionaba"*.
* Empaqueta la base de datos PostgreSQL, el servidor NestJS y el cliente React en contenedores aislados con una red interna, cumpliendo el requerimiento de **Despliegue simulando un ambiente de producción** con un solo comando (`docker compose up --build`).

---

## 3. Decisiones de Diseño de Reglas de Negocio (Dominio Financiero)

### 3.1. Segregación de Funciones (RBAC) y por qué los Beneficiarios NO son Usuarios
* **Decisión:** Existen dos tablas completamente separadas: `users` (operadores del sistema con credenciales y rol) y `beneficiaries` (el personal de física, química y biología que cobra por trabajar en los proyectos).
* **Justificación:**
  1. El enunciado establece explícitamente que *"Los beneficiarios (el personal que cobra) NO tendrán usuario en el sistema"*. Mezclarlos en una sola tabla `users` con contraseñas nulas violaría la Tercera Forma Normal (3FN) y abriría brechas de seguridad.
  2. La **Segregación de Funciones** se implementa mediante un `RolesGuard` en NestJS:
     * **Administrador (`ADMIN`):** Configura usuarios, parámetros y catálogos base, pero recibe un `403 Forbidden` si intenta invocar endpoints de causación, solicitudes de pago o cajas chicas.
     * **Generador de Nómina (`GENERADOR`):** Administra proyectos, beneficiarios y asignaciones; ejecuta el motor de causación y crea/envía solicitudes de pago, pero **no puede aprobarlas ni desembolsar fondos**.
     * **Receptor de Nómina (`RECEPTOR`):** Aprueba o rechaza las solicitudes enviadas por el Generador y registra la entrega efectiva de fondos, además de aprobar aperturas y vales de cajas chicas.
  3. **Principio de Control Interno (Cuatro Ojos):** Ninguna persona en la organización puede crear una deuda ficticia y pagársela a sí misma sin pasar por otro rol distinto.

### 3.2. Motor de Causación y Prorrateo Exacto
* **Problema:** Una persona puede ingresar a un proyecto después de iniciado el período de pago (o su asignación puede terminar antes del cierre del período). Pagarle el período completo generaría un sobrepago.
* **Decisión Algorítmica:**
  $$\text{Días Activos} = \max\left(0,\; \min(\text{Fin Período}, \text{Fin Asignación}) - \max(\text{Inicio Período}, \text{Inicio Asignación}) + 1\right)$$
  $$\text{Monto Causado} = \text{Redondear}_{2}\left(\text{Monto por Período} \times \frac{\text{Días Activos}}{\text{Días Totales del Período}}\right)$$
* **Justificación:** Calcula la intersección exacta de intervalos de fechas entre el período del grupo de pago y la vigencia de la asignación/proyecto, usando aritmética decimal (`Decimal.js`) antes de persistir en PostgreSQL.

### 3.3. Algoritmo FIFO (First-In, First-Out) para Pagos Parciales
* **Problema:** Si a un investigador se le adeudan \$300 del Período 1 (Enero) y \$300 del Período 2 (Febrero) —total \$600— y la empresa realiza un pago parcial de \$400, ¿a qué deuda se abona ese dinero?
* **Decisión Algorítmica:**
  1. Al registrar un pago de monto $M$, el servicio consulta todas las causaciones (`accruals`) con saldo pendiente (`balance_due > 0`) asociadas a la solicitud/beneficiario, ordenadas cronológicamente por fecha de inicio de período (`ORDER BY period_start ASC, id ASC`).
  2. Itera sobre la cola:
     * Para el Período 1 (deuda \$300): aplica $\min(400, 300) = \$300$. El Período 1 pasa a estado `PAGADO` (`balance_due = 0`) y quedan \$100 por distribuir.
     * Para el Período 2 (deuda \$300): aplica $\min(100, 300) = \$100$. El Período 2 pasa a estado `PARCIAL` (`paid_amount = 100`, `balance_due = 200`) y quedan \$0 por distribuir.
  3. Cada aplicación individual se guarda en la tabla puente `payment_allocations` (`payment_id`, `accrual_id`, `allocated_amount`).
* **Justificación:** La tabla puente `payment_allocations` permite responder con exactitud milimétrica qué porcentaje de cada recibo pagó qué período histórico, y permite revertir el pago de forma determinista si ocurre una anulación.

### 3.4. Inmutabilidad Financiera y Anulaciones Justificadas
* **Decisión:** En los controladores y servicios financieros **no existen endpoints `DELETE` ni `PUT/PATCH` para modificar montos** de causaciones, pagos o recibos ya emitidos.
* **¿Cómo se corrige un error humano?**
  * A través del proceso de **Anulación Justificada** (`POST /annulments`), que exige un motivo obligatorio (`reason`), registra quién anuló y cuándo, cambia el estado del documento original a `ANULADO` y revierte matemáticamente los saldos acumulados en una transacción atómica, dejando el rastro histórico intacto para los auditores.

### 3.5. Flujo Segregado en Control de Cajas Chicas
* **Decisión:** El **Generador (Coordinador)** solicita la apertura o los vales de gasto y sube los comprobantes de rendición; el **Receptor (Gerente de Administración)** aprueba la apertura, autoriza el vale, registra el desembolso y ejecuta el cierre con arrastre de saldo al mes siguiente:
  $$\text{Saldo Inicial Mes } (t+1) = \text{Saldo Disponible al Cierre del Mes } (t)$$
* **Justificación:** Mantiene la coherencia con el principio de control interno del resto del sistema: quien ejecuta el gasto operativo en el laboratorio/proyecto (Coordinador) rinde cuentas ante quien administra la tesorería (Gerencia).

### 3.6. Auditoría Completa (`audit_log`)
* **Decisión:** Implementar un interceptor/servicio transversal en el Backend que registre automáticamente en la tabla `audit_logs` cada operación de escritura (`CREATE`, `UPDATE`, `STATUS_CHANGE`, `ANNULMENT`), almacenando:
  * `user_id` y rol del autor.
  * `table_name` y `record_id` afectado.
  * `old_values` y `new_values` en formato `JSONB`.
  * `created_at` (timestamp exacto en UTC) e `ip_address`.
* **Justificación:** Garantiza trazabilidad forense completa sobre quién creó, aprobó, pagó o anuló cualquier registro del sistema.

---

## 4. Posibles Preguntas del Jurado y Cómo Responderlas

1. **¿Qué pasa si dos usuarios intentan pagar o aprobar la misma solicitud al mismo tiempo (condición de carrera)?**
   * *Respuesta:* Se ejecuta dentro de una transacción de base de datos verificando el estado actual del registro (`WHERE id = $1 AND status = 'APROBADA'`) o utilizando bloqueo pesimista (`SELECT ... FOR UPDATE`). Si el primer usuario ya cambió el estado, la segunda petición falla de forma controlada indicando que el estado ya fue modificado.
2. **¿Por qué no usaron un trigger en la base de datos para calcular el prorrateo o el FIFO en vez de hacerlo en la capa de Servicios de NestJS?**
   * *Respuesta:* Porque en una arquitectura en capas limpia, la lógica de negocio compleja debe residir en la **Capa de Dominio/Aplicación (Servicios)** donde puede ser probada mediante **Pruebas Unitarias (Vitest/Jest)** de forma aislada y mantenible, dejando a la base de datos la responsabilidad de integridad referencial y transacciones ACID.
3. **¿Cómo evitan que alguien borre un pago directamente o modifique su monto desde la aplicación?**
   * *Respuesta:* Aplicamos el patrón de **Inmutabilidad Contable (Append-Only / Estado Anulado)**: la API no expone métodos de borrado físico ni edición de importes financieros. Cualquier corrección exige crear un registro de `Anulación Justificada` que revierte los saldos en `payment_allocations` y queda registrado en `audit_logs`.
