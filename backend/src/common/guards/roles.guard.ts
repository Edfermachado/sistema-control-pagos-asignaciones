import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../constants/domain.enums';
import { RequestWithUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Hace cumplir la matriz de Segregación de Funciones (RN-SEG-02).
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      const currentRole = user?.role ?? 'SIN_ROL';
      throw new ForbiddenException(
        `[RN-SEG-02] Segregación de funciones: el rol '${currentRole}' no está autorizado. Se requiere: ${requiredRoles.join(', ')}.`,
      );
    }

    return true;
  }
}
