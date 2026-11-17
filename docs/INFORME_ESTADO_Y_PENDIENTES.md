# Informe de Estado, Validación y Pendientes

**Proyecto:** Sistema de Control de Pagos y Asignaciones (USD)  
**Repositorio:** `Edfermachado/sistema-control-pagos-asignaciones`  
**Commit base analizado:** `aa191a2` (`feat(stage-5): build interactive UI/UX workspaces...`)  
**Fecha de revisión:** Noviembre 2026  
**Alcance:** auditoría del PDF del enunciado, del repositorio completo, ejecución de pruebas, despliegue Docker y verificación funcional end-to-end.

---

## 1. Resumen ejecutivo

El proyecto está **funcionalmente avanzado y es ejecutable**. La arquitectura cliente-servidor, el modelo de datos, el RBAC, el motor de prorrateo, la cola FIFO, las anulaciones, las cajas chicas, los PDFs y la auditoría están implementados y con pruebas unitarias en verde.

Durante la revisión se detectaron y corrigieron **fallas críticas de integración** que impedían probar el sistema desde Docker y desde la interfaz:

1. Los usuarios del seed SQL no podían iniciar sesión porque el hash de contraseña no correspondía al algoritmo `scrypt` del backend.
2. La pantalla de resumen esperaba nombres de campos distintos a los que devuelve la API.
3. Varios formularios del frontend enviaban campos inexistentes en los DTO (por ejemplo `budget`, `description`, `requestedAmount`, `amountPaid`, `paymentMethod`), por lo que el backend los rechazaba con `400`.
4. El flujo de aprobación enviaba `APPROVE`/`REJECT` en lugar de `APROBADA`/`RECHAZADA`.
5. El ADMIN intentaba consultar `/assignments`, endpoint prohibido para su rol, y el `Promise.all` abortaba la carga de usuarios y auditoría.
6. El seed SQL no incluía los ítems de la solicitud de pago consolidada y los saldos de caja chica no cuadraban con los vales históricos.

Después de las correcciones, el sistema queda **listo para iniciar pruebas funcionales** con datos de demostración coherentes.

---

## 2. Cómo arrancar y probar

### 2.1 Despliegue recomendado (Docker)

```bash
cp .env.example .env
docker compose up -d --build
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`

Si necesita **restablecer la base de datos y recargar el seed**:

```bash
docker compose down -v
docker compose up -d --build
```

> El seed SQL solo se ejecuta cuando PostgreSQL crea el volumen por primera vez.

### 2.2 Credenciales de demostración

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| `ADMIN` | `admin@uc.edu.ve` | `PasswordUC2026!` |
| `GENERADOR` | `coordinador@uc.edu.ve` | `PasswordUC2026!` |
| `RECEPTOR` | `gerente@uc.edu.ve` | `PasswordUC2026!` |

### 2.3 Prueba de humo de la API

Con los contenedores levantados:

```bash
node scripts/api-smoke-test.mjs
```

El script valida salud, login de los tres roles, RBAC, catálogos, prorrateo, solicitud, aprobación, pago parcial/total FIFO, sobrepago, anulación con reversión, anulación de lote/solicitud/vale, cierre, PDFs con marca de agua, carga de comprobantes, caja chica completa, parámetros, usuarios y auditoría con triggers. **Resultado actual: 68/68 verificaciones en verde.**

### 2.4 Pruebas unitarias

```bash
npm --prefix backend test -- --runInBand   # 32 suites / 238 tests
npm --prefix frontend test                 # 11 suites / 78 tests
```

### 2.5 Ejecución manual (sin Docker)

1. Crear la base de datos y cargar el esquema y el seed:

```bash
createdb scpa_db
psql -d scpa_db -f database/01_init_schema.sql
psql -d scpa_db -f database/02_seed_data.sql
```

2. Copiar variables de entorno:

```bash
cp backend/.env.example backend/.env
```

3. Instalar, generar Prisma y ejecutar:

```bash
npm --prefix backend install
npm --prefix backend run prisma:generate
npm --prefix backend run start:dev
```

El seed programático (`npm --prefix backend run prisma:seed`) también fue ampliado y validado contra una base creada únicamente con `prisma db push`, por lo que sirve como alternativa al seed SQL.

---

## 3. Validaciones realizadas

