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

---

### Interacción #10 — Ejecución de Etapa 5: Interfaz UI/UX Interactiva Full-Stack e Integración Cliente-Servidor (FACYT - UC)
* **Fecha:** Noviembre 2026
* **Herramienta / Modelo:** Antigravity Agent
* **Indicación (Prompt) del Usuario:**
  > *"Naturalmente, solo tenemos las funciones falta un plan de UI/UX ¿no? para que sea completamente utilizable y la facultad es en Facyt, corrige el readme"* / *"Sí"*
* **Resultado Generado y Validado por el Equipo:**
  1. **Cliente HTTP Tipado y Pruebas Unitarias (`frontend/src/utils/api-client.util.ts` + `.spec.ts`):**
     * Creación de `buildAuthHeaders`, `extractApiErrorMessage`, `apiRequest` y `downloadAuthenticatedPdf` con pruebas unitarias en Vitest siguiendo patrón AAA.
  2. **Workspaces Interactivos por Rol (`App.tsx`, `CatalogsAndAssignmentsWorkspace.tsx`, `FinancialEnginePanel.tsx`, `PettyCashAndReportsPanel.tsx`, `UsersAndAuditWorkspace.tsx`):**
     * **Autenticación JWT Real (`/api/auth/login`):** Selector rápido de 1 clic para cambiar entre `GENERADOR`, `RECEPTOR` y `ADMIN` con login real contra el backend, además de formulario de login manual.
     * **5 Pestañas Operativas:** (1) Dashboard Ejecutivo y Estado de Cuenta por Persona, (2) CRUD de Proyectos, Grupos de Pago, Beneficiarios y Asignaciones en USD, (3) Previsualización/Ejecución de Lotes de Causación Prorrateada, Solicitudes de Pago, Ejecución de Pagos FIFO, Anulaciones Justificadas y Descarga de PDFs, (4) Cajas Chicas con Apertura Mensual, Arrastre de Saldo, Emisión/Desembolso/Rendición de Vales con Factura y Cierre Mensual, (5) Gestión de Usuarios (`ADMIN`) y Visor Forense Inmutable `audit_log`.
  3. **Endpoints de Listado Completo en Backend (`GET /api/accruals` y `GET /api/petty-cashes`):**
     * Ampliación de `AccrualsService.findAllAccruals` y `PettyCashService.findAllPettyCashes` con sus respectivas pruebas unitarias en `accruals.service.spec.ts` y `petty-cash.service.spec.ts`.
  4. **Verificación Integral de Pruebas Unitarias 1:1 (`TEST-01`):**
     * **Backend (Jest):** 27 suites pasadas (`188/188 unit tests` en verde) + `nest build` exitoso.
     * **Frontend (Vitest):** 5 suites pasadas (`25/25 unit tests` en verde) + `vite build` exitoso.

---

### Interacción #11 — Auditoría Integral, Corrección de Contratos Frontend/Backend y Prueba de Humo End-to-End
* **Fecha:** Noviembre 2026
* **Herramienta / Modelo:** DeepSeek V4.1 Flash (OpenCode)
* **Indicación (Prompt) del Usuario:**
  > *"Necesito que analices el pdf del directorio actual, se trata de un proyecto con varios compañeros... analices todo y dejes todo listo para que yo pueda comenzar a hacer pruebas, además de un reporte de que son las cosas que aún faltan por llevar a cabo."*
* **Hallazgos y correcciones aplicadas:**
  1. **Acceso al sistema (`database/02_seed_data.sql`):** el hash del seed SQL no era compatible con `scrypt`; los tres usuarios demo devolvían `401`. Se reemplazó por un hash válido y se verificó el login de los tres roles.
  2. **Contratos de API en Frontend:** se alinearon `App.tsx`, `CatalogsAndAssignmentsWorkspace.tsx` y `FinancialEnginePanel.tsx` con los DTO y respuestas reales del backend (resumen ejecutivo, montos, estados, claves de pago, revisión de solicitudes y permisos RBAC).
  3. **Carga del workspace ADMIN:** se dejó de consultar `/assignments` con rol `ADMIN` (403 según `RN-SEG-02`), permitiendo cargar usuarios y `audit_log`.
  4. **Seed completo (`backend/prisma/seed.ts`):** se agregaron asignaciones, causaciones, solicitud con ítems, pago FIFO, caja chica y vale histórico; se validó también sobre una base creada con `prisma db push`.
  5. **Prueba de humo (`scripts/api-smoke-test.mjs`):** 40 verificaciones end-to-end contra Docker (RBAC, prorrateo, FIFO, sobrepago, anulación con reversión, PDFs, cajas chicas y auditoría).
  6. **Documentación:** se agregó `docs/INFORME_ESTADO_Y_PENDIENTES.md` con el estado por requerimiento, correcciones y pendientes priorizados.
