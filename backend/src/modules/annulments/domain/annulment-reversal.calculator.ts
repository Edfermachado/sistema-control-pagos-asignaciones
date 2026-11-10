import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { AccrualStatus } from '../../../common/constants/domain.enums';
import {
  assertPositiveUsdAmount,
  toUsdDecimal,
} from '../../../common/domain/money.helper';

export interface ReversedAccrualState {
  newPaidAmount: string;
  newBalanceDue: string;
  newStatus: AccrualStatus;
}

/**
 * Calcula los nuevos saldos y el estado de una causación al revertir un abono por Anulación de Pago.
 * Cumple RN-GLOB-03, RN-GLOB-04, RN-PAG-03 y CC-03 (Función Pura de Dominio).
 */
export function calculateAccrualStateAfterPaymentReversal(
  currentPaidAmount: string | number | Decimal,
  currentBalanceDue: string | number | Decimal,
  reversedAllocatedAmount: string | number | Decimal,
): ReversedAccrualState {
  const paidDec = toUsdDecimal(currentPaidAmount);
  const balanceDec = toUsdDecimal(currentBalanceDue);
  const reversedDec = assertPositiveUsdAmount(
    reversedAllocatedAmount,
    'reversedAllocatedAmount',
  );

  if (reversedDec.gt(paidDec)) {
    throw new BadRequestException(
      `[RN-PAG-03] Inconsistencia contable: no se puede revertir un abono ($${reversedDec.toFixed(2)}) mayor al monto pagado acumulado ($${paidDec.toFixed(2)}).`,
    );
  }

  const newPaid = paidDec.minus(reversedDec);
  const newBalance = balanceDec.plus(reversedDec);

  return {
    newPaidAmount: newPaid.toFixed(2),
    newBalanceDue: newBalance.toFixed(2),
    newStatus: newPaid.eq(0) ? AccrualStatus.PENDIENTE : AccrualStatus.PARCIAL,
  };
}
