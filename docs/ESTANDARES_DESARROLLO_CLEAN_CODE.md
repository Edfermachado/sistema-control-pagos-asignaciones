# Estándares de Desarrollo, Clean Code y Pruebas Unitarias (TDD / 1:1)

**Universidad de Carabobo — Escuela de Computación**  
**Asignatura:** Sistemas de Información  
**Proyecto:** Sistema de Control de Pagos y Asignaciones (USD)

> **PROPÓSITO:**  
> Garantizar que el código escrito por los **4 integrantes del equipo y sus agentes de IA** sea uniforme, legible, fácil de sustentar en la defensa y esté respaldado por **pruebas unitarias automatizadas en cada función**.

---

## 1. Principios de Clean Code Obligatorios

### 1.1. Tipado Estricto en TypeScript (Prohibido el uso de `any`)
* **Regla `CC-01`:** Queda prohibido el uso de `any`, `@ts-ignore` o conversiones inseguras (`as unknown as ...`).
* Toda entrada de datos en el Backend debe tener su **DTO (Data Transfer Object)** validado con `class-validator`, y toda respuesta o entidad debe tener su interfaz o tipo generado por Prisma.

### 1.2. Funciones Pequeñas y Principio de Responsabilidad Única (SRP)
* **Regla `CC-02`:** Cada función o método debe hacer **una sola cosa** y hacerla bien.
  * *Tamaño máximo recomendado:* **25 a 35 líneas por función**. Si un método de servicio supera ese límite, debe descomponerse en funciones auxiliares privadas o de dominio puras (ej. separar `calculateActiveDays()` de `createAccrualBatch()`).
  * *Máximo de parámetros:* Si una función recibe más de **3 parámetros**, agrupa los argumentos en un objeto tipado (ej. `params: CalculateProrationInput`).

### 1.3. Separación entre Funciones Puras de Dominio y Efectos Secundarios (I/O)
* **Regla `CC-03`:** Separa la **matemática financiera** de las **consultas a base de datos**:
  * Los algoritmos matemáticos críticos (cálculo de días activos, prorrateo en USD, distribución de pagos en cola FIFO, cálculo de saldo disponible de caja chica) deben implementarse como **funciones puras deterministas** (misma entrada $\rightarrow$ misma salida, sin depender de base de datos ni de `new Date()` implícito).
  * Los métodos del `Service` orquestan la lectura en Prisma, llaman a la función pura y persisten el resultado dentro de `prisma.$transaction(...)`.
  * **Ventaja para la Defensa:** Permite probar toda la matemática financiera en milisegundos y explicarla línea por línea ante el jurado sin ruido de SQL.

### 1.4. Cero "Números Mágicos" o "Strings Mágicos"
* **Regla `CC-04`:** Nunca uses literales sueltos como `'APROBADA'`, `'GENERADOR'` o `2` en medio de una condición.
* Utiliza siempre **Enums tipados** y constantes con nombre semántico:
  * `UserRole.ADMIN | UserRole.GENERADOR | UserRole.RECEPTOR`
  * `PaymentRequestStatus.CREADA | ENVIADA | APROBADA | RECHAZADA | ENTREGADA | CERRADA`
  * `DECIMAL_PLACES = 2`, `MIN_ANNULMENT_REASON_LENGTH = 10`

### 1.5. Nombres con Intención Semántica (Ubiquitous Language)
* **Regla `CC-05`:** El código (variables, funciones, clases, tablas) se escribe en **inglés técnico consistente** alineado con el dominio financiero, mientras que los mensajes de error al usuario, comentarios de reglas de negocio (`// Cumple RN-CAUS-02`) y descripciones de tests pueden estar en español claro:
  * **Beneficiario:** `Beneficiary` (nunca `Employee` o `WorkerUser`)
  * **Proyecto:** `Project`
  * **Grupo de Pago:** `PaymentGroup`
  * **Asignación:** `Assignment`
  * **Causación:** `Accrual` / `AccrualBatch`
  * **Solicitud de Pago:** `PaymentRequest`
  * **Pago y Prelación FIFO:** `Payment` / `PaymentAllocation`
  * **Anulación Justificada:** `Annulment`
  * **Caja Chica y Vale:** `PettyCash` / `PettyCashPeriod` / `PettyCashVoucher`
  * **Auditoría:** `AuditLog`

### 1.6. Retorno Temprano (Guard Clauses) y Manejo Explícito de Errores
* **Regla `CC-06`:** Evita anidar múltiples bloques `if / else if / else` (código "flecha"). Usa **Guard Clauses** (validaciones al inicio de la función que lanzan una excepción descriptiva si no se cumple una precondición):

