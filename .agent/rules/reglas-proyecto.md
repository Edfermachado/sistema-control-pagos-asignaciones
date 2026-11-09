---
description: Reglas obligatorias de arquitectura, negocio y bitácora IA para el Sistema de Control de Pagos y Asignaciones (UC)
---

# Directrices Obligatorias para Agentes de IA y Desarrolladores

Cualquier agente de IA (Antigravity, Claude, Cursor, Copilot, etc.) que asista a cualquiera de los 4 integrantes del equipo en este repositorio **DEBE cumplir estrictamente** las siguientes directrices sin excepción:

## 1. Fuente de Verdad del Dominio
Antes de crear o modificar modelos de base de datos, servicios de backend o pantallas de frontend, lee y respeta las invariantes definidas en:
- `docs/REGLAS_DE_NEGOCIO.md`
- `docs/DECISIONES_TECNICAS_DEFENSA.md`

## 2. Stack y Separación de Capas (Inquebrantable)
- **Frontend (`/frontend`):** React + Vite + TypeScript + TailwindCSS. Es una SPA 100% cliente. Prohibido poner lógica de cálculo financiero o consultas directas en el frontend.
- **Backend (`/backend`):** NestJS (TypeScript) con Arquitectura Modular en Capas:
  - `*.controller.ts`: Solo manejo HTTP, validación de DTOs (`class-validator`) y decoradores `@Roles(...)`. Prohibido escribir consultas de Prisma o cálculos financieros en un controlador.
  - `*.service.ts`: Lógica de negocio, cálculos con `Decimal.js`, validación de reglas `RN-*` y llamadas transaccionales (`prisma.$transaction`).
  - `prisma/schema.prisma`: Modelo relacional PostgreSQL. Todos los campos de dinero en USD deben usar `@db.Decimal(12, 2)`.

## 3. Reglas Financieras Críticas que NUNCA debes violar
1. **Beneficiarios sin usuario (`RN-SEG-01`):** El personal que cobra (`Beneficiary`) NUNCA va en la tabla `User`. Son entidades separadas.
2. **Segregación de Funciones (`RN-SEG-02`):**
   - `ADMIN`: Solo gestiona usuarios, parámetros y catálogos base; ve auditoría. NO toca dinero.
   - `GENERADOR`: Gestiona proyectos, beneficiarios, asignaciones; genera causación por lote; crea/envía solicitudes de pago; solicita y rinde vales de caja chica. NO aprueba ni desembolsa dinero.
   - `RECEPTOR`: Aprueba/rechaza solicitudes de pago; registra entregas de fondos (pagos FIFO); aprueba aperturas y vales de caja chica, desembolsa y cierra mes.
3. **Prorrateo por días calendario reales (`RN-CAUS-01` a `03`):** Usa los días calendario reales e inclusivos del período (`fin - inicio + 1`) frente a la intersección de días activos de la asignación/proyecto.
4. **Pagos Parciales FIFO (`RN-PAG-02`):** Todo pago parcial debe aplicarse automáticamente a las causaciones pendientes más antiguas (`ORDER BY periodStart ASC, id ASC`) dejando trazabilidad en la tabla `PaymentAllocation`. Prohibido permitir sobrepagos.
5. **Inmutabilidad Financiera (`RN-GLOB-03` y `04`):** NUNCA crees endpoints `DELETE` ni `PUT/PATCH` para editar montos de causaciones, solicitudes enviadas, pagos, recibos o vales desembolsados. Toda corrección debe pasar por una **Anulación Justificada** (`Annulment`) con motivo obligatorio y reversión de saldos en una transacción ACID.
6. **Caja Chica sin saldo negativo (`RN-CAJA-02` a `04`):** Ningún vale puede aprobarse o desembolsarse si supera el saldo disponible actual de la caja chica. Al cerrar el mes, el saldo final se arrastra como saldo inicial del mes siguiente.
7. **Auditoría Obligatoria (`RN-AUD-03`):** Todo cambio en base de datos debe registrar quién (`userId`, `role`), cuándo (`createdAt`) y qué cambió (`oldValues`, `newValues` en JSONB) en `AuditLog`.

## 4. Registro Obligatorio en Bitácora de IA (Entregable #5)
Por exigencia académica de la asignatura Sistemas de Información (UC):
- Cada vez que un integrante utilice la IA para implementar una funcionalidad o módulo relevante, el agente **DEBE agregar una entrada resumida** al final de `docs/BITACORA_IA.md` indicando:
  1. El prompt o requerimiento solicitado por el estudiante.
  2. Los archivos creados/modificados y las reglas de negocio (`RN-*`) aplicadas.
  3. Una breve explicación técnica de cómo funciona el bloque generado para su defensa.
