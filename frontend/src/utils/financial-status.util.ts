import { AccrualStatus, PaymentRequestStatus } from '../types/domain.types';

export interface StatusBadgeMeta {
  label: string;
  colorHex: string;
  backgroundHex: string;
}

/**
 * Devuelve los metadatos visuales para representar el estado de una Causación (RN-CAUS-04 / RN-PAG-02).
 */
export function getAccrualStatusMeta(status: AccrualStatus): StatusBadgeMeta {
  switch (status) {
    case AccrualStatus.PENDIENTE:
      return {
        label: 'Pendiente de Pago',
        colorHex: '#92400e',
        backgroundHex: '#fef3c7',
      };
    case AccrualStatus.PARCIAL:
      return {
        label: 'Pago Parcial (FIFO)',
        colorHex: '#1e40af',
        backgroundHex: '#dbeafe',
      };
    case AccrualStatus.PAGADO:
      return {
        label: 'Pagado Total',
        colorHex: '#065f46',
        backgroundHex: '#d1fae5',
      };
    case AccrualStatus.ANULADO:
      return {
        label: 'Anulado Justificado',
        colorHex: '#991b1b',
        backgroundHex: '#fee2e2',
      };
    default:
      throw new Error(`[RN-CAUS-04] Estado de causación no reconocido: ${String(status)}`);
  }
}

/**
 * Devuelve la etiqueta de progreso y estilo del flujo de una Solicitud de Pago (RN-PAG-01).
 */
export function getPaymentRequestStatusMeta(
  status: PaymentRequestStatus,
): StatusBadgeMeta {
  switch (status) {
    case PaymentRequestStatus.CREADA:
      return { label: '1. Creada', colorHex: '#334155', backgroundHex: '#f1f5f9' };
    case PaymentRequestStatus.ENVIADA:
      return { label: '2. Enviada a Gerencia', colorHex: '#1d4ed8', backgroundHex: '#dbeafe' };
    case PaymentRequestStatus.APROBADA:
      return { label: '3. Aprobada', colorHex: '#047857', backgroundHex: '#d1fae5' };
    case PaymentRequestStatus.RECHAZADA:
      return { label: '3. Rechazada', colorHex: '#b91c1c', backgroundHex: '#fee2e2' };
    case PaymentRequestStatus.ENTREGADA:
      return { label: '4. Fondos Entregados', colorHex: '#0f766e', backgroundHex: '#ccfbf1' };
    case PaymentRequestStatus.CERRADA:
      return { label: '5. Cerrada', colorHex: '#1e293b', backgroundHex: '#e2e8f0' };
    case PaymentRequestStatus.ANULADA:
      return { label: 'Anulada', colorHex: '#991b1b', backgroundHex: '#fee2e2' };
    default:
      throw new Error(`[RN-PAG-01] Estado de solicitud no reconocido: ${String(status)}`);
  }
}
