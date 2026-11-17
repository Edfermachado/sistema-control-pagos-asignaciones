import { describe, expect, it } from 'vitest';
import {
  AccrualStatus,
  PaymentRequestStatus,
  ProjectStatus,
} from '../types/domain.types';
import {
  clampDateRangeToWindow,
  doDateRangesIntersect,
  filterValidCutoffPeriodsForProject,
  getNextSequentialYearMonth,
  getPayableBeneficiariesForRequest,
  toIsoDateSlice,
} from './range-validity.util';

describe('range-validity.util (Validación de Rangos Activos y Cero Fricción UX)', () => {
  describe('toIsoDateSlice', () => {
    it('debe extraer YYYY-MM-DD de una instancia Date o cadena ISO completa (Happy Path)', () => {
      // Arrange
      const dateObj = new Date('2026-11-15T18:30:00.000Z');
      const isoStr = '2026-11-15T00:00:00.000Z';

      // Act & Assert
      expect(toIsoDateSlice(dateObj)).toBe('2026-11-15');
      expect(toIsoDateSlice(isoStr)).toBe('2026-11-15');
    });

    it('debe devolver los primeros 10 caracteres cuando ya viene en formato corto (Edge Case)', () => {
      // Arrange & Act
      const slice = toIsoDateSlice('2026-02-28');

      // Assert
      expect(slice).toBe('2026-02-28');
    });

    it('debe retornar cadena vacía ante null, undefined o cadena vacía (Caso Vacío)', () => {
      // Arrange & Act & Assert
      expect(toIsoDateSlice(null)).toBe('');
      expect(toIsoDateSlice(undefined)).toBe('');
      expect(toIsoDateSlice('')).toBe('');
    });
  });

  describe('clampDateRangeToWindow & doDateRangesIntersect', () => {
    it('debe acotar fechas que salgan de la vigencia del proyecto al rango [windowStart, windowEnd] (Happy Path)', () => {
      // Arrange & Act
      const clamped = clampDateRangeToWindow(
        '2026-01-01',
        '2026-12-31',
        '2026-02-01',
        '2026-11-30',
      );

      // Assert
      expect(clamped).toEqual({
        startDate: '2026-02-01',
        endDate: '2026-11-30',
      });
    });

    it('debe detectar intersección exacta de un solo día entre dos intervalos (Edge Case)', () => {
      // Arrange & Act & Assert
      expect(
        doDateRangesIntersect('2026-11-01', '2026-11-15', '2026-11-15', '2026-11-30'),
      ).toBe(true);
      expect(
        doDateRangesIntersect('2026-11-01', '2026-11-14', '2026-11-15', '2026-11-30'),
      ).toBe(false);
    });

    it('debe corregir un rango invertido o con fechas vacías retornando un tramo válido dentro de la ventana (Caso Borde Invertido)', () => {
      // Arrange & Act
      const clampedInverted = clampDateRangeToWindow(
        '2026-10-20',
        '2026-03-01',
        '2026-02-01',
        '2026-11-30',
      );

      // Assert
      expect(clampedInverted).toEqual({
        startDate: '2026-10-20',
        endDate: '2026-11-30',
      });
      expect(doDateRangesIntersect('', '2026-11-15', '2026-11-01', '2026-11-15')).toBe(
        false,
      );
    });
  });

  describe('filterValidCutoffPeriodsForProject', () => {
    const quimicaProject = {
      id: 'proj-qui',
      code: 'QUI-2026-02',
      name: 'Catalizadores',
      startDate: '2026-02-01',
      endDate: '2026-11-30',
      status: ProjectStatus.ACTIVO,
    };

    const samplePeriods = [
      {
        id: 'per-jan',
        paymentGroupId: 'pg-quin',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-15',
      },
      {
        id: 'per-oct-1',
        paymentGroupId: 'pg-quin',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-15',
      },
      {
        id: 'per-nov-1',
        paymentGroupId: 'pg-quin',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-15',
      },
      {
        id: 'per-nov-2',
        paymentGroupId: 'pg-quin',
        periodStart: '2026-11-16',
        periodEnd: '2026-11-30',
      },
      {
        id: 'per-dec',
        paymentGroupId: 'pg-quin',
        periodStart: '2026-12-01',
        periodEnd: '2026-12-15',
      },
    ];

    it('debe conservar solo los cortes dentro de la vigencia del proyecto, con asignación activa y no causados aún (Happy Path)', () => {
      // Arrange: Valeria entra el 2026-11-11 hasta 2026-11-30, y la Q1 de noviembre ya fue causada
      const assignments = [
        {
          id: 'asig-valeria',
          beneficiaryId: 'ben-val',
          projectId: 'proj-qui',
          paymentGroupId: 'pg-quin',
          startDate: '2026-11-11',
          endDate: '2026-11-30',
          isActive: true,
        },
      ];
      const existingBatches = [
        {
          id: 'batch-nov-1',
          projectId: 'proj-qui',
          paymentGroupId: 'pg-quin',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-15',
          status: 'GENERADO',
        },
      ];

      // Act
      const valid = filterValidCutoffPeriodsForProject({
        periods: samplePeriods,
        project: quimicaProject,
        paymentGroupId: 'pg-quin',
        assignments,
        existingBatches,
      });

      // Assert: Solo queda per-nov-2 (2026-11-16 al 2026-11-30)
      expect(valid.map((p) => p.id)).toEqual(['per-nov-2']);
    });

    it('debe filtrar por vigencia y lotes causados aunque todavía no existan asignaciones en memoria (Edge Case)', () => {
      // Arrange & Act
      const valid = filterValidCutoffPeriodsForProject({
        periods: samplePeriods,
        project: quimicaProject,
        paymentGroupId: 'pg-quin',
        assignments: [],
        existingBatches: [],
      });

      // Assert: Excluye enero y diciembre (fuera de [2026-02-01, 2026-11-30])
      expect(valid.map((p) => p.id)).toEqual(['per-oct-1', 'per-nov-1', 'per-nov-2']);
    });

    it('debe retornar arreglo vacío si el proyecto está INACTIVO o CERRADO (Violación RN-CAT-02)', () => {
      // Arrange & Act
      const valid = filterValidCutoffPeriodsForProject({
        periods: samplePeriods,
        project: { ...quimicaProject, status: ProjectStatus.INACTIVO },
        paymentGroupId: 'pg-quin',
        assignments: [],
        existingBatches: [],
      });

      // Assert
      expect(valid).toEqual([]);
    });
  });

  describe('getNextSequentialYearMonth', () => {
    it('debe calcular el mes siguiente inmediato en años normales (Happy Path)', () => {
      // Arrange & Act
      const next = getNextSequentialYearMonth('2026-10');

      // Assert
      expect(next).toBe('2026-11');
    });

    it('debe realizar cambio de año al pasar de diciembre a enero (Edge Case)', () => {
      // Arrange & Act
      const jan = getNextSequentialYearMonth('2026-12');

      // Assert
      expect(jan).toBe('2027-01');
    });

    it('debe retornar fallbackYearMonth cuando el formato es inválido o nulo (Caso Error/Vacío)', () => {
      // Arrange & Act & Assert
      expect(getNextSequentialYearMonth(null, '2026-11')).toBe('2026-11');
      expect(getNextSequentialYearMonth('2026-13', '2026-11')).toBe('2026-11');
      expect(getNextSequentialYearMonth('invalido', '2026-09')).toBe('2026-09');
    });
  });

  describe('getPayableBeneficiariesForRequest', () => {
    const beneficiaries = [
      { id: 'b-1', fullName: 'Dr. Alejandro', dni: 'V-1' },
      { id: 'b-2', fullName: 'MSc. Valeria', dni: 'V-2' },
    ];

    it('debe filtrar únicamente a los beneficiarios con deuda pendiente dentro de la solicitud seleccionada (Happy Path RN-PAG-02)', () => {
      // Arrange
      const request = {
        status: PaymentRequestStatus.ENTREGADA,
        totalAmount: '900.00',
        paidAmount: '600.00',
        items: [
          {
            accrual: {
              id: 'acc-1',
              beneficiaryId: 'b-1',
              balanceDue: '0.00',
              status: AccrualStatus.PAGADO,
            },
          },
          {
            accrual: {
              id: 'acc-2',
              beneficiaryId: 'b-1',
              balanceDue: '300.00',
              status: AccrualStatus.PARCIAL,
            },
          },
        ],
      };

      // Act
      const payable = getPayableBeneficiariesForRequest(request, beneficiaries);

      // Assert
      expect(payable).toHaveLength(1);
      expect(payable[0].beneficiary.id).toBe('b-1');
      expect(payable[0].pendingInRequestUsd).toBe(300);
    });

    it('debe devolver el saldo remanente de la solicitud si no posee ítems desglosados (Edge Case)', () => {
      // Arrange
      const requestWithoutItems = {
        status: PaymentRequestStatus.APROBADA,
        totalAmount: '500.00',
        paidAmount: '150.00',
        items: [],
      };

      // Act
      const payable = getPayableBeneficiariesForRequest(
        requestWithoutItems,
        beneficiaries,
      );

      // Assert
      expect(payable).toHaveLength(2);
      expect(payable[0].pendingInRequestUsd).toBe(350);
    });

    it('debe retornar arreglo vacío cuando la solicitud es undefined (Caso Vacío)', () => {
      // Arrange & Act
      const payable = getPayableBeneficiariesForRequest(undefined, beneficiaries);

      // Assert
      expect(payable).toEqual([]);
    });
  });
});

