import { describe, expect, it } from 'vitest';
import {
  AccrualStatus,
  PaymentRequestStatus,
  Periodicity,
  ProjectStatus,
  UserRole,
} from '../types/domain.types';
import { formatUsdCurrency } from './currency.util';
import {
  getAccrualStatusMeta,
  getPaymentRequestStatusMeta,
} from './financial-status.util';
import {
  calculatePettyCashUtilizationPercent,
  validateVoucherRequestInUi,
} from './petty-cash.util';
import {
  clampDateRangeToWindow,
  filterValidCutoffPeriodsForProject,
  getNextSequentialYearMonth,
  getPayableBeneficiariesForRequest,
} from './range-validity.util';
import { getRoleDisplayLabel, getRolePermissions } from './rbac.util';
import {
  filterTableByProperty,
  paginateTableItems,
  searchTableItems,
} from './table-filter.util';
import {
  analyzeBeneficiaryProjectAvailability,
  getDefaultVoucherSettlementDraft,
  isConfirmationArmed,
  simulateFifoPaymentPreview,
  summarizeAccrualSelection,
  toggleAllEligibleAccruals,
  validateInlineJustification,
} from './ux-workflows.util';

describe('Flujos Completos del Sistema (Frontend E2E)', () => {
  it('Flujo 1: Asignación sin traslapes -> Cortes válidos -> Consolidación masiva -> Simulación FIFO parcial y liquidación total', () => {
    // 1. Arrange: Proyecto activo con fecha de fin anticipada (2026-11-30) y una asignación en el primer semestre
    const project = {
      id: 'proj-qui-02',
      code: 'QUI-2026-02',
      name: 'Síntesis Orgánica FACYT',
      startDate: '2026-01-01',
      endDate: '2026-11-30',
      status: ProjectStatus.ACTIVO,
    };

    const beneficiary = {
      id: 'ben-1',
      fullName: 'Dra. Elena Márquez',
      dni: 'V-19000111',
      isActive: true,
    };

    const existingAssignments = [
      {
        id: 'asig-sem1',
        beneficiaryId: beneficiary.id,
        projectId: project.id,
        paymentGroupId: 'pg-quincenal',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        isActive: true,
        beneficiary,
      },
    ];

    // 2. Act & Assert: Clamping de rango al proyecto y detección preventiva de traslape (UX #3 + RN-CAT-04)
    const clampedRange = clampDateRangeToWindow(
      '2026-05-01',
      '2026-12-31',
      project.startDate,
      project.endDate,
    );
    expect(clampedRange).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-11-30',
    });

    const overlapAnalysis = analyzeBeneficiaryProjectAvailability({
      project,
      beneficiaryId: beneficiary.id,
      assignments: existingAssignments,
      proposedStart: clampedRange.startDate,
      proposedEnd: clampedRange.endDate,
    });
    expect(overlapAnalysis.hasOverlapConflict).toBe(true);
    expect(overlapAnalysis.suggestedRange).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-11-30',
    });

    // El usuario aplica el tramo libre sugerido
    const freeRange = overlapAnalysis.suggestedRange!;
    const cleanAnalysis = analyzeBeneficiaryProjectAvailability({
      project,
      beneficiaryId: beneficiary.id,
      assignments: existingAssignments,
      proposedStart: freeRange.startDate,
      proposedEnd: freeRange.endDate,
    });
    expect(cleanAnalysis.hasOverlapConflict).toBe(false);

    const updatedAssignments = [
      ...existingAssignments,
      {
        id: 'asig-sem2',
        beneficiaryId: beneficiary.id,
        projectId: project.id,
        paymentGroupId: 'pg-quincenal',
        startDate: freeRange.startDate,
        endDate: freeRange.endDate,
        isActive: true,
        beneficiary,
      },
    ];

    // 3. Act & Assert: Filtrado de períodos de corte válidos para causar (excluye diciembre fuera de proyecto y lotes existentes)
    const cutoffPeriods = [
      {
        id: 'per-oct2',
        paymentGroupId: 'pg-quincenal',
        periodStart: '2026-10-16',
        periodEnd: '2026-10-31',
        label: 'Octubre 2da',
      },
      {
        id: 'per-nov1',
        paymentGroupId: 'pg-quincenal',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-15',
        label: 'Noviembre 1ra',
      },
      {
        id: 'per-nov2',
        paymentGroupId: 'pg-quincenal',
        periodStart: '2026-11-16',
        periodEnd: '2026-11-30',
        label: 'Noviembre 2da',
      },
      {
        id: 'per-dic1',
        paymentGroupId: 'pg-quincenal',
        periodStart: '2026-12-01',
        periodEnd: '2026-12-15',
        label: 'Diciembre 1ra',
      },
    ];

    const validBeforeBatch = filterValidCutoffPeriodsForProject({
      periods: cutoffPeriods,
      project,
      paymentGroupId: 'pg-quincenal',
      assignments: updatedAssignments,
      existingBatches: [
        {
          id: 'lote-oct2',
          projectId: project.id,
          paymentGroupId: 'pg-quincenal',
          periodStart: '2026-10-16',
          periodEnd: '2026-10-31',
          status: 'GENERADO',
        },
      ],
    });
    expect(validBeforeBatch.map((p) => p.id)).toEqual(['per-nov1', 'per-nov2']);

    // Al generar el lote de Noviembre 1ra, solo debe quedar Noviembre 2da
    const validAfterFirstBatch = filterValidCutoffPeriodsForProject({
      periods: cutoffPeriods,
      project,
      paymentGroupId: 'pg-quincenal',
      assignments: updatedAssignments,
      existingBatches: [
        {
          id: 'lote-oct2',
          projectId: project.id,
          paymentGroupId: 'pg-quincenal',
          periodStart: '2026-10-16',
          periodEnd: '2026-10-31',
          status: 'GENERADO',
        },
        {
          id: 'lote-nov1',
          projectId: project.id,
          paymentGroupId: 'pg-quincenal',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-15',
          status: 'GENERADO',
        },
      ],
    });
    expect(validAfterFirstBatch.map((p) => p.id)).toEqual(['per-nov2']);

    // 4. Act & Assert: Consolidación masiva de causaciones en Solicitud de Pago (UX #2)
    const accruals = [
      {
        id: 'acc-nov1',
        beneficiaryId: beneficiary.id,
        periodStart: '2026-11-01',
        periodEnd: '2026-11-15',
        balanceDue: '250.00',
        status: AccrualStatus.PENDIENTE,
      },
      {
        id: 'acc-nov2',
        beneficiaryId: beneficiary.id,
        periodStart: '2026-11-16',
        periodEnd: '2026-11-30',
        balanceDue: '250.00',
        status: AccrualStatus.PENDIENTE,
      },
    ];

    const selectedAll = toggleAllEligibleAccruals(accruals, []);
    const selectionSummary = summarizeAccrualSelection(accruals, selectedAll);
    expect(selectionSummary.allSelected).toBe(true);
    expect(selectionSummary.totalSelectedUsd).toBe(500);
    expect(selectionSummary.uniqueBeneficiariesCount).toBe(1);
    expect(getPaymentRequestStatusMeta(PaymentRequestStatus.CREADA).label).toBe(
      '1. Creada',
    );
    expect(
      getPaymentRequestStatusMeta(PaymentRequestStatus.APROBADA).label,
    ).toBe('3. Aprobada');

    // 5. Act & Assert: Pago parcial y luego total con simulación FIFO en vivo (UX #4 + range-validity)
    const approvedRequest = {
      status: PaymentRequestStatus.APROBADA,
      totalAmount: '500.00',
      paidAmount: '0.00',
      items: accruals.map((acc) => ({ accrual: acc })),
    };

    const payableEntries = getPayableBeneficiariesForRequest(approvedRequest, [
      beneficiary,
      { id: 'ben-sin-deuda', fullName: 'Otro', dni: 'V-99999999' },
    ]);
    expect(payableEntries).toHaveLength(1);
    expect(payableEntries[0].pendingInRequestUsd).toBe(500);

    const partialFifo = simulateFifoPaymentPreview({
      paymentAmount: '350.00',
      requestItems: approvedRequest.items,
      allAccruals: accruals,
      beneficiaryId: beneficiary.id,
    });
    expect(partialFifo.isValidAmount).toBe(true);
    expect(partialFifo.remainingDebtAfterPaymentUsd).toBe(150);
    expect(partialFifo.steps[0].resultingStatus).toBe(AccrualStatus.PAGADO);
    expect(partialFifo.steps[1].resultingStatus).toBe(AccrualStatus.PARCIAL);
    expect(partialFifo.steps[1].newBalanceUsd).toBe(150);
    expect(getAccrualStatusMeta(partialFifo.steps[1].resultingStatus).label).toBe(
      'Pago Parcial (FIFO)',
    );

    // Segundo abono por los $150.00 restantes
    const accrualsAfterPartial = [
      { ...accruals[1], balanceDue: '150.00', status: AccrualStatus.PARCIAL },
    ];
    const finalFifo = simulateFifoPaymentPreview({
      paymentAmount: '150.00',
      requestItems: [{ accrual: accrualsAfterPartial[0] }],
      allAccruals: accrualsAfterPartial,
      beneficiaryId: beneficiary.id,
    });
    expect(finalFifo.isValidAmount).toBe(true);
    expect(finalFifo.remainingDebtAfterPaymentUsd).toBe(0);
    expect(finalFifo.steps[0].resultingStatus).toBe(AccrualStatus.PAGADO);
    expect(formatUsdCurrency(finalFifo.steps[0].allocatedUsd)).toBe('$150.00');
  });

  it('Flujo 2: Ciclo completo de Caja Chica en Frontend (apertura secuencial, vales, rendición inline con vuelto y arrastre)', () => {
    // 1. Arrange & Act: Cálculo automático del mes secuencial siguiente tras cierre
    const nextYm = getNextSequentialYearMonth('2026-10');
    expect(nextYm).toBe('2026-11');

    // 2. Act & Assert: Validación de tope en vale antes de enviar y porcentaje de uso tras desembolso
    const openingTotal = 250;
    const validVoucherCheck = validateVoucherRequestInUi(80, openingTotal);
    expect(validVoucherCheck.allowed).toBe(true);
    expect(validateVoucherRequestInUi(300, openingTotal).allowed).toBe(false);

    const utilizationAfterDisbursement = calculatePettyCashUtilizationPercent(
      openingTotal,
      openingTotal - 80,
    );
    expect(utilizationAfterDisbursement).toBe(32);

    // 3. Act & Assert: Borrador inline de rendición de vale y retorno del vuelto (UX #1)
    const settlementDraft = getDefaultVoucherSettlementDraft({
      requestedAmount: '80.00',
      disbursedAmount: '80.00',
    });
    expect(settlementDraft.settledAmount).toBe('80.00');
    expect(settlementDraft.maxAllowedAmount).toBe(80);

    const actualInvoiceExpense = 55.5;
    const returnedChange = settlementDraft.maxAllowedAmount - actualInvoiceExpense;
    expect(returnedChange).toBe(24.5);
    expect(
      calculatePettyCashUtilizationPercent(openingTotal, 250 - 55.5),
    ).toBe(22);

    // 4. Act & Assert: Cierre de noviembre/diciembre y transición automática de año
    expect(getNextSequentialYearMonth('2026-11')).toBe('2026-12');
    expect(getNextSequentialYearMonth('2026-12')).toBe('2027-01');
  });

  it('Flujo 3: Matriz RBAC, filtrado/paginación de catálogos, justificación inline y confirmación en dos pasos', () => {
    // 1. Arrange & Assert: Segregación de funciones por rol (RN-SEG-02)
    expect(getRolePermissions(UserRole.ADMIN).canManageProjectsAndAssignments).toBe(
      false,
    );
    expect(
      getRolePermissions(UserRole.GENERADOR).canManageProjectsAndAssignments,
    ).toBe(true);
    expect(
      getRolePermissions(UserRole.RECEPTOR).canApproveAndDeliverFunds,
    ).toBe(true);
    expect(getRoleDisplayLabel(UserRole.ADMIN)).toContain('Administrador');

    // 2. Act & Assert: Filtrado, búsqueda y paginación combinados sobre grupos/proyectos
    const rows = Array.from({ length: 10 }, (_, idx) => ({
      id: `p-${idx + 1}`,
      code: `FIS-2026-${String(idx + 1).padStart(2, '0')}`,
      area: idx % 2 === 0 ? 'FISICA' : 'QUIMICA',
      periodicity: Periodicity.QUINCENAL,
    }));
    const fisicaOnly = filterTableByProperty(rows, 'area', 'FISICA');
    const searched = searchTableItems(fisicaOnly, 'FIS-2026-0', ['code']);
    const page1 = paginateTableItems(searched, 1, 2);
    expect(fisicaOnly).toHaveLength(5);
    expect(page1.totalPages).toBe(3);
    expect(page1.items).toHaveLength(2);

    // 3. Act & Assert: Justificación inline y confirmación explícita de 2 pasos (UX #1 y UX #5)
    expect(validateInlineJustification('Corto', 10).valid).toBe(false);
    expect(
      validateInlineJustification('Duplicado en carga de quincena', 10).valid,
    ).toBe(true);
    expect(isConfirmationArmed('CLOSE_REQ:req-1', 'CLOSE_REQ:req-1')).toBe(
      true,
    );
    expect(isConfirmationArmed('CLOSE_REQ:req-1', 'CLOSE_BOX:box-1')).toBe(
      false,
    );
  });
});
