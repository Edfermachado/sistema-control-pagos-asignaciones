import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { DECIMAL_PLACES } from '../../../common/constants/domain.enums';
import { assertPositiveUsdAmount } from '../../../common/domain/money.helper';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface ProrationInput {
  amountPerPeriod: string | number | Decimal;
  periodStart: Date;
  periodEnd: Date;
  assignmentStart: Date;
  assignmentEnd?: Date | null;
  projectStart: Date;
  projectEnd: Date;
}

export interface ProrationResult {
  activeDays: number;
  totalPeriodDays: number;
  proratedAmount: Decimal;
  effectiveStart: Date | null;
  effectiveEnd: Date | null;
}

/**
 * Normaliza una fecha a medianoche UTC para cálculos exactos de días calendario.
 */
function toUtcMidnightMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Calcula los días calendario reales e inclusivos de un período: (fin - inicio) + 1.
 * Cumple RN-CAUS-01 y CC-03 (Función Pura de Dominio).
 */
export function calculateTotalCalendarDays(
  periodStart: Date,
  periodEnd: Date,
): number {
  if (
    !(periodStart instanceof Date) ||
    !(periodEnd instanceof Date) ||
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime())
  ) {
    throw new BadRequestException(
      '[RN-CAUS-01] Las fechas de inicio y fin del período deben ser válidas.',
    );
  }

  const startMs = toUtcMidnightMs(periodStart);
  const endMs = toUtcMidnightMs(periodEnd);

  if (endMs < startMs) {
    throw new BadRequestException(
      '[RN-CAUS-01] La fecha de fin del período no puede ser anterior a la fecha de inicio.',
    );
  }

  return Math.round((endMs - startMs) / MS_PER_DAY) + 1;
}

/**
 * Calcula la intersección exacta de días activos y el monto causado prorrateado en USD.
 * Cumple RN-CAUS-01, RN-CAUS-02 y RN-CAUS-03.
 */
export function calculateProratedAccrual(
  input: ProrationInput,
): ProrationResult {
  const baseAmount = assertPositiveUsdAmount(
    input.amountPerPeriod,
    'amountPerPeriod',
  );
  const totalPeriodDays = calculateTotalCalendarDays(
    input.periodStart,
    input.periodEnd,
  );

  const periodStartMs = toUtcMidnightMs(input.periodStart);
  const periodEndMs = toUtcMidnightMs(input.periodEnd);
  const assignmentStartMs = toUtcMidnightMs(input.assignmentStart);
  const assignmentEndMs = input.assignmentEnd
    ? toUtcMidnightMs(input.assignmentEnd)
    : toUtcMidnightMs(input.projectEnd);
  const projectStartMs = toUtcMidnightMs(input.projectStart);
  const projectEndMs = toUtcMidnightMs(input.projectEnd);

  const effectiveStartMs = Math.max(
    periodStartMs,
    assignmentStartMs,
    projectStartMs,
  );
  const effectiveEndMs = Math.min(periodEndMs, assignmentEndMs, projectEndMs);

  if (effectiveStartMs > effectiveEndMs) {
    return {
      activeDays: 0,
      totalPeriodDays,
      proratedAmount: new Decimal('0.00'),
      effectiveStart: null,
      effectiveEnd: null,
    };
  }

  const activeDays =
    Math.round((effectiveEndMs - effectiveStartMs) / MS_PER_DAY) + 1;

  const proratedAmount = baseAmount
    .mul(activeDays)
    .div(totalPeriodDays)
    .toDecimalPlaces(DECIMAL_PLACES, Decimal.ROUND_HALF_UP);

  return {
    activeDays,
    totalPeriodDays,
    proratedAmount,
    effectiveStart: new Date(effectiveStartMs),
    effectiveEnd: new Date(effectiveEndMs),
  };
}