* **Verificación final:**
  * **Backend (Jest):** 27 suites / `188/188` tests en verde + `nest build` exitoso.
  * **Frontend (Vitest):** 5 suites / `25/25` tests en verde + `vite build` exitoso.
  * **Docker Compose:** stack completo levantado desde volumen limpio.
  * **UI (Chromium headless):** dashboard, catálogos, motor financiero, cajas chicas, usuarios y auditoría sin errores de consola.

---

### Interacción #12 — Cierre de Pendientes del PDF: Anulaciones, Parámetros, Caja Chica, Comprobantes, Auditoría y PDFs
* **Fecha:** Noviembre 2026
* **Herramienta / Modelo:** DeepSeek V4.1 Flash (OpenCode)
* **Indicación (Prompt) del Usuario:**
  > *"Hazme las preguntas necesarias para llevar a cabo los pendientes del proyecto, por supuesto los pendientes siempre tienen que estar basados en el contenido del pdf."*
* **Decisiones acordadas con el usuario:**
  1. Anulaciones para todas las entidades del modelo.
  2. CRUD genérico clave-valor para parámetros del sistema.
  3. Separar aprobación y desembolso de vales, agregando rechazo y cierre de caja.
  4. Pago FIFO limitado a los ítems de la solicitud aprobada.
  5. Carga real de archivo de comprobante + referencia.
  6. Triggers PostgreSQL + auditoría de negocio.
  7. Marca de agua y bloques de firma en PDFs.
  8. Trabajo en rama local, sin push a `main`.
* **Implementación:**
  1. **Anulaciones (`AnnulmentsService` / `AnnulmentsController`):** nuevas anulaciones de lote de causación, solicitud de pago y vale de caja chica; reapertura de solicitud al anular el último pago; validación de causaciones incluidas en solicitudes activas; auditoría y motivo obligatorio.
  2. **Parámetros (`ParametersModule`):** CRUD `GET/POST/PATCH/DELETE /api/parameters` con RBAC y pantalla en el workspace ADMIN.
  3. **Caja chica (`PettyCashService`):** endpoints separados de aprobar, rechazar, desembolsar y cerrar caja; campo `rejection_reason`; validación de comprobante obligatorio.
  4. **Integridad de pagos (`PaymentRequestsService` / `PaymentsService`):** bloqueo de causaciones duplicadas en solicitudes activas; pago FIFO exclusivo sobre ítems de la solicitud y control de saldo pendiente de la solicitud.
  5. **Comprobantes (`UploadsModule`):** endpoint multipart `/api/uploads`, validación PDF/PNG/JPEG hasta 5 MB, servido estático en `/uploads` y descarga desde la UI.
  6. **Auditoría (`database/03_audit_triggers.sql`):** triggers sobre tablas del dominio, bloqueo append-only de `audit_logs` y auditoría de negocio existente.
  7. **PDFs (`pdf-document.builder.ts`):** marca de agua rotada para anulados y bloques de firma del receptor/beneficiario y generador/aprobador.
  8. **Prueba de humo:** ampliada a 68 verificaciones end-to-end.
* **Verificación final:**
  * **Backend (Jest):** 30 suites / `225/225` tests en verde + `nest build` exitoso.
  * **Frontend (Vitest):** 5 suites / `27/27` tests en verde + `vite build` exitoso.
  * **Smoke test API:** `68/68` verificaciones en verde.
  * **UI (Chromium headless):** sin errores de consola; parámetros, lotes, caja chica y flujos segregados visibles.

---

