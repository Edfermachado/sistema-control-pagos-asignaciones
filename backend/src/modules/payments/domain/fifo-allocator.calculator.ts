import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { AccrualStatus } from '../../../common/constants/domain.enums';
import {
  assertPositiveUsdAmount,
  toUsdDecimal,
} from '../../../common/domain/money.helper';

export interface FifoAccrualCandidate {
  id: string;
  periodStart: Date;
  createdAt?: Date;
  paidAmount: string | number | Decimal;
  balanceDue: string | number | Decimal;
}

export interface FifoAllocationStep {
  accrualId: string;
  allocatedAmount: string;
  newPaidAmount: string;
  newBalanceDue: string;
  newStatus: AccrualStatus;
}

export interface FifoAllocationPlan {
  paymentAmount: string;
  totalDebtBeforePayment: string;
  remainingDebtAfterPayment: string;
  allocations: FifoAllocationStep[];
}

/**
 * Ordena las causaciones pendientes cronológicamente según RN-PAG-02 (periodStart ASC, createdAt ASC, id ASC).
 */
export function sortAccrualsForFifo(
  candidates: FifoAccrualCandidate[],
): FifoAccrualCandidate[] {
  return [...candidates].sort((a, b) => {
    const startDiff = a.periodStart.getTime() - b.periodStart.getTime();
    if (startDiff !== 0) {
      return startDiff;
    }

    const createdA = a.createdAt ? a.createdAt.getTime() : 0;
    const createdB = b.createdAt ? b.createdAt.getTime() : 0;
    if (createdA !== createdB) {
      return createdA - createdB;
    }

    return a.id.localeCompare(b.id);
  });
}

/**
 * Distribuye un pago (parcial o total) sobre la cola de causaciones pendientes aplicando prelación FIFO.
 * Cumple RN-PAG-02 y CC-03 (Función Pura de Dominio).
 */
export function allocatePaymentFifo(
  rawPaymentAmount: string | number | Decimal,
  candidates: FifoAccrualCandidate[],
): FifoAllocationPlan {
  const paymentAmount = assertPositiveUsdAmount(
    rawPaymentAmount,
    'paymentAmount',
  );

  const validCandidates = candidates.filter((c) =>
    toUsdDecimal(c.balanceDue).gt(0),
  );

  if (validCandidates.length === 0) {
    throw new BadRequestException(
      '[RN-PAG-02] El beneficiario no posee causaciones con saldo pendiente por pagar.',
    );
  }

  const orderedQueue = sortAccrualsForFifo(validCandidates);

  let totalDebt = new Decimal('0.00');
  for (const item of orderedQueue) {
    totalDebt = totalDebt.plus(toUsdDecimal(item.balanceDue));
  }

  if (paymentAmount.gt(totalDebt)) {
    throw new BadRequestException(
      `[RN-PAG-02] Sobrepago prohibido: el monto a entregar ($${paymentAmount.toFixed(2)}) supera la deuda pendiente ($${totalDebt.toFixed(2)}).`,
    );
  }

  let remainingToAllocate = paymentAmount;
  const allocations: FifoAllocationStep[] = [];

  for (const accrual of orderedQueue) {
    if (remainingToAllocate.lte(0)) {
      break;
    }

    const currentPaid = toUsdDecimal(accrual.paidAmount);
    const currentBalance = toUsdDecimal(accrual.balanceDue);

    const allocated = Decimal.min(remainingToAllocate, currentBalance);
    const newPaid = currentPaid.plus(allocated);
    const newBalance = currentBalance.minus(allocated);
    remainingToAllocate = remainingToAllocate.minus(allocated);

    allocations.push({
      accrualId: accrual.id,
      allocatedAmount: allocated.toFixed(2),
      newPaidAmount: newPaid.toFixed(2),
      newBalanceDue: newBalance.toFixed(2),
      newStatus: newBalance.eq(0)
        ? AccrualStatus.PAGADO
        : AccrualStatus.PARCIAL,
    });
  }

  return {
    paymentAmount: paymentAmount.toFixed(2),
    totalDebtBeforePayment: totalDebt.toFixed(2),
    remainingDebtAfterPayment: totalDebt.minus(paymentAmount).toFixed(2),
    allocations,
  };
}
