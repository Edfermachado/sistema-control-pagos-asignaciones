import { describe, expect, it } from 'vitest';
import {
  calculatePettyCashUtilizationPercent,
  validateVoucherRequestInUi,
} from './petty-cash.util';

describe('petty-cash.util (RN-CAJA-02 y RN-CAJA-03 Utilidades de Caja Chica en UI)', () => {
  describe('calculatePettyCashUtilizationPercent', () => {
    it('debe calcular el porcentaje de consumo del fondo mensual (Happy Path)', () => {
      // Arrange: Apertura $200, Disponible $50 -> Usado $150 (75%)
      const percent = calculatePettyCashUtilizationPercent(200, 50);

      // Assert
      expect(percent).toBe(75);
    });

    it('debe retornar 0% cuando el saldo disponible es igual a la apertura y 100% cuando queda $0.00 (Edge Case)', () => {
      // Arrange & Act & Assert
      expect(calculatePettyCashUtilizationPercent(200, 200)).toBe(0);
      expect(calculatePettyCashUtilizationPercent(200, 0)).toBe(100);
    });

    it('debe lanzar Error si la apertura es <= 0 o si el disponible es negativo (Violación RN-CAJA-02)', () => {
      // Arrange & Act & Assert
      expect(() => calculatePettyCashUtilizationPercent(0, 0)).toThrow(
        '[RN-CAJA-02]',
      );
      expect(() => calculatePettyCashUtilizationPercent(200, -10)).toThrow(
        '[RN-CAJA-02]',
      );
    });
  });

  describe('validateVoucherRequestInUi', () => {
    it('debe permitir un vale cuyo monto sea menor al saldo disponible (Happy Path)', () => {
      // Arrange & Act
      const check = validateVoucherRequestInUi(45, 120);

      // Assert
      expect(check.allowed).toBe(true);
    });

    it('debe rechazar sin excepción (allowed: false) cuando el vale supera el saldo disponible (Edge Case Tope)', () => {
      // Arrange & Act
      const check = validateVoucherRequestInUi(150, 120);

      // Assert
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('[RN-CAJA-02]');
    });

    it('debe lanzar Error si se intenta solicitar un vale por monto 0 o negativo (Violación RN-CAJA-03)', () => {
      // Arrange & Act & Assert
      expect(() => validateVoucherRequestInUi(0, 100)).toThrow('[RN-CAJA-03]');
    });
  });
});
