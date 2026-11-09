# Especificación Oficial de Reglas de Negocio e Invariantes del Dominio

**Universidad de Carabobo — Escuela de Computación**  
**Asignatura:** Sistemas de Información  
**Proyecto:** Sistema de Control de Pagos y Asignaciones (USD)

> **PROPÓSITO DE ESTE DOCUMENTO:**  
> Este documento constituye el **contrato único de verdad (Single Source of Truth)** para los 4 integrantes del equipo y sus respectivos agentes de Inteligencia Artificial. Ningún módulo de Frontend, servicio de Backend ni migración de Base de Datos puede contradecir estas reglas.

---

## 1. Reglas Globales y Financieras (`RN-GLOB`)

* **RN-GLOB-01 (Moneda Única y Sin Deducciones):** Todos los montos del sistema están expresados exclusivamente en **Dólares Estadounidenses (USD)**. No existen retenciones legales (ISLR, SSO, FAOV, etc.) ni conversiones multimoneda.
* **RN-GLOB-02 (Precisión Decimal Exacta):** Queda **terminantemente prohibido** usar tipos `FLOAT`, `DOUBLE` o `REAL` en base de datos, o aritmética nativa de punto flotante de JavaScript (`number` directo sin redondeo controlado) para cálculos monetarios.
  * En PostgreSQL: Todo campo monetario debe ser `NUMERIC(12, 2)`.
  * En Backend (NestJS): Todo cálculo de prorrateo, suma de lotes, distribución FIFO y saldos debe operarse con `Decimal.js` (o aritmética entera en centavos) redondeando a **2 decimales (`ROUND_HALF_UP`)**.
* **RN-GLOB-03 (Inmutabilidad Contable):** Una vez creado o confirmado un registro financiero (**Causación**, **Solicitud enviada/aprobada**, **Pago/Desembolso**, **Recibo**, **Vale desembolsado/rendido**), **NO puede ser eliminado físicamente (`DELETE` prohibido) ni se pueden editar sus montos (`UPDATE` de montos prohibido)**.
* **RN-GLOB-04 (Corrección vía Anulación Justificada):** Cualquier error en un registro financiero se corrige únicamente mediante una **Anulación Justificada**, la cual exige:
  1. Motivo textual obligatorio (`reason` con longitud mínima de 10 caracteres).
  2. Usuario autor (`annulled_by`) y marca de tiempo (`created_at`).
  3. Transacción atómica que cambie el estado del registro a `ANULADO` y revierta matemáticamente los saldos afectados.

---

## 2. Usuarios, Roles y Segregación de Funciones (`RN-SEG`)

* **RN-SEG-01 (Separación de Beneficiarios y Usuarios):** Los **Beneficiarios** (personal de física, química y biología que recibe pagos) **NO tienen usuario, contraseña ni acceso al sistema**. Se almacenan en la tabla `beneficiaries`, separada de la tabla `users`.
* **RN-SEG-02 (Matriz Estricta de Segregación de Funciones - RBAC):** Cada usuario del sistema tiene exactamente **un (1) rol** activo de los tres permitidos. El Backend debe rechazar con `HTTP 403 Forbidden` cualquier intento de ejecutar una acción fuera de su matriz:

