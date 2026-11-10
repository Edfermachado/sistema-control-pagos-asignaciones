import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService (RN-AUD-03 Trazabilidad Completa Append-Only)', () => {
  let service: AuditService;
  let prismaMock: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new AuditService(prismaMock as unknown as PrismaService);
  });

  describe('recordLog', () => {
    it('debe insertar un registro de auditoría con oldValues y newValues (Happy Path)', async () => {
      // Arrange
      const input = {
        userId: 'u-1',
        userRole: UserRole.GENERADOR,
        action: 'CREATE_PROJECT',
        tableName: 'projects',
        recordId: 'proj-1',
        oldValues: null,
        newValues: { code: 'FIS-001', name: 'Óptica Cuántica' },
      };
      prismaMock.auditLog.create.mockResolvedValueOnce({ id: 'log-1', ...input });

      // Act
      const created = await service.recordLog(input);

      // Assert
      expect(created.id).toBe('log-1');
      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('debe permitir usar un cliente transaccional explícito (tx) cuando se provee (Edge Case)', async () => {
      // Arrange
      const txMock = {
        auditLog: {
          create: jest.fn().mockResolvedValueOnce({ id: 'log-tx' }),
        },
      };

      // Act
      const created = await service.recordLog(
        {
          action: 'UPDATE_STATUS',
          tableName: 'payment_requests',
          recordId: 'req-1',
        },
        txMock as never,
      );

      // Assert
      expect(created.id).toBe('log-tx');
      expect(txMock.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si falta action, tableName o recordId (Violación RN-AUD-03)', async () => {
      // Arrange & Act & Assert
      await expect(
        service.recordLog({
          action: '',
          tableName: 'projects',
          recordId: 'proj-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllLogs', () => {
    it('debe consultar los logs filtrando por tabla y ordenando descendentemente (Happy Path)', async () => {
      // Arrange
      prismaMock.auditLog.findMany.mockResolvedValueOnce([{ id: 'log-1' }]);

      // Act
      const logs = await service.findAllLogs({ tableName: 'projects', limit: 50 });

      // Assert
      expect(logs).toHaveLength(1);
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
        where: { tableName: 'projects' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('debe aplicar el límite por defecto de 100 registros cuando no se especifica (Edge Case)', async () => {
      // Arrange
      prismaMock.auditLog.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllLogs();

      // Assert
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('debe lanzar BadRequestException si el límite es menor a 1 o mayor a 500 (Violación RN-AUD-03)', async () => {
      // Arrange & Act & Assert
      await expect(service.findAllLogs({ limit: 0 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAllLogs({ limit: 999 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
