import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccrualStatus,
  PaymentRequestStatus,
  UserRole,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService (RN-PAG-02 Registro de Pagos con Cola FIFO)', () => {
  let service: PaymentsService;
  let prismaMock: {
    payment: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    paymentRequest: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    accrual: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    paymentAllocation: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditMock: { recordLog: jest.Mock };

  const receptorActor: AuthenticatedUser = {
    id: 'u-rec-1',
    email: 'gerente@uc.edu.ve',
    fullName: 'Gerente de Administración',
    role: UserRole.RECEPTOR,
  };

  beforeEach(() => {
    prismaMock = {
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      paymentRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      accrual: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      paymentAllocation: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new PaymentsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('registerPayment', () => {
    it('debe registrar un pago parcial aplicando FIFO sobre las causaciones pendientes y actualizando saldos en transacción ACID (Happy Path)', async () => {
      // Arrange
      prismaMock.payment.findUnique.mockResolvedValueOnce(null);
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        projectId: 'proj-1',
        status: PaymentRequestStatus.APROBADA,
        paidAmount: '0.00',
      });
      prismaMock.accrual.findMany.mockResolvedValueOnce([
        {
          id: 'acc-1',
          periodStart: new Date('2026-01-01T00:00:00Z'),
          createdAt: new Date('2026-01-16T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '300.00',
        },
        {
          id: 'acc-2',
          periodStart: new Date('2026-02-01T00:00:00Z'),
          createdAt: new Date('2026-02-16T00:00:00Z'),
          paidAmount: '0.00',
          balanceDue: '300.00',
        },
      ]);
      prismaMock.payment.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'pay-1', ...data }),
      );
      prismaMock.paymentAllocation.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `alloc-${data.accrualId}`, ...data }),
      );
      prismaMock.accrual.update.mockResolvedValue({});
      prismaMock.paymentRequest.update.mockResolvedValue({});

      // Act
      const result = await service.registerPayment(
        {
          receiptCode: ' rec-2026-001 ',
          paymentRequestId: 'req-1',
          beneficiaryId: 'ben-1',
          amount: '400.00',
          paymentDate: '2026-11-09',
          reference: 'ZELLE-9988',
        },
        receptorActor,
      );

      // Assert
      expect(result.payment.receiptCode).toBe('REC-2026-001');
      expect(result.allocations).toHaveLength(2);
      expect(prismaMock.accrual.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          paidAmount: '300.00',
          balanceDue: '0.00',
          status: AccrualStatus.PAGADO,
        },
      });
      expect(prismaMock.accrual.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: {
          paidAmount: '100.00',
          balanceDue: '200.00',
          status: AccrualStatus.PARCIAL,
        },
      });
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ConflictException si el código de recibo ya existe o NotFoundException si la solicitud no existe (Edge Case)', async () => {
      // Arrange (Recibo duplicado)
      prismaMock.payment.findUnique.mockResolvedValueOnce({ id: 'pay-dup' });

      // Act & Assert
      await expect(
        service.registerPayment(
          {
            receiptCode: 'REC-DUP',
            paymentRequestId: 'req-1',
            beneficiaryId: 'ben-1',
            amount: '100.00',
            paymentDate: '2026-11-09',
          },
          receptorActor,
        ),
      ).rejects.toThrow(ConflictException);

      // Arrange (Solicitud no existe)
      prismaMock.payment.findUnique.mockResolvedValueOnce(null);
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.registerPayment(
          {
            receiptCode: 'REC-002',
            paymentRequestId: 'req-inexistente',
            beneficiaryId: 'ben-1',
            amount: '100.00',
            paymentDate: '2026-11-09',
          },
          receptorActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si la solicitud no ha sido APROBADA (Violación RN-PAG-01)', async () => {
      // Arrange
      prismaMock.payment.findUnique.mockResolvedValueOnce(null);
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.ENVIADA,
      });

      // Act & Assert
      await expect(
        service.registerPayment(
          {
            receiptCode: 'REC-003',
            paymentRequestId: 'req-1',
            beneficiaryId: 'ben-1',
            amount: '100.00',
            paymentDate: '2026-11-09',
          },
          receptorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllPayments', () => {
    it('debe retornar la lista de pagos con sus asignaciones FIFO (Happy Path)', async () => {
      // Arrange
      prismaMock.payment.findMany.mockResolvedValueOnce([{ id: 'pay-1' }]);

      // Act
      const list = await service.findAllPayments();

      // Assert
      expect(list).toHaveLength(1);
    });

    it('debe filtrar por beneficiaryId y paymentRequestId cuando se especifican (Edge Case)', async () => {
      // Arrange
      prismaMock.payment.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllPayments('ben-1', 'req-1');

      // Assert
      expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { beneficiaryId: 'ben-1', paymentRequestId: 'req-1' },
        }),
      );
    });

    it('debe retornar lista vacía si no hay pagos registrados para el filtro (Caso Vacío)', async () => {
      // Arrange
      prismaMock.payment.findMany.mockResolvedValueOnce([]);

      // Act
      const result = await service.findAllPayments('ben-sin-pagos');

      // Assert
      expect(result).toEqual([]);
    });
  });
});
