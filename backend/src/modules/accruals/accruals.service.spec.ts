import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccrualStatus,
  ProjectStatus,
  UserRole,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AccrualsService } from './accruals.service';

describe('AccrualsService (RN-CAUS-01 a RN-CAUS-04 Motor de Causación por Lote)', () => {
  let service: AccrualsService;
  let prismaMock: {
    project: { findUnique: jest.Mock };
    assignment: { findMany: jest.Mock };
    accrualBatch: { findUnique: jest.Mock; create: jest.Mock };
    accrual: { findMany: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditMock: { recordLog: jest.Mock };

  const generadorActor: AuthenticatedUser = {
    id: 'u-gen-1',
    email: 'coord@uc.edu.ve',
    fullName: 'Coordinador General',
    role: UserRole.GENERADOR,
  };

  beforeEach(() => {
    prismaMock = {
      project: { findUnique: jest.fn() },
      assignment: { findMany: jest.fn() },
      accrualBatch: { findUnique: jest.fn(), create: jest.fn() },
      accrual: { findMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new AccrualsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('previewAccrualBatch', () => {
    it('debe previsualizar el lote sumando los montos prorrateados de las asignaciones activas (Happy Path)', async () => {
      // Arrange
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
      });
      prismaMock.assignment.findMany.mockResolvedValueOnce([
        {
          id: 'asig-1',
          beneficiaryId: 'ben-1',
          amountPerPeriod: '300.00',
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: null,
          beneficiary: { fullName: 'Investigador 1' },
        },
        {
          id: 'asig-2',
          beneficiaryId: 'ben-2',
          amountPerPeriod: '300.00',
          startDate: new Date('2026-11-11T00:00:00Z'), // 5 de 15 días = $100.00
          endDate: null,
          beneficiary: { fullName: 'Investigador 2' },
        },
      ]);

      // Act
      const preview = await service.previewAccrualBatch({
        code: 'LOTE-01',
        projectId: 'proj-1',
        paymentGroupId: 'pg-1',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-15',
      });

      // Assert
      expect(preview.items).toHaveLength(2);
      expect(preview.totalBatchAmount).toBe('400.00');
    });

    it('debe lanzar NotFoundException si el proyecto indicado no existe (Edge Case)', async () => {
      // Arrange
      prismaMock.project.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.previewAccrualBatch({
          code: 'LOTE-01',
          projectId: 'inexistente',
          paymentGroupId: 'pg-1',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si no hay asignaciones con días activos en el período (Violación RN-CAUS-04)', async () => {
      // Arrange
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
      });
      prismaMock.assignment.findMany.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        service.previewAccrualBatch({
          code: 'LOTE-VACIO',
          projectId: 'proj-1',
          paymentGroupId: 'pg-1',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-15',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateAccrualBatch', () => {
    it('debe persistir el lote y las causaciones individuales con balanceDue = proratedAmount en transacción ACID (Happy Path)', async () => {
      // Arrange
      prismaMock.accrualBatch.findUnique.mockResolvedValueOnce(null);
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
      });
      prismaMock.assignment.findMany.mockResolvedValueOnce([
        {
          id: 'asig-1',
          beneficiaryId: 'ben-1',
          amountPerPeriod: '450.00',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: null,
          beneficiary: { fullName: 'Dr. Mendoza' },
        },
      ]);
      prismaMock.accrual.findMany.mockResolvedValueOnce([]);
      prismaMock.accrualBatch.create.mockResolvedValueOnce({
        id: 'batch-1',
        code: 'LOTE-FIS-11',
        projectId: 'proj-1',
      });
      prismaMock.accrual.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'acc-1', ...data }),
      );

      // Act
      const result = await service.generateAccrualBatch(
        {
          code: ' lote-fis-11 ',
          projectId: 'proj-1',
          paymentGroupId: 'pg-1',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-15',
        },
        generadorActor,
      );

      // Assert
      expect(result.batch.code).toBe('LOTE-FIS-11');
      expect(result.accruals).toHaveLength(1);
      expect(result.accruals[0].balanceDue).toBe('450.00');
      expect(result.accruals[0].status).toBe(AccrualStatus.PENDIENTE);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ConflictException si el código del lote ya existe (Edge Case)', async () => {
      // Arrange
      prismaMock.accrualBatch.findUnique.mockResolvedValueOnce({ id: 'b-existente' });

      // Act & Assert
      await expect(
        service.generateAccrualBatch(
          {
            code: 'LOTE-DUP',
            projectId: 'proj-1',
            paymentGroupId: 'pg-1',
            periodStart: '2026-11-01',
            periodEnd: '2026-11-15',
          },
          generadorActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar ConflictException si alguna asignación ya fue causada en ese mismo período (Violación RN-CAUS-04)', async () => {
      // Arrange
      prismaMock.accrualBatch.findUnique.mockResolvedValueOnce(null);
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
      });
      prismaMock.assignment.findMany.mockResolvedValueOnce([
        {
          id: 'asig-1',
          beneficiaryId: 'ben-1',
          amountPerPeriod: '450.00',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: null,
          beneficiary: { fullName: 'Dr. Mendoza' },
        },
      ]);
      prismaMock.accrual.findMany.mockResolvedValueOnce([{ id: 'acc-existente' }]);

      // Act & Assert
      await expect(
        service.generateAccrualBatch(
          {
            code: 'LOTE-NUEVO',
            projectId: 'proj-1',
            paymentGroupId: 'pg-1',
            periodStart: '2026-11-01',
            periodEnd: '2026-11-15',
          },
          generadorActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findPendingAccrualsByBeneficiary', () => {
    it('debe consultar causaciones PENDIENTE o PARCIAL ordenadas por periodStart ASC para la cola FIFO (Happy Path)', async () => {
      // Arrange
      prismaMock.accrual.findMany.mockResolvedValueOnce([{ id: 'acc-1' }]);

      // Act
      const list = await service.findPendingAccrualsByBeneficiary('ben-1');

      // Assert
      expect(list).toHaveLength(1);
      expect(prismaMock.accrual.findMany).toHaveBeenCalledWith({
        where: {
          beneficiaryId: 'ben-1',
          status: { in: [AccrualStatus.PENDIENTE, AccrualStatus.PARCIAL] },
        },
        orderBy: [{ periodStart: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
    });

    it('debe retornar arreglo vacío cuando el beneficiario no tiene deudas pendientes (Edge Case)', async () => {
      // Arrange
      prismaMock.accrual.findMany.mockResolvedValueOnce([]);

      // Act
      const list = await service.findPendingAccrualsByBeneficiary('ben-solvent');

      // Assert
      expect(list).toEqual([]);
    });

    it('debe excluir implícitamente causaciones PAGADO o ANULADO en la cláusula where (Invariante RN-PAG-02)', async () => {
      // Arrange
      prismaMock.accrual.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findPendingAccrualsByBeneficiary('ben-1');

      // Assert
      const callArg = prismaMock.accrual.findMany.mock.calls[0][0];
      expect(callArg.where.status.in).not.toContain(AccrualStatus.PAGADO);
      expect(callArg.where.status.in).not.toContain(AccrualStatus.ANULADO);
    });
  });

  describe('findAllAccruals', () => {
    it('debe listar el libro mayor de causaciones con beneficiario, proyecto y lote (Happy Path)', async () => {
      // Arrange
      prismaMock.accrual.findMany.mockResolvedValueOnce([{ id: 'acc-1' }]);

      // Act
      const result = await service.findAllAccruals();

      // Assert
      expect(result).toHaveLength(1);
      expect(prismaMock.accrual.findMany).toHaveBeenCalledWith({
        include: { beneficiary: true, project: true, batch: true },
        orderBy: [{ periodStart: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });
});
