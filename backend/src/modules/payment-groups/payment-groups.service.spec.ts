import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Periodicity, UserRole } from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentGroupsService } from './payment-groups.service';

describe('PaymentGroupsService (RN-CAT-03 Grupos de Pago)', () => {
  let service: PaymentGroupsService;
  let prismaMock: {
    paymentGroup: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    paymentGroupPeriod: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      createMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    accrualBatch: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditMock: { recordLog: jest.Mock };

  const adminActor: AuthenticatedUser = {
    id: 'u-admin',
    email: 'admin@uc.edu.ve',
    fullName: 'Administrador',
    role: UserRole.ADMIN,
  };

  beforeEach(() => {
    prismaMock = {
      paymentGroup: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      paymentGroupPeriod: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      accrualBatch: { findFirst: jest.fn() },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new PaymentGroupsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('createPaymentGroup', () => {
    it('debe crear un grupo de pago quincenal y registrar auditoría (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce(null);
      prismaMock.paymentGroup.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'pg-1', ...data }),
      );
      prismaMock.paymentGroupPeriod.createMany.mockResolvedValueOnce({
        count: 48,
      });

      // Act
      const created = await service.createPaymentGroup(
        {
          name: 'Quincenal Investigadores',
          periodicity: Periodicity.QUINCENAL,
          cutoffRules: 'Días 15 y último de cada mes',
        },
        adminActor,
      );

      // Assert
      expect(created.name).toBe('Quincenal Investigadores');
      expect(created.periodicity).toBe(Periodicity.QUINCENAL);
      expect(prismaMock.paymentGroupPeriod.createMany).toHaveBeenCalled();
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar BadRequestException si el nombre o reglas están vacíos (Edge Case)', async () => {
      // Arrange & Act & Assert
      await expect(
        service.createPaymentGroup(
          {
            name: '   ',
            periodicity: Periodicity.SEMANAL,
            cutoffRules: 'Viernes',
          },
          adminActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar ConflictException si el nombre del grupo de pago ya existe (Violación RN-CAT-03)', async () => {
      // Arrange
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce({ id: 'pg-1' });

      // Act & Assert
      await expect(
        service.createPaymentGroup(
          {
            name: 'Quincenal Investigadores',
            periodicity: Periodicity.QUINCENAL,
            cutoffRules: 'Días 15 y 30',
          },
          adminActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updatePaymentGroup y períodos de corte', () => {
    it('debe actualizar un grupo de pago y auditar los cambios (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentGroup.findUnique
        .mockResolvedValueOnce({
          id: 'pg-1',
          name: 'Quincenal',
          periodicity: Periodicity.QUINCENAL,
          cutoffRules: '15 y último',
          isActive: true,
        })
        .mockResolvedValueOnce(null);
      prismaMock.paymentGroup.update.mockResolvedValueOnce({
        id: 'pg-1',
        name: 'Quincenal ajustado',
        periodicity: Periodicity.QUINCENAL,
        cutoffRules: '16 y último',
        isActive: true,
      });

      // Act
      const updated = await service.updatePaymentGroup(
        'pg-1',
        {
          name: 'Quincenal ajustado',
          cutoffRules: '16 y último',
        },
        adminActor,
      );

      // Assert
      expect(updated.name).toBe('Quincenal ajustado');
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe listar y crear fechas de corte personalizadas sin solapamiento (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentGroupPeriod.findMany.mockResolvedValueOnce([
        { id: 'period-1' },
      ]);
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce({ id: 'pg-1' });
      prismaMock.paymentGroupPeriod.findFirst.mockResolvedValueOnce(null);
      prismaMock.paymentGroupPeriod.create.mockResolvedValueOnce({
        id: 'period-2',
        label: 'Corte especial',
      });

      // Act
      const periods = await service.findPeriods('pg-1');
      const created = await service.createPeriod(
        'pg-1',
        {
          periodStart: '2026-12-01',
          periodEnd: '2026-12-10',
          label: 'Corte especial',
        },
        adminActor,
      );

      // Assert
      expect(periods).toHaveLength(1);
      expect(created.id).toBe('period-2');
    });

    it('debe rechazar la creación de un período solapado (Edge Case)', async () => {
      // Arrange
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce({ id: 'pg-1' });
      prismaMock.paymentGroupPeriod.findFirst.mockResolvedValueOnce({
        id: 'period-existente',
      });

      // Act & Assert
      await expect(
        service.createPeriod(
          'pg-1',
          { periodStart: '2026-12-05', periodEnd: '2026-12-15' },
          adminActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar NotFoundException o ConflictException al actualizar un grupo inexistente o con nombre duplicado (Violación RN-CAT-03)', async () => {
      // Arrange (Grupo no existe)
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.updatePaymentGroup('pg-no', { name: 'Nuevo' }, adminActor),
      ).rejects.toThrow(NotFoundException);

      // Arrange (Nombre duplicado)
      prismaMock.paymentGroup.findUnique
        .mockResolvedValueOnce({
          id: 'pg-1',
          name: 'Original',
          periodicity: Periodicity.QUINCENAL,
          cutoffRules: '15 y 30',
          isActive: true,
        })
        .mockResolvedValueOnce({ id: 'pg-2', name: 'Duplicado' });

      await expect(
        service.updatePaymentGroup('pg-1', { name: 'Duplicado' }, adminActor),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar crear un período cuya fecha fin sea anterior a la fecha inicio (Violación RN-CAT-03)', async () => {
      // Arrange
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce({ id: 'pg-1' });

      // Act & Assert
      await expect(
        service.createPeriod(
          'pg-1',
          { periodStart: '2026-12-20', periodEnd: '2026-12-10' },
          adminActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removePeriod', () => {
    it('debe eliminar un período sin lotes asociados y registrar auditoría (Happy Path)', async () => {
      // Arrange
      const period = {
        id: 'per-1',
        paymentGroupId: 'pg-1',
        periodStart: new Date('2026-12-01T00:00:00Z'),
        periodEnd: new Date('2026-12-15T00:00:00Z'),
        label: 'Diciembre Q1',
      };
      prismaMock.paymentGroupPeriod.findUnique.mockResolvedValueOnce(period);
      prismaMock.accrualBatch.findFirst.mockResolvedValueOnce(null);
      prismaMock.paymentGroupPeriod.delete.mockResolvedValueOnce(period);

      // Act
      const result = await service.removePeriod('pg-1', 'per-1', adminActor);

      // Assert
      expect(result).toEqual({ deleted: true, id: 'per-1' });
      expect(prismaMock.paymentGroupPeriod.delete).toHaveBeenCalledWith({
        where: { id: 'per-1' },
      });
      expect(auditMock.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_PAYMENT_GROUP_PERIOD',
          recordId: 'per-1',
          newValues: null,
        }),
      );
    });

    it('debe lanzar NotFoundException si el período no existe o pertenece a otro grupo (Edge Case)', async () => {
      // Arrange (No existe)
      prismaMock.paymentGroupPeriod.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.removePeriod('pg-1', 'no-existe', adminActor),
      ).rejects.toThrow(NotFoundException);

      // Arrange (Otro grupo)
      prismaMock.paymentGroupPeriod.findUnique.mockResolvedValueOnce({
        id: 'per-2',
        paymentGroupId: 'pg-otro',
      });

      await expect(
        service.removePeriod('pg-1', 'per-2', adminActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar ConflictException si el período ya tiene un lote de causación asociado (Violación RN-CAT-03)', async () => {
      // Arrange
      prismaMock.paymentGroupPeriod.findUnique.mockResolvedValueOnce({
        id: 'per-1',
        paymentGroupId: 'pg-1',
        periodStart: new Date('2026-11-01T00:00:00Z'),
        periodEnd: new Date('2026-11-15T00:00:00Z'),
        label: 'Nov Q1',
      });
      prismaMock.accrualBatch.findFirst.mockResolvedValueOnce({
        id: 'batch-1',
      });

      // Act & Assert
      await expect(
        service.removePeriod('pg-1', 'per-1', adminActor),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.paymentGroupPeriod.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAllPaymentGroups', () => {
    it('debe retornar únicamente los grupos activos por defecto (Happy Path)', async () => {
      // Arrange
      prismaMock.paymentGroup.findMany.mockResolvedValueOnce([{ id: 'pg-1' }]);

      // Act
      const list = await service.findAllPaymentGroups();

      // Assert
      expect(list).toHaveLength(1);
      expect(prismaMock.paymentGroup.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('debe retornar todos los grupos (activos e inactivos) cuando onlyActive es false (Edge Case)', async () => {
      // Arrange
      prismaMock.paymentGroup.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllPaymentGroups(false);

      // Assert
      expect(prismaMock.paymentGroup.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });

    it('debe retornar lista vacía si aún no hay grupos configurados (Caso Vacío)', async () => {
      // Arrange
      prismaMock.paymentGroup.findMany.mockResolvedValueOnce([]);

      // Act
      const result = await service.findAllPaymentGroups(true);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
