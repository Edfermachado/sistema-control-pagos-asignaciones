import { BadRequestException } from '@nestjs/common';
import { PettyCashVoucherStatus } from '../../../common/constants/domain.enums';
import {
  assertPeriodCanBeClosed,
  assertValidYearMonth,
  calculateBalanceAfterVoucherDisbursement,
  calculateBalanceAfterVoucherSettlement,
  calculateOpeningAvailableBalance,
} from './petty-cash-balance.calculator';

describe('petty-cash-balance.calculator (RN-CAJA-01 a RN-CAJA-04)', () => {
  describe('assertValidYearMonth', () => {
    it('debe validar y limpiar un período con formato YYYY-MM válido (Happy Path)', () => {
      // Arrange & Act
      const valid = assertValidYearMonth(' 2026-11 ');

      // Assert
      expect(valid).toBe('2026-11');
    });

    it('debe aceptar meses límite como enero (01) y diciembre (12) (Edge Case)', () => {
      // Arrange & Act & Assert
      expect(assertValidYearMonth('2026-01')).toBe('2026-01');
      expect(assertValidYearMonth('2026-12')).toBe('2026-12');
    });

    it('debe lanzar BadRequestException si el mes es 13 o el formato es inválido (Violación RN-CAJA-02)', () => {
      // Arrange & Act & Assert
      expect(() => assertValidYearMonth('2026-13')).toThrow(BadRequestException);
      expect(() => assertValidYearMonth('11-2026')).toThrow('[RN-CAJA-02]');
    });
  });

  describe('calculateOpeningAvailableBalance', () => {
    it('debe sumar el saldo arrastrado del mes anterior más la reposición inicial (Happy Path)', () => {
      // Arrange: Arrastre mes anterior = $45.50, Reposición = $154.50
      const opening = calculateOpeningAvailableBalance('45.50', '154.50');

      // Assert
      expect(opening).toBe('200.00');
    });

    it('debe permitir abrir el mes únicamente con el saldo arrastrado si la reposición es 0.00 (Edge Case)', () => {
      // Arrange & Act
      const opening = calculateOpeningAvailableBalance('80.00', '0.00');

      // Assert
      expect(opening).toBe('80.00');
    });

    it('debe lanzar BadRequestException si la suma inicial es 0 o si algún valor es negativo (Violación RN-CAJA-02)', () => {
      // Arrange & Act & Assert
      expect(() => calculateOpeningAvailableBalance('0.00', '0.00')).toThrow(
        BadRequestException,
      );
      expect(() => calculateOpeningAvailableBalance('-10.00', '100.00')).toThrow(
        '[RN-CAJA-02]',
      );
    });
  });

  describe('calculateBalanceAfterVoucherDisbursement', () => {
    it('debe descontar el monto del vale del saldo disponible actual (Happy Path)', () => {
      // Arrange & Act
      const remaining = calculateBalanceAfterVoucherDisbursement('200.00', '75.25');

      // Assert
      expect(remaining).toBe('124.75');
    });

    it('debe permitir desembolsar exactamente el 100% del saldo disponible dejando $0.00 (Edge Case)', () => {
      // Arrange & Act
      const remaining = calculateBalanceAfterVoucherDisbursement('120.00', '120.00');

      // Assert
      expect(remaining).toBe('0.00');
    });

    it('debe lanzar BadRequestException si el vale supera por $0.01 el saldo disponible (Violación Tope RN-CAJA-02)', () => {
      // Arrange & Act & Assert
      expect(() =>
        calculateBalanceAfterVoucherDisbursement('100.00', '100.01'),
      ).toThrow(BadRequestException);
    });
  });

  describe('calculateBalanceAfterVoucherSettlement', () => {
    it('debe calcular el vuelto devuelto y sumarlo de regreso al saldo disponible de la caja chica (Happy Path)', () => {
      // Arrange: Disponible en caja = $100, Vale desembolsado = $50, Gasto real en factura = $38.50 (Vuelto = $11.50)
      const result = calculateBalanceAfterVoucherSettlement(
        '100.00',
        '50.00',
        '38.50',
      );

      // Assert
      expect(result.returnedChange).toBe('11.50');
      expect(result.newAvailableBalance).toBe('111.50');
    });

    it('debe retornar vuelto $0.00 y mantener igual el saldo disponible cuando se gastó exactamente lo desembolsado (Edge Case)', () => {
      // Arrange & Act
      const result = calculateBalanceAfterVoucherSettlement(
        '100.00',
        '50.00',
        '50.00',
      );

      // Assert
      expect(result.returnedChange).toBe('0.00');
      expect(result.newAvailableBalance).toBe('100.00');
    });

    it('debe lanzar BadRequestException si el gasto rendido supera el vale o es negativo (Violación RN-CAJA-02 / RN-CAJA-03)', () => {
      // Arrange & Act & Assert
      expect(() =>
        calculateBalanceAfterVoucherSettlement('100.00', '50.00', '55.00'),
      ).toThrow(BadRequestException);

      expect(() =>
        calculateBalanceAfterVoucherSettlement('100.00', '50.00', '-5.00'),
      ).toThrow('[RN-CAJA-03]');
    });
  });

  describe('assertPeriodCanBeClosed', () => {
    it('debe permitir el cierre mensual cuando todos los vales están RENDIDO, RECHAZADO o ANULADO (Happy Path)', () => {
      // Arrange
      const statuses = [
        PettyCashVoucherStatus.RENDIDO,
        PettyCashVoucherStatus.RENDIDO,
        PettyCashVoucherStatus.RECHAZADO,
        PettyCashVoucherStatus.ANULADO,
      ];

      // Act & Assert
      expect(() => assertPeriodCanBeClosed(statuses)).not.toThrow();
    });

    it('debe permitir el cierre de un mes sin vales emitidos (Edge Case)', () => {
      // Arrange & Act & Assert
      expect(() => assertPeriodCanBeClosed([])).not.toThrow();
    });

    it('debe lanzar BadRequestException si existe algún vale DESEMBOLSADO sin rendir (Violación RN-CAJA-04)', () => {
      // Arrange
      const statuses = [
        PettyCashVoucherStatus.RENDIDO,
        PettyCashVoucherStatus.DESEMBOLSADO,
      ];

      // Act & Assert
      expect(() => assertPeriodCanBeClosed(statuses)).toThrow(
        BadRequestException,
      );
    });
  });
});