### Interacción #13 — Cierre de Brechas 1, 3 y 5: Catálogos del ADMIN, Fechas de Corte y CRUD de UI
* **Fecha:** Noviembre 2026
* **Herramienta / Modelo:** DeepSeek V4.1 Flash (OpenCode)
* **Indicación (Prompt) del Usuario:**
  > *"ok por ahora me gustaría que atiendas las brechas 1, brecha 3, brecha 5, una vez termine dime si con estos cambios se cubren los requisitos del pdf."*
* **Implementación:**
  1. **Brecha 1 — ADMIN y catálogos:** los endpoints de proyectos y beneficiarios ahora permiten `ADMIN` y `GENERADOR`; el ADMIN mantiene prohibición total sobre operaciones de dinero. La matriz `RN-SEG-02` fue actualizada.
  2. **Brecha 3 — Fechas de corte:** nuevo modelo `PaymentGroupPeriod`, generador puro `buildDefaultPaymentPeriods`, generación automática de períodos para dos años, endpoints `GET/POST/DELETE /api/payment-groups/:id/periods` y validación del período al crear lotes de causación.
  3. **Brecha 5 — CRUD de UI:** edición y activación/desactivación de proyectos, grupos de pago y beneficiarios; gestión visual de períodos/cortes; selector de fecha de corte en el motor de causación.
* **Verificación final:**
  * **Backend (Jest):** 30 suites / `225/225` tests en verde + `nest build` exitoso.
  * **Frontend (Vitest):** 5 suites / `27/27` tests en verde + `vite build` exitoso.
  * **Smoke test API:** `68/68` verificaciones en verde.
  * **UI (Chromium headless):** ADMIN gestiona catálogos y cortes; GENERADOR selecciona períodos; sin errores de consola.

---

### Interacción #14 — Rediseño visual completo de la interfaz y erradicación de "AI slop" con skills y MCP locales en OpenCode
* **Fecha:** Noviembre 2026
* **Herramientas / Modelos:** Hermes Agent (orquestación), OpenCode CLI 2.3.0 con DeepSeek V4.1 Pro, skills locales `impeccable`, `frontend-design` y `web-design-guidelines`, MCP locales `shadcn`, `chrome-devtools` y `@21st-dev/magic`.
* **Indicación (Prompt) del Usuario:**
  > *"Ejecuta de principio a fin, de forma completamente autónoma, la instalación segura de herramientas de diseño web para OpenCode (estrictamente dentro del directorio del proyecto) y la orquestación del rediseño visual completo de todas las vistas para erradicar cualquier rastro de 'AI slop'."*
* **Auditoría de las skills descargadas:** se inspeccionaron los tres `SKILL.md` y todos los scripts auxiliares: sin instrucciones ocultas, sin exfiltración de variables de entorno ni comandos maliciosos. La única dependencia ejecutable (`impeccable/scripts/impeccable`) es un lanzador de shell que descarga un motor binario **verificado por SHA-256** contra `engine-checksums.txt`; se redirigió su caché al propio proyecto (`IMPECCABLE_HOME=.opencode/.cache/impeccable`) para no escribir fuera del workspace.
* **Implementación:**
  1. **`DESIGN.md`** (nuevo, raíz): identidad "libro mayor + instrumento de laboratorio", paleta fría, tipografía Spectral + Public Sans, prohibiciones explícitas de clichés generados, reglas por vista y criterios de aceptación.
  2. **`frontend/src/styles/design-system.css`** (nuevo): tokens de color, tipografía, espaciado y radios; estructura de riel + folios; tablas contables con numeración tabular; badges, controles y avisos. Sin framework de CSS y sin estilos inline.
  3. **`App.tsx`**: reescrito el armazón (riel numerado 1–5, cabecera de área de trabajo con controles de sesión y rol) y el panel de resumen convertido en libro mayor (causado / pagado / deuda + cobertura), con tabla de estado de cuenta.
  4. **Cuatro espacios de trabajo migrados de estilo inline a clases** por agentes OpenCode en paralelo, con especificaciones escritas en `.opencode/prompts/` y verificación central del build: catálogos y asignaciones, motor financiero (causación, solicitudes, FIFO y anulaciones), cajas chicas y usuarios/auditoría.
