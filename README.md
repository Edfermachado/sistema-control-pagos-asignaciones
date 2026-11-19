# Sistema de Control de Pagos y Asignaciones (USD)

**Universidad de Carabobo — Facultad Experimental de Ciencias y Tecnología (FACYT)**  
**Escuela de Computación — Asignatura: Sistemas de Información**

Sistema cliente-servidor con arquitectura modular en capas para la gestión, causación prorrateada, solicitudes de pago con prelación FIFO, control de cajas chicas y auditoría forense de asignaciones en dólares (USD) para proyectos de investigación en **Física, Química y Biología**.

---

## 1. Características Principales y Requerimientos Cubiertos

* **Segregación de Funciones (RBAC Estricto):**
  * **Administrador del Sistema (`ADMIN`):** Gestiona usuarios, parámetros globales y catálogos base. No participa en operaciones financieras ni de dinero.
  * **Generador de Nómina (`GENERADOR` - Coordinador General):** Gestiona proyectos, beneficiarios (quienes no poseen usuario en el sistema) y asignaciones; ejecuta el motor de causación por lote, crea solicitudes de pago y rinde vales de caja chica.
  * **Receptor de Nómina (`RECEPTOR` - Gerente de Administración):** Recibe, aprueba o rechaza solicitudes de pago, registra la entrega de fondos (totales o parciales) y autoriza aperturas/vales de cajas chicas.
* **Motor de Causación y Prorrateo Exacto:**
  * Cálculo automático del monto causado por período (semanal, quincenal o mensual) en función de los días activos de la asignación frente a los días totales del período utilizando aritmética decimal exacta (`NUMERIC(12,2)`).
  * Generación de causación por lote agrupado por proyecto y período.
* **Ciclo de Solicitudes, Pagos Parciales FIFO e Inmutabilidad:**
  * Flujo de estados controlado: `Creada` $\rightarrow$ `Enviada` $\rightarrow$ `Aprobada / Rechazada` $\rightarrow$ `Entrega de Fondos` $\rightarrow$ `Cerrada`.
  * Aplicación automática **FIFO (Primero en Entrar, Primero en Salir)** de pagos parciales sobre las deudas pendientes más antiguas.
  * **Inmutabilidad Financiera:** Prohibición de borrado o edición directa de registros financieros; corrección exclusiva mediante **Anulaciones Justificadas** con reversión transaccional para pagos, causaciones, lotes, solicitudes y vales.
  * **Integridad de solicitudes:** una causación no puede estar en dos solicitudes activas y el pago FIFO solo aplica a los ítems de la solicitud aprobada.
* **Catálogos Gestionables por el ADMIN:** proyectos, beneficiarios, grupos de pago y fechas de corte configurables desde la interfaz, con generación automática de períodos estándar.
* **Control de Cajas Chicas por Proyecto:**
  * Gestión de múltiples cajas chicas asignables a proyectos, con apertura mensual, solicitud de vales, aprobación/rechazo por gerencia, desembolso separado, rendición con archivo de comprobante y arrastre automático de saldo al mes siguiente.
* **Parámetros Globales del Sistema:**
  * CRUD clave-valor exclusivo del `ADMIN` para reglas operativas configurables.
* **Reportes PDF y Auditoría (`audit_log`):**
  * Exportación en PDF de **Recibos Individuales** y **Solicitudes Consolidadas**, con bloques de firma y marca de agua para documentos anulados.
  * Bitácora de auditoría inmutable (`audit_log`) con registro de negocio y **triggers PostgreSQL** que capturan los cambios reales de la base de datos (`old_values` vs. `new_values` en `JSONB`).

---

## 2. Arquitectura y Stack Tecnológico

