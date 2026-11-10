import { BadRequestException, ConflictException } from '@nestjs/common';
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
    };
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
      },
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