* **Verificación final:**
  * `tsc -b` + `vite build`: sin errores; **cero** `style={{ }}` en el frontend.
  * **Frontend (Vitest):** 5 suites / `27/27` en verde. **Smoke test API:** `68/68`.
  * **10 capturas** (5 vistas × 1440×900 y 390×844): sin errores de consola, sin desbordes horizontales, sin texto recortado y **0 fallos de contraste** (todo ≥ AA).
  * **`impeccable detect` sobre la app en ejecución:** 0 anti-patrones; se corrigieron los dos avisos iniciales (fondo cuadriculado eliminado, `--ink-3` oscurecido a `#5F6C76`).

---

### Interacción #15 — Pruebas funcionales de la interfaz (QA) y corrección de dos fallas de RBAC antes de la entrega
* **Fecha:** Noviembre 2026
* **Herramientas / Modelos:** Hermes Agent como orquestador, navegador Chromium controlado por CDP, `impeccable detect`, Docker Compose.
* **Indicación (Prompt) del Usuario:**
  > *"También quiero una lista de todas las vistas y todo lo que debería probar… me gustaría que tú o el agente con las herramientas para probar web hagan las pruebas y verifiquen que todo funcione bien, antes de subir los cambios a la rama guille."*
* **Alcance ejecutado:** recorrido completo de los cinco espacios de trabajo con los tres roles y datos reales de la API: catálogos (proyectos, grupos y cortes, beneficiarios, asignaciones y sus validaciones `RN-CAT-01/02/03/04`), motor financiero (previsualización de prorrateo, lote, solicitud, aprobación, pago parcial y total FIFO, sobrepago rechazado, PDF del recibo, anulación con reversión), cajas chicas (apertura, vale, aprobación, desembolso, rendición con comprobante subido, cierre de mes bloqueado y cierre definitivo), usuarios, parámetros con edición en línea y bitácora con detalle JSONB; además de login manual válido e inválido y cambio de rol.
* **Defectos corregidos:**
  1. **RBAC al cambiar de rol:** el ADMIN conservaba el espacio de Cajas Chicas visible al cambiar desde GENERADOR/RECEPTOR. `handleRoleSwitch` ahora valida el espacio activo contra los permitidos por el rol.
  2. **RBAC en catálogos:** el ADMIN veía la sección de Asignaciones (estado vacío que invitaba a operar). La sección ya no se renderiza para ese rol.
* **Hallazgos documentados sin corregir (decisión del equipo):** motivo de anulación precargado con texto de plantilla (`RN-GLOB-04`), anulación de pago sin confirmación, validación de formulario ausente en el registro de pagos, campos de anulación/rendición separados de sus botones, y dos detalles de usabilidad en cortes y grupos.
* **Verificación final:**
  * **Backend (Jest):** 30 suites / `225/225` en verde.
  * **Frontend (Vitest):** 5 suites / `27/27` en verde.
  * **Smoke test API:** `68/68`.
  * **10 capturas** (5 vistas × 1440×900 y 390×844): 0 errores de consola, 0 desbordes, 0 recortes, 0 fallos de contraste y 0 estilos inline.
  * Informe completo con el checklist de pruebas: [`docs/QA_VISTAS_Y_PRUEBAS.md`](./QA_VISTAS_Y_PRUEBAS.md).

---

### Interacción #16 — Auditoría Integral del Modelo de Negocio, Frontend, Backend y Ampliación de Datos de Prueba (MVP)
* **Fecha:** Noviembre 2026
* **Herramientas / Modelos:** Antigravity (Gemini)
* **Indicación (Prompt) del Usuario:**
  > *"Haz una auditoria y analisis del front y back, y de los datos de prueba para tener el MPV funcional, dime las áreas de mejora así como posibles fallos en el modelo de negocio basado en nuestros docs"*
