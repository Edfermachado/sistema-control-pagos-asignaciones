# Bitácora de Uso de Inteligencia Artificial (Entregable #5)

**Universidad de Carabobo — Escuela de Computación**  
**Asignatura:** Sistemas de Información  
**Proyecto:** Sistema de Control de Pagos y Asignaciones

De acuerdo con la sección **4. Entregables del Proyecto (Punto 5 - Uso de IA)**, este documento registra de manera transparente las indicaciones (prompts) suministradas al asistente de Inteligencia Artificial generativa, el propósito de cada interacción y la validación/sustentación técnica aplicada por el equipo de desarrollo.

---

## Registro Cronológico de Interacciones (Prompts y Decisiones)

### Interacción #1 — Análisis de Requerimientos y Planificación por Etapas
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Crea un plan de desarrollo por etapas para este proyecto, pregúntame lo que necesites"* (adjuntando el enunciado oficial del proyecto de Sistemas de Información - UC).
* **Parámetros definidos por el equipo:**
  * Stack: TypeScript Full-Stack (React +Node.js + PostgreSQL).
  * Duración: 2 a 3 semanas (intensivo) para un equipo de 4 integrantes.
  * Prioridades adicionales: Docker Compose, pruebas unitarias para el motor financiero (prorrateo, FIFO e inmutabilidad) y bitácora de uso de IA desde el día 1.
* **Resultado generado y validado:**
  * Se estructuró un plan de trabajo dividido en 5 etapas (Etapa 0 a Etapa 4) y una matriz de responsabilidades para los 4 integrantes del equipo sin bloqueos cruzados.

---

### Interacción #2 — Definición Arquitectónica, Documentación de Defensa y Repositorio Inicial
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Hazlo con la arquitectura modular y en el segundo caso explícame las ventajas y desventajas"*  
  > *"Usa React + Vite y el enfoque de flujo segregado, crea un documento explicando el porqué de cada decisión técnica para estudiar la defensa, así como crea el repo público en GitHub con el README del proyecto antes de empezar a construirlo, deberías poder hacerlo desde la terminal ya que tengo mi sesión iniciada"*
* **Decisiones arquitectónicas adoptadas por el equipo tras evaluar ventajas y desventajas:**
  1. **Backend con Arquitectura Modular en NestJS:** Separación estricta en `Controllers` (HTTP/DTOs), `Services` (reglas de negocio: prorrateo, FIFO, inmutabilidad) y `Prisma/PostgreSQL` (persistencia ACID con tipos decimales exactos `NUMERIC(12,2)`).
  2. **Frontend SPA con React + Vite:** Se eligió sobre Next.js para garantizar una separación Cliente-Servidor 100% pura (un único servidor backend en NestJS y un cliente puro en el navegador), facilitando su sustentación académica y reduciendo el consumo de recursos en Docker.
  3. **Flujo Segregado en Cajas Chicas:** El rol *Generador (Coordinador)* solicita vales y rinde comprobantes, mientras que el rol *Receptor (Gerente de Administración)* aprueba aperturas, autoriza vales, desembolsa y cierra el período mensual con arrastre de saldo, cumpliendo estrictamente el principio de Segregación de Funciones.
* **Artefactos generados:**
  * `docs/DECISIONES_TECNICAS_DEFENSA.md`: Documento de estudio técnico y justificación arquitectónica.
  * `docs/BITACORA_IA.md`: Este registro de trazabilidad de uso de IA.
  * `README.md`: Documentación principal del repositorio.


---

### Interacción #3 — Definición de Reglas de Negocio (`RN-*`) y Guardrails para Agentes de IA del Equipo
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Creemos reglas de negocios en base a los requerimientos ya que todos trabajaremos usando agentes e IA, así nadie se sale de los marcos, definamos eso"*
* **Invariantes de negocio acordadas por el equipo:**
  1. **Multiplicidad de asignaciones (`RN-CAT-04`):** Un beneficiario puede tener asignaciones activas en distintos proyectos simultáneamente, pero no duplicadas/solapadas en el mismo proyecto.
  2. **Base de cálculo de prorrateo (`RN-CAUS-01`):** Se utilizan los días calendario reales e inclusivos del período (`fecha_fin - fecha_inicio + 1`).
  3. **Vigencia de proyectos (`RN-CAT-02`):** Se bloquean nuevas causaciones fuera del rango `[start_date, end_date]` del proyecto, pero se permite liquidar/pagar deudas que ya fueron causadas válidamente antes del vencimiento.
  4. **Tope estricto en Cajas Chicas (`RN-CAJA-02`):** Prohibido el saldo negativo; ningún vale puede aprobarse ni desembolsarse por encima del saldo disponible actual de la caja chica.
