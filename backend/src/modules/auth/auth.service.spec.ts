import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import { hashPassword } from '../../common/security/crypto.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

describe('AuthService (RN-SEG-02 Autenticación y Segregación de Roles)', () => {
  let service: AuthService;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
    };
  };
  let auditMock: {
    recordLog: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new AuthService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('login', () => {
    it('debe retornar accessToken y datos del usuario cuando las credenciales son válidas (Happy Path)', async () => {
      // Arrange
      const validHash = hashPassword('ClaveSegura2026');
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        email: 'coordinador@uc.edu.ve',
        fullName: 'Coordinador General',
        passwordHash: validHash,
        role: UserRole.GENERADOR,
        isActive: true,
      });

      // Act
      const result = await service.login({
        email: '  COORDINADOR@uc.edu.ve ',
        password: 'ClaveSegura2026',
      });

      // Assert
      expect(result.accessToken).toBeDefined();
      expect(result.user.role).toBe(UserRole.GENERADOR);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ForbiddenException si el usuario existe pero está inactivo (Edge Case)', async () => {
      // Arrange
      const validHash = hashPassword('ClaveSegura2026');
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u-inactivo',
        email: 'inactivo@uc.edu.ve',
        fullName: 'Usuario Inactivo',
        passwordHash: validHash,
        role: UserRole.RECEPTOR,
        isActive: false,
      });

      // Act & Assert
      await expect(
        service.login({
          email: 'inactivo@uc.edu.ve',
          password: 'ClaveSegura2026',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar UnauthorizedException si la contraseña o el correo son incorrectos (Caso de Error)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.login({
          email: 'noexiste@uc.edu.ve',
          password: 'ClaveIncorrecta123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('debe retornar el perfil del usuario sin exponer passwordHash (Happy Path)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        email: 'admin@uc.edu.ve',
        fullName: 'Administrador UC',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date('2026-11-01T00:00:00Z'),
      });

      // Act
      const profile = await service.getProfile('u-1');

      // Assert
      expect(profile.email).toBe('admin@uc.edu.ve');
      expect((profile as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('debe consultar exactamente por el ID suministrado (Edge Case)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u-receptor',
        email: 'gerente@uc.edu.ve',
        fullName: 'Gerente Admin',
        role: UserRole.RECEPTOR,
        isActive: true,
        createdAt: new Date(),
      });

      // Act
      await service.getProfile('u-receptor');

      // Assert
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u-receptor' } }),
      );
    });

    it('debe lanzar NotFoundException cuando el ID de usuario no existe (Caso de Error)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.getProfile('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