* **Archivos Creados / Modificados y Reglas Aplicadas:**
  1. **`backend/src/common/constants/domain.enums.ts`** (`CC-01`, `CC-04`): Reexportación directa de los tipos enumerados generados por `@prisma/client` para eliminar las conversiones forzadas `as unknown as` en los servicios de dominio.
  2. **`backend/src/modules/audit/audit.service.ts` y `audit.service.spec.ts`** (`RN-AUD-03`): Inclusión de la relación `user: { select: { id, fullName, email } }` en `findAllLogs` para que la bitácora forense muestre el nombre y correo del autor en lugar de `—`.
  3. **`backend/src/modules/reports/domain/pdf-document.builder.ts`, `reports.service.ts` y `reports.controller.ts`** (`RN-AUD-01`, `RN-AUD-02`, `RN-SEG-02`): Encapsulación de los operadores de texto (`Tf`, `Tm`, `Tj`) de la marca de agua dentro de un bloque `BT ... ET` conforme al estándar PDF 1.4; cálculo de antigüedad de deuda (`oldestUnpaidPeriodStart` y `pendingAccrualsCount`) en el estado de cuenta por beneficiario; habilitación de consulta de resumen en solo lectura para `ADMIN`.
  4. **`backend/src/modules/accruals/accruals.service.ts` y `backend/src/modules/payments/domain/fifo-allocator.calculator.ts`** (`RN-CAUS-04`, `RN-PAG-02`): Exclusión de beneficiarios inactivos al previsualizar lotes, validación de intersección de fechas para impedir doble causación solapada y desempate por `periodEnd ASC` en la cola FIFO.
  5. **`backend/src/modules/annulments/annulments.service.ts`** (`RN-GLOB-04`, `RN-PAG-03`): Actualización del monto total (y estado) del `AccrualBatch` cuando se anula una causación individual y limpieza de `closedAt` al reabrir una solicitud por anulación de pago.
  6. **`backend/src/modules/petty-cash/domain/petty-cash-balance.calculator.ts` y `petty-cash.service.ts`** (`RN-CAJA-01`, `RN-CAJA-02`): Validación del tope autorizado (`authorizedAmount`) y del orden cronológico (`yearMonth` posterior al último período cerrado) al abrir períodos mensuales.
  7. **`frontend/src/App.tsx`, `FinancialEnginePanel.tsx` y `PettyCashAndReportsPanel.tsx`** (`RN-SEG-02`, `RN-PAG-01`, `RN-CAJA-03`): Ocultación de la pestaña de Auditoría y limpieza de estados sensibles para el rol `GENERADOR`; filtrado de causaciones ya comprometidas en solicitudes activas; habilitación de los campos de motivo de rechazo y anulación de vales/solicitudes para el rol `RECEPTOR`; columna de antigüedad de deuda en el estado de cuenta.
  8. **`database/02_seed_data.sql`, `backend/prisma/seed.ts` y `uploads/factura-fis-2026-1042.pdf`**: Sincronización y ampliación del seed con asignación semanal para `Lic. Gabriel Tovar`, lote y causación prorrateada (5/15 días = `$150.00`) `PENDIENTE` libre en `QUI-2026-02`, solicitud `ENVIADA` en `BIO-2026-03` lista para aprobar/rechazar, vale `SOLICITADO` en el período abierto `2026-11`, comprobante PDF de demostración y registros iniciales en `audit_logs`.
* **Explicación Técnica para la Defensa:**
  * Se cerraron las brechas entre el contrato documental (`RN-*`) y la implementación: la cola FIFO respeta el cuádruple criterio de ordenamiento (`periodStart`, `periodEnd`, `createdAt`, `id`), las cajas chicas validan su tope autorizado (`authorizedAmount`) bajo el modelo de Fondo Fijo (Imprest), y la segregación de funciones (`RN-SEG-02`) se aplica tanto en los Guards de NestJS como en la visibilidad de vistas y memoria de React.

---

### Interacción #17 — Implementación de la lógica de filtrado, búsqueda y paginación en tablas del frontend
* **Fecha:** Noviembre 2026 · **Rama:** `dervis`
* **Herramientas / Modelos:** Antigravity (Gemini 3.8 Flash)
* **Indicación (Prompt) del Usuario:**
  > *"crea la logica del filtro y las tablas"*
