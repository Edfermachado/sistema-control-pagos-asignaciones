import { BadRequestException } from '@nestjs/common';
import { PaymentRequestStatus } from '../../../common/constants/domain.enums';
import {
  assertPaymentRequestCanBeClosed,
  assertValidPaymentRequestTransition,
} from './payment-request-state.machine';

describe('payment-request-state.machine (RN-PAG-01 Flujo de Estados)', () => {
  describe('assertValidPaymentRequestTransition', () => {
    it('debe permitir el ciclo válido CREADA -> ENVIADA -> APROBADA -> ENTREGADA -> CERRADA (Happy Path)', () => {
      // Arrange & Act & Assert
      expect(() =>
        assertValidPaymentRequestTransition(
          PaymentRequestStatus.CREADA,
          PaymentRequestStatus.ENVIADA,
        ),
      ).not.toThrow();

      expect(() =>
        assertValidPaymentRequestTransition(
          PaymentRequestStatus.ENVIADA,
          PaymentRequestStatus.APROBADA,
        ),
      ).not.toThrow();

      expect(() =>
        assertValidPaymentRequestTransition(
          PaymentRequestStatus.APROBADA,
          PaymentRequestStatus.ENTREGADA,
        ),
      ).not.toThrow();

      expect(() =>
        assertValidPaymentRequestTransition(
          PaymentRequestStatus.ENTREGADA,
          PaymentRequestStatus.CERRADA,
        ),
      ).not.toThrow();
    });

    it('debe permitir múltiples entregas parciales manteniéndose en ENTREGADA -> ENTREGADA (Edge Case)', () => {
      // Arrange & Act & Assert
      expect(() =>
        assertValidPaymentRequestTransition(
          PaymentRequestStatus.ENTREGADA,
          PaymentRequestStatus.ENTREGADA,
        ),
      ).not.toThrow();
    });

    it('debe lanzar BadRequestException si se intenta saltar de CREADA a APROBADA o modificar una solicitud RECHAZADA/CERRADA (Violación RN-PAG-01)', () => {
      // Arrange & Act & Assert
      expect(() =>
        assertValidPaymentRequestTransition(
          PaymentRequestStatus.CREADA,
          PaymentRequestStatus.APROBADA,
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        assertValidPaymentRequestTransition(
          PaymentRequestStatus.RECHAZADA,
          PaymentRequestStatus.APROBADA,
        ),
      ).toThrow('[RN-PAG-01]');
    });
  });

  describe('assertPaymentRequestCanBeClosed', () => {
    it('debe permitir el cierre cuando está ENTREGADA y paidAmount === totalAmount (Happy Path)', () => {
      // Arrange & Act & Assert
      expect(() =>
        assertPaymentRequestCanBeClosed(
          PaymentRequestStatus.ENTREGADA,
          '900.00',
          '900.00',
        ),
      ).not.toThrow();
    });

    it('debe manejar comparación decimal exacta entre números y strings (Edge Case)', () => {
      // Arrange & Act & Assert
      expect(() =>
        assertPaymentRequestCanBeClosed(
          PaymentRequestStatus.ENTREGADA,
          450.5,
          '450.50',
        ),
      ).not.toThrow();
    });

    it('debe lanzar BadRequestException si aún queda saldo pendiente por pagar (Violación RN-PAG-01)', () => {
      // Arrange & Act & Assert
      expect(() =>
        assertPaymentRequestCanBeClosed(
          PaymentRequestStatus.ENTREGADA,
          '900.00',
          '600.00',
        ),
      ).toThrow(BadRequestException);
    });
  });
});
