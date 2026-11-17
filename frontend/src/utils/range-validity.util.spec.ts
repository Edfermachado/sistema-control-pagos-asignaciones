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
} from './range-validity.util';

describe('range-validity.util (Validación de Rangos Activos y Cero Fricción UX)', () => {
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

  describe('getNextSequentialYearMonth & getPayableBeneficiariesForRequest', () => {
    it('debe calcular el mes siguiente inmediato incluyendo cambio de año en diciembre (Happy Path)', () => {
      expect(getNextSequentialYearMonth('2026-10')).toBe('2026-11');
      expect(getNextSequentialYearMonth('2026-12')).toBe('2027-01');
    });

    it('debe filtrar únicamente a los beneficiarios con deuda pendiente dentro de la solicitud seleccionada (RN-PAG-02)', () => {
      // Arrange
      const beneficiaries = [
        { id: 'b-1', fullName: 'Dr. Alejandro', dni: 'V-1' },
        { id: 'b-2', fullName: 'MSc. Valeria', dni: 'V-2' },
      ];
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
  });
});

