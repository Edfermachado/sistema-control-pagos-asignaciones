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
import { PaymentRequestsService } from './payment-requests.service';

describe('PaymentRequestsService (RN-PAG-01 Ciclo de Solicitudes de Pago)', () => {
  let service: PaymentRequestsService;
  let prismaMock: {
    paymentRequest: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    accrual: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditMock: { recordLog: jest.Mock };

  const generadorActor: AuthenticatedUser = {
    id: 'u-gen',
    email: 'coord@uc.edu.ve',
    fullName: 'Coordinador',
    role: UserRole.GENERADOR,
  };

  const receptorActor: AuthenticatedUser = {
    id: 'u-rec',
    email: 'gerente@uc.edu.ve',
    fullName: 'Gerente Administración',
    role: UserRole.RECEPTOR,
  };

  beforeEach(() => {
    prismaMock = {
      paymentRequest: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      accrual: { findMany: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new PaymentRequestsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('createPaymentRequest', () => {
    it('debe crear una solicitud en estado CREADA sumando el balanceDue de las causaciones seleccionadas (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce(null);
      prismaMock.accrual.findMany.mockResolvedValueOnce([
        { id: 'acc-1', balanceDue: '300.00', status: AccrualStatus.PENDIENTE },
        { id: 'acc-2', balanceDue: '150.50', status: AccrualStatus.PARCIAL },
      ]);
      prismaMock.paymentRequest.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'req-1', ...data }),
      );

      // Act
      const created = await service.createPaymentRequest(
        {
          code: ' sol-fis-01 ',
          projectId: 'proj-1',
          accrualIds: ['acc-1', 'acc-2'],
        },
        generadorActor,
      );

      // Assert
      expect(created.code).toBe('SOL-FIS-01');
      expect(created.totalAmount).toBe('450.50');
      expect(created.status).toBe(PaymentRequestStatus.CREADA);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ConflictException si el código de solicitud ya existe (Edge Case)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({ id: 'req-dup' });

      // Act & Assert
      await expect(
        service.createPaymentRequest(
          {
            code: 'SOL-DUP',
            projectId: 'proj-1',
            accrualIds: ['acc-1'],
          },
          generadorActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar BadRequestException si alguna causación no tiene saldo pendiente o es de otro proyecto (Violación RN-PAG-01)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce(null);
      prismaMock.accrual.findMany.mockResolvedValueOnce([{ id: 'acc-1', balanceDue: '300.00' }]);

      // Act & Assert
      await expect(
        service.createPaymentRequest(
          {
            code: 'SOL-02',
            projectId: 'proj-1',
            accrualIds: ['acc-1', 'acc-invalida'],
          },
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendPaymentRequest', () => {
    it('debe cambiar el estado de CREADA a ENVIADA y registrar auditoría (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.CREADA,
      });
      prismaMock.paymentRequest.update.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.ENVIADA,
      });

      // Act
      const result = await service.sendPaymentRequest('req-1', generadorActor);

      // Assert
      expect(result.status).toBe(PaymentRequestStatus.ENVIADA);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar NotFoundException si la solicitud no existe (Edge Case)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.sendPaymentRequest('no-existe', generadorActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si ya había sido enviada o aprobada previamente (Violación RN-PAG-01)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.APROBADA,
      });

      // Act & Assert
      await expect(
        service.sendPaymentRequest('req-1', generadorActor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reviewPaymentRequest', () => {
    it('debe permitir al RECEPTOR aprobar una solicitud ENVIADA (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.ENVIADA,
      });
      prismaMock.paymentRequest.update.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.APROBADA,
        rejectionReason: null,
      });

      // Act
      const result = await service.reviewPaymentRequest(
        'req-1',
        { decision: PaymentRequestStatus.APROBADA },
        receptorActor,
      );

      // Assert
      expect(result.status).toBe(PaymentRequestStatus.APROBADA);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe permitir rechazar una solicitud ENVIADA cuando se suministra un motivo válido (Edge Case)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.ENVIADA,
      });
      prismaMock.paymentRequest.update.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.RECHAZADA,
        rejectionReason: 'Diferencia en soporte de asistencia',
      });

      // Act
      const result = await service.reviewPaymentRequest(
        'req-1',
        {
          decision: PaymentRequestStatus.RECHAZADA,
          rejectionReason: 'Diferencia en soporte de asistencia',
        },
        receptorActor,
      );

      // Assert
      expect(result.status).toBe(PaymentRequestStatus.RECHAZADA);
    });

    it('debe lanzar BadRequestException si se rechaza sin motivo o si la solicitud no está ENVIADA (Violación RN-PAG-01)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.ENVIADA,
      });

      // Act & Assert
      await expect(
        service.reviewPaymentRequest(
          'req-1',
          { decision: PaymentRequestStatus.RECHAZADA, rejectionReason: '' },
          receptorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closePaymentRequest & findAllPaymentRequests', () => {
    it('debe cerrar la solicitud cuando está ENTREGADA y pagada al 100% (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.ENTREGADA,
        totalAmount: '600.00',
        paidAmount: '600.00',
      });
      prismaMock.paymentRequest.update.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.CERRADA,
      });

      // Act
      const closed = await service.closePaymentRequest('req-1', receptorActor);

      // Assert
      expect(closed.status).toBe(PaymentRequestStatus.CERRADA);
    });

    it('debe listar solicitudes filtrando por proyecto y estado cuando se proveen (Edge Case)', async () => {
      // Arrange
      prismaMock.paymentRequest.findMany.mockResolvedValueOnce([{ id: 'req-1' }]);

      // Act
      const list = await service.findAllPaymentRequests(
        'proj-1',
        PaymentRequestStatus.APROBADA,
      );

      // Assert
      expect(list).toHaveLength(1);
    });

    it('debe lanzar BadRequestException al intentar cerrar una solicitud con pago parcial incompleto (Violación RN-PAG-01)', async () => {
      // Arrange
      prismaMock.paymentRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: PaymentRequestStatus.ENTREGADA,
        totalAmount: '600.00',
        paidAmount: '400.00',
      });

      // Act & Assert
      await expect(
        service.closePaymentRequest('req-1', receptorActor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