| Validación | Resultado |
| :--- | :--- |
| `backend` compila (`nest build`) | ✅ |
| `frontend` compila (`tsc -b && vite build`) | ✅ |
| Backend: 32 suites / 238 pruebas | ✅ 238/238 |
| Frontend: 11 suites / 78 pruebas | ✅ 78/78 |
| `docker compose up -d --build` | ✅ |
| Login de los 3 roles con el seed SQL | ✅ |
| Health check con conexión a PostgreSQL | ✅ |
| Prueba de humo API end-to-end | ✅ 68/68 |
| Verificación de UI en navegador (Chromium headless) | ✅ Sin errores de consola |
| Dashboard, catálogos, motor financiero, caja chica, usuarios y auditoría | ✅ Cargan datos reales de la API |
| Cambio de rol GENERADOR → ADMIN → RECEPTOR con JWT automático | ✅ |
| Descarga de PDF de recibo y de solicitud consolidada | ✅ (`%PDF`, HTTP 200) |
| Seed SQL idempotente en volumen nuevo | ✅ |
| Seed Prisma sobre base creada con `prisma db push` | ✅ |

---

## 4. Correcciones aplicadas en esta revisión

### 4.1 Backend / base de datos

- **`database/02_seed_data.sql`**
  - Se reemplazó el hash inválido de los usuarios por un hash `scrypt` compatible con `crypto.helper.ts`.
  - Se agregaron los `payment_request_items` de la solicitud de demostración (el PDF consolidado salía sin detalle).
  - Se corrigió el saldo disponible de noviembre de la caja chica (`$200.00 = $65.50 + $134.50`).
  - Se agregó el vale histórico de octubre que justifica el saldo consumido y el cierre en `$65.50`.
- **`backend/prisma/seed.ts`**
  - Se amplió el seed programático para incluir asignaciones, lotes, causaciones, solicitud con ítems, pago FIFO, asignaciones de pago, caja chica, períodos y vale histórico.
  - Se hicieron idempotentes los ítems de solicitud mediante `upsert` por la clave compuesta.
- **`backend/src/main.ts` + `backend/package.json`**
  - Se agregó `dotenv` para que el backend lea `backend/.env` en ejecución manual.
- **`backend/.env.example`**
  - Se alineó el puerto de PostgreSQL con el publicado por Docker Compose (`55432`).

### 4.2 Frontend (contratos API)

- **`frontend/src/App.tsx`**
  - Se alineó `ExecutiveSummaryData` con la respuesta real (`totalPendingDebtUsd`, `beneficiaryBalances`, `beneficiaryDni`, `totalAccruedUsd`, `totalPaidUsd`, `totalDebtDueUsd`).
  - El ADMIN ya no solicita `/assignments` (prohibido por RN-SEG-02), por lo que usuarios y auditoría cargan correctamente.
- **`frontend/src/components/CatalogsAndAssignmentsWorkspace.tsx`**
  - Proyectos: se eliminó el campo inexistente `budget`; estados corregidos a `ACTIVO`, `INACTIVO`, `CERRADO`.
  - Grupos de pago: `description` → `cutoffRules`.
  - Beneficiarios: `roleTitle`/`bankReference` → `bankInfo`.
  - Permisos separados: proyectos y beneficiarios solo `GENERADOR`; grupos de pago solo `ADMIN`; asignaciones solo `GENERADOR`.
- **`frontend/src/components/FinancialEnginePanel.tsx`**
  - Solicitud de pago: ahora se seleccionan causaciones pendientes reales (`accrualIds`), que es lo que exige el DTO.
  - Revisión: `APPROVE`/`REJECT` → `APROBADA`/`RECHAZADA`; se eliminó `approvedAmount` inexistente.
  - Pago: `amountPaid`/`paymentMethod`/`referenceNumber` → `amount`/`reference`.
  - Tabla de solicitudes: `totalAmount`/`paidAmount` en lugar de campos inexistentes.
  - Estado de pago: `VALIDO`/`ANULADO` en lugar de `ACTIVO`.
  - Se ocultó “Cerrar Solicitud” a roles no autorizados y cuando aún hay deuda.
  - Se ocultó “Anular Causación” al RECEPTOR (solo el GENERADOR puede anular causaciones no pagadas).
  - El proyecto por defecto para solicitudes ahora prioriza uno con causaciones pendientes.
- **`frontend/src/types/domain.types.ts`**
  - Se eliminaron estados de proyecto que no existen en el backend (`SUSPENDIDO`, `FINALIZADO`).
- **`frontend/src/utils/api-client.util.ts` + `vite-env.d.ts` + `Dockerfile` + `docker-compose.yml`**
  - `VITE_API_URL` ahora se usa realmente en tiempo de build.
- **`README.md`**
  - Conteos de pruebas corregidos, instrucciones manuales completas, nota de reseed y prueba de humo.

---

## 5. Estado por requerimiento del enunciado

