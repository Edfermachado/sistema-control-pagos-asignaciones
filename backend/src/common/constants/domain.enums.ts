/**
 * Enumeraciones y Constantes del Dominio Financiero
 * Cumple con CC-04 (Cero Números o Strings Mágicos) y RN-GLOB / RN-SEG / RN-CAT / RN-PAG / RN-CAJA.
 */

export const CURRENCY_CODE = 'USD' as const;
export const DECIMAL_PLACES = 2 as const;
export const MIN_ANNULMENT_REASON_LENGTH = 10 as const;

export enum UserRole {
  ADMIN = 'ADMIN',
  GENERADOR = 'GENERADOR',
  RECEPTOR = 'RECEPTOR',
}

export enum ProjectArea {
  FISICA = 'FISICA',
  QUIMICA = 'QUIMICA',
  BIOLOGIA = 'BIOLOGIA',
}

export enum ProjectScope {
  INTERNO = 'INTERNO',
  EXTERNO = 'EXTERNO',
}

export enum ProjectStatus {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  CERRADO = 'CERRADO',
}

export enum Periodicity {
  SEMANAL = 'SEMANAL',
  QUINCENAL = 'QUINCENAL',
  MENSUAL = 'MENSUAL',
}

export enum AccrualStatus {
  PENDIENTE = 'PENDIENTE',
  PARCIAL = 'PARCIAL',
  PAGADO = 'PAGADO',
  ANULADO = 'ANULADO',
}

export enum PaymentRequestStatus {
  CREADA = 'CREADA',
  ENVIADA = 'ENVIADA',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  ENTREGADA = 'ENTREGADA',
  CERRADA = 'CERRADA',
  ANULADA = 'ANULADA',
}

export enum PettyCashVoucherStatus {
  SOLICITADO = 'SOLICITADO',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  DESEMBOLSADO = 'DESEMBOLSADO',
  RENDIDO = 'RENDIDO',
  ANULADO = 'ANULADO',
}