| Módulo / Acción | `ADMIN` (Administrador) | `GENERADOR` (Coordinador) | `RECEPTOR` (Gerente Admin.) |
| :--- | :---: | :---: | :---: |
| Gestionar Usuarios del Sistema (`users`) | ✅ Sí | ❌ No | ❌ No |
| Configurar Parámetros y Grupos de Pago | ✅ Sí | 👁️ Solo lectura | 👁️ Solo lectura |
| Ver Bitácora de Auditoría (`audit_logs`) | ✅ Sí | ❌ No | ✅ Sí (consulta) |
| Gestionar Proyectos y Beneficiarios | 👁️ Solo lectura | ✅ Sí (CRUD) | 👁️ Solo lectura |
| Gestionar Asignaciones | ❌ No | ✅ Sí (CRUD) | 👁️ Solo lectura |
| Ejecutar Motor de Causación por Lote | ❌ No | ✅ Sí | ❌ No |
| Crear y Enviar Solicitudes de Pago | ❌ No | ✅ Sí | ❌ No |
| Aprobar o Rechazar Solicitudes de Pago | ❌ No | ❌ No | ✅ Sí |
| Registrar Entrega de Fondos (Pagos) y Cierre | ❌ No | ❌ No | ✅ Sí |
| Anular Causación / Solicitud no pagada | ❌ No | ✅ Sí (con motivo) | ❌ No |
| Anular Pago / Entrega de Fondos | ❌ No | ❌ No | ✅ Sí (con motivo) |
| Caja Chica: Crear Caja / Solicitar Apertura y Vales / Rendir | ❌ No | ✅ Sí | ❌ No |
| Caja Chica: Aprobar Apertura y Vales / Desembolsar / Cerrar Mes | ❌ No | ❌ No | ✅ Sí |

---

## 3. Catálogos: Proyectos, Grupos de Pago y Asignaciones (`RN-CAT`)

* **RN-CAT-01 (Clasificación de Proyectos):** Todo proyecto debe pertenecer obligatoriamente a un **Área** (`FISICA`, `QUIMICA`, `BIOLOGIA`), tener un **Ámbito** (`INTERNO`, `EXTERNO`) y un rango de **Vigencia** (`start_date` $\le$ `end_date`).
* **RN-CAT-02 (Efecto de la Vigencia del Proyecto):**
  * **Bloqueo de nuevas causaciones:** No se pueden generar nuevas causaciones ni crear nuevas asignaciones para fechas fuera del rango `[start_date, end_date]` del proyecto, ni si el proyecto está inactivo/cerrado.
  * **Liquidación de deudas previas permitida:** Aunque la fecha actual supere el `end_date` del proyecto, el sistema **SÍ permite** aprobar solicitudes y registrar pagos sobre causaciones que fueron generadas válidamente dentro del período de vigencia del proyecto.
* **RN-CAT-03 (Grupos de Pago y Periodicidad):** Los grupos de pago definen la periodicidad (`SEMANAL`, `QUINCENAL`, `MENSUAL`) y las fechas de corte adaptables (períodos con `period_start` y `period_end` explícitos).
* **RN-CAT-04 (Multiplicidad y Unicidad de Asignaciones):**
  * Un mismo Beneficiario **SÍ puede tener múltiples asignaciones activas simultáneamente en DISTINTOS proyectos**.
  * Un Beneficiario **NO puede tener dos asignaciones activas solapadas en fechas dentro del MISMO proyecto**.
  * El rango de fechas de una asignación (`assignment.start_date`, `assignment.end_date`) debe estar contenido dentro de la vigencia del proyecto (`project.start_date`, `project.end_date`).

---

## 4. Motor de Causación y Prorrateo (`RN-CAUS`)

* **RN-CAUS-01 (Base de Días Calendario Reales):** El prorrateo se calcula sobre los **días calendario reales (inclusivos)** del período que se está procesando:
  $$\text{Días Totales del Período } (D_{\text{total}}) = (\text{Fecha Fin Período} - \text{Fecha Inicio Período}) + 1$$
  *(Ejemplo: del 01/11 al 15/11 hay $15 - 1 + 1 = 15$ días; del 16/11 al 30/11 hay $15$ días; del 16/10 al 31/10 hay $16$ días).*
* **RN-CAUS-02 (Intersección de Días Activos):** Para cada asignación activa en el proyecto y grupo de pago evaluado, el intervalo efectivo trabajado dentro del período es:
  $$\text{Inicio Efectivo} = \max(\text{Inicio Período}, \text{Inicio Asignación}, \text{Inicio Proyecto})$$
  $$\text{Fin Efectivo} = \min(\text{Fin Período}, \text{Fin Asignación}, \text{Fin Proyecto})$$
  * Si $\text{Inicio Efectivo} > \text{Fin Efectivo}$, entonces $\text{Días Activos } (D_{\text{activos}}) = 0$ (no genera causación en ese período).
  * En caso contrario:
    $$D_{\text{activos}} = (\text{Fin Efectivo} - \text{Inicio Efectivo}) + 1$$