* **Artefactos generados:**
  * `docs/REGLAS_DE_NEGOCIO.md`: Catálogo formal codificado (`RN-GLOB`, `RN-SEG`, `RN-CAT`, `RN-CAUS`, `RN-PAG`, `RN-CAJA`, `RN-AUD`).
  * `.agent/rules/reglas-proyecto.md` y `AGENTS.md`: Reglas automáticas de espacio de trabajo para que cualquier agente de IA usado por los 4 integrantes respete el mismo marco arquitectónico y actualice esta bitácora.


---

### Interacción #4 — Definición de Estándares de Desarrollo, Clean Code y Pruebas Unitarias 1:1
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Ahora vamos a definir reglas de desarrollo, como crear unitest por cada función, y siga patrones de clean code"*
* **Estándares de ingeniería y pruebas establecidos:**
  1. **Clean Code (`CC-01` a `CC-06`):** Prohibición total de `any` en TypeScript; Principio de Responsabilidad Única (funciones de máx. 25–35 líneas); separación de algoritmos matemáticos en **funciones puras deterministas** desacopladas de I/O; prohibición de números/strings mágicos usando `Enums` tipados; lenguaje ubicuo consistente y uso de *Guard Clauses* referenciando el código de regla (`[RN-...]`).
  2. **Unit Testing 1:1 por Función (`TEST-01`):** Ninguna función de servicio o calculadora de dominio se da por terminada sin su archivo `*.spec.ts` estructurado con el patrón **AAA (Arrange, Act, Assert)** y probando como mínimo 3 escenarios: *Happy Path*, *Edge Case* y *Violación de regla `RN-*`*.
  3. **Integración en Guardrails de Agentes:** Se actualizaron `.agent/rules/reglas-proyecto.md` y `AGENTS.md` para obligar a los agentes de IA del equipo a escribir y ejecutar las pruebas unitarias de cada función antes de dar por completada cualquier tarea.
* **Artefactos generados/modificados:**
  * `docs/ESTANDARES_DESARROLLO_CLEAN_CODE.md`
  * `.agent/rules/reglas-proyecto.md`, `AGENTS.md` y `README.md`


---

### Interacción #5 — Ejecución de Etapa 0: Infraestructura Docker, Esquema Relacional y Módulos Fundacionales con Unit Tests 1:1
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Vamos con la etapa 0"*
* **Artefactos y módulos implementados:**
  1. **Orquestación de Contenedores:** `docker-compose.yml` y `.env.example` configurados para levantar `postgres:16-alpine`, `backend` (NestJS) y `frontend` (React + Vite con Nginx).
  2. **Esquema de Base de Datos Relacional (`backend/prisma/schema.prisma` y `database/01_init_schema.sql`):**
     * 17 tablas relacionales normalizadas con claves foráneas `ON DELETE RESTRICT` e importes monetarios en `NUMERIC(12, 2)` (`RN-GLOB-02`).
     * Separación física entre `users` y `beneficiaries` (`RN-SEG-01`).
     * Soporte nativo para lotes de causación (`accrual_batches`), causaciones individuales (`accruals`), solicitudes de pago (`payment_requests`), entregas de fondos (`payments`), tabla puente FIFO (`payment_allocations`), anulaciones justificadas (`annulments`), cajas chicas con arrastre mensual (`petty_cashes`, `petty_cash_periods`, `petty_cash_vouchers`) y bitácora inmutable (`audit_logs`).
  3. **Backend Modular (`/backend` - NestJS) con Unit Tests 1:1 (`TEST-01`):**
     * `common/constants/domain.enums.ts`: Enums tipados y constantes sin valores mágicos (`CC-04`).
     * `common/domain/money.helper.ts` y `money.helper.spec.ts`: Funciones puras `toUsdDecimal`, `assertPositiveUsdAmount` y `validateAnnulmentReason` usando `Decimal.js`, probadas con patrón AAA (Happy Path, Edge Case y Violación `RN-GLOB`).
     * `modules/health/health.service.ts` y `health.service.spec.ts`: Verificación de salud del servidor y conexión PostgreSQL con pruebas unitarias aisladas mediante mocks.
  4. **Frontend SPA (`/frontend` - React + Vite + TypeScript) con Unit Tests 1:1 (`TEST-01`):**
     * `src/utils/currency.util.ts` y `currency.util.spec.ts`: Formateador visual en USD (`formatUsdCurrency`) con su suite de pruebas en Vitest.


