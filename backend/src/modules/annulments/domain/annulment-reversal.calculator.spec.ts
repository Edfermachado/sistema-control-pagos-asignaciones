import { BadRequestException } from '@nestjs/common';
import { AccrualStatus } from '../../../common/constants/domain.enums';
import { calculateAccrualStateAfterPaymentReversal } from './annulment-reversal.calculator';

describe('annulment-reversal.calculator (RN-PAG-03 Reversión Contable por Anulación)', () => {
  it('debe restaurar el estado a PENDIENTE cuando se revierte el 100% de lo pagado en esa causación (Happy Path)', () => {
    // Arrange
    const currentPaid = '300.00';
    const currentBalance = '0.00';
    const reversedAmount = '300.00';

    // Act
    const state = calculateAccrualStateAfterPaymentReversal(
      currentPaid,
      currentBalance,
      reversedAmount,
    );

    // Assert
    expect(state).toEqual({
      newPaidAmount: '0.00',
      newBalanceDue: '300.00',
      newStatus: AccrualStatus.PENDIENTE,
    });
  });

  it('debe dejar el estado en PARCIAL si aún queda otro pago previo vigente sobre esa causación (Edge Case)', () => {
    // Arrange: Se habían pagado $250 en dos abonos ($150 + $100) de una causación de $300. Se anula el segundo abono de $100.
    const state = calculateAccrualStateAfterPaymentReversal(
      '250.00',
      '50.00',
      '100.00',
    );

    // Assert
    expect(state).toEqual({
      newPaidAmount: '150.00',
      newBalanceDue: '150.00',
      newStatus: AccrualStatus.PARCIAL,
    });
  });

  it('debe lanzar BadRequestException si el monto a revertir supera lo pagado (Violación RN-PAG-03)', () => {
    // Arrange & Act & Assert
    expect(() =>
      calculateAccrualStateAfterPaymentReversal('100.00', '200.00', '150.00'),
    ).toThrow(BadRequestException);
  });
});
