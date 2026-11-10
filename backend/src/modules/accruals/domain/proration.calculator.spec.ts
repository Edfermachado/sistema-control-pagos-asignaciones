import { BadRequestException } from '@nestjs/common';
import {
  calculateProratedAccrual,
  calculateTotalCalendarDays,
} from './proration.calculator';

describe('proration.calculator (RN-CAUS-01, RN-CAUS-02 y RN-CAUS-03)', () => {
  describe('calculateTotalCalendarDays', () => {
    it('debe calcular 15 días para la primera quincena y 16 días para la segunda quincena de un mes de 31 días (Happy Path)', () => {
      // Arrange
      const q1Start = new Date('2026-10-01T00:00:00Z');
      const q1End = new Date('2026-10-15T00:00:00Z');
      const q2Start = new Date('2026-10-16T00:00:00Z');
      const q2End = new Date('2026-10-31T00:00:00Z');

      // Act
      const daysQ1 = calculateTotalCalendarDays(q1Start, q1End);
      const daysQ2 = calculateTotalCalendarDays(q2Start, q2End);

      // Assert
      expect(daysQ1).toBe(15);
      expect(daysQ2).toBe(16);
    });

    it('debe retornar 1 día cuando el inicio y el fin del período son el mismo día (Edge Case)', () => {
      // Arrange
      const singleDay = new Date('2026-11-09T00:00:00Z');

      // Act
      const total = calculateTotalCalendarDays(singleDay, singleDay);

      // Assert
      expect(total).toBe(1);
    });

    it('debe lanzar BadRequestException cuando periodEnd es anterior a periodStart (Violación RN-CAUS-01)', () => {
      // Arrange
      const start = new Date('2026-11-15T00:00:00Z');
      const end = new Date('2026-11-01T00:00:00Z');

      // Act & Assert
      expect(() => calculateTotalCalendarDays(start, end)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('calculateProratedAccrual', () => {
    const projectStart = new Date('2026-01-01T00:00:00Z');
    const projectEnd = new Date('2026-12-31T00:00:00Z');

    it('debe causar el 100% del monto ($450.00) cuando la asignación estuvo activa los 15 días del período (Happy Path)', () => {
      // Arrange
      const result = calculateProratedAccrual({
        amountPerPeriod: '450.00',
        periodStart: new Date('2026-11-01T00:00:00Z'),
        periodEnd: new Date('2026-11-15T00:00:00Z'),
        assignmentStart: new Date('2026-02-01T00:00:00Z'),
        assignmentEnd: null,
        projectStart,
        projectEnd,
      });

      // Assert
      expect(result.totalPeriodDays).toBe(15);
      expect(result.activeDays).toBe(15);
      expect(result.proratedAmount.toFixed(2)).toBe('450.00');
    });

    it('debe prorratear exactamente por días activos (5 de 15 días = $150.00) si la persona ingresó el día 11 (Edge Case)', () => {
      // Arrange: días activos = 11, 12, 13, 14 y 15 de noviembre (5 días)
      const result = calculateProratedAccrual({
        amountPerPeriod: '450.00',
        periodStart: new Date('2026-11-01T00:00:00Z'),
        periodEnd: new Date('2026-11-15T00:00:00Z'),
        assignmentStart: new Date('2026-11-11T00:00:00Z'),
        assignmentEnd: null,
        projectStart,
        projectEnd,
      });

      // Assert
      expect(result.activeDays).toBe(5);
      expect(result.proratedAmount.toFixed(2)).toBe('150.00');
    });

    it('debe retornar 0 días activos y $0.00 si la asignación inicia después del período, o lanzar error si el monto es <= 0 (Violación RN-CAUS-02 / RN-GLOB-02)', () => {
      // Arrange (Fuera de período)
      const zeroResult = calculateProratedAccrual({
        amountPerPeriod: '450.00',
        periodStart: new Date('2026-11-01T00:00:00Z'),
        periodEnd: new Date('2026-11-15T00:00:00Z'),
        assignmentStart: new Date('2026-11-20T00:00:00Z'),
        assignmentEnd: null,
        projectStart,
        projectEnd,
      });

      // Assert
      expect(zeroResult.activeDays).toBe(0);
      expect(zeroResult.proratedAmount.toFixed(2)).toBe('0.00');

      // Act & Assert (Monto inválido)
      expect(() =>
        calculateProratedAccrual({
          amountPerPeriod: 0,
          periodStart: new Date('2026-11-01T00:00:00Z'),
          periodEnd: new Date('2026-11-15T00:00:00Z'),
          assignmentStart: new Date('2026-11-01T00:00:00Z'),
          projectStart,
          projectEnd,
        }),
      ).toThrow(BadRequestException);
    });
  });
});