---

### Interacción #6 — Ejecución de Etapa 1: Autenticación JWT, Segregación de Roles (RBAC), Auditoría Inmutable y Gestión de Catálogos con Unit Tests 1:1
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Continua con la etapa 1"*
* **Módulos, Reglas de Negocio (`RN-*`) y Clean Code (`CC-*` / `TEST-01`) implementados:**
  1. **Criptografía y Autenticación JWT (`backend/src/common/security/crypto.helper.ts`, `auth.service.ts`):**
     * Hash de contraseñas con sal aleatoria usando `node:crypto` (`scryptSync` + `timingSafeEqual`) y firma/verificación de tokens JWT HS256 sin dependencias externas vulnerables.
     * Guardias `JwtAuthGuard` y `RolesGuard` que aplican estrictamente la matriz de Segregación de Funciones (`RN-SEG-02`), devolviendo `403 Forbidden` ante cualquier intento de cruce de funciones.
  2. **Módulo de Auditoría Inmutable (`backend/src/modules/audit/audit.service.ts` — `RN-AUD-03`):**
     * Servicio global *Append-Only* (`recordLog` y `findAllLogs`) que registra `userId`, `userRole`, `action`, `tableName`, `recordId`, `oldValues` y `newValues` en JSONB, con soporte para transacciones Prisma (`tx`).
  3. **Módulo de Usuarios (`backend/src/modules/users/users.service.ts` — `RN-SEG-02`):**
     * Exclusivo para `ADMIN`. Creación de usuarios con rol tipado, listado seguro sin exponer `passwordHash` y activación/desactivación con bloqueo de auto-desactivación del Administrador en sesión.
  4. **Módulo de Beneficiarios (`backend/src/modules/beneficiaries/beneficiaries.service.ts` — `RN-SEG-01`):**
     * Gestión del personal de Física, Química y Biología en tabla independiente (`beneficiaries`) sin usuario ni credenciales de sistema, validando unicidad de DNI/Cédula.
  5. **Módulo de Proyectos y Vigencia (`backend/src/modules/projects/projects.service.ts` y `project-validity.helper.ts` — `RN-CAT-01`, `RN-CAT-02`):**
     * Funciones puras `assertValidProjectDateRange` y `assertProjectAllowsNewAccruals` que validan áreas científicas (`FISICA`, `QUIMICA`, `BIOLOGIA`), ámbitos (`INTERNO`, `EXTERNO`) y bloqueo de nuevas causaciones fuera del rango de vigencia.
  6. **Módulos de Grupos de Pago y Asignaciones (`payment-groups.service.ts`, `assignments.service.ts` y `assignment-overlap.helper.ts` — `RN-CAT-03`, `RN-CAT-04`):**
     * Función pura `assertValidAssignmentWindowAndNoOverlap` que permite a un beneficiario trabajar en varios proyectos simultáneamente pero impide asignaciones solapadas en fechas dentro del mismo proyecto.
  7. **Frontend React + Vite (`frontend/src/utils/rbac.util.ts`, `App.tsx`):**
     * Matriz de permisos en cliente (`getRolePermissions`, `getRoleDisplayLabel`) y vista interactiva de catálogos y bitácora de auditoría por rol.
  8. **Verificación de Pruebas Unitarias 1:1 (`TEST-01`):**
     * **Backend:** 14 suites pasadas (`90/90 unit tests` en verde con patrón AAA) + `nest build` exitoso.
     * **Frontend:** 2 suites pasadas (`9/9 unit tests` en verde con Vitest) + `vite build` exitoso.