El sistema implementa una arquitectura **Cliente-Servidor Desacoplada** con separación estricta de capas:

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Cliente (Frontend)** | **React 18 + Vite + TypeScript** + sistema de diseño CSS (`DESIGN.md`, cero estilos inline) | Single Page Application (SPA) con control de acceso por rol, rutas por vista y visualización reactiva. |
| **Servidor (Backend API)** | **NestJS (Node.js + TypeScript)** | Arquitectura modular en capas (`Controllers` $\rightarrow$ `Services` $\rightarrow$ `Repositories/Prisma`). |
| **Base de Datos** | **PostgreSQL 16 + Prisma ORM** | Integridad referencial, transacciones ACID, tipos decimales exactos (`NUMERIC`) y `JSONB` para auditoría. |
| **Infraestructura** | **Docker & Docker Compose** | Entorno reproducible simulando producción en un solo comando. |
| **Calidad (Testing)** | **Vitest / Jest** | Pruebas unitarias deterministas para prorrateo, pagos parciales FIFO e inmutabilidad. |

---

## 3. Estructura del Repositorio

```text
├── backend/                  # Servidor API REST en NestJS (Arquitectura Modular en Capas)
├── frontend/                 # Cliente Web SPA en React + Vite + TypeScript
├── database/                 # Scripts DDL de creación SQL y carga inicial (Seeds)
├── docs/
│   ├── GLOSARIO_Y_MODELO_DE_NEGOCIO.md # Glosario de términos financieros, ejemplos y modelo de negocio
│   ├── DECISIONES_TECNICAS_DEFENSA.md  # Justificación arquitectónica y guía para la defensa
│   ├── INFORME_ESTADO_Y_PENDIENTES.md  # Auditoría, validaciones y trabajo pendiente
│   └── BITACORA_IA.md                  # Registro de prompts y uso de IA (Entregable #5)
├── scripts/                  # Prueba de humo end-to-end de la API
├── docker-compose.yml        # Orquestación de contenedores (PostgreSQL + Backend + Frontend)
└── README.md                 # Documentación principal de instalación y despliegue
```

---

## 4. Plan de Desarrollo por Etapas

1. **Etapa 0 — Cimientos, Base de Datos y Bitácora IA:** Configuración de repositorio, Docker Compose, diseño del esquema relacional en PostgreSQL y documentación de defensa.
2. **Etapa 1 — Gestión de Catálogos, Segregación de Roles (RBAC) y Auditoría:** Autenticación JWT, guardias por rol (`ADMIN`, `GENERADOR`, `RECEPTOR`), CRUD de proyectos, grupos de pago, beneficiarios, asignaciones e interceptor de `audit_log`.
3. **Etapa 2 — Motor de Causación, Prorrateo y Pagos FIFO Inmutables:** Algoritmo de prorrateo por días activos, causación por lote, flujo de solicitudes, pagos parciales FIFO, anulaciones justificadas y pruebas unitarias.
4. **Etapa 3 — Control de Cajas Chicas y Generación de Reportes PDF:** Flujo mensual de cajas chicas con arrastre de saldo, generación de PDFs (Recibos Individuales y Solicitudes Consolidadas) y panel de consultas clave.
5. **Etapa 4 — Semilla de Datos (`Seed`), Pruebas Integrales y Despliegue:** Datos ficticios de prueba completos para demostración y validación final en contenedor.

---

## 5. Instrucciones de Instalación y Ejecución

### Requisitos Previos
* **Docker** y **Docker Compose** (recomendado para despliegue directo), o bien:
* **Node.js v20+** y **PostgreSQL 16+** (para ejecución manual en entorno local).

### Ejecución con Docker (Simulación de Producción)
```bash
# 1. Clonar el repositorio
git clone https://github.com/Edfermachado/sistema-control-pagos-asignaciones.git
cd sistema-control-pagos-asignaciones

# 2. Copiar archivo de variables de entorno
cp .env.example .env

# 3. Levantar la infraestructura completa (PostgreSQL 16 + DDL + Seed + Backend NestJS + Frontend React)
docker compose up -d --build
```
* **Frontend Web (SPA):** `http://localhost:5173`
* **Backend API REST:** `http://localhost:3000/api`
* **Health Check:** `http://localhost:3000/api/health`

