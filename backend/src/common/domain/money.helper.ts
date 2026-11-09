import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  DECIMAL_PLACES,
  MIN_ANNULMENT_REASON_LENGTH,
} from '../constants/domain.enums';

/**
 * Convierte un valor numérico o cadena en una instancia de Decimal redondeada a 2 decimales.
 * Cumple RN-GLOB-01 y RN-GLOB-02 (Precisión Decimal Exacta en USD).
 */
export function toUsdDecimal(value: string | number | Decimal): Decimal {
  if (value === null || value === undefined || value === '') {
    throw new BadRequestException(
      '[RN-GLOB-02] El valor monetario en USD no puede ser nulo ni vacío.',
    );
  }

  let decimalValue: Decimal;
  try {
    decimalValue = new Decimal(value);
  } catch {
    throw new BadRequestException(
      `[RN-GLOB-02] El valor '${String(value)}' no es un monto decimal válido en USD.`,
    );
  }

  if (!decimalValue.isFinite()) {
    throw new BadRequestException(
      '[RN-GLOB-02] El monto monetario debe ser un número finito.',
    );
  }

  return decimalValue.toDecimalPlaces(DECIMAL_PLACES, Decimal.ROUND_HALF_UP);
}

/**
 * Valida que un monto en USD sea estrictamente positivo (> 0.00).
 * Cumple RN-GLOB-02 y CC-06 (Guard Clauses).
 */
export function assertPositiveUsdAmount(
  value: string | number | Decimal,
  fieldName = 'monto',
): Decimal {
  const amount = toUsdDecimal(value);

  if (amount.lte(0)) {
    throw new BadRequestException(
      `[RN-GLOB-02] El campo '${fieldName}' debe ser mayor a 0.00 USD.`,
    );
  }

  return amount;
}

/**
 * Valida que el motivo de una Anulación Justificada cumpla la longitud mínima obligatoria.
 * Cumple RN-GLOB-04 (Corrección vía Anulación Justificada).
 */
export function validateAnnulmentReason(reason: string): string {
  const trimmedReason = (reason ?? '').trim();

  if (trimmedReason.length < MIN_ANNULMENT_REASON_LENGTH) {
    throw new BadRequestException(
      `[RN-GLOB-04] Toda anulación justificada requiere un motivo de al menos ${MIN_ANNULMENT_REASON_LENGTH} caracteres.`,
    );
  }

  return trimmedReason;
}