---

### Interacción #7 — Ejecución de Etapa 2: Motor de Causación Prorrateada, Solicitudes de Pago, Cola FIFO y Anulaciones Justificadas con Unit Tests 1:1
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Continua con la etapa 2"*
* **Módulos, Reglas de Negocio (`RN-*`) y Clean Code (`CC-*` / `TEST-01`) implementados:**
  1. **Motor de Causación y Prorrateo (`backend/src/modules/accruals` — `RN-CAUS-01` a `04`):**
     * Funciones puras `calculateTotalCalendarDays` y `calculateProratedAccrual` (`proration.calculator.ts`) que calculan los días calendario reales inclusivos $(\text{fin} - \text{inicio}) + 1$ y la intersección exacta de días activos frente a la vigencia de la asignación y del proyecto usando `Decimal.js` (`ROUND_HALF_UP`).
     * `AccrualsService`: Previsualización (`previewAccrualBatch`) y generación transaccional de lotes (`generateAccrualBatch`) con bloqueo de duplicidad en el mismo período y creación de registros `Accrual` inmutables.
  2. **Ciclo de Solicitudes de Pago (`backend/src/modules/payment-requests` — `RN-PAG-01`):**
     * Máquina de estados pura `assertValidPaymentRequestTransition` y `assertPaymentRequestCanBeClosed` (`payment-request-state.machine.ts`) que hace cumplir el grafo dirigido `CREADA -> ENVIADA -> APROBADA | RECHAZADA -> ENTREGADA -> CERRADA`.
     * Segregación de funciones: `GENERADOR` crea y envía; `RECEPTOR` aprueba/rechaza y cierra cuando la deuda llega a `$0.00`.
  3. **Motor de Pagos Parciales con Prelación FIFO (`backend/src/modules/payments` — `RN-PAG-02`):**
     * Funciones puras `sortAccrualsForFifo` y `allocatePaymentFifo` (`fifo-allocator.calculator.ts`) que ordenan las deudas pendientes por antigüedad (`periodStart ASC, createdAt ASC, id ASC`), prohíben sobrepagos y abonan cada dólar desde la deuda más antigua hasta agotar el pago, dejando trazabilidad en `payment_allocations`.
  4. **Inmutabilidad Financiera y Anulaciones Justificadas (`backend/src/modules/annulments` — `RN-GLOB-03`, `RN-GLOB-04`, `RN-PAG-03`):**
     * Calculadora pura `calculateAccrualStateAfterPaymentReversal` (`annulment-reversal.calculator.ts`) y servicio transaccional `AnnulmentsService` (`annulPayment` y `annulUnpaidAccrual`) que corrigen errores exigiendo motivo obligatorio ($\ge 10$ caracteres) y revirtiendo matemáticamente los abonos FIFO sin borrar registros físicos.
  5. **Frontend React + Vite (`frontend/src/utils/financial-status.util.ts`, `FinancialEnginePanel.tsx`):**
     * Utilidades de estados financieros con pruebas unitarias en Vitest y panel demostrativo del motor de prorrateo y cola FIFO.
  6. **Verificación de Pruebas Unitarias 1:1 (`TEST-01`):**
     * **Backend (Jest):** 22 suites pasadas (`144/144 unit tests` en verde) + `nest build` exitoso.
     * **Frontend (Vitest):** 3 suites pasadas (`15/15 unit tests` en verde) + `vite build` exitoso.


---

