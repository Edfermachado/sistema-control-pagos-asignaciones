import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccrualStatus,
  PaymentStatus,
  UserRole,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AnnulmentsService } from './annulments.service';

describe('AnnulmentsService (RN-GLOB-03, RN-GLOB-04 y RN-PAG-03 Inmutabilidad y Anulaciones)', () => {
  let service: AnnulmentsService;
  let prismaMock: {
    payment: { findUnique: jest.Mock; update: jest.Mock };
    accrual: { findUnique: jest.Mock; update: jest.Mock };
    paymentRequest: { update: jest.Mock };
    annulment: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditMock: { recordLog: jest.Mock };

  const receptorActor: AuthenticatedUser = {
    id: 'u-rec',
    email: 'gerente@uc.edu.ve',
    fullName: 'Gerente Administración',
    role: UserRole.RECEPTOR,
  };

  const generadorActor: AuthenticatedUser = {
    id: 'u-gen',
    email: 'coord@uc.edu.ve',
    fullName: 'Coordinador',
    role: UserRole.GENERADOR,
  };

  beforeEach(() => {
    prismaMock = {
      payment: { findUnique: jest.fn(), update: jest.fn() },
      accrual: { findUnique: jest.fn(), update: jest.fn() },
      paymentRequest: { update: jest.fn() },
      annulment: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new AnnulmentsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('annulPayment', () => {
    it('debe anular el pago, revertir los saldos FIFO de cada causación y auditar la operación (Happy Path)', async () => {
      // Arrange
      prismaMock.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        receiptCode: 'REC-001',
        paymentRequestId: 'req-1',
        amount: '400.00',
        status: PaymentStatus.VALIDO,
        paymentRequest: { id: 'req-1', paidAmount: '400.00' },
        allocations: [
          {
            accrualId: 'acc-1',
            allocatedAmount: '300.00',
            accrual: { paidAmount: '300.00', balanceDue: '0.00' },
          },
          {
            accrualId: 'acc-2',
            allocatedAmount: '100.00',
            accrual: { paidAmount: '100.00', balanceDue: '200.00' },
          },
        ],
      });
      prismaMock.accrual.update.mockResolvedValue({});
      prismaMock.paymentRequest.update.mockResolvedValue({});
      prismaMock.payment.update.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.ANULADO,
      });
      prismaMock.annulment.create.mockResolvedValueOnce({
        id: 'ann-1',
        reason: 'Error en cuenta receptora informada por banco',
      });

      // Act
      const result = await service.annulPayment(
        'pay-1',
        'Error en cuenta receptora informada por banco',
        receptorActor,
      );

      // Assert
      expect(result.payment.status).toBe(PaymentStatus.ANULADO);
      expect(prismaMock.accrual.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          paidAmount: '0.00',
          balanceDue: '300.00',
          status: AccrualStatus.PENDIENTE,
        },
      });
      expect(prismaMock.accrual.update).toHaveBeenCalledWith({
        where: { id: 'acc-2' },
        data: {
          paidAmount: '0.00',
          balanceDue: '300.00',
          status: AccrualStatus.PENDIENTE,
        },
      });
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ConflictException si el pago ya estaba ANULADO o NotFoundException si no existe (Edge Case)', async () => {
      // Arrange (Ya anulado)
      prismaMock.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        receiptCode: 'REC-001',
        status: PaymentStatus.ANULADO,
      });

      // Act & Assert
      await expect(
        service.annulPayment(
          'pay-1',
          'Motivo válido con más de diez letras',
          receptorActor,
        ),
      ).rejects.toThrow(ConflictException);

      // Arrange (No existe)
      prismaMock.payment.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.annulPayment(
          'inexistente',
          'Motivo válido con más de diez letras',
          receptorActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el motivo tiene menos de 10 caracteres (Violación RN-GLOB-04)', async () => {
      // Arrange & Act & Assert
      await expect(
        service.annulPayment('pay-1', 'Corto', receptorActor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('annulUnpaidAccrual & findAllAnnulments', () => {
    it('debe anular una causación sin pagos previos poniendo balanceDue en 0.00 (Happy Path)', async () => {
      // Arrange
      prismaMock.accrual.findUnique.mockResolvedValueOnce({
        id: 'acc-1',
        status: AccrualStatus.PENDIENTE,
        paidAmount: '0.00',
        balanceDue: '300.00',
      });
      prismaMock.accrual.update.mockResolvedValueOnce({
        id: 'acc-1',
        status: AccrualStatus.ANULADO,
        balanceDue: '0.00',
      });
      prismaMock.annulment.create.mockResolvedValueOnce({ id: 'ann-2' });

      // Act
      const result = await service.annulUnpaidAccrual(
        'acc-1',
        'Cargado con fecha de inicio errónea en lote',
        generadorActor,
      );

      // Assert
      expect(result.accrual.status).toBe(AccrualStatus.ANULADO);
      expect(result.accrual.balanceDue).toBe('0.00');
    });

    it('debe listar el historial completo de anulaciones justificadas (Edge Case)', async () => {
      // Arrange
      prismaMock.annulment.findMany.mockResolvedValueOnce([{ id: 'ann-1' }]);

      // Act
      const list = await service.findAllAnnulments();

      // Assert
      expect(list).toHaveLength(1);
    });

    it('debe lanzar BadRequestException si se intenta anular directamente una causación que ya tiene pagos aplicados (Violación RN-GLOB-03)', async () => {
      // Arrange
      prismaMock.accrual.findUnique.mockResolvedValueOnce({
        id: 'acc-pagada',
        status: AccrualStatus.PARCIAL,
        paidAmount: '100.00',
        balanceDue: '200.00',
      });

      // Act & Assert
      await expect(
        service.annulUnpaidAccrual(
          'acc-pagada',
          'Intento de anular causación con pagos activos',
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