> **Nota sobre el seed:** PostgreSQL ejecuta los scripts `database/*.sql` **solo la primera vez** que se crea el volumen. Si modifica los datos de demostración o desea volver al estado inicial, ejecute `docker compose down -v` y luego `docker compose up -d --build`. Esto elimina la base de datos y vuelve a cargar el seed.

### Prueba de humo end-to-end (API)
Con los contenedores levantados:
```bash
node scripts/api-smoke-test.mjs
```
El script crea datos de prueba con un sufijo único y valida autenticación, RBAC, catálogos, prorrateo, solicitudes, pagos FIFO, anulaciones, PDFs, cajas chicas y auditoría.

### Ejecución Manual en Entorno Local (Desarrollo y Pruebas Unitarias)
```bash
# 0. Crear la base de datos y cargar el esquema + datos de demostración
createdb scpa_db
psql -d scpa_db -f database/01_init_schema.sql
psql -d scpa_db -f database/02_seed_data.sql
psql -d scpa_db -f database/03_audit_triggers.sql

# Copiar variables de entorno del backend (ajustar DATABASE_URL si es necesario)
cp backend/.env.example backend/.env

# 1. Instalar dependencias y generar cliente Prisma en Backend
npm --prefix backend install
npm --prefix backend run prisma:generate

# 2. Ejecutar las 32 suites de Pruebas en Backend (256 tests unitarios y de flujos completos E2E con patrón AAA)
npm --prefix backend test -- --runInBand

# 3. Poblar datos iniciales de prueba completos (catálogos, asignaciones,
#    causaciones, solicitud, pago FIFO y caja chica con arrastre)
npm --prefix backend run prisma:seed

# 4. Instalar dependencias y ejecutar las 11 suites de Pruebas en Frontend (104 tests en Vitest, incl. flujos E2E)
npm --prefix frontend install
npm --prefix frontend test

# 5. Compilar ambos proyectos para producción
npm --prefix backend run build
npm --prefix frontend run build
```

---

## 6. Credenciales de Prueba Pre-cargadas (`Seed`)

El script SQL (`database/02_seed_data.sql`) y el sembrador de Prisma (`backend/prisma/seed.ts`) cargan automáticamente los tres roles segregados (**`RN-SEG-01`** a **`RN-SEG-04`**):

| Rol en el Sistema | Correo Electrónico | Contraseña | Responsabilidad Principal |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** (Administrador) | `admin@uc.edu.ve` | `PasswordUC2026!` | Gestión de usuarios, parámetros globales y auditoría (`audit_log`). No opera dinero. |
| **`GENERADOR`** (Coordinador General) | `coordinador@uc.edu.ve` | `PasswordUC2026!` | Proyectos, beneficiarios, asignaciones, motor de causación por lote, solicitudes de pago y rendición de vales de caja chica. |
| **`RECEPTOR`** (Gerente de Administración) | `gerente@uc.edu.ve` | `PasswordUC2026!` | Aprobación/rechazo de solicitudes, entrega de fondos con prelación FIFO, anulaciones justificadas y autorización/cierre de cajas chicas. |

> **Nota de Regla de Negocio (`RN-SEG-01`):** Los **Beneficiarios** (profesores, investigadores, técnicos de laboratorio y asistentes) están registrados exclusivamente en la tabla `beneficiaries` y **no poseen credenciales de acceso** al sistema.

---

## 7. Resumen de Endpoints REST Principales (`/api`)

