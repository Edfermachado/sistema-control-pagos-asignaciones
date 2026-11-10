import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../constants/domain.enums';
import { RequestWithUser } from '../decorators/current-user.decorator';
import { signJwtToken } from '../security/crypto.helper';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test_secret_guard_2026';
    guard = new JwtAuthGuard();
  });

  function createMockContext(authHeader?: string): {
    context: ExecutionContext;
    request: RequestWithUser;
  } {
    const request: RequestWithUser = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it('debe autenticar un token Bearer válido y adjuntar request.user (Happy Path)', () => {
    // Arrange
    const token = signJwtToken(
      {
        sub: 'uuid-admin',
        email: 'admin@uc.edu.ve',
        fullName: 'Admin Sistema',
        role: UserRole.ADMIN,
      },
      'test_secret_guard_2026',
    );
    const { context, request } = createMockContext(`Bearer ${token}`);

    // Act
    const canActivate = guard.canActivate(context);

    // Assert
    expect(canActivate).toBe(true);
    expect(request.user).toEqual({
      id: 'uuid-admin',
      email: 'admin@uc.edu.ve',
      fullName: 'Admin Sistema',
      role: UserRole.ADMIN,
    });
  });

  it('debe lanzar UnauthorizedException si el encabezado no tiene prefijo Bearer (Edge Case)', () => {
    // Arrange
    const { context } = createMockContext('Basic dXNlcjpwYXNz');

    // Act & Assert
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException cuando no se envía encabezado Authorization (Caso de Error)', () => {
    // Arrange
    const { context } = createMockContext(undefined);

    // Act & Assert
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
