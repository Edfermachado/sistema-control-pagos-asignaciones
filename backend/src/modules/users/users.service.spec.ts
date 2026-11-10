import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from './users.service';

describe('UsersService (RN-SEG-02 Gestión de Usuarios por ADMIN)', () => {
  let service: UsersService;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditMock: { recordLog: jest.Mock };

  const adminActor: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@uc.edu.ve',
    fullName: 'Administrador Principal',
    role: UserRole.ADMIN,
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'log-1' }),
    };
    service = new UsersService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('createUser', () => {
    it('debe crear un usuario normalizando su email y registrando auditoría (Happy Path)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'u-gen-1',
        email: 'coordinador@uc.edu.ve',
        fullName: 'Coordinador Física',
        role: UserRole.GENERADOR,
        isActive: true,
        createdAt: new Date(),
      });

      // Act
      const created = await service.createUser(
        {
          email: '  Coordinador@UC.edu.ve ',
          fullName: 'Coordinador Física',
          password: 'Password2026!',
          role: UserRole.GENERADOR,
        },
        adminActor,
      );

      // Assert
      expect(created.email).toBe('coordinador@uc.edu.ve');
      expect(created.role).toBe(UserRole.GENERADOR);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe recortar espacios en blanco del nombre completo (Edge Case)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'u-2', ...data }),
      );

      // Act
      const created = await service.createUser(
        {
          email: 'receptor@uc.edu.ve',
          fullName: '  Gerente Administración  ',
          password: 'Password2026!',
          role: UserRole.RECEPTOR,
        },
        adminActor,
      );

      // Assert
      expect(created.fullName).toBe('Gerente Administración');
    });

    it('debe lanzar ConflictException si el correo electrónico ya existe (Violación RN-SEG-02)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'existente' });

      // Act & Assert
      await expect(
        service.createUser(
          {
            email: 'admin@uc.edu.ve',
            fullName: 'Duplicado',
            password: 'Password2026!',
            role: UserRole.ADMIN,
          },
          adminActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllUsers', () => {
    it('debe listar todos los usuarios sin filtro cuando no se pasa rol (Happy Path)', async () => {
      // Arrange
      prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'u-1' }, { id: 'u-2' }]);

      // Act
      const list = await service.findAllUsers();

      // Assert
      expect(list).toHaveLength(2);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('debe filtrar por rol específico cuando se suministra roleFilter (Edge Case)', async () => {
      // Arrange
      prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'u-gen' }]);

      // Act
      await service.findAllUsers(UserRole.GENERADOR);

      // Assert
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: UserRole.GENERADOR } }),
      );
    });

    it('debe retornar arreglo vacío si no existen usuarios para ese filtro (Caso Vacío)', async () => {
      // Arrange
      prismaMock.user.findMany.mockResolvedValueOnce([]);

      // Act
      const list = await service.findAllUsers(UserRole.RECEPTOR);

      // Assert
      expect(list).toEqual([]);
    });
  });

  describe('toggleUserActiveStatus', () => {
    it('debe actualizar el estado isActive de otro usuario y auditar el cambio (Happy Path)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u-target',
        isActive: true,
      });
      prismaMock.user.update.mockResolvedValueOnce({
        id: 'u-target',
        email: 'coord@uc.edu.ve',
        fullName: 'Coordinador',
        role: UserRole.GENERADOR,
        isActive: false,
      });

      // Act
      const result = await service.toggleUserActiveStatus(
        'u-target',
        false,
        adminActor,
      );

      // Assert
      expect(result.isActive).toBe(false);
      expect(auditMock.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_USER_STATUS',
          oldValues: { isActive: true },
          newValues: { isActive: false },
        }),
      );
    });

    it('debe lanzar NotFoundException si el usuario objetivo no existe (Edge Case)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.toggleUserActiveStatus('no-existe', false, adminActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el ADMIN intenta desactivarse a sí mismo (Violación RN-SEG-02)', async () => {
      // Arrange & Act & Assert
      await expect(
        service.toggleUserActiveStatus(adminActor.id, false, adminActor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