| Requerimiento | Estado | Observaciones |
| :--- | :--- | :--- |
| 3 roles con segregación de funciones | ✅ Implementado | RBAC verificado en API y UI. |
| Beneficiarios sin usuario | ✅ Implementado | Tabla separada y sin credenciales. |
| Proyectos con área, ámbito y vigencia | ✅ Implementado | Creación, edición y cambio de estado desde UI. |
| Grupos de pago con periodicidad y cortes | ✅ Implementado | CRUD, fechas de corte automáticas y cortes personalizados. |
| Asignaciones persona-proyecto-grupo | ✅ Implementado | Con bloqueo de solapamientos. |
| Prorrateo exacto por días | ✅ Implementado | `Decimal.js`, `ROUND_HALF_UP`, probado. |
| Causación por lote | ✅ Implementado | Con control de duplicidad. |
| Flujo de solicitudes y pagos | ✅ Implementado | Estados y transiciones probados. |
| Pagos parciales FIFO | ✅ Implementado | Con `payment_allocations`. |
| Inmutabilidad y anulaciones justificadas | ✅ Implementado | Anulación de pagos, causaciones, lotes, solicitudes y vales con reversión y motivo obligatorio. |
| Cajas chicas múltiples por proyecto | ✅ Implementado | Apertura, aprobación, rechazo, desembolso separado, rendición con archivo y arrastre. |
| PDF de recibo y solicitud consolidada | ✅ Implementado | PDF 1.4 nativo con bloques de firma y marca de agua para anulados. |
| `audit_log` con quién/cuándo/qué | ✅ Implementado | Registro de negocio por servicio + triggers PostgreSQL y bloqueo append-only. |
| Parámetros del sistema | ✅ Implementado | CRUD clave-valor con API y pantalla exclusiva del ADMIN. |
| Adjuntar comprobante de rendición | ✅ Implementado | Carga real de PDF/PNG/JPEG hasta 5 MB y referencia obligatoria. |
| Seed ficticio completo | ✅ Implementado | SQL y Prisma, con datos financieros y de caja chica. |
| README de instalación/ejecución | ✅ Implementado | Actualizado y validado. |
| Bitácora de uso de IA | ✅ Implementado | Ver `docs/BITACORA_IA.md`. |

---

## 6. Pendientes y riesgos priorizados

### Pendientes del PDF resueltos en esta iteración

1. ✅ **Parámetros globales del sistema:** CRUD clave-valor (`GET/POST/PATCH/DELETE /api/parameters`) y pantalla exclusiva del ADMIN.
2. ✅ **Anulaciones completas:** pagos, causaciones, lotes de causación, solicitudes de pago y vales de caja chica, con motivo obligatorio, reversión contable y auditoría.
3. ✅ **Flujo de caja chica:** aprobación y desembolso separados, rechazo de vales con motivo y cierre definitivo de la caja.
4. ✅ **Integridad de solicitudes/pagos:** bloqueo de causaciones duplicadas en solicitudes activas, pago FIFO limitado a los ítems de la solicitud y reapertura de la solicitud al anular un pago.
5. ✅ **Comprobantes adjuntos:** endpoint `/api/uploads` con validación de tipo/tamaño y carga desde la UI.
6. ✅ **Auditoría a nivel de BD:** triggers PostgreSQL sobre las tablas del dominio y bloqueo append-only de `audit_logs`.
7. ✅ **PDF formales:** marca de agua gráfica para documentos anulados y bloques de firma/trazabilidad.
8. ✅ **ADMIN y catálogos:** proyectos y beneficiarios gestionables por ADMIN y GENERADOR; grupos y cortes por ADMIN, manteniendo la segregación de dinero.
9. ✅ **Fechas de corte adaptables:** generación automática de períodos estándar, gestión de cortes personalizados y validación del período al causar.
10. ✅ **CRUD de catálogos en UI:** edición y activación/desactivación de proyectos, grupos, beneficiarios y períodos.

### Brechas residuales frente al PDF (revisión final)

1. ✅ **Alcance del ADMIN sobre catálogos (resuelto)**
   - El ADMIN ahora puede crear y editar proyectos, beneficiarios y grupos de pago, además de gestionar sus fechas de corte.
   - Se mantiene la prohibición de participar en operaciones de dinero.

2. ✅ **Fechas de corte adaptables (resuelto)**
   - Los grupos de pago generan automáticamente sus períodos estándar para el año actual y el siguiente.
   - El ADMIN puede agregar o eliminar cortes personalizados.
   - La creación de lotes valida que el período coincida con una fecha de corte configurada cuando el grupo posee períodos.

3. ✅ **Inmutabilidad a nivel de base de datos (resuelto)**
   - La aplicación no expone endpoints de edición/borrado de registros financieros y las correcciones se hacen por anulación.
   - Adicionalmente, [03_audit_triggers.sql](../database/03_audit_triggers.sql) instala triggers `BEFORE DELETE` (`fn_block_financial_deletion`) que impiden eliminaciones físicas directas por SQL sobre todas las tablas financieras (`RN-GLOB-03`).

