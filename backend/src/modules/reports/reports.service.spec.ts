import { NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '../../common/constants/domain.enums';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService (RN-AUD-01 Consultas Clave y RN-AUD-02 Reportes PDF)', () => {
  let service: ReportsService;
  let prismaMock: {
    accrual: { findMany: jest.Mock };
    payment: { findUnique: jest.Mock };
    paymentRequest: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prismaMock = {
      accrual: { findMany: jest.fn() },
      payment: { findUnique: jest.fn() },
      paymentRequest: { findUnique: jest.fn() },
    };
    service = new ReportsService(prismaMock as unknown as PrismaService);
  });

  describe('getExecutiveSummaryAndDebts', () => {
    it('debe consolidar cuánto se ha causado, cuánto se ha pagado y cuánto se le adeuda a cada persona (Happy Path)', async () => {
      // Arrange
      prismaMock.accrual.findMany.mockResolvedValueOnce([
        {
          beneficiaryId: 'ben-1',
          proratedAmount: '450.00',
          paidAmount: '450.00',
          balanceDue: '0.00',
          beneficiary: { fullName: 'Dr. Mendoza', dni: 'V-18456789' },
          project: { code: 'FIS-01' },
        },
        {
          beneficiaryId: 'ben-1',
          proratedAmount: '450.00',
          paidAmount: '150.00',
          balanceDue: '300.00',
          beneficiary: { fullName: 'Dr. Mendoza', dni: 'V-18456789' },
          project: { code: 'FIS-01' },
        },
      ]);

      // Act
      const summary = await service.getExecutiveSummaryAndDebts('proj-1');

      // Assert
      expect(summary.totalAccruedUsd).toBe('900.00');
      expect(summary.totalPaidUsd).toBe('600.00');
      expect(summary.totalPendingDebtUsd).toBe('300.00');
      expect(summary.beneficiaryBalances).toHaveLength(1);
      expect(summary.beneficiaryBalances[0].totalDebtDueUsd).toBe('300.00');
    });

    it('debe retornar totales en 0.00 cuando no existen causaciones activas (Edge Case)', async () => {
      // Arrange
      prismaMock.accrual.findMany.mockResolvedValueOnce([]);

      // Act
      const summary = await service.getExecutiveSummaryAndDebts();

      // Assert
      expect(summary.totalAccruedUsd).toBe('0.00');
      expect(summary.totalPaidUsd).toBe('0.00');
      expect(summary.totalPendingDebtUsd).toBe('0.00');
      expect(summary.beneficiaryBalances).toEqual([]);
    });

    it('debe excluir registros ANULADO en la consulta de estado de cuenta (Invariante RN-GLOB-04)', async () => {
      // Arrange
      prismaMock.accrual.findMany.mockResolvedValueOnce([]);

      // Act
      await service.getExecutiveSummaryAndDebts();

      // Assert
      const callArg = prismaMock.accrual.findMany.mock.calls[0][0];
      expect(callArg.where.status).toEqual({ not: 'ANULADO' });
    });
  });

  describe('generateIndividualReceiptPdf & generateConsolidatedRequestPdf', () => {
    it('debe generar un archivo PDF válido para un Recibo Individual de Pago con desglose FIFO (Happy Path)', async () => {
      // Arrange
      prismaMock.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        receiptCode: 'REC-2026-001',
        paymentDate: new Date('2026-11-09T00:00:00Z'),
        status: PaymentStatus.VALIDO,
        amount: '400.00',
        beneficiary: { fullName: 'Dr. Alejandro Mendoza', dni: 'V-18456789' },
        deliveredBy: { fullName: 'Gerente Administración' },
        paymentRequest: {
          project: { code: 'FIS-2026-01', name: 'Óptica Cuántica' },
        },
        allocations: [
          {
            allocatedAmount: '400.00',
            accrual: {
              periodStart: new Date('2026-10-01T00:00:00Z'),
              periodEnd: new Date('2026-10-15T00:00:00Z'),
              balanceDue: '50.00',
            },
          },
        ],
      });

      // Act
      const pdf = await service.generateIndividualReceiptPdf('pay-1');

      // Assert
      expect(pdf.filename).toBe('recibo_REC-2026-001.pdf');
      expect(pdf.buffer.toString('utf8').startsWith('%PDF-1.4')).toBe(true);
    });

    it('debe generar un archivo PDF válido para una Solicitud Consolidada de Pago (Edge Case)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        code: 'SOL-FIS-01',
        status: 'APROBADA',
        totalAmount: '450.00',
        project: {
          code: 'FIS-2026-01',
          name: 'Óptica Cuántica',
          area: 'FISICA',
        },
        createdBy: { fullName: 'Coordinador General' },
        reviewedBy: { fullName: 'Gerente Admin' },
        items: [
          {
            requestedAmount: '450.00',
            accrual: {
              periodStart: new Date('2026-11-01T00:00:00Z'),
              periodEnd: new Date('2026-11-15T00:00:00Z'),
              beneficiary: { fullName: 'Dr. Mendoza', dni: 'V-18456789' },
            },
          },
        ],
      });

      // Act
      const pdf = await service.generateConsolidatedRequestPdf('req-1');

      // Assert
      expect(pdf.filename).toBe('solicitud_SOL-FIS-01.pdf');
      expect(pdf.buffer.toString('utf8').startsWith('%PDF-1.4')).toBe(true);
    });

    it('debe lanzar NotFoundException si el pago o la solicitud no existen al exportar PDF (Caso de Error)', async () => {
      // Arrange
      prismaMock.payment.findUnique.mockResolvedValueOnce(null);
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.generateIndividualReceiptPdf('inexistente'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.generateConsolidatedRequestPdf('inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
