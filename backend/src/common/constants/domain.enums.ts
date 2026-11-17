/**
 * Enumeraciones y Constantes del Dominio Financiero
 * Cumple con CC-01 (Cero conversiones inseguras), CC-04 (Cero Números o Strings Mágicos)
 * y RN-GLOB / RN-SEG / RN-CAT / RN-PAG / RN-CAJA.
 */

export {
  AccrualBatchStatus,
  AccrualStatus,
  AnnulledEntityType,
  PaymentRequestStatus,
  PaymentStatus,
  Periodicity,
  PettyCashPeriodStatus,
  PettyCashStatus,
  PettyCashVoucherStatus,
  ProjectArea,
  ProjectScope,
  ProjectStatus,
  UserRole,
} from '@prisma/client';

export const CURRENCY_CODE = 'USD' as const;
export const DECIMAL_PLACES = 2 as const;
export const MAX_USD_AMOUNT = '9999999999.99' as const;
export const MIN_ANNULMENT_REASON_LENGTH = 10 as const;
export const MIN_REJECTION_REASON_LENGTH = 5 as const;

