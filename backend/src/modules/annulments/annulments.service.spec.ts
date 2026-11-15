import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccrualBatchStatus,
  AccrualStatus,
  PaymentRequestStatus,
  PaymentStatus,
  PettyCashPeriodStatus,
  PettyCashVoucherStatus,
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
    accrual: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    accrualBatch: { findUnique: jest.Mock; update: jest.Mock };
    paymentRequest: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    paymentRequestItem: { findFirst: jest.Mock };
    pettyCashVoucher: { findUnique: jest.Mock; update: jest.Mock };
    pettyCashPeriod: { update: jest.Mock };
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
      accrual: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      accrualBatch: { findUnique: jest.fn(), update: jest.fn() },
      paymentRequest: { findUnique: jest.fn(), update: jest.fn() },
      paymentRequestItem: { findFirst: jest.fn() },
      pettyCashVoucher: { findUnique: jest.fn(), update: jest.fn() },
      pettyCashPeriod: { update: jest.fn() },
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
    it('debe anular el pago, revertir los saldos FIFO y reabrir la solicitud si queda sin pagos (Happy Path)', async () => {
      // Arrange
      prismaMock.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        receiptCode: 'REC-001',
        paymentRequestId: 'req-1',
        amount: '400.00',
        status: PaymentStatus.VALIDO,
        paymentRequest: {
          id: 'req-1',
          status: PaymentRequestStatus.ENTREGADA,
          paidAmount: '400.00',
        },
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
      expect(prismaMock.paymentRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          paidAmount: '0.00',
          status: PaymentRequestStatus.APROBADA,
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
      // Act & Assert
      await expect(
        service.annulPayment('pay-1', 'Corto', receptorActor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('annulUnpaidAccrual', () => {
    it('debe anular una causación sin pagos previos poniendo balanceDue en 0.00 (Happy Path)', async () => {
      // Arrange
      prismaMock.accrual.findUnique.mockResolvedValueOnce({
        id: 'acc-1',
        status: AccrualStatus.PENDIENTE,
        paidAmount: '0.00',
        balanceDue: '300.00',
      });
      prismaMock.paymentRequestItem.findFirst.mockResolvedValueOnce(null);
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

    it('debe impedir anular una causación incluida en una solicitud activa (Edge Case)', async () => {
      // Arrange
      prismaMock.accrual.findUnique.mockResolvedValueOnce({
        id: 'acc-1',
        status: AccrualStatus.PENDIENTE,
        paidAmount: '0.00',
        balanceDue: '300.00',
      });
      prismaMock.paymentRequestItem.findFirst.mockResolvedValueOnce({
        id: 'item-1',
      });

      // Act & Assert
      await expect(
        service.annulUnpaidAccrual(
          'acc-1',
          'Intento de anular causación en solicitud activa',
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si se intenta anular una causación que ya tiene pagos aplicados (Violación RN-GLOB-03)', async () => {
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

  describe('annulAccrualBatch', () => {
    it('debe anular un lote no pagado y todas sus causaciones (Happy Path)', async () => {
      // Arrange
      prismaMock.accrualBatch.findUnique.mockResolvedValueOnce({
        id: 'batch-1',
        code: 'LOTE-01',
        status: AccrualBatchStatus.GENERADO,
        totalAmount: '450.00',
        accruals: [
          { id: 'acc-1', paidAmount: '0.00' },
          { id: 'acc-2', paidAmount: '0.00' },
        ],
      });
      prismaMock.paymentRequestItem.findFirst.mockResolvedValueOnce(null);
      prismaMock.accrualBatch.update.mockResolvedValueOnce({
        id: 'batch-1',
        status: AccrualBatchStatus.ANULADO,
      });
      prismaMock.accrual.updateMany.mockResolvedValueOnce({ count: 2 });
      prismaMock.annulment.create.mockResolvedValueOnce({ id: 'ann-3' });

      // Act
      const result = await service.annulAccrualBatch(
        'batch-1',
        'Lote generado con rango de fechas incorrecto',
        generadorActor,
      );

      // Assert
      expect(result.batch.status).toBe(AccrualBatchStatus.ANULADO);
      expect(prismaMock.accrual.updateMany).toHaveBeenCalledWith({
        where: { batchId: 'batch-1' },
        data: { status: AccrualStatus.ANULADO, balanceDue: '0.00' },
      });
    });

    it('debe rechazar la anulación de un lote con pagos aplicados (Edge Case)', async () => {
      // Arrange
      prismaMock.accrualBatch.findUnique.mockResolvedValueOnce({
        id: 'batch-1',
        code: 'LOTE-01',
        status: AccrualBatchStatus.GENERADO,
        accruals: [{ id: 'acc-1', paidAmount: '100.00' }],
      });

      // Act & Assert
      await expect(
        service.annulAccrualBatch(
          'batch-1',
          'Intento de anular lote con pagos',
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('annulPaymentRequest', () => {
    it('debe anular una solicitud sin pagos válidos (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        code: 'SOL-01',
        status: PaymentRequestStatus.APROBADA,
        paidAmount: '0.00',
        totalAmount: '450.00',
        payments: [],
      });
      prismaMock.paymentRequest.update.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.ANULADA,
      });
      prismaMock.annulment.create.mockResolvedValueOnce({ id: 'ann-4' });

      // Act
      const result = await service.annulPaymentRequest(
        'req-1',
        'Solicitud creada por duplicado en el lote',
        generadorActor,
      );

      // Assert
      expect(result.paymentRequest.status).toBe(PaymentRequestStatus.ANULADA);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe rechazar la anulación de una solicitud con pagos válidos (Edge Case)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        code: 'SOL-01',
        status: PaymentRequestStatus.ENTREGADA,
        paidAmount: '300.00',
        totalAmount: '450.00',
        payments: [{ id: 'pay-1', status: PaymentStatus.VALIDO }],
      });

      // Act & Assert
      await expect(
        service.annulPaymentRequest(
          'req-1',
          'Intento de anular solicitud con pagos',
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('annulPettyCashVoucher', () => {
    it('debe anular un vale desembolsado y devolver el monto al saldo disponible (Happy Path)', async () => {
      // Arrange
      prismaMock.pettyCashVoucher.findUnique.mockResolvedValueOnce({
        id: 'v-1',
        code: 'VALE-01',
        periodId: 'per-1',
        status: PettyCashVoucherStatus.DESEMBOLSADO,
        requestedAmount: '80.00',
        disbursedAmount: '80.00',
        settledAmount: null,
        period: {
          id: 'per-1',
          status: PettyCashPeriodStatus.ABIERTO,
          availableBalance: '120.00',
        },
      });
      prismaMock.pettyCashPeriod.update.mockResolvedValueOnce({});
      prismaMock.pettyCashVoucher.update.mockResolvedValueOnce({
        id: 'v-1',
        status: PettyCashVoucherStatus.ANULADO,
      });
      prismaMock.annulment.create.mockResolvedValueOnce({ id: 'ann-5' });

      // Act
      const result = await service.annulPettyCashVoucher(
        'v-1',
        'Vale desembolsado a la persona equivocada',
        receptorActor,
      );

      // Assert
      expect(result.voucher.status).toBe(PettyCashVoucherStatus.ANULADO);
      expect(prismaMock.pettyCashPeriod.update).toHaveBeenCalledWith({
        where: { id: 'per-1' },
        data: { availableBalance: '200.00' },
      });
    });

    it('debe impedir que el GENERADOR anule un vale ya desembolsado (Edge Case)', async () => {
      // Arrange
      prismaMock.pettyCashVoucher.findUnique.mockResolvedValueOnce({
        id: 'v-1',
        code: 'VALE-01',
        periodId: 'per-1',
        status: PettyCashVoucherStatus.DESEMBOLSADO,
        requestedAmount: '80.00',
        disbursedAmount: '80.00',
        period: {
          id: 'per-1',
          status: PettyCashPeriodStatus.ABIERTO,
          availableBalance: '120.00',
        },
      });

      // Act & Assert
      await expect(
        service.annulPettyCashVoucher(
          'v-1',
          'Intento de anulación por rol no autorizado',
          generadorActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllAnnulments', () => {
    it('debe listar el historial completo de anulaciones justificadas (Edge Case)', async () => {
      // Arrange
      prismaMock.annulment.findMany.mockResolvedValueOnce([{ id: 'ann-1' }]);

      // Act
      const list = await service.findAllAnnulments();

      // Assert
      expect(list).toHaveLength(1);
    });
  });
});
