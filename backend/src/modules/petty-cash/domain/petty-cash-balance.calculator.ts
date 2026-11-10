import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PettyCashVoucherStatus } from '../../../common/constants/domain.enums';
import {
  assertPositiveUsdAmount,
  toUsdDecimal,
} from '../../../common/domain/money.helper';

const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface VoucherSettlementResult {
  newAvailableBalance: string;
  returnedChange: string;
}

/**
 * Valida que el período mensual tenga el formato estricto 'YYYY-MM' (RN-CAJA-02).
 */
export function assertValidYearMonth(yearMonth: string): string {
  const clean = (yearMonth ?? '').trim();
  if (!YEAR_MONTH_REGEX.test(clean)) {
    throw new BadRequestException(
      `[RN-CAJA-02] El período mensual '${clean}' es inválido. Debe tener el formato 'YYYY-MM' (ej. 2026-11).`,
    );
  }
  return clean;
}

/**
 * Calcula el saldo inicial disponible al abrir un mes sumando el arrastre del mes anterior + reposición.
 * Cumple RN-CAJA-02 y RN-CAJA-04 (Arrastre de Saldo).
 */
export function calculateOpeningAvailableBalance(
  carryoverBalance: string | number | Decimal,
  initialReplenishment: string | number | Decimal,
): string {
  const carryoverDec = toUsdDecimal(carryoverBalance);
  const replenishmentDec = toUsdDecimal(initialReplenishment);

  if (carryoverDec.lt(0) || replenishmentDec.lt(0)) {
    throw new BadRequestException(
      '[RN-CAJA-02] El saldo arrastrado y la reposición inicial no pueden ser negativos.',
    );
  }

  const totalOpening = carryoverDec.plus(replenishmentDec);
  if (totalOpening.lte(0)) {
    throw new BadRequestException(
      '[RN-CAJA-02] La apertura mensual de caja chica debe contar con un saldo disponible mayor a 0.00 USD.',
    );
  }

  return totalOpening.toFixed(2);
}

/**
 * Calcula el nuevo saldo disponible tras desembolsar un vale, prohibiendo estrictamente el saldo negativo.
 * Cumple RN-CAJA-02 (Regla de Tope Estricto).
 */
export function calculateBalanceAfterVoucherDisbursement(
  currentAvailableBalance: string | number | Decimal,
  voucherAmount: string | number | Decimal,
): string {
  const availableDec = toUsdDecimal(currentAvailableBalance);
  const voucherDec = assertPositiveUsdAmount(voucherAmount, 'voucherAmount');

  if (voucherDec.gt(availableDec)) {
    throw new BadRequestException(
      `[RN-CAJA-02] Fondos insuficientes en caja chica: el vale ($${voucherDec.toFixed(2)}) supera el saldo disponible actual ($${availableDec.toFixed(2)}).`,
    );
  }

  return availableDec.minus(voucherDec).toFixed(2);
}

/**
 * Calcula el ajuste de saldo al rendir un vale con comprobante y devolver el vuelto sobrante si aplica.
 * Cumple RN-CAJA-03.
 */
export function calculateBalanceAfterVoucherSettlement(
  currentAvailableBalance: string | number | Decimal,
  disbursedAmount: string | number | Decimal,
  settledRealExpense: string | number | Decimal,
): VoucherSettlementResult {
  const availableDec = toUsdDecimal(currentAvailableBalance);
  const disbursedDec = assertPositiveUsdAmount(
    disbursedAmount,
    'disbursedAmount',
  );
  const settledDec = toUsdDecimal(settledRealExpense);

  if (settledDec.lt(0)) {
    throw new BadRequestException(
      '[RN-CAJA-03] El monto real gastado en la rendición no puede ser negativo.',
    );
  }

  if (settledDec.gt(disbursedDec)) {
    throw new BadRequestException(
      `[RN-CAJA-02] El gasto rendido ($${settledDec.toFixed(2)}) no puede superar el monto desembolsado en el vale ($${disbursedDec.toFixed(2)}).`,
    );
  }

  const returnedChange = disbursedDec.minus(settledDec);
  const newAvailableBalance = availableDec.plus(returnedChange);

  return {
    newAvailableBalance: newAvailableBalance.toFixed(2),
    returnedChange: returnedChange.toFixed(2),
  };
}

/**
 * Verifica que todos los vales activos del período estén rendidos (o rechazados/anulados) antes del cierre mensual.
 * Cumple RN-CAJA-04.
 */
export function assertPeriodCanBeClosed(
  voucherStatuses: PettyCashVoucherStatus[],
): void {
  const blockingStatuses: PettyCashVoucherStatus[] = [
    PettyCashVoucherStatus.SOLICITADO,
    PettyCashVoucherStatus.APROBADO,
    PettyCashVoucherStatus.DESEMBOLSADO,
  ];

  const hasPendingVouchers = voucherStatuses.some((status) =>
    blockingStatuses.includes(status),
  );

  if (hasPendingVouchers) {
    throw new BadRequestException(
      '[RN-CAJA-04] No se puede cerrar el mes de caja chica: existen vales pendientes de aprobación o de rendición con comprobante.',
    );
  }
}
