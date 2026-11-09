import { describe, expect, it } from 'vitest';
import { formatUsdCurrency } from './currency.util';

describe('formatUsdCurrency (RN-GLOB-01 / TEST-01)', () => {
  it('debe formatear montos enteros y decimales al formato estándar USD (Happy Path)', () => {
    // Arrange
    const amount = '1500.5';

    // Act
    const formatted = formatUsdCurrency(amount);

    // Assert
    expect(formatted).toBe('$1,500.50');
  });

  it('debe formatear el valor 0 como $0.00 (Edge Case)', () => {
    // Arrange
    const zeroAmount = 0;

    // Act
    const formatted = formatUsdCurrency(zeroAmount);

    // Assert
    expect(formatted).toBe('$0.00');
  });

  it('debe lanzar un Error cuando el valor no es numérico o está vacío (Violación RN-GLOB-01)', () => {
    // Arrange
    const invalidInput = 'no-es-numero';

    // Act & Assert
    expect(() => formatUsdCurrency(invalidInput)).toThrow('[RN-GLOB-01]');
    expect(() => formatUsdCurrency('')).toThrow('[RN-GLOB-01]');
  });
});