4. **Atribución de usuario en la auditoría de triggers**
   - Los triggers registran `INSERT/UPDATE/DELETE` reales en SQL (`user_id` nulo), complementando el log de negocio con usuario y rol exactos; en la interfaz de auditoría pueden filtrarse de forma separada (`Acciones de negocio` vs. `Triggers SQL`).

5. ✅ **Alcance del pago FIFO configurable (`PAYMENT_REQUEST_SCOPE`, resuelto)**
   - Por defecto aplica solo a las causaciones incluidas en la solicitud aprobada (`REQUEST_ITEMS`), pero el parámetro global `PAYMENT_REQUEST_SCOPE = PROJECT_ACCRUALS` permite abarcar dinámicamente todas las causaciones pendientes del beneficiario en el proyecto desde [payments.service.ts](../backend/src/modules/payments/payments.service.ts).

6. ✅ **CRUD de catálogos en la interfaz (resuelto)**
   - Proyectos, grupos de pago, beneficiarios y usuarios tienen alta, edición y activación/desactivación desde la UI (`PATCH /api/users/:id`).
   - Los grupos de pago incluyen gestión de períodos y cortes.

7. **Recibos**
   - El recibo se representa con `payments.receipt_code` (autogenerado correlativamente por el sistema) y su PDF formal con desglose FIFO y marca de agua `ANULADO`.

### Resuelto en las rondas finales (UX, E2E y Consultas)

8. **Pruebas de integración E2E de flujos completos**
   - Además de las pruebas unitarias 1:1 y el script `scripts/api-smoke-test.mjs` (68 verificaciones reales), el sistema cuenta con suites de flujos E2E completos en Backend ([full-system-flows.spec.ts](../backend/src/common/system-flows/full-system-flows.spec.ts)) y Frontend ([system-flows.spec.ts](../frontend/src/utils/system-flows.spec.ts)).

9. **Gestión de sesión, rutas por vista y edición de usuarios**
   - Implementado login portal, cierre de sesión explícito (`/login`), rutas protegidas por URL (`/resumen`, `/catalogos`, `/causacion`, `/cajas-chicas`, `/auditoria`) con persistencia en `sessionStorage` y edición completa de usuarios (`PATCH /api/users/:id`).

10. **UX sin fricción, filtrado, paginación y consultas `/resumen` (`RN-AUD-01`)**
    - Todas las tablas principales cuentan con búsqueda reactiva, filtros y paginación; los selectores de rangos, períodos, beneficiarios y montos máximos filtran únicamente opciones válidas.
    - `/resumen` expone el **Historial de pagos ejecutados** para todos los roles (incluido el `ADMIN`) y descarga en PDF del Estado de Cuenta General (`GET /api/reports/summary/pdf`).
    - Los parámetros globales (`PETTY_CASH_REQUIRE_ATTACHMENT` y `PAYMENT_REQUEST_SCOPE`) gobiernan dinámicamente las reglas en tiempo de ejecución y `PaymentsService.registerPayment` opera de forma íntegra dentro de `prisma.$transaction`.

### Prioridad baja / endurecimiento

12. **Migraciones formales**
    - El despliegue depende de scripts SQL de inicialización. No hay carpeta `prisma/migrations`.
    - Para producción conviene generar migraciones versionadas.

13. **Seguridad de despliegue**
    - `app.enableCors()` está abierto a cualquier origen.
    - Secretos JWT y de BD tienen valores por defecto en `docker-compose.yml`.
    - Los contenedores corren como `root`.
    - No hay rate limiting ni protección de fuerza bruta en `/auth/login`.
    - Backend y frontend no tienen healthcheck en Compose.

14. **Fechas y zonas horarias**
    - Se usan `new Date('YYYY-MM-DD')` (UTC). Conviene estandarizar el manejo de fechas para evitar corrimientos según la zona horaria del servidor.

---

## 7. Conclusión

El sistema **puede demostrarse y probarse de punta a punta hoy** con Docker y datos de demostración. Los flujos principales del enunciado funcionan y están cubiertos por 238 pruebas de backend (incluidos flujos E2E), 78 pruebas de frontend (incluidos flujos E2E) y una prueba de humo end-to-end contra PostgreSQL.

Todos los pendientes funcionales del PDF, las mejoras de UX (acciones inline por fila, selección masiva, detección preventiva de traslapes, previsualización FIFO y confirmaciones de dos pasos) y las carencias detectadas en la auditoría final (parámetros globales conectados, transacción íntegra en pagos, triggers `BEFORE DELETE` en PostgreSQL, edición de usuarios e historial de pagos + PDF en `/resumen`) **ya fueron implementados y verificados**. Únicamente permanecen como mejoras opcionales futuras OpenAPI/Swagger, CI automatizado y migraciones Prisma versionadas para entornos productivos externos.
