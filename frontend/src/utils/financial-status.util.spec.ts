import { describe, expect, it } from 'vitest';
import { AccrualStatus, PaymentRequestStatus } from '../types/domain.types';
import {
  getAccrualStatusMeta,
  getPaymentRequestStatusMeta,
} from './financial-status.util';

describe('financial-status.util (RN-CAUS-04 y RN-PAG-01 Metadatos de Estados Financieros)', () => {
  describe('getAccrualStatusMeta', () => {
    it('debe retornar la etiqueta y colores semánticos para PENDIENTE, PARCIAL y PAGADO (Happy Path)', () => {
      // Arrange & Act
      const pending = getAccrualStatusMeta(AccrualStatus.PENDIENTE);
      const partial = getAccrualStatusMeta(AccrualStatus.PARCIAL);
      const paid = getAccrualStatusMeta(AccrualStatus.PAGADO);

      // Assert
      expect(pending.label).toBe('Pendiente de Pago');
      expect(partial.label).toContain('FIFO');
      expect(paid.label).toBe('Pagado Total');
    });

    it('debe identificar el estado ANULADO como Anulado Justificado (Edge Case Inmutabilidad)', () => {
      // Arrange & Act
      const annulled = getAccrualStatusMeta(AccrualStatus.ANULADO);

      // Assert
      expect(annulled.label).toBe('Anulado Justificado');
    });

    it('debe lanzar Error si se recibe un estado de causación desconocido (Caso de Error)', () => {
      // Arrange & Act & Assert
      expect(() =>
        getAccrualStatusMeta('BORRADO' as unknown as AccrualStatus),
      ).toThrow('[RN-CAUS-04]');
    });
  });

  describe('getPaymentRequestStatusMeta', () => {
    it('debe reflejar la numeración secuencial del flujo de estados de Solicitud de Pago (Happy Path)', () => {
      // Arrange & Act
      const created = getPaymentRequestStatusMeta(PaymentRequestStatus.CREADA);
      const sent = getPaymentRequestStatusMeta(PaymentRequestStatus.ENVIADA);
      const approved = getPaymentRequestStatusMeta(PaymentRequestStatus.APROBADA);

      // Assert
      expect(created.label).toContain('1.');
      expect(sent.label).toContain('2.');
      expect(approved.label).toContain('3.');
    });

    it('debe retornar metadatos válidos para ENTREGADA, CERRADA y RECHAZADA (Edge Case)', () => {
      // Arrange & Act
      const delivered = getPaymentRequestStatusMeta(PaymentRequestStatus.ENTREGADA);
      const closed = getPaymentRequestStatusMeta(PaymentRequestStatus.CERRADA);
      const rejected = getPaymentRequestStatusMeta(PaymentRequestStatus.RECHAZADA);

      // Assert
      expect(delivered.label).toContain('4.');
      expect(closed.label).toContain('5.');
      expect(rejected.label).toContain('Rechazada');
    });

    it('debe lanzar Error citando [RN-PAG-01] si el estado de solicitud no es válido (Caso de Error)', () => {
      // Arrange & Act & Assert
      expect(() =>
        getPaymentRequestStatusMeta('INVALIDO' as unknown as PaymentRequestStatus),
      ).toThrow('[RN-PAG-01]');
    });
  });
});