* **Motivación y Arquitectura:**
  En vistas con alto volumen de datos (beneficiarios, proyectos, asignaciones y bitácora de auditoría), las tablas sin paginación ni búsqueda dificultan la consulta y la evaluación. Siguiendo `ESTANDARES_DESARROLLO_CLEAN_CODE.md` (`CC-01` sin `any`, `CC-02` funciones puras deterministas, `TEST-01` pruebas unitarias 1:1 con patrón AAA) y `DESIGN.md` (cero estilos inline, uso estricto de tokens de diseño):
* **Implementación:**
  1. **`frontend/src/utils/table-filter.util.ts`**: Utilidades puras deterministas para búsqueda insensible a mayúsculas/minúsculas (`searchTableItems`), filtrado por propiedad (`filterTableByProperty`) y paginación segura con límites de página (`paginateTableItems`).
  2. **`frontend/src/utils/table-filter.util.spec.ts`**: Suite completa de 9 pruebas unitarias con patrón AAA cubriendo casos felices, consultas vacías, funciones extractoras personalizadas y límites de página en listas vacías.
  3. **`frontend/src/components/TableFilterBar.tsx`**: Control de búsqueda reactivo con input semántico, selectores de filtro opcionales, contador de resultados en vivo y botón para restablecer filtros.
  4. **`frontend/src/components/TablePagination.tsx`**: Paginador con numeración tabular, límites de registros mostrados y navegación de páginas accesible.
  5. **`frontend/src/styles/design-system.css`**: Incorporación de tokens y clases `.table-toolbar`, `.table-pagination`, `.table-pagination__btn` sin dependencias externas ni estilos inline.
  6. **Integración en vistas:**
     - **`App.tsx`**: Tabla de estado de cuenta por beneficiario con buscador por cédula/nombre y paginación.
     - **`CatalogsAndAssignmentsWorkspace.tsx`**: Tablas de Proyectos (filtro por área y texto), Beneficiarios (filtro por estado activo/inactivo y texto) y Asignaciones (filtro por proyecto y texto).
     - **`UsersAndAuditWorkspace.tsx`**: Tablas de Usuarios (filtro por rol y texto) y Bitácora de Auditoría (filtro por acción `INSERT`/`UPDATE`/`DELETE` y texto).
* **Verificación técnica:**
  - **Pruebas Frontend:** 6 suites / `36/36` pruebas pasando en verde con Vitest (+9 pruebas nuevas).
  - **Compilación Frontend:** `tsc -b && vite build` exitoso con cero advertencias de tipo y cero estilos inline.

---

### Interacción #18 — Implementación del Flujo Formal de Cierre de Sesión (Logout) y Pantalla de Acceso Portal
* **Fecha:** Noviembre 2026 · **Rama:** `dervis`
* **Herramientas / Modelos:** Antigravity (Gemini 3.8 Flash)
* **Indicación (Prompt) del Usuario:**
  > *"hagamos la 5 entonces"* (Implementación de botón formal de Logout y flujo de sesión desacoplado).
* **Motivación y Arquitectura:**
  Previamente, el sistema mantenía una sesión automática permanente basada en credenciales demo sin opción explícita de cerrar sesión. Se implementó una gestión de sesión limpia (`session.util.ts`), con borrado de tokens en memoria (estateless JWT), visualización de estado desconectado y una pantalla de acceso portal (`login-portal`) para ingresar tanto con credenciales institucionales como mediante accesos rápidos por rol (`ADMIN`, `GENERADOR`, `RECEPTOR`).
* **Implementación:**
  1. **`frontend/src/utils/session.util.ts`**: Funciones puras para construcción de sesión (`buildUserSession`), validación de sintaxis de token (`isValidAuthToken`) y reseteo de estado limpio (`getClearedSessionState`).
  2. **`frontend/src/utils/session.util.spec.ts`**: 5 pruebas unitarias 1:1 con patrón AAA cubriendo casos felices y bordes de token y sesión.
  3. **`frontend/src/styles/design-system.css`**: Clases `.login-portal`, `.login-portal__card`, `.login-portal__demo-grid`, `.rail__logout-btn` respetando la paleta fría, tipografía Spectral + Public Sans y sin estilos inline.
  4. **`frontend/src/App.tsx`**: Botón de "Cerrar sesión" en el riel inferior y en la barra de herramientas superior; estado `isLoggedOut` que previene el auto-login tras cierre de sesión y renderiza el portal de autenticación.
