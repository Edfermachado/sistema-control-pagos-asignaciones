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

El script valida salud, login de los tres roles, RBAC, catálogos, prorrateo, solicitud, aprobación, pago parcial/total FIFO, sobrepago, anulación con reversión, cierre, PDFs, caja chica completa, usuarios y auditoría. **Resultado actual: 40/40 verificaciones en verde.**

### 2.4 Pruebas unitarias

```bash
npm --prefix backend test -- --runInBand   # 27 suites / 188 tests
npm --prefix frontend test                 # 5 suites / 25 tests
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
| Backend: 27 suites / 188 pruebas | ✅ 188/188 |
| Frontend: 5 suites / 25 pruebas | ✅ 25/25 |
| `docker compose up -d --build` | ✅ |
| Login de los 3 roles con el seed SQL | ✅ |
| Health check con conexión a PostgreSQL | ✅ |
| Prueba de humo API end-to-end | ✅ 40/40 |
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
| Proyectos con área, ámbito y vigencia | ✅ Implementado | Falta edición completa desde UI. |
| Grupos de pago con periodicidad y cortes | ✅ Implementado | Solo creación y listado. |
| Asignaciones persona-proyecto-grupo | ✅ Implementado | Con bloqueo de solapamientos. |
| Prorrateo exacto por días | ✅ Implementado | `Decimal.js`, `ROUND_HALF_UP`, probado. |
| Causación por lote | ✅ Implementado | Con control de duplicidad. |
| Flujo de solicitudes y pagos | ✅ Implementado | Estados y transiciones probados. |
| Pagos parciales FIFO | ✅ Implementado | Con `payment_allocations`. |
| Inmutabilidad y anulaciones justificadas | ⚠️ Parcial | Pagos y causaciones sí; faltan anulaciones de lote, solicitud y vale. |
| Cajas chicas múltiples por proyecto | ✅ Implementado | Apertura, vales, desembolso, rendición y arrastre. |
| PDF de recibo y solicitud consolidada | ✅ Implementado | PDF 1.4 nativo, sin librerías externas. |
| `audit_log` con quién/cuándo/qué | ⚠️ Parcial | Registro por servicio; no hay trigger de BD ni interceptor global. |
| Parámetros del sistema | ❌ No implementado | El modelo `SystemParameter` existe, pero no hay API ni UI. |
| Adjuntar comprobante de rendición | ⚠️ Parcial | Se exige referencia de factura, pero no hay carga real de archivo. |
| Seed ficticio completo | ✅ Implementado | SQL y Prisma, con datos financieros y de caja chica. |
| README de instalación/ejecución | ✅ Implementado | Actualizado y validado. |
| Bitácora de uso de IA | ✅ Implementado | Ver `docs/BITACORA_IA.md`. |

---

## 6. Pendientes y riesgos priorizados

### Prioridad alta (completar antes de la defensa)

1. **Módulo de parámetros del sistema (`SystemParameter`)**
   - El enunciado indica que el Administrador gestiona parámetros. Hoy solo existe la tabla.
   - Falta API (`GET/PATCH /api/parameters`) y pantalla en el workspace ADMIN.

2. **Completar el ciclo de anulaciones**
   - Faltan endpoints/servicios para anular:
     - lote de causación (`ACCRUAL_BATCH`),
     - solicitud de pago (`PAYMENT_REQUEST`),
     - vale de caja chica (`PETTY_CASH_VOUCHER`).
   - Los tipos ya existen en el enum, pero no se usan.

3. **Rechazo y anulación de vales de caja chica**
   - El estado `RECHAZADO` existe, pero no hay endpoint para rechazar un vale.
   - Tampoco hay cierre definitivo de la caja chica (`PettyCashStatus.CERRADA`).

4. **Integridad de la solicitud de pago**
   - Una misma causación puede incluirse en dos solicitudes activas simultáneas.
   - El pago FIFO se aplica sobre todas las causaciones pendientes del beneficiario/proyecto, no solo sobre los ítems de la solicitud; esto puede hacer que `paidAmount` supere `totalAmount` de la solicitud.
   - Al anular un pago de una solicitud ya `CERRADA`, la solicitud no se reabre y queda inconsistente.

5. **Carga real de comprobantes**
   - El campo `attachment_url` existe, pero no hay endpoint de subida ni control de archivo en la UI.
   - El directorio `uploads/` está montado, pero sin uso.

### Prioridad media

6. **Auditoría a nivel de base de datos**
   - Hoy la auditoría se escribe manualmente en cada servicio.
   - Para cumplir estrictamente “qué cambió en la base de datos”, conviene agregar triggers PostgreSQL o un interceptor global de Prisma.
   - También conviene impedir `UPDATE`/`DELETE` sobre `audit_logs` a nivel de BD (tabla append-only real).

7. **Documentación de API**
   - No hay Swagger/OpenAPI. Agregar `@nestjs/swagger` facilitaría pruebas manuales y defensa.

8. **Pruebas de integración y CI**
   - Las 188 + 25 pruebas son unitarias con mocks.
   - El script `scripts/api-smoke-test.mjs` cubre el flujo real, pero no está integrado en CI.
   - No hay pipeline (GitHub Actions) que ejecute tests, build y smoke test.

9. **Gestión de sesión y contraseñas**
   - No hay logout, refresh token, cambio de contraseña ni recuperación.
   - El JWT se guarda solo en memoria (correcto para seguridad), pero al recargar se vuelve a autenticar automáticamente con credenciales demo.

10. **CRUD incompleto desde UI**
    - Proyectos: no hay edición de nombre/fechas, solo cambio de estado.
    - Beneficiarios: la API permite actualizar, pero la UI solo crea.
    - Grupos de pago: solo creación y listado.
    - No hay filtros, paginación ni búsqueda en tablas grandes.

### Prioridad baja / endurecimiento

11. **Migraciones formales**
    - El despliegue depende de scripts SQL de inicialización. No hay carpeta `prisma/migrations`.
    - Para producción conviene generar migraciones versionadas.

12. **Seguridad de despliegue**
    - `app.enableCors()` está abierto a cualquier origen.
    - Secretos JWT y de BD tienen valores por defecto en `docker-compose.yml`.
    - Los contenedores corren como `root`.
    - No hay rate limiting ni protección de fuerza bruta en `/auth/login`.
    - Backend y frontend no tienen healthcheck en Compose.

13. **PDF**
    - El estado `ANULADO` se muestra como banner de texto, no como marca de agua gráfica.
    - Las “firmas” son nombres/trazabilidad, no firma digital.

14. **Fechas y zonas horarias**
    - Se usan `new Date('YYYY-MM-DD')` (UTC). Conviene estandarizar el manejo de fechas para evitar corrimientos según la zona horaria del servidor.

---

## 7. Conclusión

El sistema **puede demostrarse y probarse de punta a punta hoy** con Docker y datos de demostración. Los flujos principales del enunciado funcionan y están cubiertos por pruebas unitarias y por la prueba de humo agregada.

Los pendientes más importantes para cerrar el alcance académico son: **parámetros del sistema, anulaciones faltantes, rechazo/cierre de cajas chicas, integridad de solicitudes/pagos y carga de comprobantes**. Los demás puntos son mejoras de robustez, seguridad y experiencia de usuario.