* **Salud y Autenticación:** `GET /api/health`, `POST /api/auth/login`, `GET /api/auth/me`
* **Administración y Auditoría (`ADMIN`):** `GET/POST /api/users`, `PATCH /api/users/:id`, `PATCH /api/users/:id/status`, `GET /api/audit-logs`, `GET/POST /api/parameters`, `PATCH/DELETE /api/parameters/:id`
* **Catálogos y Asignaciones (`ADMIN` / `GENERADOR`):** `GET/POST /api/projects`, `PATCH /api/projects/:id`, `PATCH /api/projects/:id/status`, `GET/POST /api/payment-groups`, `PATCH /api/payment-groups/:id`, `GET/POST /api/payment-groups/:id/periods`, `DELETE /api/payment-groups/:id/periods/:periodId`, `GET/POST /api/beneficiaries`, `PATCH /api/beneficiaries/:id`, `GET/POST /api/assignments`, `PATCH /api/assignments/:id/deactivate`
* **Motor Financiero (`GENERADOR` / `RECEPTOR`):**
  * `POST /api/accruals/batches/preview`, `POST /api/accruals/batches`, `GET /api/accruals/batches`, `GET /api/accruals/beneficiary/:beneficiaryId/pending`
  * `GET/POST /api/payment-requests`, `PATCH /api/payment-requests/:id/send`, `PATCH /api/payment-requests/:id/review`, `PATCH /api/payment-requests/:id/close`
  * `GET/POST /api/payments`
  * `POST /api/annulments/payments/:paymentId`, `POST /api/annulments/accruals/:accrualId`, `POST /api/annulments/accrual-batches/:batchId`, `POST /api/annulments/payment-requests/:paymentRequestId`, `POST /api/annulments/petty-cash-vouchers/:voucherId`, `GET /api/annulments`
* **Cajas Chicas y Reportes PDF (`GENERADOR` / `RECEPTOR`):**
  * `POST /api/petty-cashes`, `POST /api/petty-cashes/:pettyCashId/periods`, `PATCH /api/petty-cashes/periods/:periodId/approve`, `PATCH /api/petty-cashes/periods/:periodId/close`, `PATCH /api/petty-cashes/:pettyCashId/close`
  * `POST /api/petty-cashes/periods/:periodId/vouchers`, `PATCH /api/petty-cashes/vouchers/:voucherId/approve`, `PATCH /api/petty-cashes/vouchers/:voucherId/reject`, `PATCH /api/petty-cashes/vouchers/:voucherId/disburse`, `PATCH /api/petty-cashes/vouchers/:voucherId/settle`
  * `POST /api/uploads` (comprobantes PDF/PNG/JPEG, hasta 5 MB)
  * `GET /api/reports/summary`, `GET /api/reports/summary/pdf`, `GET /api/reports/payments/:paymentId/pdf`, `GET /api/reports/payment-requests/:paymentRequestId/pdf`

---

## 8. Documentación Adicional para Evaluación

* 📖 [Glosario y Guía del Modelo de Negocio (`GLOSARIO_Y_MODELO_DE_NEGOCIO.md`)](./docs/GLOSARIO_Y_MODELO_DE_NEGOCIO.md) — definición pedagógica de causaciones, prorrateo, FIFO, cajas chicas, anulaciones y diccionario tabla-regla.
* 🎨 [Identidad visual y sistema de diseño (`DESIGN.md`)](./DESIGN.md) — tokens, tipografía, prohibiciones anti-*AI slop* y criterios de aceptación de interfaz.
* 📋 [Informe de Estado, Validación y Pendientes](./docs/INFORME_ESTADO_Y_PENDIENTES.md)
* 📘 [Especificación de Reglas de Negocio e Invariantes (`RN-*`)](./docs/REGLAS_DE_NEGOCIO.md)
* 🧪 [Estándares de Desarrollo, Clean Code y Unit Testing 1:1](./docs/ESTANDARES_DESARROLLO_CLEAN_CODE.md)
* 📄 [Guía de Decisiones Técnicas y Sustentación para la Defensa](./docs/DECISIONES_TECNICAS_DEFENSA.md)
* 🤖 [Bitácora de Indicaciones y Uso de IA (Entregable #5)](./docs/BITACORA_IA.md)
* 🛡️ [Reglas Automáticas para Agentes de IA del Equipo](./.agent/rules/reglas-proyecto.md)
