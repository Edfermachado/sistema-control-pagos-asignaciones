import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../constants/domain.enums';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard (RN-SEG-02 Segregación de Funciones)', () => {
  let guard: RolesGuard;
  let reflectorMock: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflectorMock = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflectorMock as unknown as Reflector);
  });

  function buildContext(user?: AuthenticatedUser): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('debe permitir el acceso cuando el rol del usuario coincide con los roles requeridos (Happy Path)', () => {
    // Arrange
    reflectorMock.getAllAndOverride.mockReturnValueOnce([UserRole.GENERADOR]);
    const ctx = buildContext({
      id: 'u-1',
      email: 'coord@uc.edu.ve',
      fullName: 'Coordinador',
      role: UserRole.GENERADOR,
    });

    // Act
    const result = guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
  });

  it('debe permitir el acceso si la ruta no especifica metadatos de roles (Edge Case)', () => {
    // Arrange
    reflectorMock.getAllAndOverride.mockReturnValueOnce(undefined);
    const ctx = buildContext(undefined);

    // Act
    const result = guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
  });

  it('debe lanzar ForbiddenException citando [RN-SEG-02] si ADMIN intenta ejecutar operaciones de dinero de GENERADOR o RECEPTOR (Violación RN-SEG-02)', () => {
    // Arrange
    reflectorMock.getAllAndOverride.mockReturnValueOnce([
      UserRole.GENERADOR,
      UserRole.RECEPTOR,
    ]);
    const ctx = buildContext({
      id: 'u-admin',
      email: 'admin@uc.edu.ve',
      fullName: 'Admin',
      role: UserRole.ADMIN,
    });

    // Act & Assert
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
