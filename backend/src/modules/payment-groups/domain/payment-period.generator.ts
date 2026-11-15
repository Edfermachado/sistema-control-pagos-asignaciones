import { BadRequestException } from '@nestjs/common';
import { Periodicity } from '../../../common/constants/domain.enums';

export interface PaymentPeriodRange {
  periodStart: Date;
  periodEnd: Date;
  label: string;
}

const MIN_PERIOD_YEAR = 2000;
const MAX_PERIOD_YEAR = 2100;

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Genera los períodos estándar de un año según la periodicidad del grupo de pago.
 * El ADMIN puede luego agregar, editar o eliminar períodos personalizados.
 */
export function buildDefaultPaymentPeriods(
  periodicity: Periodicity,
  year: number,
): PaymentPeriodRange[] {
  if (
    !Number.isInteger(year) ||
    year < MIN_PERIOD_YEAR ||
    year > MAX_PERIOD_YEAR
  ) {
    throw new BadRequestException(
      `[RN-CAT-03] El año de los períodos debe estar entre ${MIN_PERIOD_YEAR} y ${MAX_PERIOD_YEAR}.`,
    );
  }

  if (periodicity === Periodicity.MENSUAL) {
    return Array.from({ length: 12 }, (_value, monthIndex) => ({
      periodStart: utcDate(year, monthIndex, 1),
      periodEnd: utcDate(year, monthIndex, lastDayOfMonth(year, monthIndex)),
      label: `Mes ${monthIndex + 1}`,
    }));
  }

  if (periodicity === Periodicity.QUINCENAL) {
    return Array.from({ length: 12 }).flatMap((_value, monthIndex) => {
      const lastDay = lastDayOfMonth(year, monthIndex);
      return [
        {
          periodStart: utcDate(year, monthIndex, 1),
          periodEnd: utcDate(year, monthIndex, 15),
          label: `Quincena 1 - Mes ${monthIndex + 1}`,
        },
        {
          periodStart: utcDate(year, monthIndex, 16),
          periodEnd: utcDate(year, monthIndex, lastDay),
          label: `Quincena 2 - Mes ${monthIndex + 1}`,
        },
      ];
    });
  }

  return Array.from({ length: 12 }).flatMap((_value, monthIndex) => {
    const lastDay = lastDayOfMonth(year, monthIndex);
    const periods: PaymentPeriodRange[] = [];
    let startDay = 1;
    let weekNumber = 1;

    while (startDay <= lastDay) {
      const endDay = Math.min(startDay + 6, lastDay);
      periods.push({
        periodStart: utcDate(year, monthIndex, startDay),
        periodEnd: utcDate(year, monthIndex, endDay),
        label: `Semana ${weekNumber} - Mes ${monthIndex + 1}`,
      });
      startDay = endDay + 1;
      weekNumber += 1;
    }

    return periods;
  });
}
