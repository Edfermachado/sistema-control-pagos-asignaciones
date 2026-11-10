import { BadRequestException } from '@nestjs/common';
import { AccrualStatus } from '../../../common/constants/domain.enums';
import {
  allocatePaymentFifo,
  sortAccrualsForFifo,
} from './fifo-allocator.calculator';

describe('fifo-allocator.calculator (RN-PAG-02 Prelación FIFO para Pagos Parciales)', () => {
  describe('sortAccrualsForFifo', () => {
    it('debe ordenar las causaciones desde la fecha de inicio de período más antigua a la más reciente (Happy Path)', () => {
      // Arrange
      const unsorted = [
        {
          id: 'acc-feb',
          periodStart: new Date('2026-02-01T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '300.00',
        },
        {
          id: 'acc-ene',
          periodStart: new Date('2026-01-01T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '300.00',
        },
      ];

      // Act
      const sorted = sortAccrualsForFifo(unsorted);

      // Assert
      expect(sorted[0].id).toBe('acc-ene');
      expect(sorted[1].id).toBe('acc-feb');
    });

    it('debe desempatar por createdAt y luego por id cuando periodStart es idéntico (Edge Case)', () => {
      // Arrange
      const samePeriod = new Date('2026-01-01T00:00:00Z');
      const unsorted = [
        {
          id: 'acc-b',
          periodStart: samePeriod,
          createdAt: new Date('2026-01-16T10:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '100.00',
        },
        {
          id: 'acc-a',
          periodStart: samePeriod,
          createdAt: new Date('2026-01-16T09:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '100.00',
        },
      ];

      // Act
      const sorted = sortAccrualsForFifo(unsorted);

      // Assert
      expect(sorted[0].id).toBe('acc-a');
    });

    it('no debe mutar el arreglo original de entrada (Inmutabilidad Pura)', () => {
      // Arrange
      const original = [
        {
          id: 'acc-2',
          periodStart: new Date('2026-02-01T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '100.00',
        },
        {
          id: 'acc-1',
          periodStart: new Date('2026-01-01T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '100.00',
        },
      ];

      // Act
      sortAccrualsForFifo(original);

      // Assert
      expect(original[0].id).toBe('acc-2');
    });
  });

  describe('allocatePaymentFifo', () => {
    it('debe saldar primero la deuda más antigua ($300) y abonar el resto ($100) a la segunda dejándola PARCIAL (Happy Path)', () => {
      // Arrange: Deuda Enero = $300, Deuda Febrero = $300 (Total $600). Pago Parcial = $400
      const candidates = [
        {
          id: 'acc-feb',
          periodStart: new Date('2026-02-01T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '300.00',
        },
        {
          id: 'acc-ene',
          periodStart: new Date('2026-01-01T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '300.00',
        },
      ];

      // Act
      const plan = allocatePaymentFifo('400.00', candidates);

      // Assert
      expect(plan.totalDebtBeforePayment).toBe('600.00');
      expect(plan.remainingDebtAfterPayment).toBe('200.00');
      expect(plan.allocations).toHaveLength(2);

      // Primero en entrar (Enero) -> PAGADO completo ($300)
      expect(plan.allocations[0]).toEqual({
        accrualId: 'acc-ene',
        allocatedAmount: '300.00',
        newPaidAmount: '300.00',
        newBalanceDue: '0.00',
        newStatus: AccrualStatus.PAGADO,
      });

      // Segundo en entrar (Febrero) -> PARCIAL ($100 pagado, $200 pendiente)
      expect(plan.allocations[1]).toEqual({
        accrualId: 'acc-feb',
        allocatedAmount: '100.00',
        newPaidAmount: '100.00',
        newBalanceDue: '200.00',
        newStatus: AccrualStatus.PARCIAL,
      });
    });

    it('debe completar una causación que ya estaba PARCIAL sin tocar las posteriores si el pago cubre exactamente su remanente (Edge Case)', () => {
      // Arrange
      const candidates = [
        {
          id: 'acc-ene-parcial',
          periodStart: new Date('2026-01-01T00:00:00Z'),
          paidAmount: '100.00',
          balanceDue: '200.00',
        },
        {
          id: 'acc-feb',
          periodStart: new Date('2026-02-01T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '300.00',
        },
      ];

      // Act
      const plan = allocatePaymentFifo('200.00', candidates);

      // Assert
      expect(plan.allocations).toHaveLength(1);
      expect(plan.allocations[0].accrualId).toBe('acc-ene-parcial');
      expect(plan.allocations[0].newPaidAmount).toBe('300.00');
      expect(plan.allocations[0].newBalanceDue).toBe('0.00');
      expect(plan.allocations[0].newStatus).toBe(AccrualStatus.PAGADO);
    });

    it('debe lanzar BadRequestException si se intenta pagar más de la deuda pendiente o si no hay deudas (Violación RN-PAG-02)', () => {
      // Arrange
      const candidates = [
        {
          id: 'acc-ene',
          periodStart: new Date('2026-01-01T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '300.00',
        },
      ];

      // Act & Assert (Sobrepago)
      expect(() => allocatePaymentFifo('300.01', candidates)).toThrow(
        BadRequestException,
      );

      // Act & Assert (Sin deuda pendiente)
      expect(() => allocatePaymentFifo('50.00', [])).toThrow('[RN-PAG-02]');
    });
  });
});