```typescript
// ❌ INCORRECTO (Anidamiento profundo)
if (project) {
  if (project.status === ProjectStatus.ACTIVE) {
    if (amount > 0) {
      // lógica...
    }
  }
}

// ✅ CORRECTO (Clean Code con Guard Clauses y referencia a Regla de Negocio)
if (!project) {
  throw new NotFoundException(`El proyecto con ID ${projectId} no existe.`);
}
if (project.status !== ProjectStatus.ACTIVE) {
  throw new BadRequestException('[RN-CAT-02] No se puede causar en un proyecto inactivo.');
}
if (amount.lte(0)) {
  throw new BadRequestException('[RN-GLOB-02] El monto debe ser mayor a 0.00 USD.');
}
```

---

## 2. Regla de Pruebas Unitarias 1:1 (Unit Test por Cada Función)

> **REGLA DE ORO (`TEST-01`):**  
> **Ninguna función de servicio (`*.service.ts`) o función utilitaria de dominio (`*.util.ts` / `*.helper.ts`) se considera terminada si no tiene su prueba unitaria correspondiente en un archivo `*.spec.ts` ejecutándose en verde.**

### 2.1. Estructura Obligatoria de cada Prueba Unitaria (Patrón AAA)
Toda prueba unitaria debe dividirse visualmente usando el patrón **AAA (Arrange, Act, Assert)**:
1. **Arrange (Preparar):** Configurar los datos de entrada y los mocks necesarios (`PrismaService`, `AuditService`).
2. **Act (Actuar):** Invocar la función específica bajo prueba.
3. **Assert (Verificar):** Comprobar el valor retornado, que los montos decimales sean exactos y que se hayan invocado (o bloqueado) las operaciones esperadas.

### 2.2. Cobertura Mínima por Función (3 Escenarios Obligatorios)
Por cada función de negocio creada, su bloque `describe('nombreDeLaFuncion', ...)` en el archivo `.spec.ts` debe incluir al menos:
1. **Caso Feliz (Happy Path):** La función recibe datos válidos y produce el resultado esperado.
2. **Caso Borde (Edge / Boundary Case):** Ejemplo: prorrateo de 1 solo día activo, pago parcial que cubre exactamente una deuda y deja \$0.01 en la siguiente, o vale de caja chica que consume exactamente el 100% del saldo disponible.
3. **Caso de Error / Invariante (`RN-*`):** La función lanza la excepción esperada (`BadRequestException`, `ForbiddenException`, `ConflictException`) cuando se intenta violar una regla de negocio (ej. sobrepago, saldo negativo en caja chica, anulación sin motivo o rol no autorizado).

### 2.3. Ejemplo Plantilla de Función Limpia + Unit Test (`*.spec.ts`)

```typescript
// src/modules/accruals/domain/proration.calculator.ts
import Decimal from 'decimal.js';

export interface ProrationInput {
  amountPerPeriod: Decimal;
  periodStart: Date;
  periodEnd: Date;
  assignmentStart: Date;
  assignmentEnd?: Date | null;
}

export interface ProrationResult {
  activeDays: number;
  totalPeriodDays: number;
  proratedAmount: Decimal;
}

/**
 * Calcula los días activos y el monto causado prorrateado según RN-CAUS-01, RN-CAUS-02 y RN-CAUS-03.
 */
export function calculateProratedAccrual(input: ProrationInput): ProrationResult {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const totalPeriodDays =
    Math.round((input.periodEnd.getTime() - input.periodStart.getTime()) / MS_PER_DAY) + 1;

  if (totalPeriodDays <= 0) {
    throw new Error('[RN-CAUS-01] El rango de fechas del período es inválido.');
  }

  const effectiveStart = new Date(
    Math.max(input.periodStart.getTime(), input.assignmentStart.getTime()),
  );
  const effectiveEnd = input.assignmentEnd
    ? new Date(Math.min(input.periodEnd.getTime(), input.assignmentEnd.getTime()))
    : input.periodEnd;

  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    return {
      activeDays: 0,
      totalPeriodDays,
      proratedAmount: new Decimal('0.00'),
    };
  }

  const activeDays =
    Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / MS_PER_DAY) + 1;

  const proratedAmount = input.amountPerPeriod
    .mul(activeDays)
    .div(totalPeriodDays)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { activeDays, totalPeriodDays, proratedAmount };
}
```