* **RN-CAUS-03 (Fórmula de Monto Causado):**
  $$\text{Monto Causado} = \text{ROUND}_{2}\left( \text{Monto por Período} \times \frac{D_{\text{activos}}}{D_{\text{total}}} \right)$$
* **RN-CAUS-04 (Generación por Lote y No Duplicidad):**
  * La causación se ejecuta por lote agrupado por **Proyecto** y **Período** (`AccrualBatch`).
  * Una asignación **NO puede ser causada dos veces para el mismo período** (a menos que la causación anterior haya sido `ANULADA`).
  * Al crearse la causación (`Accrual`), nace con:
    * `prorated_amount = Monto Causado`
    * `paid_amount = 0.00`
    * `balance_due = Monto Causado`
    * `status = PENDIENTE`

---

## 5. Ciclo de Solicitudes de Pago y Prelación FIFO (`RN-PAG`)

* **RN-PAG-01 (Máquina de Estados de Solicitudes de Pago):**
  Las solicitudes de pago (`PaymentRequest`) deben respetar estrictamente el siguiente grafo dirigido de estados:
  ```text
  CREADA ──(Generador envía)──> ENVIADA
  ENVIADA ──(Receptor evalúa)──> APROBADA | RECHAZADA
  APROBADA ──(Receptor registra entrega de fondos)──> ENTREGADA (o EN_PAGO_PARCIAL)
  ENTREGADA ──(Saldo solicitud = 0 y confirmada)──> CERRADA
  ```
  * *Nota sobre Rechazo:* Una solicitud `RECHAZADA` es inmutable; libera las causaciones vinculadas para que puedan incluirse en una nueva solicitud corregida.
* **RN-PAG-02 (Pagos Parciales y Algoritmo FIFO):**
  * El sistema permite registrar entregas de fondos (pagos) por un monto menor o igual al saldo pendiente (`0 < Monto Pago <= Deuda Total Pendiente`). **Nunca se permite pagar más de lo adeudado (sobrepago prohibido).**
  * Cuando se registra un pago a favor de un beneficiario (o dentro de una solicitud aprobada), el monto entregado $M$ se distribuye automáticamente sobre sus causaciones pendientes (`status IN ('PENDIENTE', 'PARCIAL')` y `balance_due > 0`) ordenadas por **antigüedad estricta (FIFO)**:
    1. Criterio de ordenamiento: `ORDER BY period_start ASC, period_end ASC, created_at ASC, id ASC`.
    2. Para cada causación $i$ en la cola mientras $M > 0$:
       * $\text{Abono}_i = \min(M,\; \text{balance\_due}_i)$
       * $\text{paid\_amount}_i \leftarrow \text{paid\_amount}_i + \text{Abono}_i$
       * $\text{balance\_due}_i \leftarrow \text{balance\_due}_i - \text{Abono}_i$
       * $M \leftarrow M - \text{Abono}_i$
       * Si $\text{balance\_due}_i == 0$, el estado de la causación pasa a `PAGADO`; si $\text{balance\_due}_i > 0$, pasa a `PARCIAL`.
       * Se inserta un registro inmutable en `payment_allocations` con `(payment_id, accrual_id, allocated_amount = Abono_i)`.
* **RN-PAG-03 (Reversión por Anulación de Pago):**
  * Si el Receptor anula justificadamente un Pago, el sistema recorre todos sus `payment_allocations`, resta cada `allocated_amount` del `paid_amount` de la causación correspondiente, se lo devuelve al `balance_due`, recalcula el estado de la causación (`PENDIENTE` o `PARCIAL`) y marca el pago y su recibo como `ANULADO`.

