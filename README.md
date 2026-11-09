# Sistema de Control de Pagos y Asignaciones (USD)

**Universidad de Carabobo — Facultad Experimental de Ciencias y Tecnología (FACES / Facyt)**  
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
  * **Inmutabilidad Financiera:** Prohibición de borrado o edición directa de registros financieros; corrección exclusiva mediante **Anulaciones Justificadas** con reversión transaccional.
* **Control de Cajas Chicas por Proyecto:**
  * Gestión de múltiples cajas chicas asignables a proyectos, con apertura mensual, solicitud de vales, aprobación por gerencia, desembolso, rendición con comprobante y arrastre automático de saldo al mes siguiente.
* **Reportes PDF y Auditoría (`audit_log`):**
  * Exportación en PDF de **Recibos Individuales** y **Solicitudes Consolidadas**.
  * Bitácora de auditoría inmutable (`audit_log`) en base de datos que registra quién, cuándo y qué cambió (`old_values` vs. `new_values` en `JSONB`).

---

## 2. Arquitectura y Stack Tecnológico

El sistema implementa una arquitectura **Cliente-Servidor Desacoplada** con separación estricta de capas:

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Cliente (Frontend)** | **React 18 + Vite + TypeScript** + TailwindCSS | Single Page Application (SPA) con control de acceso por rol y visualización reactiva. |
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
│   ├── DECISIONES_TECNICAS_DEFENSA.md  # Justificación arquitectónica y guía para la defensa
│   └── BITACORA_IA.md                  # Registro de prompts y uso de IA (Entregable #5)
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
git clone <URL_DEL_REPOSITORIO>
cd proyecto_final

# 2. Levantar la infraestructura completa (Base de Datos + Backend + Frontend)
docker compose up --build
```

*(Las credenciales de prueba para cada uno de los 3 roles y los comandos detallados de migración/seed se actualizarán conforme avance la implementación de la Etapa 0 y Etapa 1).*

---

## 6. Documentación Adicional para Evaluación

* 📘 [Especificación de Reglas de Negocio e Invariantes (`RN-*`)](./docs/REGLAS_DE_NEGOCIO.md)
* 📄 [Guía de Decisiones Técnicas y Sustentación para la Defensa](./docs/DECISIONES_TECNICAS_DEFENSA.md)
* 🤖 [Bitácora de Indicaciones y Uso de IA (Entregable #5)](./docs/BITACORA_IA.md)
* 🛡️ [Reglas Automáticas para Agentes de IA del Equipo](./.agent/rules/reglas-proyecto.md)