```typescript
// src/modules/accruals/domain/proration.calculator.spec.ts
import Decimal from 'decimal.js';
import { calculateProratedAccrual } from './proration.calculator';

describe('calculateProratedAccrual (RN-CAUS-01 a RN-CAUS-03)', () => {
  it('debe retornar el 100% del monto cuando la asignación estuvo activa todo el período (Happy Path)', () => {
    // Arrange
    const input = {
      amountPerPeriod: new Decimal('300.00'),
      periodStart: new Date('2026-11-01T00:00:00Z'),
      periodEnd: new Date('2026-11-15T00:00:00Z'),
      assignmentStart: new Date('2026-10-01T00:00:00Z'),
      assignmentEnd: null,
    };

    // Act
    const result = calculateProratedAccrual(input);

    // Assert
    expect(result.totalPeriodDays).toBe(15);
    expect(result.activeDays).toBe(15);
    expect(result.proratedAmount.toFixed(2)).toBe('300.00');
  });

  it('debe prorratear exactamente por días activos si ingresa a mitad de quincena (Edge Case)', () => {
    // Arrange: Entra el 11 de noviembre en una quincena de 15 días (5 días activos: 11, 12, 13, 14, 15)
    const input = {
      amountPerPeriod: new Decimal('300.00'),
      periodStart: new Date('2026-11-01T00:00:00Z'),
      periodEnd: new Date('2026-11-15T00:00:00Z'),
      assignmentStart: new Date('2026-11-11T00:00:00Z'),
      assignmentEnd: null,
    };

    // Act
    const result = calculateProratedAccrual(input);

    // Assert
    expect(result.activeDays).toBe(5);
    expect(result.proratedAmount.toFixed(2)).toBe('100.00');
  });

  it('debe retornar 0 días activos y $0.00 si la asignación inicia después del cierre del período', () => {
    // Arrange
    const input = {
      amountPerPeriod: new Decimal('300.00'),
      periodStart: new Date('2026-11-01T00:00:00Z'),
      periodEnd: new Date('2026-11-15T00:00:00Z'),
      assignmentStart: new Date('2026-11-20T00:00:00Z'),
      assignmentEnd: null,
    };

    // Act
    const result = calculateProratedAccrual(input);

    // Assert
    expect(result.activeDays).toBe(0);
    expect(result.proratedAmount.toFixed(2)).toBe('0.00');
  });
});
```

---

## 3. Reglas de Clean Code en el Frontend (React + Vite)

1. **Separación Vista vs. Lógica (`FE-01`):**
   * Los componentes `.tsx` en `/pages` o `/components` solo se encargan de mostrar datos y capturar eventos de usuario.
   * Las llamadas HTTP y manejo de estado de servidor deben vivir en Custom Hooks (`/hooks/useProjects.ts`, `/hooks/useAccruals.ts`) o servicios API tipados (`/services/api.ts`).
2. **Componentes Pequeños y Reutilizables (`FE-02`):**
   * Ningún archivo `.tsx` debe superar las **200 líneas**. Si una página tiene una tabla, un modal de creación y un filtro, divídelos en subcomponentes (`ProjectTable.tsx`, `CreateProjectModal.tsx`).
3. **Cero Cálculos Financieros Definitivos en el Cliente (`FE-03`):**
   * El Frontend nunca decide cuánto dinero corresponde pagar en FIFO ni si un vale cabe en la caja chica; muestra lo que el Backend calcula y valida.

---

## 4. Flujo de Trabajo en Git para los 4 Integrantes

1. **Ramas por Funcionalidad:**
   * `feat/etapa-0-infraestructura`
   * `feat/catalogos-y-roles`
   * `feat/motor-causacion-fifo`
   * `feat/cajas-chicas-y-pdf`
2. **Commits Semánticos (Conventional Commits):**
   * `feat(accruals): implementar cálculo de prorrateo según RN-CAUS-02`
   * `test(accruals): agregar pruebas unitarias para calculateProratedAccrual`
   * `fix(payments): validar prohibición de sobrepago en cola FIFO`
   * `docs(bitacora): registrar prompt de generación del módulo de cajas chicas`
3. **Checklist antes de hacer Push / Merge:**
   * [ ] ¿Corren todos los unit tests en verde (`npm test`)?
   * [ ] ¿El código compila sin errores de TypeScript (`npm run build`)?
   * [ ] ¿Se respetaron las reglas `RN-*` y la arquitectura modular?
   * [ ] ¿Se registró la interacción en `docs/BITACORA_IA.md`?