---

## 6. Control de Cajas Chicas (`RN-CAJA`)

* **RN-CAJA-01 (Asignación a Proyectos):** Pueden existir múltiples cajas chicas en el sistema, cada una vinculada a un Proyecto activo desde la interfaz.
* **RN-CAJA-02 (Ciclo Mensual y Tope de Saldo):**
  * Cada caja chica opera por períodos mensuales (`YYYY-MM`). No puede haber dos períodos `ABIERTO` simultáneamente para la misma caja chica.
  * **Fórmula de Saldo Disponible en Tiempo Real:**
    $$\text{Saldo Disponible} = \text{Saldo Inicial del Mes} + \text{Reposiciones Aprobadas} - \text{Vales Desembolsados Pendientes de Rendir} - \text{Gastos Reales Rendidos}$$
  * **Regla de Tope Estricto:** **NO se permite aprobar ni desembolsar un vale cuyo monto supere el `Saldo Disponible` actual de la caja chica** (prohibido el saldo negativo).
* **RN-CAJA-03 (Flujo de Estados de un Vale de Caja Chica):**
  1. `SOLICITADO` (creado por `GENERADOR` indicando monto estimado y concepto).
  2. `APROBADO` / `RECHAZADO` (evaluado por `RECEPTOR` / Gerencia).
  3. `DESEMBOLSADO` (entrega de efectivo/fondos registrada por `RECEPTOR`; descuenta del saldo disponible).
  4. `RENDIDO` (el `GENERADOR` registra el monto real gastado, adjunta comprobante/referencia obligatoria y devuelve el sobrante en caso de que $\text{Gasto Real} < \text{Monto Desembolsado}$).
* **RN-CAJA-04 (Cierre Mensual y Arrastre de Saldo):**
  * Para cerrar el mes de una caja chica, **todos los vales en estado `DESEMBOLSADO` deben haber sido `RENDIDOS` (o anulados)**.
  * Al ejecutar el cierre del mes $t$, el `closing_balance` queda congelado y se convierte automáticamente en el `Carryover / initial_balance` (arrastre de saldo) de la apertura del mes $t+1$.

---

## 7. Reportes, Documentos y Auditoría (`RN-AUD`)

* **RN-AUD-01 (Consultas Clave Obligatorias):** El sistema debe exponer endpoints y vistas que respondan en todo momento:
  1. ¿Cuánto se ha causado en total y por proyecto/período?
  2. ¿Cuánto se ha pagado, cuándo, a quién y por qué proyecto?
  3. ¿Cuánto se le adeuda actualmente a cada persona (estado de cuenta por beneficiario con antigüedad de deuda)?
* **RN-AUD-02 (Generación de PDFs Oficiales):**
  * **Recibo Individual de Pago (PDF):** Incluye código único de recibo, fecha/hora, datos del beneficiario, proyecto, monto total pagado, tabla desglosada de qué períodos se abonaron según **FIFO** y qué saldo queda pendiente, más estado (`VÁLIDO` o marca de agua `ANULADO`).
  * **Solicitud Consolidada de Pago (PDF):** Incluye código de solicitud, proyecto, período, tabla de beneficiarios y montos causados incluidos, total consolidado y firmas/trazabilidad de quién generó y quién aprobó.
* **RN-AUD-03 (Trazabilidad Completa en `audit_log`):**
  * Toda operación que modifique el estado de la base de datos (`INSERT`, `UPDATE`, `STATUS_CHANGE`, `ANNULMENT`) debe generar un registro en la tabla `audit_logs` dentro de la misma transacción o vía interceptor global, registrando: `user_id`, `user_role`, `action`, `entity_name`, `entity_id`, `old_values` (`JSONB`), `new_values` (`JSONB`) y `created_at`.
  * La tabla `audit_logs` es estrictamente **Append-Only** (nadie, ni siquiera el `ADMIN`, puede borrar ni editar logs de auditoría desde la aplicación).
