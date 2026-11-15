import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ParametersService } from './parameters.service';

describe('ParametersService (RF 2.1 Parámetros Globales del Sistema)', () => {
  let service: ParametersService;
  let prismaMock: {
    systemParameter: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
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
      systemParameter: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new ParametersService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('findAll', () => {
    it('debe listar los parámetros ordenados por clave (Happy Path)', async () => {
      // Arrange
      prismaMock.systemParameter.findMany.mockResolvedValueOnce([
        { id: 'p-1', key: 'MAX_UPLOAD_SIZE_MB', value: '5' },
      ]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(1);
      expect(prismaMock.systemParameter.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('debe crear un parámetro normalizando la clave a mayúsculas y auditar (Happy Path)', async () => {
      // Arrange
      prismaMock.systemParameter.findUnique.mockResolvedValueOnce(null);
      prismaMock.systemParameter.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'p-1', ...data }),
      );

      // Act
      const created = await service.create(
        {
          key: 'max_upload_size_mb',
          value: ' 10 ',
          description: ' Tamaño máximo de archivo ',
        },
        adminActor,
      );

      // Assert
      expect(created.key).toBe('MAX_UPLOAD_SIZE_MB');
      expect(created.value).toBe('10');
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ConflictException si la clave ya existe (Edge Case)', async () => {
      // Arrange
      prismaMock.systemParameter.findUnique.mockResolvedValueOnce({
        id: 'p-1',
        key: 'MAX_UPLOAD_SIZE_MB',
      });

      // Act & Assert
      await expect(
        service.create(
          {
            key: 'max_upload_size_mb',
            value: '10',
            description: 'Duplicado',
          },
          adminActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('debe actualizar valor y descripción registrando valores anteriores y nuevos (Happy Path)', async () => {
      // Arrange
      prismaMock.systemParameter.findUnique.mockResolvedValueOnce({
        id: 'p-1',
        key: 'MAX_UPLOAD_SIZE_MB',
        value: '5',
        description: 'Tamaño máximo',
      });
      prismaMock.systemParameter.update.mockResolvedValueOnce({
        id: 'p-1',
        key: 'MAX_UPLOAD_SIZE_MB',
        value: '10',
        description: 'Tamaño máximo actualizado',
      });

      // Act
      const updated = await service.update(
        'p-1',
        { value: '10', description: 'Tamaño máximo actualizado' },
        adminActor,
      );

      // Assert
      expect(updated.value).toBe('10');
      expect(auditMock.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_SYSTEM_PARAMETER',
          oldValues: { value: '5', description: 'Tamaño máximo' },
        }),
      );
    });

    it('debe lanzar NotFoundException si el parámetro no existe (Edge Case)', async () => {
      // Arrange
      prismaMock.systemParameter.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.update('no-existe', { value: '10' }, adminActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debe eliminar un parámetro y auditar su valor previo (Happy Path)', async () => {
      // Arrange
      prismaMock.systemParameter.findUnique.mockResolvedValueOnce({
        id: 'p-1',
        key: 'MAX_UPLOAD_SIZE_MB',
        value: '5',
        description: 'Tamaño máximo',
      });
      prismaMock.systemParameter.delete.mockResolvedValueOnce({ id: 'p-1' });

      // Act
      const result = await service.remove('p-1', adminActor);

      // Assert
      expect(result.deleted).toBe(true);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar NotFoundException al eliminar un parámetro inexistente (Edge Case)', async () => {
      // Arrange
      prismaMock.systemParameter.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.remove('no-existe', adminActor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
