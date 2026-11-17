import { describe, expect, it } from 'vitest';
import { AccrualStatus } from '../types/domain.types';
import {
  analyzeBeneficiaryProjectAvailability,
  getDefaultVoucherSettlementDraft,
  isConfirmationArmed,
  simulateFifoPaymentPreview,
  summarizeAccrualSelection,
  toggleAllEligibleAccruals,
  validateInlineJustification,
} from './ux-workflows.util';

describe('ux-workflows.util', () => {
  describe('validateInlineJustification', () => {
    it('debe rechazar motivos con menos caracteres tras recortar espacios y calcular caracteres faltantes', () => {
      // Arrange
      const reason = '   Error   ';

      // Act
      const result = validateInlineJustification(reason, 10);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.trimmed).toBe('Error');
      expect(result.remainingChars).toBe(5);
    });

    it('debe aceptar motivos que cumplen la longitud mínima', () => {
      // Arrange
      const reason = 'Error de carga en monto';

      // Act
      const result = validateInlineJustification(reason, 10);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.remainingChars).toBe(0);
    });
  });

  describe('getDefaultVoucherSettlementDraft', () => {
    it('debe usar el monto desembolsado como borrador y tope máximo permitidos', () => {
      // Arrange
      const voucher = { requestedAmount: '50.00', disbursedAmount: '45.50' };

      // Act
      const draft = getDefaultVoucherSettlementDraft(voucher);

      // Assert
      expect(draft.settledAmount).toBe('45.50');
      expect(draft.maxAllowedAmount).toBe(45.5);
    });

    it('debe usar el monto solicitado cuando no existe disbursedAmount', () => {
      // Arrange
      const voucher = { requestedAmount: 60, disbursedAmount: null };

      // Act
      const draft = getDefaultVoucherSettlementDraft(voucher);

      // Assert
      expect(draft.settledAmount).toBe('60.00');
      expect(draft.maxAllowedAmount).toBe(60);
    });
  });

  describe('summarizeAccrualSelection y toggleAllEligibleAccruals', () => {
    const eligible = [
      { id: 'a1', balanceDue: '125.50', beneficiaryId: 'b1' },
      { id: 'a2', balanceDue: '250.25', beneficiaryId: 'b2' },
      { id: 'a3', balanceDue: '100.00', beneficiaryId: 'b1' },
    ];

    it('debe calcular subtotal, beneficiarios únicos y allSelected', () => {
      // Arrange
      const selectedIds = ['a1', 'a2'];

      // Act
      const summary = summarizeAccrualSelection(eligible, selectedIds);

      // Assert
      expect(summary.selectedCount).toBe(2);
      expect(summary.totalEligibleCount).toBe(3);
      expect(summary.allSelected).toBe(false);
      expect(summary.totalSelectedUsd).toBe(375.75);
      expect(summary.uniqueBeneficiariesCount).toBe(2);
    });

    it('debe seleccionar todas al faltar alguna y limpiar cuando ya están todas seleccionadas', () => {
      // Arrange & Act
      const allSelected = toggleAllEligibleAccruals(eligible, ['a1']);
      const cleared = toggleAllEligibleAccruals(eligible, allSelected);

      // Assert
      expect(allSelected).toEqual(['a1', 'a2', 'a3']);
      expect(cleared).toEqual([]);
    });
  });

  describe('analyzeBeneficiaryProjectAvailability', () => {
    const project = {
      id: 'proj-1',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };

    it('debe detectar traslape contra asignación existente y sugerir el tramo libre', () => {
      // Arrange
      const assignments = [
        {
          id: 'asig-1',
          beneficiaryId: 'ben-1',
          projectId: 'proj-1',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          isActive: true,
        },
      ];

      // Act
      const analysis = analyzeBeneficiaryProjectAvailability({
        project,
        beneficiaryId: 'ben-1',
        assignments,
        proposedStart: '2026-05-01',
        proposedEnd: '2026-08-31',
      });

      // Assert
      expect(analysis.hasOverlapConflict).toBe(true);
      expect(analysis.occupiedRanges).toEqual([
        { id: 'asig-1', startDate: '2026-01-01', endDate: '2026-06-30' },
      ]);
      expect(analysis.freeSubRanges).toEqual([
        { startDate: '2026-07-01', endDate: '2026-12-31' },
      ]);
      expect(analysis.suggestedRange).toEqual({
        startDate: '2026-07-01',
        endDate: '2026-12-31',
      });
    });

    it('debe ignorar asignaciones inactivas y calcular múltiples huecos libres', () => {
      // Arrange
      const assignments = [
        {
          id: 'asig-old',
          beneficiaryId: 'ben-1',
          projectId: 'proj-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isActive: false,
        },
        {
          id: 'asig-mid',
          beneficiaryId: 'ben-1',
          projectId: 'proj-1',
          startDate: '2026-04-01',
          endDate: '2026-08-31',
          isActive: true,
        },
      ];

      // Act
      const analysis = analyzeBeneficiaryProjectAvailability({
        project,
        beneficiaryId: 'ben-1',
        assignments,
        proposedStart: '2026-09-01',
        proposedEnd: '2026-12-31',
      });

      // Assert
      expect(analysis.hasOverlapConflict).toBe(false);
      expect(analysis.freeSubRanges).toEqual([
        { startDate: '2026-01-01', endDate: '2026-03-31' },
        { startDate: '2026-09-01', endDate: '2026-12-31' },
      ]);
    });
  });

  describe('simulateFifoPaymentPreview', () => {
    it('debe repartir un pago parcial cronológicamente marcando la más antigua PAGADO y la segunda PARCIAL', () => {
      // Arrange
      const allAccruals = [
        {
          id: 'acc-2',
          beneficiaryId: 'ben-1',
          periodStart: '2026-10-16',
          periodEnd: '2026-10-31',
          balanceDue: '200.00',
          status: AccrualStatus.PENDIENTE,
        },
        {
          id: 'acc-1',
          beneficiaryId: 'ben-1',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-15',
          balanceDue: '200.00',
          status: AccrualStatus.PENDIENTE,
        },
      ];
      const requestItems = [
        {
          accrual: {
            id: 'acc-2',
            beneficiaryId: 'ben-1',
            balanceDue: '200.00',
          },
        },
        {
          accrual: {
            id: 'acc-1',
            beneficiaryId: 'ben-1',
            balanceDue: '200.00',
          },
        },
      ];

      // Act
      const preview = simulateFifoPaymentPreview({
        paymentAmount: '300.00',
        requestItems,
        allAccruals,
        beneficiaryId: 'ben-1',
      });

      // Assert
      expect(preview.isValidAmount).toBe(true);
      expect(preview.totalBeneficiaryDebtInRequestUsd).toBe(400);
      expect(preview.remainingDebtAfterPaymentUsd).toBe(100);
      expect(preview.steps).toEqual([
        {
          accrualId: 'acc-1',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-15',
          previousBalanceUsd: 200,
          allocatedUsd: 200,
          newBalanceUsd: 0,
          resultingStatus: AccrualStatus.PAGADO,
        },
        {
          accrualId: 'acc-2',
          periodStart: '2026-10-16',
          periodEnd: '2026-10-31',
          previousBalanceUsd: 200,
          allocatedUsd: 100,
          newBalanceUsd: 100,
          resultingStatus: AccrualStatus.PARCIAL,
        },
      ]);
    });

    it('debe marcar isValidAmount=false si supera la deuda pendiente en la solicitud', () => {
      // Arrange
      const allAccruals = [
        {
          id: 'acc-1',
          beneficiaryId: 'ben-1',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-15',
          balanceDue: '150.00',
          status: AccrualStatus.PENDIENTE,
        },
      ];

      // Act
      const preview = simulateFifoPaymentPreview({
        paymentAmount: '200.00',
        requestItems: [
          {
            accrual: {
              id: 'acc-1',
              beneficiaryId: 'ben-1',
              balanceDue: '150.00',
            },
          },
        ],
        allAccruals,
        beneficiaryId: 'ben-1',
      });

      // Assert
      expect(preview.isValidAmount).toBe(false);
      expect(preview.steps[0].allocatedUsd).toBe(0);
    });
  });

  describe('isConfirmationArmed', () => {
    it('debe validar coincidencia exacta de clave de confirmación en dos pasos', () => {
      // Arrange & Act & Assert
      expect(isConfirmationArmed('CLOSE_REQ:r1', 'CLOSE_REQ:r1')).toBe(true);
      expect(isConfirmationArmed('CLOSE_REQ:r1', 'CLOSE_REQ:r2')).toBe(false);
      expect(isConfirmationArmed(null, 'CLOSE_REQ:r1')).toBe(false);
    });
  });
});