* **Verificación técnica:**
  - **Pruebas Frontend:** 7 suites / `41/41` pruebas pasando en verde con Vitest (+5 pruebas nuevas).
  - **Compilación Frontend:** `tsc -b && vite build` exitoso con cero advertencias de tipo y cero estilos inline.

---

### Interacción #19 — Enrutado por vista: una URL por espacio de trabajo, sesión persistente y verificación funcional completa
* **Fecha:** Noviembre 2026
* **Herramientas / Modelos:** Hermes Agent como orquestador, navegador Chromium vía CDP para las pruebas, `psql` dentro del contenedor para comprobar la base de datos, `impeccable detect`.
* **Indicación (Prompt) del Usuario:**
  > *"Así que no termines hasta que hayas validado todo siempre asegurando que se cumpla todo lo que solicita el documento… quiero que testees todo, que funcione el login, los botones, valides que todo se refleje correctamente en la base de datos."*
* **Problema que resuelve:** la aplicación tenía cinco espacios y un portal de acceso, pero todos bajo la misma URL `/`. No se podía enlazar, recargar ni volver con el botón Atrás, y el RBAC solo se demostraba ocultando botones (`react-router-dom` estaba declarado y sin usar).
* **Implementación:**
  1. **`frontend/src/routes/workspaces.ts`:** definición única de las cinco rutas (`/resumen`, `/catalogos`, `/causacion`, `/cajas-chicas`, `/auditoria`) con título, descripción, índice y **roles autorizados**; funciones puras `findWorkspaceByPath`, `canAccessWorkspace`, `visibleWorkspaces`, `firstAllowedPath` y `pathForWorkspace`, con su suite de pruebas.
  2. **`context/WorkspaceContext.tsx`:** todo el estado y la carga de datos que vivían en `App.tsx` (sesión, RBAC, catálogos, motor financiero, cajas, auditoría, filtros y paginación del resumen) pasan a un contexto tipado; un efecto único recarga los datos cuando cambia la sesión o el filtro de proyecto.
  3. **`components/AppShell.tsx` y `components/RouteGuards.tsx`:** riel con `NavLink` reales (`aria-current` en la vista activa), cabecera con el título de la ruta, guard de sesión y guard de rol que redirige con aviso citando `RN-SEG-02`, y estado de carga mientras se restaura la sesión.
  4. **`pages/`:** el portal de acceso y las cinco vistas como componentes de ruta; `NotFoundPage` para rutas inexistentes. `App.tsx` queda como configuración del router, generada desde `WORKSPACES` para que no haya rutas duplicadas a mano.
  5. **`utils/session.util.ts`:** persistencia en `sessionStorage` (ámbito de pestaña, no `localStorage`) con `serializeSession`, `parseStoredSession`, `saveSession`, `loadSession` y `clearSession`, más 6 pruebas nuevas (11 en total en esa suite).
  6. **`design-system.css`:** bloque nuevo (`.app-boot`, enlaces del riel y de la marca) sin introducir tokens nuevos.