### Interacción #8 — Ejecución de Etapa 3: Control de Cajas Chicas con Flujo Segregado y Arrastre de Saldo, Consultas Clave y Generación de Reportes PDF con Unit Tests 1:1
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Sí"* (confirmación para avanzar a la Etapa 3: Cajas Chicas, Consultas Clave y Reportes PDF).
* **Módulos, Reglas de Negocio (`RN-*`) y Clean Code (`CC-*` / `TEST-01`) implementados:**
  1. **Control de Cajas Chicas por Proyecto (`backend/src/modules/petty-cash` — `RN-CAJA-01` a `04`):**
     * Calculadora pura `petty-cash-balance.calculator.ts` (`assertValidYearMonth`, `calculateOpeningAvailableBalance`, `calculateBalanceAfterVoucherDisbursement`, `calculateBalanceAfterVoucherSettlement`, `assertPeriodCanBeClosed`).
     * Cumple **Regla de Tope Estricto (`RN-CAJA-02`):** Prohibición de saldo negativo; rechaza vales cuyo monto supere el `availableBalance`.
     * Cumple **Flujo Segregado (`RN-SEG-02`):** `GENERADOR` solicita apertura/vales y rinde con comprobante (`settleVoucher`); `RECEPTOR` aprueba apertura, desembolsa vales y cierra el período mensual congelando el `closingBalance` como `carryoverBalance` (arrastre automático de saldo al mes siguiente — `RN-CAJA-04`).
  2. **Consultas Clave y Generador PDF 1.4 Nativo (`backend/src/modules/reports` — `RN-AUD-01`, `RN-AUD-02`):**
     * `pdf-document.builder.ts`: Constructor puro de documentos binarios `%PDF-1.4` con tabla `xref` exacta sin librerías externas vulnerables.
     * `ReportsService`:
       * `getExecutiveSummaryAndDebts`: Responde cuánto se ha causado, cuánto se ha pagado y cuánto se le adeuda a cada persona por proyecto.
       * `generateIndividualReceiptPdf`: Emite el PDF del Recibo Individual con desglose de períodos cubiertos por **FIFO** y marca de agua si fue anulado.
       * `generateConsolidatedRequestPdf`: Emite el PDF de la Solicitud Consolidada de Pago agrupada por proyecto.
  3. **Frontend React + Vite (`frontend/src/utils/petty-cash.util.ts`, `PettyCashAndReportsPanel.tsx`):**
     * Utilidades de validación y porcentaje de ejecución de caja chica en cliente con pruebas unitarias en Vitest y panel visual de cajas chicas y reportes.
  4. **Verificación de Pruebas Unitarias 1:1 (`TEST-01`):**
     * **Backend (Jest):** 26 suites pasadas (`183/183 unit tests` en verde) + `nest build` exitoso.
     * **Frontend (Vitest):** 4 suites pasadas (`21/21 unit tests` en verde) + `vite build` exitoso.

---

### Interacción #9 — Ejecución de Etapa 4: Scripts de Semilla (`Seed`), Documentación Final (`README.md`) y Verificación Integral
* **Fecha:** Noviembre 2026
* **Herramienta / Modelo:** Antigravity Agent
* **Indicación (Prompt) del Usuario:**
  > *"Sí"* (Confirmación para iniciar la Etapa 4 final).
* **Resultado Generado y Validado por el Equipo:**
  1. **Fábrica Determinista de Semilla y Scripts SQL/Prisma (`backend/src/common/seed/seed-data.factory.ts`, `backend/prisma/seed.ts`, `database/02_seed_data.sql`):**
     * Creación de `buildDefaultSeedDataset` con su prueba unitaria `seed-data.factory.spec.ts` para verificar que los datos iniciales cumplan invariantes de negocio (`RN-SEG-01`, `RN-CAT-01`, `RN-GLOB-01`).
     * Script SQL idempotente (`ON CONFLICT DO NOTHING`) montado en `docker-compose.yml` (`/docker-entrypoint-initdb.d/02_seed_data.sql`) y script `prisma/seed.ts` con usuarios de los 3 roles (`admin@uc.edu.ve`, `coordinador@uc.edu.ve`, `gerente@uc.edu.ve`), proyectos de Física, Química y Biología, grupos de pago, beneficiarios sin cuenta de usuario, asignaciones, causación prorrateada, solicitud con pago parcial FIFO y caja chica con arrastre de saldo.
  2. **Documentación Final de Despliegue (`README.md`):**
     * Actualización con instrucciones paso a paso (Docker y manual), tabla de credenciales de prueba por rol y resumen completo de endpoints REST.
  3. **Verificación Final de Pruebas Unitarias 1:1 (`TEST-01`):**
     * **Backend (Jest):** 27 suites pasadas (`186/186 unit tests` en verde) + `nest build` exitoso.
     * **Frontend (Vitest):** 4 suites pasadas (`21/21 unit tests` en verde) + `vite build` exitoso.
