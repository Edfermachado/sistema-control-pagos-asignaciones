import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  assertPositiveUsdAmount,
  toUsdDecimal,
  validateAnnulmentReason,
} from './money.helper';

describe('money.helper (RN-GLOB-01, RN-GLOB-02, RN-GLOB-04)', () => {
  describe('toUsdDecimal', () => {
    it('debe convertir y redondear a 2 decimales con ROUND_HALF_UP (Happy Path)', () => {
      // Arrange
      const rawAmount = '125.555';

      // Act
      const result = toUsdDecimal(rawAmount);

      // Assert
      expect(result).toBeInstanceOf(Decimal);
      expect(result.toFixed(2)).toBe('125.56');
    });

    it('debe evitar errores clásicos de punto flotante IEEE 754 como 0.1 + 0.2 (Edge Case)', () => {
      // Arrange
      const first = toUsdDecimal(0.1);
      const second = toUsdDecimal(0.2);

      // Act
      const sum = first.plus(second);

      // Assert
      expect(sum.toFixed(2)).toBe('0.30');
    });

    it('debe lanzar BadRequestException si el valor no es un número válido (Violación RN-GLOB-02)', () => {
      // Arrange
      const invalidInput = 'abc-usd';

      // Act & Assert
      expect(() => toUsdDecimal(invalidInput)).toThrow(BadRequestException);
      expect(() => toUsdDecimal('')).toThrow('[RN-GLOB-02]');
    });
  });

  describe('assertPositiveUsdAmount', () => {
    it('debe retornar el Decimal cuando el monto es mayor a 0.00 USD (Happy Path)', () => {
      // Arrange
      const input = '450.00';

      // Act
      const result = assertPositiveUsdAmount(input, 'amountPerPeriod');

      // Assert
      expect(result.toFixed(2)).toBe('450.00');
    });

    it('debe aceptar el monto mínimo positivo posible de $0.01 USD (Edge Case)', () => {
      // Arrange
      const minCent = 0.01;

      // Act
      const result = assertPositiveUsdAmount(minCent);

      // Assert
      expect(result.toFixed(2)).toBe('0.01');
    });

    it('debe lanzar BadRequestException cuando el monto es 0 o negativo (Violación RN-GLOB-02)', () => {
      // Arrange
      const zeroAmount = 0;
      const negativeAmount = -15.5;

      // Act & Assert
      expect(() => assertPositiveUsdAmount(zeroAmount)).toThrow(BadRequestException);
      expect(() => assertPositiveUsdAmount(negativeAmount)).toThrow('[RN-GLOB-02]');
    });
  });

  describe('validateAnnulmentReason', () => {
    it('debe retornar el motivo limpio si cumple la longitud mínima de 10 caracteres (Happy Path)', () => {
      // Arrange
      const rawReason = '  Error en la carga de fechas de corte del proyecto Física  ';

      // Act
      const cleanReason = validateAnnulmentReason(rawReason);

      // Assert
      expect(cleanReason).toBe(
        'Error en la carga de fechas de corte del proyecto Física',
      );
    });

    it('debe aceptar un motivo con exactamente 10 caracteres útiles (Edge Case)', () => {
      // Arrange
      const exactReason = '1234567890';

      // Act
      const result = validateAnnulmentReason(exactReason);

      // Assert
      expect(result).toHaveLength(10);
    });

    it('debe lanzar BadRequestException si el motivo está vacío o tiene menos de 10 caracteres (Violación RN-GLOB-04)', () => {
      // Arrange
      const shortReason = 'Error';

      // Act & Assert
      expect(() => validateAnnulmentReason(shortReason)).toThrow(BadRequestException);
      expect(() => validateAnnulmentReason('   ')).toThrow('[RN-GLOB-04]');
    });
  });
});
