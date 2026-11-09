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
