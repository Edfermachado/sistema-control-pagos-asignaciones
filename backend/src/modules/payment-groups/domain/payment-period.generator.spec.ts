import { BadRequestException } from '@nestjs/common';
import { Periodicity } from '../../../common/constants/domain.enums';
import { buildDefaultPaymentPeriods } from './payment-period.generator';

describe('payment-period.generator (RN-CAT-03 Fechas de Corte Adaptables)', () => {
  it('debe generar 12 períodos mensuales con el último día real de cada mes (Happy Path)', () => {
    // Act
    const periods = buildDefaultPaymentPeriods(Periodicity.MENSUAL, 2026);

    // Assert
    expect(periods).toHaveLength(12);
    expect(periods[1].periodStart.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(periods[1].periodEnd.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('debe generar 24 quincenas con corte en 15 y último día (Happy Path)', () => {
    // Act
    const periods = buildDefaultPaymentPeriods(Periodicity.QUINCENAL, 2026);

    // Assert
    expect(periods).toHaveLength(24);
    expect(periods[0].periodEnd.toISOString().slice(0, 10)).toBe('2026-01-15');
    expect(periods[1].periodStart.toISOString().slice(0, 10)).toBe('2026-01-16');
    expect(periods[1].periodEnd.toISOString().slice(0, 10)).toBe('2026-01-31');
  });

  it('debe generar semanas consecutivas y ajustar la última al fin de mes (Edge Case)', () => {
    // Act
    const periods = buildDefaultPaymentPeriods(Periodicity.SEMANAL, 2026);
    const januaryPeriods = periods.filter((period) =>
      period.periodStart.toISOString().startsWith('2026-01'),
    );

    // Assert
    expect(periods.length).toBeGreaterThan(48);
    expect(januaryPeriods[0].periodEnd.toISOString().slice(0, 10)).toBe('2026-01-07');
    expect(januaryPeriods.at(-1)?.periodEnd.toISOString().slice(0, 10)).toBe('2026-01-31');
  });

  it('debe rechazar años inválidos (Violación RN-CAT-03)', () => {
    expect(() =>
      buildDefaultPaymentPeriods(Periodicity.MENSUAL, 1999),
    ).toThrow(BadRequestException);
  });
});
