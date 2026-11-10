import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PaymentRequestStatus } from '../../../common/constants/domain.enums';
import { toUsdDecimal } from '../../../common/domain/money.helper';

const ALLOWED_TRANSITIONS: Record<PaymentRequestStatus, PaymentRequestStatus[]> = {
  [PaymentRequestStatus.CREADA]: [
    PaymentRequestStatus.ENVIADA,
    PaymentRequestStatus.ANULADA,
  ],
  [PaymentRequestStatus.ENVIADA]: [
    PaymentRequestStatus.APROBADA,
    PaymentRequestStatus.RECHAZADA,
    PaymentRequestStatus.ANULADA,
  ],
  [PaymentRequestStatus.APROBADA]: [
    PaymentRequestStatus.ENTREGADA,
    PaymentRequestStatus.ANULADA,
  ],
  [PaymentRequestStatus.RECHAZADA]: [],
  [PaymentRequestStatus.ENTREGADA]: [
    PaymentRequestStatus.ENTREGADA,
    PaymentRequestStatus.CERRADA,
  ],
  [PaymentRequestStatus.CERRADA]: [],
  [PaymentRequestStatus.ANULADA]: [],
};

/**
 * Valida que la transición entre el estado actual y el nuevo estado de una Solicitud de Pago
 * respete el grafo dirigido definido en RN-PAG-01.
 */
export function assertValidPaymentRequestTransition(
  currentStatus: PaymentRequestStatus,
  targetStatus: PaymentRequestStatus,
): void {
  const validTargets = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  if (!validTargets.includes(targetStatus)) {
    throw new BadRequestException(
      `[RN-PAG-01] Transición de estado inválida en Solicitud de Pago: no se puede pasar de '${currentStatus}' a '${targetStatus}'.`,
    );
  }
}

/**
 *Verifica si una solicitud en estado ENTREGADA puede pasar a CERRADA (requiere deuda pagada al 100%).
 */
export function assertPaymentRequestCanBeClosed(
  currentStatus: PaymentRequestStatus,
  totalAmount: string | number | Decimal,
  paidAmount: string | number | Decimal,
): void {
  assertValidPaymentRequestTransition(
    currentStatus,
    PaymentRequestStatus.CERRADA,
  );

  const totalDec = toUsdDecimal(totalAmount);
  const paidDec = toUsdDecimal(paidAmount);

  if (!paidDec.eq(totalDec)) {
    throw new BadRequestException(
      `[RN-PAG-01] No se puede cerrar la solicitud: monto pagado ($${paidDec.toFixed(2)}) es menor al total solicitado ($${totalDec.toFixed(2)}).`,
    );
  }
}