* **Pruebas ejecutadas en la interfaz:** 12 comprobaciones de rutas y sesión (entrada directa, recarga, ruta prohibida por rol, cambio de rol, ruta inexistente, historial, logout y retorno al destino tras el login) y los flujos completos de catálogos, causación, solicitud, dos pagos parciales consecutivos con FIFO, PDF, caja chica con comprobante real subido, cierre de mes y de caja, usuarios, parámetros y bitácora.
* **Comprobación en PostgreSQL:** cada operación de la interfaz se verificó contra su fila real (`projects`, `beneficiaries`, `assignments`, `accrual_batches`, `accruals`, `payment_requests`, `payments`, `payment_allocations`, `petty_cashes`, `petty_cash_periods`, `petty_cash_vouchers`, `users`, `system_parameters`, `audit_logs`). Detalle en [`docs/QA_VISTAS_Y_PRUEBAS.md`](./QA_VISTAS_Y_PRUEBAS.md).
* **Segunda vuelta (acciones destructivas):** se probaron con clics reales rechazar y anular solicitudes, pagos con reversión FIFO, lotes de causación y vales de caja chica, además de editar un proyecto y desactivar/reactivar un beneficiario. Dos defectos aparecieron y se corrigieron en la misma pasada:
  1. **Motivos precargados** (`FinancialEnginePanel`, `PettyCashAndReportsPanel`): los campos de anulación y rechazo nacían con un texto de plantilla, así que un solo clic ejecutaba la acción irreversible sin justificación real y la auditoría registraba ese texto genérico. Ahora arrancan vacíos y los botones destructivos quedan inhabilitados hasta alcanzar el mínimo de la regla (10 caracteres para anular, 5 para rechazar), con la explicación en el `title`.
  2. **Motivo reutilizado** (F9): el mismo campo servía a varias acciones y conservaba el texto de la operación anterior; ahora se limpia al completar cada acción con éxito.
  Verificado en la interfaz: botón inhabilitado con el campo vacío, habilitado al escribir, estado final correcto (`RECHAZADA`, `ANULADA`, `ANULADO`) y saldo revertido o intacto según corresponda, con la fila comprobada en PostgreSQL.
* **Verificación final:**
  * **Frontend (Vitest):** 8 suites / `58/58` en verde (antes 41).
  * **Backend (Jest):** 30 suites / `225/225` en verde.
  * **Smoke test API:** `68/68`.
  * **10 capturas** (5 rutas × 1440×900 y 390×844): 0 errores de consola, 0 desbordes, 0 recortes y 0 fallos de contraste.
  * **`impeccable detect`:** 0 hallazgos sobre los archivos y sobre la aplicación en ejecución.

---


---

### Interacción #17 — Protección contra desbordamiento `NUMERIC(12, 2)` y generación automática de códigos de documentos y vales
* **Fecha:** Noviembre 2026
* **Herramientas / Modelos:** Antigravity (Gemini)
* **Indicación (Prompt) del Usuario:**
  > *"Corrige lo siguiente: ... ERROR: numeric field overflow ... A field with precision 12, scale 2 must round to an absolute value less than 10^10 ... Y haz que la generación de codigos dependa del sistema, no tiene sentido que el usuario pueda editar el formato de los codigod de documento o vales"*
* **Archivos Creados / Modificados y Reglas Aplicadas:**
  1. **`backend/src/common/constants/domain.enums.ts`, `backend/src/common/domain/money.helper.ts` y `money.helper.spec.ts`** (`RN-GLOB-02`): Definición de `MAX_USD_AMOUNT = '9999999999.99'` y validación en `toUsdDecimal` para rechazar con `BadRequestException` cualquier monto que exceda la precisión `NUMERIC(12, 2)` de PostgreSQL antes de llegar a la capa de datos.
  2. **`backend/src/common/domain/document-code.generator.ts` y `document-code.generator.spec.ts`** (`CC-03`, `TEST-01`): Generador puro determinista `buildSystemDocumentCode` con pruebas unitarias AAA.
  3. **`projects.service.ts`, `accruals.service.ts`, `payment-requests.service.ts`, `payments.service.ts`, `petty-cash.service.ts` y sus DTOs**: Generación automática y libre de colisiones de códigos institucionales (`FIS-2026-XX`, `LOTE-YYYY-MM-XXX`, `SOL-YYYY-XXX`, `REC-YYYY-XXXX`, `CC-YYYY-XX`, `VALE-YYYY-MM-XXX`) cuando el cliente no envía código.
  4. **`CatalogsAndAssignmentsWorkspace.tsx`, `FinancialEnginePanel.tsx` y `PettyCashAndReportsPanel.tsx`**: Los campos de código de proyecto, lote, solicitud, recibo, caja chica y vale pasan a ser de solo lectura (`Autogenerado por el sistema`), y todos los inputs monetarios incluyen `min` y `max="9999999999.99"`.
* **Explicación Técnica para la Defensa:**
  * Se blindó la frontera entre aplicación y base de datos garantizando que ningún importe supere $10^{10} - 0.01$ USD (`NUMERIC(12, 2)`), y se centralizó la numeración correlativa de documentos y vales en el servidor para impedir códigos arbitrarios o inconsistentes desde el cliente.
